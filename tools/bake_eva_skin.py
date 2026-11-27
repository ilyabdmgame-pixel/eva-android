"""Pack the original painted portraits and clothing swatches for Eva's 3D rig.

Run from any directory with Pillow. The shipped atlas keeps the game offline.
"""
from pathlib import Path

from PIL import Image

project = Path(__file__).resolve().parents[1]
avatar = project / "runtime/codex-mobile/avatar"
art = project / "app/src/main/assets/home/art"
size = 256
atlas = Image.new("RGB", (4 * size, 2 * size), "white")


def tile(image, column, row):
    atlas.paste(image.convert("RGB").resize((size, size), Image.Resampling.LANCZOS),
                (column * size, row * size))


# Coordinates are registered on the 300-pixel portrait proof used to author
# the head's UV rings. Transparent hair-edge pixels are filled before mipmaps.
for column, state in enumerate(("idle", "blink", "smile-mid", "thinking-soft")):
    with Image.open(avatar / (state + ".png")) as source:
        ratio = source.width / 300
        rect = tuple(round(i * ratio) for i in (52, 0, 250, 211))
        face = source.convert("RGBA").crop(rect)
        background = Image.new("RGB", face.size, (90, 56, 54))
        background.paste(face, mask=face.getchannel("A"))
        tile(background, column, 0)

with Image.open(art / "rear-idle.png") as source:
    # The central locks have paint from root to tip, clear of the outline.
    hair = source.crop((43, 32, 87, 161)).convert("RGB")
    tile(hair, 0, 1)
with Image.open(avatar / "idle.png") as source:
    ratio = source.width / 300
    def crop(rect):
        return source.crop(tuple(round(i * ratio) for i in rect))
    tile(crop((58, 341, 80, 452)), 1, 1)
    tile(crop((79, 245, 224, 513)), 3, 1)
with Image.open(art / "idle.png") as source:
    tile(source.crop((46, 268, 65, 351)), 2, 1)
# Reserve a mip-safe white patch for shoes, seams, palms and room props.
atlas.paste("white", (4 * size - 24, 2 * size - 24, 4 * size, 2 * size))
atlas.save(art / "eva-rig-skin.png", optimize=True)
