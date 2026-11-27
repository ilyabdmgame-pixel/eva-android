"""Bake Eva's face expressions, textile studies and embroidered trim into one mobile albedo.

Run with Pillow. Each primary UV island uses its own 512-pixel source area.
The small accessory islands are inset far enough for the four shipped mip levels.
"""
from pathlib import Path
from math import pi, sin

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

root = Path(__file__).resolve().parents[1]
portraits = root / "runtime/codex-mobile/avatar"
art = root / "app/src/main/assets/home/art"
atlas = Image.new("RGB", (2048, 1024), "white")
resample = Image.Resampling.LANCZOS


def put(image, bounds):
    x, y, right, bottom = bounds
    atlas.paste(image.resize((right - x, bottom - y), resample), (x, y))


def registered(source, coordinates):
    ratio = source.width / 300
    return source.crop(tuple(round(value * ratio) for value in coordinates))


def dye(study, shadow, mid, light, midpoint=112):
    tones = ImageOps.autocontrast(ImageOps.grayscale(study), cutoff=(1, 1))
    return ImageOps.colorize(tones, shadow, light, mid, midpoint=midpoint)


# The same four painted faces share one UV layout. Preserve the eyelids, iris
# highlights and nose; use chestnut behind transparent pixels at the temples.
for column, state in enumerate(("idle", "blink", "smile-mid", "thinking-soft")):
    with Image.open(portraits / (state + ".png")) as source:
        face = registered(source.convert("RGBA"), (52, 0, 250, 211))
        base = Image.new("RGB", face.size, (85, 51, 54))
        base.paste(face, mask=face.getchannel("A"))
        base = ImageEnhance.Color(base).enhance(1.055)
        base = base.filter(ImageFilter.UnsharpMask(radius=.8, percent=52, threshold=4))
        put(base, (512 * column, 0, 512 * (column + 1), 512))

# Cropping in by several source texels separates the four authored studies.
with Image.open(root / "tools/art/eva-fabric-study.webp") as sheet:
    middle = sheet.width // 2
    boxes = [(2, 2, middle - 2, middle - 2), (middle + 2, 2, sheet.width - 2, middle - 2),
             (2, middle + 2, middle - 2, sheet.height - 2),
             (middle + 2, middle + 2, sheet.width - 2, sheet.height - 2)]
    hair, coat, jeans, knit = [sheet.crop(b).convert("RGB") for b in boxes]

# These rolls retain the broad hand-painted changes in value at launcher scale.
# The lustre on the hair belongs to the texture and follows each lock's UVs.
hair = dye(hair, (64, 40, 52), (141, 84, 85), (207, 137, 116), 71).resize((512, 512), resample)


def smooth(t):
    t = max(0., min(1., t))
    return t * t * (3. - 2. * t)


# Continue the portrait's painted part over the crown to the back of the
# head. The lower study remains uninterrupted along the long locks. A direct
# join between the two paintings gives the forehead a visible cap edge.
with Image.open(portraits / "idle.png") as source:
    face = registered(source.convert("RGB"), (52, 0, 250, 211)).resize((396, 422), resample).load()
    paint = hair.load()
    heights = [(.193, 136, 67), (.218, 118, 70), (.244, 98, 72), (.272, 75, 69),
               (.295, 54, 65), (.316, 32, 52), (.331, 16, 36), (.346, 4, 1)]
    for py in range(120):
        v = (py / 511 - .025) / .95
        z = .346 - .80 * (v - .023) / .94
        if z < heights[0][0]:
            continue
        level = next((i for i in range(1, len(heights)) if heights[i][0] >= z), len(heights) - 1)
        lo, hi = heights[level - 1], heights[level]
        t = max(0., min(1., (z - lo[0]) / (hi[0] - lo[0])))
        image_y, span = [lo[i] + (hi[i] - lo[i]) * t for i in (1, 2)]
        for px in range(512):
            u = (px / 511 - .03) / .94
            n = max(0., min(1., (u - .036) / .928))
            edge = 1. - smooth(min(n, 1. - n) / .24)
            weight = max(smooth((z - .246) / .082), edge * smooth((z - .204) / .038))
            sample_x = 2. * (151. - sin(pi * (.5 + n)) * span - 52.)
            original = face[round(sample_x), round(2. * image_y)]
            # Temple strands may border a pale ear. Carry only hair onto the back.
            weight *= 1. - smooth((min(original[1], original[2]) - 128.) / 32.)
            paint[px, py] = tuple(round(c + (b - c) * weight) for c, b in zip(paint[px, py], original))
coat = dye(coat, (32, 31, 40), (58, 65, 68), (111, 128, 119), 128)
denim = dye(jeans, (38, 39, 55), (63, 75, 88), (110, 128, 137), 121)
lining = dye(knit, (153, 137, 126), (205, 191, 173), (238, 228, 210), 122)
canvas = dye(jeans, (154, 143, 128), (201, 192, 171), (240, 228, 203), 113)
for image, box in ((hair, (0, 512, 512, 1024)), (coat, (512, 512, 1024, 1024)),
                   (denim, (1024, 512, 1536, 1024)), (lining, (1792, 512, 2048, 768)),
                   (canvas, (1920, 768, 2048, 928))):
    put(image, box)

with Image.open(portraits / "idle.png") as source:
    put(registered(source.convert("RGB"), (79, 245, 224, 513)), (1536, 512, 1792, 1024))

# Original woven shoulder badge. The moon and an asymmetric four-point star
# also read when the little stitched border has disappeared into a mip level.
badge = dye(knit, (27, 47, 51), (43, 74, 76), (64, 95, 91)).resize((192, 240), resample)
draw = ImageDraw.Draw(badge)
outline = [(21, 16), (170, 16), (170, 145), (154, 183), (96, 221), (36, 184), (21, 146)]
draw.line(outline + [outline[0]], fill=(188, 153, 100), width=8, joint="curve")
draw.ellipse((40, 57, 131, 153), fill=(220, 184, 119))
draw.ellipse((66, 42, 150, 133), fill=(49, 78, 78))
draw.polygon([(135, 48), (141, 69), (158, 75), (141, 81), (135, 102), (129, 81),
              (113, 75), (129, 69)], fill=(240, 217, 165))
draw.line([(75, 177), (93, 187), (123, 166)], fill=(169, 165, 127), width=4)
put(badge, (1792, 768, 1920, 928))

# Keeping these texels neutral allows a single filtered draw call for solids.
atlas.paste("white", (1792, 928, 2048, 1024))
atlas.save(art / "eva-rig-skin.webp", quality=94, method=6)
