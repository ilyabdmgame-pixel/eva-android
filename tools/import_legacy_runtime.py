#!/usr/bin/env python3
"""Recover build-time runtime dependencies from a local Eva 0.63 APK."""
import argparse
import gzip
import io
import posixpath
import shutil
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

from stage_runtime import LIBRARIES, add_parent_dirs

OLD_LOADER = b"/data/data/ru.eva.sixchat.petpreview/files/p\0"
NEW_LOADER = b"/data/data/org.evaassistant.app/files/p\0"
SYSTEM_TREES = ("usr/bin/", "usr/lib/", "usr/share/nodejs/", "usr/local/bin/", "usr/local/lib/node_modules/@openai/")
SYSTEM_FILES = {"bin", "lib", "lib64", "etc/ssl/certs/ca-certificates.crt"}


def copy_system(archive, apk, asset, seen, links):
    with apk.open("assets/" + asset) as compressed, tarfile.open(fileobj=compressed, mode="r|gz") as original:
        for entry in original:
            name = entry.name.removeprefix("./")
            if name in seen or not (name in SYSTEM_FILES or name.startswith(SYSTEM_TREES)):
                continue
            if name.startswith("/") or ".." in PurePosixPath(name).parts:
                raise ValueError("Unsafe archive path: " + name)
            if not (entry.isfile() or entry.isdir() or entry.issym() or entry.islnk()):
                raise ValueError("Unsupported archive entry: " + name)
            if entry.issym() or entry.islnk():
                target = entry.linkname
                joined = posixpath.join(posixpath.dirname(name), target) if entry.issym() else target
                normalized = posixpath.normpath(joined)
                if target.startswith("/") or not (normalized.startswith("usr/") or normalized in SYSTEM_FILES):
                    raise ValueError("Unsafe archive link: " + name)
            entry.name = name
            entry.uid = entry.gid = entry.mtime = 0
            entry.uname = entry.gname = ""
            entry.pax_headers = {}
            add_parent_dirs(archive, name, seen)
            seen.add(name)
            if entry.issym() or entry.islnk():
                links.append(entry)
            else:
                archive.addfile(entry, original.extractfile(entry) if entry.isfile() else None)


def network_defaults(archive, seen):
    files = {
        "etc/hosts": b"127.0.0.1 localhost\n::1 localhost\n",
        "etc/resolv.conf": b"nameserver 1.1.1.1\nnameserver 8.8.8.8\n",
        "etc/nsswitch.conf": b"passwd: files\ngroup: files\nhosts: files dns\n",
        "etc/passwd": b"root:x:0:0:root:/root:/bin/bash\n",
        "etc/group": b"root:x:0:\n",
    }
    for name, data in files.items():
        add_parent_dirs(archive, name, seen)
        info = tarfile.TarInfo(name)
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))


def recover(apk_path, output):
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(apk_path) as apk:
        seen = set()
        links = []
        with (output / "rootfs.pack").open("wb") as destination:
            with gzip.GzipFile(filename="", fileobj=destination, mode="wb", mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w|") as archive:
                    for asset in ("rootfs.pack", "eva.pack"):
                        copy_system(archive, apk, asset, seen, links)
                    network_defaults(archive, seen)
                    for entry in links:
                        archive.addfile(entry)
        for name in LIBRARIES:
            data = apk.read("lib/arm64-v8a/" + name)
            if name == "libproot.so":
                if data.count(OLD_LOADER) != 1 or len(NEW_LOADER) > len(OLD_LOADER):
                    raise ValueError("Unexpected PRoot loader path")
                data = data.replace(OLD_LOADER, NEW_LOADER.ljust(len(OLD_LOADER), b"\0"))
            (output / name).write_bytes(data)
        with apk.open("assets/vosk-ru-small.zip") as source, (output / "vosk-ru-small.zip").open("wb") as destination:
            shutil.copyfileobj(source, destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--output", type=Path, default=Path("local-runtime"))
    args = parser.parse_args()
    recover(args.apk, args.output)
