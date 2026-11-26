#!/usr/bin/env python3
"""Audit an Eva APK against the source tree and its declared runtime digests."""
import argparse
import hashlib
from pathlib import Path, PurePosixPath
import re
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = re.compile(
    r"(?:^|/)(?:\.git|\.ssh|\.android|\.env[^/]*|auth\.json|config\.toml|"
    r"town-chat\.json|work-thread\.json|thread\.json|providers\.json|voice-settings\.json|"
    r"notes\.json|tasks\.json|drafts\.json|server-port\.json|\.adb-device\.json|"
    r"sessions|chat-backups|credentials?\.json)(?:/|$)|\.(?:jks|p12|pem|jsonl)$", re.I
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
    with apk.open(asset) as content, tarfile.open(fileobj=content, mode="r|gz") as entries:
        for member in entries:
            name = clean_path(member.name)
            if asset.endswith("/rootfs.pack"):
                if name.startswith(("root/", "home/", "sdcard/", "data/")):
                    raise ValueError(f"Private directory in the Linux image: {name}")
            elif member.isfile():
                if name.startswith(("root/codex-mobile/", "root/eva-workshop/")):
                    source = ROOT / "runtime" / name.removeprefix("root/")
                else:
                    avatar = "root/.codex/generated_images/eva-builtin-20261116/"
                    if not name.startswith(avatar):
                        raise ValueError(f"Unknown runtime entry: {name}")
                    source = ROOT / "runtime/eva-builtins" / name.removeprefix(avatar)
                if not source.is_file() or entries.extractfile(member).read() != source.read_bytes():
                    raise ValueError(f"Runtime entry differs from source: {name}")


def audit(path):
    with zipfile.ZipFile(path) as apk:
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
    print("Runtime digests, source contents and private-path checks passed.")
