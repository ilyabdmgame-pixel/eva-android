#!/usr/bin/env python3
"""Fetch, reproduce and verify Eva's four Android arm64 PRoot runtime files.

    python3 tools/native_provenance.py fetch local-runtime
    python3 tools/native_provenance.py verify local-runtime
    python3 tools/native_provenance.py verify Eva.apk
    python3 tools/native_provenance.py sources native-source
"""
import argparse
import hashlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
from typing import NamedTuple
import urllib.request
import zipfile


class Artifact(NamedTuple):
    name: str
    url: str
    size: int
    sha256: str


PLAY_REPO = "https://termux.net/debs/stable/aarch64/"
TERMUX = "https://github.com/termux-play-store/termux-packages"
RECIPE = "57401119f9988f79fa095398a9b33b03380222b3"
PROOT = Artifact(
    "proot_5.1.107.80_aarch64.deb", PLAY_REPO + "p/proot/proot_5.1.107.80_aarch64.deb",
    90944, "bc1cbed6182006d5c13f2bbe8787135e27f11259e08d67a4405f4208fe4f6165",
)
TALLOC = Artifact(
    "libtalloc_2.4.3_aarch64.deb", PLAY_REPO + "l/libtalloc/libtalloc_2.4.3_aarch64.deb",
    33068, "e7b8a3e8d5b8faff9fa7f0ecfb5eeaa12dc9ec2372ec593dc9dc9649f8d8e3b2",
)
SHMEM = Artifact(
    "libandroid-shmem_0.7_aarch64.deb", PLAY_REPO + "l/libandroid-shmem/libandroid-shmem_0.7_aarch64.deb",
    7140, "08f045c296e24732ce8ab874f733918e6254988a38947fcfeba4b696c83aaed4",
)
LOADER = Artifact(
    "libproot-loader-aarch64-5.1.107.80-0.so",
    TERMUX + "/releases/download/proot-2026.06.21-r1/libproot-loader-aarch64-5.1.107.80-0.so",
    18592, "f7e3211e4c210c2a39a1f22b7f38666d99aee172fd009c0d19b84108cf20bb42",
)
SOURCES = (
    Artifact("proot-5.1.107.80.zip", "https://github.com/termux/proot/archive/v5.1.107.80.zip",
             454896, "d237b21b6d84a3acb00507f96251dcf2bbfbee9ffc66ab6258a3f86ef7874186"),
    Artifact("talloc-2.4.3.tar.gz", "https://www.samba.org/ftp/talloc/talloc-2.4.3.tar.gz",
             684092, "dc46c40b9f46bb34dd97fe41f548b0e8b247b77a918576733c528e83abd854dd"),
    Artifact("libandroid-shmem-0.7.tar.gz", "https://github.com/termux/libandroid-shmem/archive/refs/tags/v0.7.tar.gz",
             8891, "1e5ff8459bc0a8c229dd8a94b27d119987e09ef3414331c2b5ebfff20b98e867"),
    Artifact("termux-packages-" + RECIPE + ".tar.gz", TERMUX + "/archive/" + RECIPE + ".tar.gz",
             9533252, "cd0d19327ed0436dddd2b5283830fc9c7729de0f92fa0107db8b37e27050d3e2"),
)
# These are the final ELF bytes, after the two operations below.
OUTPUT = {
    "libproot.so": "34ace0e06852722005274b7eecde77ff3382257e1d319eec99afc7de2c996ce2",
    "libproot-loader.so": "b5b856b8b0d00d881d44d9fabfd6386499a607ceb9e8a5b95df94a3a2b7b451e",
    "libtalloc.so": "2b571225d692d2f8699b7eda17771fc610900570a18d7f84d36c40aca41d1e60",
    "libandroid-shmem.so": "c150511ff5fda97da2eca37073c06990b8733ca4e7f04535bdebaa1aef5e1d46",
}
DEB_FILES = {
    "libproot.so": (PROOT, "bin/proot"),
    "libtalloc.so": (TALLOC, "lib/libtalloc.so.2.4.3"),
    "libandroid-shmem.so": (SHMEM, "lib/libandroid-shmem.so"),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def install(files, directory):
    """Keep previous valid files and publish each new file atomically."""
    directory.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        dst = directory / name
        if dst.is_symlink() or (dst.exists() and (not dst.is_file() or dst.read_bytes() != data)):
            raise ValueError(f"Existing file differs: {dst}")
    with tempfile.TemporaryDirectory(dir=directory) as stage:
        for name, data in files.items():
            dst = directory / name
            src = Path(stage) / name
            src.write_bytes(data)
            if dst.exists():
                if dst.is_symlink() or dst.read_bytes() != data:
                    raise ValueError(f"Concurrent writer changed {dst}") from None
                continue
            # A concurrent run stages the same digest. rename also works on
            # Android shared storage and filesystems without hard links.
            os.replace(src, dst)


def fetch(artifact, cache):
    cached = cache / artifact.name if cache else None
    if cached is not None and cached.is_file():
        data = cached.read_bytes()
    else:
        request = urllib.request.Request(artifact.url, headers={"User-Agent": "Eva-Android/runtime-provenance"})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read(artifact.size + 1)
    if len(data) != artifact.size or digest(data) != artifact.sha256:
        raise ValueError(f"SHA-256 or size differs from the pinned release: {artifact.name}")
    if cached is not None and not cached.exists():
        install({artifact.name: data}, cache)
    return data


def deb_file(archive, relative):
    if archive[:8] != b"!<arch>\n":
        raise ValueError("Missing deb ar signature")
    offset = 8
    while offset + 60 <= len(archive):
        header = archive[offset:offset + 60]
        size = int(header[48:58].strip())
        start = offset + 60
        if header[58:60] != b"`\n" or size < 0 or start + size > len(archive):
            raise ValueError("Invalid deb ar header")
        if header[:16].rstrip(b" /") == b"data.tar.xz":
            with tarfile.open(fileobj=io.BytesIO(archive[start:start + size]), mode="r:xz") as tar:
                member = tar.getmember("./data/data/com.termux/files/usr/" + relative)
                if not member.isfile():
                    raise ValueError("Expected a regular ELF member: " + relative)
                return tar.extractfile(member).read()
        offset = start + size + size % 2
    raise ValueError("deb does not contain data.tar.xz")


def strip_executable(explicit):
    if explicit:
        return explicit
    for candidate in ("llvm-strip", "llvm-strip-15"):
        found = shutil.which(candidate)
        if found:
            return found
    ndks = [Path(os.environ[k]) for k in ("ANDROID_NDK_HOME", "ANDROID_NDK_ROOT") if os.environ.get(k)]
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if sdk:
        ndks += sorted((Path(sdk) / "ndk").glob("*"), reverse=True)
    for ndk in ndks:
        for candidate in sorted(ndk.glob("toolchains/llvm/prebuilt/*/bin/llvm-strip*")):
            if candidate.is_file() and os.access(candidate, os.X_OK):
                return str(candidate)
    raise ValueError("LLVM strip is required. Use --llvm-strip, an Android NDK, or the llvm-15 package.")


def check(files):
    for name, expected in OUTPUT.items():
        actual = digest(files[name])
        if actual != expected:
            raise ValueError(f"{name}: {actual}, expected {expected}")
        print(actual, name)


def reproduce(directory, cache, tool):
    strip = strip_executable(tool)
    files = {name: deb_file(fetch(deb, cache), path) for name, (deb, path) in DEB_FILES.items()}
    old = b"/data/data/com.termux/files/applib/libproot-loader.so\0"
    new = b"/data/data/org.evaassistant.app/files/p\0"
    if files["libproot.so"].count(old) != 1 or len(new) > len(old):
        raise ValueError("Unexpected PRoot loader string")
    files["libproot.so"] = files["libproot.so"].replace(old, new.ljust(len(old), b"\0"))
    with tempfile.TemporaryDirectory() as temp:
        incoming, stripped = Path(temp) / "upstream.so", Path(temp) / "stripped.so"
        incoming.write_bytes(fetch(LOADER, cache))
        subprocess.run([strip, "--strip-unneeded", "-o", str(stripped), str(incoming)], check=True)
        files["libproot-loader.so"] = stripped.read_bytes()
    check(files)
    install(files, directory)


def verify(target):
    if target.is_dir():
        check({name: (target / name).read_bytes() for name in OUTPUT})
    else:
        with zipfile.ZipFile(target) as apk:
            entries = apk.namelist()
            files = {}
            for name in OUTPUT:
                key = "lib/arm64-v8a/" + name
                if entries.count(key) != 1:
                    raise ValueError(f"Expected one APK entry for {key}")
                files[name] = apk.read(key)
            check(files)


def source_bundle(directory, cache):
    files = {artifact.name: fetch(artifact, cache) for artifact in SOURCES}
    files["native_provenance.py"] = Path(__file__).read_bytes()
    notice_dir = Path(__file__).resolve().parent.parent / "app/src/main/assets/licenses/native"
    if not notice_dir.is_dir():
        notice_dir = Path(__file__).resolve().parent
    for name in ("NOTICE.md", "PRoot-COPYING.txt", "talloc-LGPL-3.0.txt", "GPL-3.0.txt", "libandroid-shmem-LICENSE.txt"):
        files[name] = (notice_dir / name).read_bytes()
    checksums = (digest(data) + "  " + name + "\n" for name, data in files.items())
    files["SHA256SUMS"] = "".join(checksums).encode("ascii")
    install(files, directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "sources"):
        sub = commands.add_parser(name)
        sub.add_argument("directory", type=Path)
        sub.add_argument("--cache", type=Path, help="directory containing the pinned public downloads")
        if name == "fetch":
            sub.add_argument("--llvm-strip", help="path to the LLVM strip executable")
    commands.add_parser("verify").add_argument("target", type=Path, help="runtime directory or APK")
    args = parser.parse_args()
    if args.command == "fetch":
        reproduce(args.directory, args.cache, args.llvm_strip)
    elif args.command == "sources":
        source_bundle(args.directory, args.cache)
    else:
        verify(args.target)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, tarfile.TarError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
