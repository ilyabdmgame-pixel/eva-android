#!/usr/bin/env python3
"""Bake Eva's two original hand drawings into a fixed-camera, two-joint 2D gesture."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

BASE=Path(__file__).resolve().parents[1]
ART=BASE/'runtime/codex-mobile/avatar'
W,H,S=325,578,2
TILE=(246,812)
# Forearm outlines in the reference art. The inner edge follows the printed seam of the sleeve.
SLEEVES=[[(11,443),(20,414),(34,388),(58,361),(73,339),(98,351),(100,371),(89,390),(88,403),
          (75,426),(65,449),(54,466),(37,478),(24,474),(14,462)],
         [(3,401),(7,380),(13,354),(16,331),(21,312),(33,300),(39,279),(66,288),(71,309),
          (75,329),(78,351),(74,373),(70,397),(68,418),(59,435),(48,448),(35,454),(22,449),(8,429)]]
PALMS=[[(70,347),(73,324),(80,302),(88,285),(100,275),(114,265),(120,261),(121,270),(106,285),
        (116,281),(122,287),(113,299),(102,317),(101,331),(94,348),(86,355)],
       [(37,285),(31,260),(23,242),(4,217),(8,210),(24,221),(12,199),(13,190),(20,187),
        (36,206),(24,183),(27,177),(38,177),(49,197),(42,183),(45,177),(55,180),(68,207),
        (74,225),(84,213),(90,212),(91,218),(83,237),(77,258),(68,274),(67,289)]]
JOINTS=[((36,452),(85,349),(111,272)),((38,429),(54,282),(41,188))]


def rgba(path):
    with Image.open(path) as src:
        pixels=np.array(src.convert('RGBA').resize((W*S,H*S),Image.Resampling.LANCZOS),np.float32)/255
    pixels[:,:,:3]*=pixels[:,:,3:];return pixels


def matte(pixels,polygon,skin):
    rgb=np.uint8(np.clip(pixels[:,:,:3]/np.maximum(pixels[:,:,3:4],.001),0,1)*255)
    rough=np.zeros(pixels.shape[:2],np.uint8);cv2.fillPoly(rough,[np.array(polygon,np.int32)*S],255)
    wide=cv2.dilate(rough,np.ones((13,13),np.uint8));inner=cv2.erode(rough,np.ones((9,9),np.uint8))
    mask=np.full(rough.shape,cv2.GC_BGD,np.uint8);mask[wide>0]=cv2.GC_PR_BGD;mask[rough>0]=cv2.GC_PR_FGD
    if skin:
        r,g,b=rgb.astype(np.float32).transpose(2,0,1)
        colored=(g>120)&(r>1.045*g)&(g>b*1.035)&(rough>0)
        mask[colored]=cv2.GC_FGD;mask[~colored&(inner>0)]=cv2.GC_PR_BGD
    else:mask[inner>0]=cv2.GC_FGD
    mask[pixels[:,:,3]<.03]=cv2.GC_BGD
    cv2.grabCut(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),mask,None,np.zeros((1,65)),np.zeros((1,65)),4,cv2.GC_INIT_WITH_MASK)
    edge=np.float32((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD))
    edge=cv2.GaussianBlur(edge,(3,3),.55)
    return edge[:,:,None]


def limb_map(layer,old_start,old_end,start,end,width=1):
    a,b,c,d=[np.asarray(v,np.float32) for v in (old_start,old_end,start,end)]
    axis=b-a;other=d-c
    perp=np.array([-axis[1],axis[0]])/np.linalg.norm(axis)*15
    target_perp=np.array([-other[1],other[0]])/np.linalg.norm(other)*15*width
    old=np.float32([a,b,a+perp])*S;new=np.float32([c,d,c+target_perp])*S
    return cv2.warpAffine(layer,cv2.getAffineTransform(old,new),(W*S,H*S))


def over(bg,fg):return fg+bg*(1-fg[:,:,3:])


def main():
    cv2.setNumThreads(1)
    idle=rgba(ART/'idle.png');poses=[rgba(BASE/'art/chat'/f) for f in ('wave-mid.png','wave.png')]
    masks=[(matte(pic,poly,False),matte(pic,palm,True)) for pic,poly,palm in zip(poses,SLEEVES,PALMS)]
    # Where the raised forearm uncovers the jacket, use the other independently painted pose.
    occupied=[np.maximum(arm,hand) for arm,hand in masks]
    y,x=np.mgrid[:H*S,:W*S].astype(np.float32)/S
    behind=poses[0]*(1-occupied[0])+idle*occupied[0]
    hair=np.clip((303-y)/12,0,1)[:,:,None];behind=behind*(1-hair)+idle*hair
    body=poses[1]*(1-occupied[1])+behind*occupied[1]
    panels=[]
    for pose,(arm,hand) in zip(poses,masks):
        color=pose[:,:,:3]/np.maximum(pose[:,:,3:4],.001)
        wrist_skin=np.clip((color[:,:,1]-.36)*12,0,1)*np.clip((color[:,:,0]-color[:,:,1]-.055)*20,0,1)
        sleeve=arm*(1-wrist_skin[:,:,None])
        palm=np.maximum(hand,arm*wrist_skin[:,:,None])
        panels.append((pose*sleeve,pose*palm))
    def paint(key,elbow,wrist,fingers,hand_key=None):
        old_elbow,old_wrist,old_fingers=JOINTS[key];arm,hand=panels[key]
        sleeve=limb_map(arm,old_elbow,old_wrist,elbow,wrist)
        hand_key=key if hand_key is None else hand_key
        _,hand_wrist,hand_tip=JOINTS[hand_key]
        palm=limb_map(panels[hand_key][1],hand_wrist,hand_tip,wrist,fingers)
        return over(over(body,palm),sleeve)
    poses_up=[(0,(46,451),(57,554),(53,620),1),(0,(42,454),(76,511),(31,546),1),
              (0,(38,457),(87,451),(70,393),1),(0,(36,455),(86,395),(92,335)),(0,*JOINTS[0]),
              (0,(37,447),(80,332),(98,252)),(0,(37,442),(72,314),(80,237)),
              (1,(38,438),(62,299),(57,213)),(1,*JOINTS[1])]
    frames=[idle,*[paint(*args) for args in poses_up]]
    elbow,wrist,tip=JOINTS[1];vec=np.array(tip)-wrist
    for deg in [-9,-6,-3,0,3,6,9,12]:
        angle=np.deg2rad(deg);c,s=np.cos(angle),np.sin(angle)
        fingers=np.array(wrist)+np.array([[c,-s],[s,c]])@vec
        frames.append(paint(1,elbow,wrist,fingers))
    frames.extend(frames[i] for i in [7,6,5,4,2,0]);assert len(frames)==24
    # The head, eyes and neckline use the original front cel at every frame of the gesture.
    seam=np.clip((133-x)/10,0,1)*np.maximum(np.clip((92-x)/7,0,1),np.clip((y-248)/15,0,1))
    atlas=Image.new('RGBA',(TILE[0]*6,TILE[1]*4))
    for i,frame in enumerate(frames):
        image=idle*(1-seam[:,:,None])+frame*seam[:,:,None];image[:,:,:3]/=np.maximum(image[:,:,3:4],.00001)
        drawn=Image.fromarray(np.uint8(np.clip(image,0,1)*255+.5))
        cut=drawn.crop((0,round(H*S*.24),round(W*S*.41),H*S)).resize(TILE,Image.Resampling.LANCZOS)
        atlas.paste(cut,(i%6*TILE[0],i//6*TILE[1]))
    atlas.save(ART/'cel-wave.webp',format='WEBP',quality=94,method=5,alpha_quality=100)


if __name__=='__main__':main()
