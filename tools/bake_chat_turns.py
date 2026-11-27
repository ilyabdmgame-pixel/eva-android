#!/usr/bin/env python3
"""Bake the chat turnarounds and registered in-betweens (Pillow, numpy, OpenCV)."""
import json
from pathlib import Path
import re

import cv2
import numpy as np
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
AVATAR = PROJECT / 'runtime/codex-mobile/avatar'
PAINTINGS = PROJECT / 'art/chat'
KEY_SIZE = (650, 1155)
INBETWEEN_SIZE = (560, 996)  # Four cells fit in the minimum 2048px WebGL texture.


def drawings(source, left, right):
    with Image.open(PAINTINGS / source) as original:
        for x in (left, right):
            rgba = np.array(original.crop((x, 0, x + 704, 1024)))
            # Remove barely-visible stray alpha outside the original silhouette.
            rgba[:, :, 3] = np.clip((rgba[:, :, 3].astype(np.float32) - 3) * 255 / 249, 0, 255)
            yield Image.fromarray(rgba).resize(KEY_SIZE, Image.Resampling.LANCZOS)


def write_atlas(frames, columns, name):
    w, h = frames[0].size
    result = Image.new('RGBA', (columns * w, h * (len(frames) // columns)))
    for i, frame in enumerate(frames):
        result.paste(frame, ((i % columns) * w, (i // columns) * h))
    result.save(AVATAR / name, format='WEBP', quality=94, alpha_quality=100, method=6)


def load_mesh():
    text = (AVATAR.parent / 'portrait.js').read_text()
    rows = text.split('const landmarks = [', 1)[1].split('];', 1)[0]
    vertices = np.array([json.loads(m)[:10] for m in re.findall(r'(\[[^\]]+\]), //', rows)], np.float32)
    weights = np.array([(INBETWEEN_SIZE[0] - 1) / 325, (INBETWEEN_SIZE[1] - 1) / 578], np.float32)
    tris = text.split('const triangles = new Uint16Array([', 1)[1].split(']);', 1)[0]
    faces = np.array(re.findall(r'\d+', tris), dtype=np.int32).reshape(-1, 3)
    return vertices.reshape(-1, 5, 2) * weights, faces


def remap_key(drawing, source, target, faces):
    w, h = INBETWEEN_SIZE
    uv = np.zeros((h, w, 2), np.float32)
    for indices in faces:
        tri = target[indices]
        x0, y0 = np.floor(tri.min(axis=0)).astype(int).clip(0)
        x1, y1 = np.minimum(np.ceil(tri.max(axis=0)).astype(int) + 1, [w, h])
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        base = tri[0]
        axes = np.linalg.inv((tri[1:] - base).T)
        bary = (np.stack([xx, yy], axis=-1) - base) @ axes.T
        interior = (bary >= -.00001).all(axis=2) & (bary.sum(axis=2) <= 1.00001)
        src = source[indices]
        uv[y0:y1, x0:x1][interior] = (src[0] + bary @ (src[1:] - src[0]))[interior]
    rgba = np.array(drawing.resize(INBETWEEN_SIZE, Image.Resampling.LANCZOS), np.float32) / 255
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    return cv2.remap(rgba, uv, None, cv2.INTER_LINEAR)


def midpoint(a, b):
    # The rig has already aligned eyes, nose, mouth, chin, shoulders and clothing.
    # The residual flow aligns small cel-shaded boundaries in the hair, ears and jaw shadow.
    def grey(frame):
        matte = np.rint(255 * (frame[:, :, :3] + (1 - frame[:, :, 3:4]) * .14)).astype(np.uint8)
        return cv2.cvtColor(matte, cv2.COLOR_RGB2GRAY)

    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]].astype(np.float32)
    xy = np.stack([xx, yy], axis=-1)
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    mono_a, mono_b = grey(a), grey(b)

    def advect(frame, vector):
        delta = np.clip(vector, -18, 18) * .5
        # Invert the forward mapping at the midpoint instead of copying a displaced edge twice.
        at = xy - delta
        at = xy - cv2.remap(delta, at, None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        return cv2.remap(frame, at, None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    first = advect(a, flow.calc(mono_a, mono_b, None))
    second = advect(b, flow.calc(mono_b, mono_a, None))
    result = (first + second) * .5
    alpha = result[:, :, 3:4]
    result[:, :, :3] /= np.maximum(alpha, 1 / 255)
    return Image.fromarray(np.clip(np.rint(result * 255), 0, 255).astype(np.uint8))


def main():
    cv2.setNumThreads(1)
    shallow = list(drawings('turn-shallow.png', 55, 778))
    wide = list(drawings('turn-wide.png', 45, 790))
    with Image.open(AVATAR / 'idle.png') as face:
        front = face.convert('RGBA')
    keys = [front, shallow[0], wide[0], shallow[1], wide[1]]
    vertices, faces = load_mesh()
    frames = []
    for first, second in [(0, 1), (1, 2), (0, 3), (3, 4)]:
        at = (vertices[:, first] + vertices[:, second]) * .5
        a = remap_key(keys[first], vertices[:, first], at, faces)
        b = remap_key(keys[second], vertices[:, second], at, faces)
        frames.append(midpoint(a, b))
    write_atlas([shallow[0], wide[0]], 2, 'turn-left.webp')
    write_atlas([shallow[1], wide[1]], 2, 'turn-right.webp')
    write_atlas(frames, 2, 'turn-between.webp')


if __name__ == '__main__':
    main()
