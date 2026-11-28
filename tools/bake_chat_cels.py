#!/usr/bin/env python3
"""Bake fixed-camera 2D facial cels from Eva's two painted keys per expression (Pillow, NumPy, OpenCV)."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

if __package__:
    from .chat_gaze import PaintedEyes, pose_at
else:
    from chat_gaze import PaintedEyes, pose_at

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'runtime/codex-mobile/avatar'
MOODS = ROOT / 'runtime/eva-builtins/emotions'
# The crop is shared by the runtime compositor. The complete head and hair stay on the original cel.
BOX = (.26, .195, .745, .39)
SIZE = (400, 284)
NAMES = ['warm', 'joy', 'laugh', 'curious', 'surprised', 'sly', 'thinking', 'skeptical', 'shy',
         'pout', 'confident', 'sad', 'excited', 'blink', 'wink', 'annoyed', 'tired', 'relieved', 'confused']


def facial_mask(blink):
    w,h = SIZE
    def box(bounds):
        x,y,x2,y2=bounds
        return (round((x-BOX[0])/(BOX[2]-BOX[0])*w), round((y-BOX[1])/(BOX[3]-BOX[1])*h),
                round((x2-BOX[0])/(BOX[2]-BOX[0])*w), round((y2-BOX[1])/(BOX[3]-BOX[1])*h))
    result=Image.new('L',SIZE)
    pen=ImageDraw.Draw(result)
    for pos in [(.291,.203,.474,.302),(.53,.201,.708,.30)]:
        pen.ellipse(box(pos), fill=255)
    if not blink:
        for pos in [(.33,.279,.464,.329),(.551,.279,.686,.329),(.391,.316,.617,.378)]:
            pen.ellipse(box(pos),fill=255)
    return result.filter(ImageFilter.GaussianBlur(4))


def face(path):
    with Image.open(path) as master:
        w,h = master.size
        return np.asarray(master.convert('RGB').crop(tuple(round(v * (w if i % 2 == 0 else h)) for i,v in enumerate(BOX)))
                          .resize(SIZE,Image.Resampling.LANCZOS))


def cel_segment(first, last, steps):
    h,w=first.shape[:2]
    y,x=np.mgrid[:h,:w].astype(np.float32)
    field=np.stack((x,y),axis=-1)
    a,b=(cv2.cvtColor(im,cv2.COLOR_RGB2GRAY) for im in (first,last))
    matcher=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    matcher.setFinestScale(0)
    forward=matcher.calc(a,b,None)
    backward=matcher.calc(b,a,None)
    def sample(data, lookup):
        return cv2.remap(data,lookup[:,:,0],lookup[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    for step in range(1,steps+1):
        if step==steps:
            yield last
            continue
        t=step/steps
        src=field-forward*t
        dst=field-backward*(1-t)
        for _ in range(3):
            src=field-sample(forward,src)*t
            dst=field-sample(backward,dst)*(1-t)
        left=sample(first,src).astype(np.float32)
        right=sample(last,dst).astype(np.float32)
        # A newly covered iris or the interior of a mouth must have one ink contour.
        # Blend matching paper/color, pick a single drawing at an occluding edge.
        difference=np.max(np.abs(left-right),axis=-1,keepdims=True)
        cover=np.clip((difference-15)/24,0,1)
        amount=t+cover*((1.0 if t>=.5 else 0.0)-t)
        yield np.uint8(np.clip(left*(1-amount)+right*amount+.5,0,255))


def bake_speech():
    files=sorted((ROOT / 'runtime/eva-builtins/speech').glob('*.png'))
    if len(files)!=12:raise ValueError('Two drawings for each of six speech shapes are required')
    def mouth(path):
        with Image.open(path) as source:
            w,h=source.size
            return np.asarray(source.convert('RGB').crop((round(w*.36), round(h*.31), round(w*.64), round(h*.38))))
    idle=mouth(ART/'idle.png')
    h,w=idle.shape[:2];atlas=Image.new('RGB',(6*w,6*h))
    for row in range(6):
        mid,full=(mouth(file) for file in files[row*2:row*2+2])
        for col,rgb in enumerate([idle,*cel_segment(idle,mid,2),*cel_segment(mid,full,3)]):
            atlas.paste(Image.fromarray(rgb),(w*col,h*row))
    atlas.save(ART/'visemes.webp',format='WEBP',quality=96,method=5)
    print('36 speech cels',flush=True)


def main():
    cv2.setNumThreads(1)
    bake_speech()
    idle=face(ART/'idle.png')
    refs=sorted(MOODS.glob('*.png'))
    if len(refs)!=2*len(NAMES):raise ValueError('Two painted keys per expression are required')
    eyes=PaintedEyes(idle,face(MOODS/'28-blink-full.png'),face(MOODS/'06-laugh-full.png'),
                     face(MOODS/'10-surprised-full.png'),face(MOODS/'26-excited-full.png'))
    for i,name in enumerate([*NAMES,'glance']):
        if name=='glance':
            cells=[idle]*12
        else:
            a,b=refs[2*i:2*i+2]
            if name=='warm':a,b=b,a
            mid,end=eyes.remove_key_eyes(face(a)),eyes.remove_key_eyes(face(b))
            cells=[idle,*cel_segment(idle,mid,5),*cel_segment(mid,end,6)]
        mask=facial_mask(name in ('blink','glance'))
        atlas=Image.new('RGBA',(SIZE[0]*4,SIZE[1]*3))
        for index,rgb in enumerate(cells):
            drawn=eyes.draw(rgb,pose_at(name,index),name) if index else idle
            cel=Image.fromarray(drawn).convert('RGBA');cel.putalpha(mask)
            atlas.paste(cel,((index%4)*SIZE[0],(index//4)*SIZE[1]))
        target=ART/f'cel-{name}.webp'
        atlas.save(target,format='WEBP',quality=95,method=5,alpha_quality=100)
        print(name,target.stat().st_size,flush=True)


if __name__=='__main__':main()
