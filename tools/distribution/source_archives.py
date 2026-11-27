#!/usr/bin/env python3
"""Package the pinned Linux/native corresponding sources and checksums next to the signed Eva APK."""
import argparse
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

from release import ROOT, digest, version


class SplitWriter:
    def __init__(self, basename, limit=512 * 1024 * 1024):
        self.basename = basename
        self.limit = limit
        self.files = []
        self.stream = None
        self.remaining = 0

    def write(self, data):
        size = len(data)
        data = memoryview(data)
        while data:
            if not self.remaining:
                self.close()
                part = self.basename.with_name(self.basename.name + f".part-{len(self.files) + 1:03}")
                self.stream = part.open("xb")
                self.files.append(part)
                self.remaining = self.limit
            count = min(self.remaining, len(data))
            self.stream.write(data[:count])
            self.remaining -= count
            data = data[count:]
        return size

    def close(self):
        if self.stream:
            self.stream.close()


def tar_tree(root, name, out):
    with tarfile.open(fileobj=out, mode="w|", format=tarfile.PAX_FORMAT, bufsize=1024 * 1024) as tar:
        for path in [root, *sorted(root.rglob("*"))]:
            local = Path(name) / path.relative_to(root)
            info = tarfile.TarInfo(local.as_posix())
            if path.is_symlink() or not (path.is_file() or path.is_dir()):
                raise ValueError(f"Unexpected source entry: {local}")
            if path.is_dir():
                info.type, info.mode = tarfile.DIRTYPE, 0o755
                tar.addfile(info)
            else:
                info.size, info.mode = path.stat().st_size, 0o644
                with path.open("rb") as src:
                    tar.addfile(info, src)


def package(linux, native, work, release_version):
    base = "Eva-" + release_version
    native_tar = work / (base + "-native-sources.tar")
    with native_tar.open("xb") as out:
        tar_tree(native, "native", out)
    chunks = SplitWriter(work / (base + "-linux-sources.tar"))
    try:
        tar_tree(linux, "linux", chunks)
    finally:
        chunks.close()
    instructions = work / "SOURCE-INSTRUCTIONS.txt"
    instructions.write_text(f"""Ева {release_version} · Android ARM64

Проверка всех скачанных файлов из одного каталога:
  sha256sum -c SHA256SUMS

Исходники PRoot, talloc, libandroid-shmem, рецепты их сборки и лицензии:
  tar -xf {native_tar.name}

Пакеты Debian и исходники компонентов Linux-среды:
  cat {base}-linux-sources.tar.part-* | tar -xf -

Исходники приложения доступны на странице релиза в архиве тега v{release_version}.
Версии и хэши перечислены в tools/public-rootfs.lock.json и tools/native_provenance.py.
Команды сборки и проверки подписи находятся в tools/distribution/README.md.
""", encoding="utf-8")
    return [native_tar, *chunks.files, instructions]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()
    v = version()
    apk = args.directory / f"Eva-{v}-arm64.apk"
    if not apk.is_file() or apk.is_symlink():
        raise ValueError("Expected signed release APK in output directory")
    with tempfile.TemporaryDirectory(dir=args.directory) as temp:
        work = Path(temp)
        linux, native = work / "linux", work / "native"
        subprocess.run([sys.executable, ROOT / "tools/prepare_public_rootfs.py", "--sources-only", "--sources", linux,
                        "--cache", args.cache / "linux"], check=True)
        subprocess.run([sys.executable, ROOT / "tools/native_provenance.py", "sources", native,
                        "--cache", args.cache / "native"], check=True)
        files = package(linux, native, work, v)
        sums = work / "SHA256SUMS"
        sums.write_text("".join(digest(p) + "  " + p.name + "\n" for p in sorted([*files, apk], key=lambda p: p.name)),
                        encoding="ascii")
        for path in [*files, sums]:
            path.replace(args.directory / path.name)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
