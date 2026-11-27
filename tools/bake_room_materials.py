#!/usr/bin/env python3
"""Pack the four original, hand-painted-style room sheets into the GPU atlas. Requires Pillow."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTERS = ROOT / "art/room-materials"
OUTPUT = ROOT / "app/src/main/assets/home/art/room-indie-atlas.webp"
TILE = 512


def main():
    atlas = Image.new("RGB", (4 * TILE, 4 * TILE))
    for row, name in enumerate(("timber", "walls", "fabric", "hardware")):
        with Image.open(MASTERS / f"{name}.png") as source:
            if source.width != source.height or source.width % 2 or source.width < 2 * TILE:
                raise ValueError(f"{name} must have four equal tiles of at least {TILE}px")
            half = source.width // 2
            for column in range(4):
                x, y = column % 2 * half, column // 2 * half
                tile = source.crop((x, y, x + half, y + half))
                atlas.paste(tile.resize((TILE, TILE), Image.Resampling.LANCZOS), (column * TILE, row * TILE))
    atlas.save(OUTPUT, "WEBP", quality=94, method=6)
    print(f"{OUTPUT.name}: {atlas.width}x{atlas.height}, {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
