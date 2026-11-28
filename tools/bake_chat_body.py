#!/usr/bin/env python3
"""Bake the chat portrait's transparent breathing loop with Pillow and libwebp.

The 640×660 image replaces source rows 702..1671 of the 941×1672 idle
drawing. It shares an immobile neck/hair band with the head through row 744.
Its 192 presentations last 6.4 seconds; no other portrait image is needed
under the animated region. Run: python3 tools/bake_chat_body.py
"""
from math import cos, exp, pi, sin
from pathlib import Path
from tempfile import TemporaryDirectory, TemporaryFile

from PIL import Image
from PIL.TiffImagePlugin import AppendingTiffWriter

ROOT = Path(__file__).resolve().parents[1]
AVATAR = ROOT / "runtime/codex-mobile/avatar"
SOURCE_W, SOURCE_H, CUT_Y = 941, 1672, 702
WIDTH, HEIGHT = 640, 660
FPS, COUNT = 30, 192
# The supplied cel has a fine near-opaque matte (most cloth pixels are
# alpha 251..253). Preserve its average coverage, and remove only the almost
# invisible noise that would otherwise have to be stored in every WebP frame.
COVERAGE = [0 if a <= 5 else 253 if a >= 248 else a for a in range(256)]


def smooth(u):
    u = max(0., min(1., u))
    return u * u * (3. - 2. * u)


def bell(value, center, spread):
    return exp(-.5 * ((value - center) / spread) ** 2)


def weights(px, py):
    """Inverse sampling in artwork pixels. Positive screen Y points down."""
    x, y = px / SOURCE_W, py / SOURCE_H
    # Registration at the collar and a relaxed lower hem. Remaining pixels
    # outside the silhouette move with its boundary, including soft alpha.
    top = smooth((py - 744.) / 87.)
    hem = smooth((1.01 - y) / .155)
    free = top * hem
    horizontal = smooth(min(x, 1. - x) / .048)
    side = 2. * x - 1.
    chest = bell(y, .585, .117)
    shoulder = bell(y, .498, .072) * (.54 + .70 * abs(side))
    belt = bell(y, .753, .176)
    # Left and right shoulders rise at different amplitudes. The middle of
    # the breastbone expands much less than the fabric near the upper arms.
    rise = 7.8 * chest + (13.0 - 4.0 * side) * shoulder
    stretch = side * (15.2 * chest + 3.3 * belt)
    # A small counterlean at the waist balances the rib cage. Hair tips at
    # the collar and down the sides trail the motion of the upper body.
    lean = 9.4 * bell(y, .555, .130) - 4.0 * bell(y, .831, .115)
    tilt = -11.6 * side * bell(y, .542, .118)
    inner_lock = bell(abs(side), .442, .131) * bell(y, .647, .078)
    outer_lock = bell(abs(side), .865, .110) * bell(y, .815, .116)
    hair = 6.8 * inner_lock + 11.2 * outer_lock
    return (-stretch * free * horizontal, rise * free,
            -lean * free * horizontal, tilt * free,
            -hair * free * horizontal, side * hair * .39 * free)


def movement(phase):
    if phase < .397:
        inhale = .5 - .5 * cos(pi * phase / .397)
    else:
        inhale = .5 + .5 * cos(pi * (phase - .397) / .603)
    rocking = .86 * sin(2. * pi * phase) ** 3 + .13 * sin(4. * pi * phase) ** 3
    trailing = sin(2. * pi * (phase - .092)) * sin(pi * phase) ** 2
    return inhale, rocking, trailing


def mesh_edges(length, spacing):
    return [*range(0, length, spacing), length]


def source_and_grid():
    with Image.open(AVATAR / "idle.png") as original:
        if original.size != (SOURCE_W, SOURCE_H):
            raise ValueError("Register the motion mesh on the new portrait first")
        # Resample premultiplied colour. Interpolating straight alpha would
        # expose the RGB hidden in transparent pixels as a fringe on dark UI.
        body = original.convert("RGBa").crop((0, CUT_Y, SOURCE_W, SOURCE_H))
        body = body.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    xs, ys = mesh_edges(WIDTH, 24), mesh_edges(HEIGHT, 22)
    lock = round((744 - CUT_Y) * HEIGHT / (SOURCE_H - CUT_Y))
    ys = sorted(set(ys + [lock]))
    points = {(x, y): weights(x * SOURCE_W / WIDTH,
                              CUT_Y + y * (SOURCE_H - CUT_Y) / HEIGHT)
              for y in ys for x in xs}
    cells = [(x, y, r, b) for y, b in zip(ys, ys[1:]) for x, r in zip(xs, xs[1:])]
    return body, points, cells


def pose(source, points, cells, frame):
    breath, weight, delay = movement(frame / COUNT)
    if frame % COUNT == 0:
        return source.convert("RGBA")
    mapped = {}
    for (x, y), (bx, by, wx, wy, hx, hy) in points.items():
        mapped[x, y] = (x + WIDTH / SOURCE_W * (bx * breath + wx * weight + hx * delay),
                        y + HEIGHT / (SOURCE_H - CUT_Y) * (by * breath + wy * weight + hy * delay))
    mesh = []
    for box in cells:
        x, y, r, b = box
        quad = (*mapped[x, y], *mapped[x, b], *mapped[r, b], *mapped[r, y])
        mesh.append((box, quad))
    return source.transform((WIDTH, HEIGHT), Image.Transform.MESH, mesh,
                            Image.Resampling.BICUBIC, fillcolor=(0, 0, 0, 0)).convert("RGBA")


def bake(destination):
    body, points, cells = source_and_grid()
    # A disk-backed sequence feeds one frame at a time through Pillow's public
    # animation writer. The atlas alternative would hold 309 MiB of RGBA.
    with TemporaryFile() as spool:
        with AppendingTiffWriter(spool) as pages:
            for i in range(COUNT):
                frame = pose(body, points, cells, i)
                frame.putalpha(frame.getchannel("A").point(COVERAGE))
                frame.save(pages, format="TIFF", compression="packbits")
                pages.newFrame()
        del pages
        spool.seek(0)
        with Image.open(spool) as sequence, TemporaryDirectory(dir=destination.parent) as folder:
            if sequence.n_frames != COUNT:
                raise ValueError("Incomplete portrait frame sequence")
            durations = [round(1000 * (i + 1) / FPS) - round(1000 * i / FPS) for i in range(COUNT)]
            output = Path(folder) / "idle.webp"
            sequence.save(output, format="WEBP", save_all=True, duration=durations, loop=0,
                          background=(0, 0, 0, 0), quality=70, alpha_quality=80,
                          method=4, kmin=15, kmax=29)
            output.replace(destination)


if __name__ == "__main__":
    bake(AVATAR / "idle-body.webp")
