#!/usr/bin/env python3
"""Bake the chat's transparent art with Pillow, or verify existing exports (--check)."""
import argparse
import math
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1] / "runtime"
AVATAR = ROOT / "codex-mobile/avatar"
SPEECH = ROOT / "eva-builtins/speech"
DIRECTORIES = (AVATAR, ROOT / "eva-builtins/emotions", SPEECH)


def verify(master, cooked):
    if cooked.size != master.size:
        raise ValueError("dimensions changed")
    if ImageChops.difference(master.getchannel("A"), cooked.getchannel("A")).getbbox():
        raise ValueError("alpha channel changed")
    visible = master.getchannel("A").point(lambda value: 255 if value > 127 else 0)
    diff = ImageChops.difference(master.convert("RGB"), cooked.convert("RGB"))
    rms = max(ImageStat.Stat(diff, mask=visible).rms)
    return -20 * math.log10(rms / 255) if rms else math.inf


def export(master, target, check):
    if check:
        with Image.open(target) as packed:
            psnr = verify(master, packed.convert("RGBA"))
    else:
        # Protect contours and the highlights in the irises and lips.
        for options in ({"quality": q, "method": 5} for q in (93, 96, 99, None)):
            if options["quality"] is None:
                options = {"lossless": True, "method": 4}
            output = BytesIO()
            master.save(output, format="WEBP", alpha_quality=100, **options)
            output.seek(0)
            with Image.open(output) as packed:
                psnr = verify(master, packed.convert("RGBA"))
            if psnr >= 38:
                break
        if psnr >= 38 and (not target.exists() or target.read_bytes() != output.getvalue()):
            temp = target.with_suffix(".webp.tmp")
            temp.write_bytes(output.getvalue())
            temp.replace(target)
    if psnr < 38:
        raise SystemExit(f"{target.name}: painted region changed ({psnr:.2f} dB)")
    return psnr


def bake_mouth(check):
    sources = sorted(SPEECH.glob("*.png"))
    if len(sources) != 12 or [p.name.split("-")[1] for p in sources] != list("aaeeoouummff"):
        raise ValueError("Expected mid/full variants of the A, E, O, U, M and F mouth drawings")
    atlas = None
    for index, source in enumerate(sources):
        with Image.open(source) as master:
            width, height = master.size
            box = (round(width * .36), round(height * .31), round(width * .64), round(height * .38))
            tile = master.crop(box).convert("RGBA")
        if atlas is None:
            cell_w, cell_h = tile.size
            atlas = Image.new("RGBA", (4 * cell_w, 3 * cell_h))
        if tile.size != (cell_w, cell_h):
            raise ValueError(f"{source.name}: incompatible registration")
        atlas.paste(tile, ((index % 4) * cell_w, (index // 4) * cell_h))
    target = AVATAR / "visemes.webp"
    export(atlas, target, check)
    print(f"12 mouth patches: {atlas.width} × {atlas.height}, {target.stat().st_size:,} bytes.")


def main(check):
    count = original = packed = 0
    lowest = math.inf
    for folder in DIRECTORIES:
        for source in sorted(folder.glob("*.png")):
            target = source.with_suffix(".webp")
            with Image.open(source) as master:
                lowest = min(lowest, export(master.convert("RGBA"), target, check))
            count += 1
            original += source.stat().st_size
            packed += target.stat().st_size
    print(f"{count} portraits. PNG {original:,} bytes. WebP {packed:,} bytes. "
          f"Minimum visible-channel PSNR {lowest:.2f} dB. Alpha matches all masters.")
    bake_mouth(check)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
