#!/usr/bin/env python3
"""Create a real minimal Android APK and disposable key, then verify a byte-exact detached round trip."""
import argparse
import base64
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
from types import SimpleNamespace

from release import digest, insert_block, local_block, metadata, unsigned_check, verify_signature, version, zip_sections


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--android-jar", required=True, type=Path)
    ap.add_argument("--aapt2", required=True, type=Path)
    ap.add_argument("--apksigner-jar", required=True, type=Path)
    ap.add_argument("--java", default="java")
    ap.add_argument("--keytool", default="keytool")
    args = ap.parse_args()
    with tempfile.TemporaryDirectory() as folder:
        work = Path(folder)
        source = work / "AndroidManifest.xml"
        source.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android" '
                          'package="org.evaassistant.app" android:versionCode="1" android:versionName="1">'
                          '<uses-sdk android:minSdkVersion="26" android:targetSdkVersion="29"/>'
                          '<application android:hasCode="false" android:label="Local release test"/></manifest>')
        apk = work / "candidate.apk"
        subprocess.run([args.aapt2, "link", "--manifest", source, "-I", args.android_jar, "-o", apk], check=True)
        unsigned_check(apk)
        store, password, cert = work / "throwaway.p12", work / "password", work / "public.der"
        password.write_text("ephemeral-example-only\n")
        options = ["-alias", "fixture", "-keystore", store, "-storepass:file", password]
        subprocess.run([args.keytool, "-genkeypair", *options, "-keyalg", "RSA", "-keysize", "2048",
                        "-validity", "2", "-dname", "CN=Disposable local release test"], check=True)
        subprocess.run([args.keytool, "-exportcert", *options, "-file", cert], check=True)
        config = SimpleNamespace(**vars(args), keystore=store, password_file=password, key_password_file=None, alias="")
        pin = digest(cert)
        pad, block = local_block(apk, work / "signature", config, pin)
        first, second = work / "signed.apk", work / "restored.apk"
        candidate_sha = insert_block(apk, first, pad, block)
        assert candidate_sha == digest(apk)
        verify_signature(first, args, pin)
        # Only these public fields survive transfer to a fresh process with no key or password.
        receipt = metadata({"schema": 1, "version": version(), "candidate_tag": "candidate-" + version(),
                            "source_commit": "1" * 40, "run_id": 7, "run_attempt": 1,
                            "unsigned_sha256": candidate_sha, "signed_sha256": digest(first),
                            "padding": pad, "certificate_sha256": pin, "signing_block": base64.b64encode(block).decode()}, True)
        store.unlink()
        password.unlink()
        assert insert_block(apk, second, receipt["padding"], base64.b64decode(receipt["signing_block"])) == candidate_sha
        assert second.read_bytes() == first.read_bytes() and digest(second) == receipt["signed_sha256"]
        verify_signature(second, args, pin)
        # Independently reconstruct the original ZIP by taking the actual signed sections apart.
        with first.open("rb") as signed, apk.open("rb") as original:
            signed_cd, signed_end, signed_eocd = zip_sections(signed)
            old_cd, old_end, old_eocd = zip_sections(original)
            signed.seek(0)
            old_bytes = signed.read(old_cd)
            assert signed.read(pad) == bytes(pad) and signed.read(len(block)) == block
            assert signed.tell() == signed_cd and signed_end - signed_cd == old_end - old_cd
            assert old_eocd == signed_eocd[:16] + struct.pack("<I", old_cd) + signed_eocd[20:]
            assert old_bytes + signed.read(signed_end-signed_cd) + old_eocd == apk.read_bytes()
        tampered = work / "tampered.apk"
        shutil.copyfile(second, tampered)
        with tampered.open("r+b") as output:
            output.seek(50)
            byte = output.read(1)
            output.seek(50)
            output.write(bytes([byte[0] ^ 1]))
        result = subprocess.run([args.java, "-jar", str(args.apksigner_jar), "verify", str(tampered)], capture_output=True)
        assert result.returncode != 0
        print(f"SDK verifies v2/v3, rejects modified APK; {first.stat().st_size} signed bytes restored exactly.")


if __name__ == "__main__":
    main()
