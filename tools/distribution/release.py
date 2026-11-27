#!/usr/bin/env python3
"""Prepare a candidate, sign locally, or restore a public Android v2/v3 signature."""
import argparse
import base64
import binascii
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PIN = HERE / "signer.sha256"
UNSIGNED = "Eva-unsigned.apk"
CANDIDATE = "candidate.json"
MAGIC = b"APK Sig Block 42"
MAX_BLOCK = 128 * 1024
V2, V3, VERITY_PADDING = 0x7109871a, 0xf05368c0, 0x42726577
FIELDS = {"schema", "version", "candidate_tag", "source_commit", "run_id", "run_attempt", "unsigned_sha256"}
SIGNATURE = {"certificate_sha256", "signed_sha256", "padding", "signing_block"}


def digest(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def sha(value, digits=64):
    if not isinstance(value, str) or not re.fullmatch(rf"[a-f0-9]{{{digits}}}", value):
        raise ValueError("Invalid SHA digest in release metadata")
    return value


def version():
    return re.search(r"^\s*versionName\s+'([0-9]+(?:\.[0-9]+){1,3})'\s*$",
                     (ROOT / "app/build.gradle").read_text(), re.M)[1]


def metadata(data, signed=False):
    if not isinstance(data, dict) or data.keys() != (FIELDS | SIGNATURE if signed else FIELDS):
        raise ValueError("Unexpected release receipt fields")
    if type(data["schema"]) is not int or data["schema"] != 1 or data["version"] != version():
        raise ValueError("Receipt schema or application version differs from checkout")
    tag = r"candidate-" + re.escape(data["version"]) + r"(?:-[A-Za-z0-9][A-Za-z0-9.-]{0,40})?"
    if not isinstance(data["candidate_tag"], str) or not re.fullmatch(tag, data["candidate_tag"]):
        raise ValueError("Candidate tag does not identify this version")
    for field in ("run_id", "run_attempt"):
        if type(data[field]) is not int or not 0 < data[field] < 2**63:
            raise ValueError("Invalid candidate run ID or attempt")
    sha(data["source_commit"], 40)
    sha(data["unsigned_sha256"])
    if signed:
        sha(data["certificate_sha256"])
        sha(data["signed_sha256"])
        if type(data["padding"]) is not int or not 0 <= data["padding"] < 4096:
            raise ValueError("Invalid pre-signature alignment")
        if not isinstance(data["signing_block"], str) or len(data["signing_block"]) > MAX_BLOCK * 2:
            raise ValueError("Oversized signature")
        validate_block(base64.b64decode(data["signing_block"], validate=True))
    return data


def load(path, signed=False):
    if path.stat().st_size > MAX_BLOCK * 2:
        raise ValueError("Oversized release receipt")
    return metadata(json.loads(path.read_text()), signed)


def write_metadata(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = (json.dumps(data, indent=2, sort_keys=True) + "\n").encode()
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        fcntl.flock(directory, fcntl.LOCK_EX)
        if path.exists():
            if path.read_bytes() != content:
                raise ValueError(f"Different receipt already exists: {path}")
            return
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as file:
            temp = Path(file.name)
            file.write(content)
        try:
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)
    finally:
        os.close(directory)


def zip_sections(source):
    """Read ordinary single-disk ZIP. Android APK signature schemes do not support ZIP64."""
    size = source.seek(0, 2)
    window = min(size, 65535 + 22)
    source.seek(size - window)
    end = source.read(window)
    index = len(end)
    while (index := end.rfind(b"PK\x05\x06", 0, index)) >= 0:
        if len(end) - index < 22:
            continue
        disk, cd_disk, entries, total, length, offset, comment = struct.unpack_from("<4H2IH", end, index + 4)
        if index + 22 + comment != len(end):
            continue
        eocd = size - window + index
        if disk or cd_disk or not entries or entries != total or total == 0xffff or offset + length != eocd:
            raise ValueError("Invalid or unsupported APK central directory")
        source.seek(offset)
        if source.read(4) != b"PK\x01\x02":
            raise ValueError("Invalid central directory signature")
        return offset, eocd, end[index:]
    raise ValueError("No APK ZIP end record")


def unsigned_check(apk):
    with apk.open("rb") as source:
        central, _, _ = zip_sections(source)
        if central >= 24:
            source.seek(central - 16)
            if source.read(16) == MAGIC:
                raise ValueError("Candidate already contains an APK signing block")
    with zipfile.ZipFile(apk) as archive:
        if "AndroidManifest.xml" not in archive.namelist() or any(
            re.fullmatch(r"META-INF/[^/]+\.(?:RSA|DSA|EC|SF)", name, re.I) for name in archive.namelist()
        ):
            raise ValueError("Candidate lacks an Android manifest or contains a JAR signature")


def validate_block(block):
    length = len(block)
    if not 32 < length <= MAX_BLOCK or block[-16:] != MAGIC or any(
        struct.unpack_from("<Q", block, i)[0] != length - 8 for i in (0, length - 24)
    ):
        raise ValueError("Invalid APK signing block")
    pos, stop, found = 8, length - 24, set()
    while pos < stop:
        if pos + 12 > stop:
            raise ValueError("Truncated APK signature pair")
        size, key = struct.unpack_from("<QI", block, pos)
        if size < 4 or pos + 8 + size > stop or key in found or key not in (V2, V3, VERITY_PADDING):
            raise ValueError("Unexpected or incomplete public signing record")
        if key == VERITY_PADDING and any(block[pos + 12:pos + 8 + size]):
            raise ValueError("Unexpected signing padding bytes")
        found.add(key)
        pos += 8 + size
    if not {V2, V3} <= found:
        raise ValueError("Both v2 and v3 signatures are required")


def copy_span(source, output, remaining, checksum):
    while remaining:
        block = source.read(min(1024 * 1024, remaining))
        if not block:
            raise ValueError("Candidate truncated during read")
        checksum.update(block)
        output.write(block)
        remaining -= len(block)


def insert_block(unsigned, target, padding, block):
    validate_block(block)
    if not 0 <= padding < 4096:
        raise ValueError("Invalid signing alignment")
    with unsigned.open("rb") as source, target.open("wb") as out:
        checksum = hashlib.sha256()
        central, end, eocd = zip_sections(source)
        offset = central + padding + len(block)
        if offset >= 0xffffffff:
            raise ValueError("Signed APK would require ZIP64")
        source.seek(0)
        copy_span(source, out, central, checksum)
        out.write(bytes(padding))
        out.write(block)
        copy_span(source, out, end - central, checksum)
        out.write(eocd[:16] + struct.pack("<I", offset) + eocd[20:])
        checksum.update(eocd)
        return checksum.hexdigest()


def verify_signature(apk, args, pin):
    command = [args.java, "-jar", str(args.apksigner_jar), "verify", "--verbose", "--print-certs",
               "--min-sdk-version", "26", str(apk)]
    output = subprocess.check_output(command, text=True)
    for number, expected in ((1, "false"), (2, "true"), (3, "true")):
        if not re.search(rf"^Verified using v{number} scheme [^\n]*: {expected}$", output, re.M):
            raise ValueError(f"Unexpected signature verification result for v{number}")
    found = re.findall(r"^Signer #\d+ certificate SHA-256 digest: ([A-Fa-f0-9]{64})$", output, re.M)
    if [fingerprint.lower() for fingerprint in found] != [pin]:
        raise ValueError("APK signing certificate differs from the pinned public certificate")


def audit(apk):
    for command in ([sys.executable, ROOT / "tools/audit_apk.py", apk],
                    [sys.executable, ROOT / "tools/native_provenance.py", "verify", apk]):
        subprocess.run(command, check=True)


def local_block(unsigned, target, args, pin):
    subprocess.run([args.java, "--class-path", str(args.apksigner_jar), str(HERE / "PublicApkSignature.java"),
                    str(unsigned), str(target), str(args.keystore), str(args.password_file),
                    str(args.key_password_file or args.password_file), args.alias, pin], check=True)
    data = target.read_bytes()
    return int.from_bytes(data[:4], "big"), data[4:]


def checked_candidate(folder):
    candidate = load(folder / CANDIDATE)
    apk = folder / UNSIGNED
    if digest(apk) != candidate["unsigned_sha256"]:
        raise ValueError("Candidate SHA-256 differs from its build receipt")
    unsigned_check(apk)
    return candidate, apk


def sign_or_restore(args):
    candidate, unsigned = checked_candidate(args.candidate)
    pin = sha(args.pin.read_text().strip())
    receipt = args.receipt or HERE / "receipts" / ("v" + version() + ".json")
    if args.command == "restore" or receipt.exists():
        record = load(receipt, signed=True)
        if any(record[k] != candidate[k] for k in FIELDS) or record["certificate_sha256"] != pin:
            raise ValueError("Signature belongs to another candidate or signer")
    else:
        record = None
    if args.command == "sign":
        audit(unsigned)
    output = args.output
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        if output.resolve() == unsigned.resolve():
            raise ValueError("Signed and unsigned APK paths must differ")
    with tempfile.TemporaryDirectory(dir=output.parent if output else None) as work:
        scratch = Path(work)
        if record is None:
            padding, block = local_block(unsigned, scratch / "signature", args, pin)
        else:
            padding, block = record["padding"], base64.b64decode(record["signing_block"], validate=True)
        result = scratch / "signed.apk"
        if insert_block(unsigned, result, padding, block) != candidate["unsigned_sha256"]:
            raise ValueError("Candidate changed during signing")
        signed_hash = digest(result)
        if record and record["signed_sha256"] != signed_hash:
            raise ValueError("Restored signed-file SHA-256 differs from the original local signature")
        verify_signature(result, args, pin)
        if args.command == "restore":
            audit(result)
        if output and output.exists() and digest(output) != signed_hash:
            raise ValueError("Output already exists with different content")
        if record is None:
            record = metadata({**candidate, "certificate_sha256": pin, "signed_sha256": signed_hash,
                               "padding": padding, "signing_block": base64.b64encode(block).decode("ascii")}, True)
            write_metadata(receipt, record)
        if output and not output.exists():
            os.replace(result, output)
    print(f"Verified signed APK {signed_hash}, public certificate {pin}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    prepare = commands.add_parser("candidate")
    prepare.add_argument("directory", type=Path)
    prepare.add_argument("--tag", required=True)
    prepare.add_argument("--commit", required=True)
    prepare.add_argument("--run-id", required=True, type=int)
    prepare.add_argument("--attempt", required=True, type=int)
    for action in ("sign", "restore"):
        part = commands.add_parser(action)
        part.add_argument("candidate", type=Path)
        part.add_argument("--apksigner-jar", type=Path, required=True)
        part.add_argument("--java", default="java")
        part.add_argument("--receipt", type=Path)
        part.add_argument("--pin", type=Path, default=PIN)
        part.add_argument("--output", type=Path, required=action == "restore")
        if action == "sign":
            part.add_argument("--keystore", type=Path, required=True)
            part.add_argument("--password-file", type=Path, required=True)
            part.add_argument("--key-password-file", type=Path)
            part.add_argument("--alias", default="")
    info = commands.add_parser("info")
    info.add_argument("--tag", required=True)
    args = parser.parse_args()
    if args.command == "candidate":
        apk = args.directory / UNSIGNED
        unsigned_check(apk)
        candidate = metadata({"schema": 1, "version": version(), "candidate_tag": args.tag, "source_commit": args.commit,
                              "run_id": args.run_id, "run_attempt": args.attempt, "unsigned_sha256": digest(apk)})
        write_metadata(args.directory / CANDIDATE, candidate)
    elif args.command == "info":
        if args.tag != "v" + version():
            raise ValueError("Release tag does not match app/build.gradle")
        receipt = load(HERE / "receipts" / (args.tag + ".json"), True)
        if receipt["certificate_sha256"] != sha(PIN.read_text().strip()):
            raise ValueError("Wrong pinned signer in receipt")
        for key in ("run_id", "run_attempt", "source_commit", "candidate_tag", "unsigned_sha256", "signed_sha256"):
            print(f"{key}={receipt[key]}")
    else:
        sign_or_restore(args)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, binascii.Error, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
