#!/usr/bin/env python3
"""Audit an Eva APK against the source tree and its declared runtime digests."""
import argparse
import hashlib
from pathlib import Path, PurePosixPath
import re
import tarfile
import zipfile
import tempfile
import shutil

if __package__:
    from .stage_runtime import portrait_replacements, runtime_files
else:
    from stage_runtime import portrait_replacements, runtime_files

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = re.compile(
    r"(?:^|/)(?:\.git|\.ssh|\.android|\.env[^/]*|auth\.json|config\.toml|"
    r"town-chat\.json|work-thread\.json|thread\.json|providers\.json|voice-settings\.json|"
    r"notes\.json|tasks\.json|drafts\.json|server-port\.json|\.adb-device\.json|"
    r"sessions|chat-backups|credentials?\.json|operations\.json|android-build\.json|current-url)(?:/|$)|\.(?:jks|keystore|p12|pem|jsonl)$", re.I
)


def clean_path(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or PRIVATE.search(path.as_posix()):
        raise ValueError(f"Unexpected private or unsafe archive entry: {path}")
    return path.as_posix()


def audit_runtime(apk, asset, expected):
    with apk.open(asset) as content:
        if hashlib.file_digest(content, "sha256").hexdigest() != expected:
            raise ValueError(f"Digest mismatch: {asset}")
    application = asset.endswith("/eva-runtime.pack")
    wanted = {name: source for source, name in runtime_files()} if application else {}
    seen = set()
    with apk.open(asset) as content, tarfile.open(fileobj=content, mode="r|gz") as entries:
        for member in entries:
            name = clean_path(member.name)
            if not application:
                if name.startswith(("root/", "home/", "sdcard/", "data/")):
                    raise ValueError(f"Private directory in the Linux image: {name}")
                continue
            if member.isdir():
                continue
            if not member.isfile() or name in seen or name not in wanted:
                raise ValueError(f"Unexpected application entry: {name}")
            seen.add(name)
            if entries.extractfile(member).read() != wanted[name].read_bytes():
                raise ValueError(f"Runtime entry differs from source: {name}")
    if application and seen != wanted.keys():
        raise ValueError(f"Missing application file: {min(wanted.keys() - seen)}")


def audit_assets(apk):
    source_dir = ROOT / "app/src/main/assets"
    wanted = {"assets/" + p.relative_to(source_dir).as_posix(): p
              for p in source_dir.rglob("*") if p.is_file() and not p.is_symlink()}
    root = ROOT / "runtime/codex-mobile"
    wanted.update({"assets/eva-questions.js": root / "question-options.js",
                   "assets/eva-icons.js": root / "ui-icons.js"})
    replacements = "assets/eva-replaced-portraits.tsv"
    if apk.read(replacements) != portrait_replacements():
        raise ValueError("Portrait upgrade list differs from source")
    packs = {"assets/eva-runtime.version", "assets/rootfs.pack", "assets/eva-runtime.pack", "assets/vosk-ru-small.zip", replacements}
    files = {info.filename for info in apk.infolist() if info.filename.startswith("assets/") and not info.is_dir()}
    difference = files ^ (wanted.keys() | packs)
    if difference:
        raise ValueError(f"Unexpected or missing Android asset: {min(difference)}")
    for name, source in wanted.items():
        with apk.open(name) as packaged, source.open("rb") as original:
            if hashlib.file_digest(packaged, "sha256").digest() != hashlib.file_digest(original, "sha256").digest():
                raise ValueError(f"Android asset differs from source: {name}")


def audit_voice_model(apk):
    # Android extracts this nested ZIP into the wake detector's private model directory.
    with tempfile.TemporaryFile() as buffer, apk.open("assets/vosk-ru-small.zip") as stream:
        shutil.copyfileobj(stream, buffer, 1 << 20)
        buffer.seek(0)
        with zipfile.ZipFile(buffer) as model:
            entries = model.infolist()
            names = set()
            size = 0
            for entry in entries:
                name = clean_path(entry.filename)
                parts = PurePosixPath(name).parts
                if not parts or parts[0] != "vosk-model-small-ru-0.22" or name in names:
                    raise ValueError("Unexpected speech model entry: " + name)
                if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError("Unexpected symbolic link in the speech model")
                names.add(name)
                size += entry.file_size
            if size > 200 * 1024 ** 2 or "vosk-model-small-ru-0.22/am/final.mdl" not in names:
                raise ValueError("Incomplete or oversized speech model")


def audit(path):
    with zipfile.ZipFile(path) as apk:
        if len(set(apk.namelist())) != len(apk.namelist()):
            raise ValueError("Duplicate APK entries")
        audit_assets(apk)
        audit_voice_model(apk)
        for name in apk.namelist():
            clean_path(name)
        base, runtime = apk.read("assets/eva-runtime.version").decode("ascii").splitlines()
        for asset, digest in (("assets/rootfs.pack", base), ("assets/eva-runtime.pack", runtime)):
            if not re.fullmatch(r"[0-9a-f]{64}", digest):
                raise ValueError(f"Missing pack digest: {asset}")
            audit_runtime(apk, asset, digest)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    args = parser.parse_args()
    audit(args.apk)
    print("Runtime digests, complete application assets, source contents and private-path checks passed.")
