#!/usr/bin/env python3
"""Build the Android runtime assets from source and local dependencies."""
import argparse
import gzip
import hashlib
import shutil
import tarfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime"
PACKS = ("rootfs.pack", "vosk-ru-small.zip")
LIBRARIES = ("libproot.so", "libproot-loader.so", "libtalloc.so", "libandroid-shmem.so")


def add_parent_dirs(archive, name, seen):
    # Android tar expects parent entries to appear before files and links.
    for parent in reversed(PurePosixPath(name).parents):
        directory = parent.as_posix()
        if directory == "." or directory in seen:
            continue
        entry = tarfile.TarInfo(directory)
        entry.type = tarfile.DIRTYPE
        entry.mode = 0o755
        archive.addfile(entry)
        seen.add(directory)


def add_file(archive, source, name):
    info = archive.gettarinfo(str(source), name)
    info.uid = info.gid = info.mtime = 0
    info.uname = info.gname = ""
    info.mode = 0o644
    with source.open("rb") as content:
        archive.addfile(info, content)


def runtime_files():
    for dirname in ("codex-mobile", "eva-workshop", "eva-builtins"):
        for source in sorted((RUNTIME / dirname).rglob("*")):
            if source.is_symlink() or not source.is_file():
                continue
            relative = source.relative_to(RUNTIME)
            if source.suffix == ".png" and source.with_suffix(".webp").is_file() and not source.with_suffix(".webp").is_symlink():
                continue  # PNG masters stay in the checkout for the rig and future artwork.
            if dirname == "eva-builtins" and relative.parent in (Path(dirname, "emotions"), Path(dirname, "speech")) and source.suffix in (".png", ".webp"):
                yield source, "root/.codex/generated_images/eva-builtin-20261116/" + str(relative.relative_to(dirname))
            elif dirname == "codex-mobile" and relative.parent == Path(dirname, "avatar") and source.suffix in (".png", ".webp"):
                yield source, "root/" + relative.as_posix()
            elif dirname != "eva-builtins" and relative.parent == Path(dirname) and source.suffix in (".js", ".py", ".html", ".css", ".md"):
                yield source, "root/" + relative.as_posix()


def sha256(path):
    with path.open("rb") as content:
        return hashlib.file_digest(content, "sha256").hexdigest()


def portrait_replacements():
    """Name only shipped, byte-identifiable PNG masters with a packaged successor."""
    lines = []
    for source, name in runtime_files():
        master = source.with_suffix(".png")
        if source.suffix == ".webp" and master.is_file() and not master.is_symlink():
            lines.append(f"{sha256(master)}\t{PurePosixPath(name).with_suffix('.png')}")
    return ("\n".join(lines) + "\n").encode("ascii")


def stage(deps, output):
    assets = output / "assets"
    libraries = output / "jniLibs" / "arm64-v8a"
    assets.mkdir(parents=True, exist_ok=True)
    libraries.mkdir(parents=True, exist_ok=True)
    required = [deps / name for name in PACKS + LIBRARIES]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise SystemExit("Missing Android runtime dependencies:\n" + "\n".join(missing))
    for name in PACKS:
        shutil.copyfile(deps / name, assets / name)
    for name in LIBRARIES:
        shutil.copyfile(deps / name, libraries / name)
    pack_application(assets, deps / "rootfs.pack")


def pack_application(assets, rootfs):
    """Write just the application layer. Both APK build paths use this exact manifest."""
    assets.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(RUNTIME / "codex-mobile" / "question-options.js", assets / "eva-questions.js")
    shutil.copyfile(RUNTIME / "codex-mobile" / "ui-icons.js", assets / "eva-icons.js")
    (assets / "eva-replaced-portraits.tsv").write_bytes(portrait_replacements())
    pack = assets / "eva-runtime.pack"
    with pack.open("wb") as destination, gzip.GzipFile(filename="", fileobj=destination, mode="wb", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w|") as archive:
            seen = set()
            for source, name in runtime_files():
                add_parent_dirs(archive, name, seen)
                add_file(archive, source, name)
    (assets / "eva-runtime.version").write_text(
        sha256(rootfs) + "\n" + sha256(pack) + "\n", encoding="ascii"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deps", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    stage(args.deps, args.output)
