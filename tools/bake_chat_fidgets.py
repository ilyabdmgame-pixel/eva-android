#!/usr/bin/env python3
"""Bake two full, registered idle gestures from Eva's painted PNGs (Pillow, NumPy and OpenCV).

Each image covers the complete 576×1024 portrait, including clear alpha outside its outline.
Hair lasts 3200 ms, the yawn lasts 3600 ms. Both return to the same idle drawing.
Run with --proof DIR for a contact sheet of the actual intermediate poses.
"""
import argparse
from math import floor, pi, sin
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

from bake_chat_wave import W, H, S, matte

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'runtime/codex-mobile/avatar'
SIZE = (576, 1024)
DURATION = {'hair': 3200, 'yawn': 3600}
JOINT_UPPER = ((52, 303), (54, 455))
UPPER = [(40,296),(52,302),(65,311),(78,330),(86,363),(92,393),(98,427),(101,452),
         (85,468),(54,475),(32,467),(27,455),(25,426),(24,398),(23,367),(25,340),(31,315)]
# Each polyline follows the sewn inner cuff or the ink contour of the thumb.
# The yawn drawing contains a complete elbow. The raised hair drawing's elbow is
# clipped by its original frame, which would create a straight edge when rotated.
SLEEVE_JOINTS=((63,451),(120,259))
SLEEVE=[(31,410),(37,388),(51,369),(62,349),(77,326),(80,308),(82,295),(95,278),
        (100,259),(102,248),(115,248),(133,253),(147,261),(144,275),(138,288),(143,300),
        (136,322),(132,342),(126,367),(118,390),(112,417),(102,438),(88,458),(72,471),
        (59,471),(43,456),(33,437),(30,422)]
PALMS = {
 'hair':('scratch',((63,183),(68,104)),
     [(51,183),(52,170),(50,153),(45,135),(49,120),(50,110),(55,104),(66,100),(75,103),
      (79,106),(76,110),(69,109),(60,112),(58,122),(66,115),(72,116),(81,121),(83,125),
      (82,128),(78,128),(71,123),(65,125),(61,133),(69,128),(74,128),(82,132),(85,139),
      (83,144),(80,142),(78,137),(74,136),(69,141),(71,150),(75,160),(77,167),(75,177),(71,186)]),
 'yawn':('yawn-mid',((113,280),(143,208)),
     [(99.2,273.4),(101,266),(102.4,258.6),(104.7,250.1),(105.6,247.6),(107.3,244.9),
      (110,241),(113.5,236.3),(115.4,233.6),(116.4,230.4),(117.1,229.8),(117.4,230.2),
      (120.1,226.7),(122.6,224.1),(127,220.9),(131.6,217.3),(138,212.4),(142.6,209.3),
      (145,207.9),(146.3,207.9),(147,209),(146.8,211.4),(145.7,213.2),(143.6,215.8),
      (148,212.5),(151.6,210.3),(153.6,210.1),(154.6,211.4),(154.5,214.3),(153.7,216.7),
      (151.6,219.8),(153.6,219.4),(155.1,219.2),(156.3,220.1),(156.4,222),(155.4,224.3),
      (152.3,228.6),(150.1,231.3),(146.5,236.6),(150,234.1),(153.4,232.2),(154.8,232.2),
      (156,232.9),(156,235.6),(155,238.7),(151.7,242.6),(148.7,246.3),(145.3,250.3),
      (142.9,254.6),(139.8,260.5),(138,266.8),(135,275.8),(131,285.2)]),
}
# Depth foreshortens the arm as the wrist swings in front of the chest.
# Rows give elbow, wrist and fingertip in the fixed portrait camera.
REACH = {
 'hair': [((53,459),(94,578),(113,647)),((39,455),(110,530),(166,564)),
          ((28,444),(119,465),(171,428)),((22,432),(107,393),(138,328)),
          ((25,414),(87,313),(104,246)),((33,390),(55,245),(68,172)),
          ((34,355),(63,183),(68,104))],
 'yawn': [((53,459),(94,578),(113,647)),((45,456),(111,535),(168,560)),
          ((39,451),(126,472),(183,443)),((40,447),(133,409),(173,352)),
          ((45,448),(132,343),(170,286)),((53,450),(119,280),(154,215)),
          ((62,452),(121,260),(159,192))],
}


def smooth(x):
    x = np.clip(x, 0., 1.)
    return x*x*(3.-2.*x)


def rgba(name):
    with Image.open(ART / (name+'.png')) as base:
        return np.array(base.convert('RGBa').resize((W*S,H*S),Image.Resampling.LANCZOS).convert('RGBA'))


def covered(background,foreground):
    """Premultiplied RGBA in the renderer. A clear pixel owns no RGB outline."""
    return foreground+background*(1.-foreground[:,:,3:4])


def premul(raw):
    value=raw.astype(np.float32)/255
    value[:,:,:3]*=value[:,:,3:4]
    return value


def unmul(value):
    pic=value.copy()
    pic[:,:,:3]/=np.maximum(pic[:,:,3:4],1/65535)
    return Image.fromarray(np.uint8(np.clip(pic*255+.5,0,255)))


def polygon(points,feather=.65):
    mask=np.zeros((H*S,W*S),np.uint8)
    cv2.fillPoly(mask,[np.int32(np.round(np.asarray(points)*S))],255,lineType=cv2.LINE_AA)
    if feather: mask=cv2.GaussianBlur(mask,(0,0),feather*S)
    return mask.astype(np.float32)[:,:,None]/255


class Limb:
    def __init__(self,source,image_mask,joints):
        alpha=source[:,:,3]*image_mask[:,:,0]
        x,y,w,h=cv2.boundingRect(np.uint8(alpha>.004))
        self.bounds=np.float32([[0,0],[w,0],[0,h],[w,h]])
        self.color=(source*image_mask)[y:y+h,x:x+w].copy()
        self.origin=np.array([x,y],np.float32)
        self.joints=np.asarray(joints,np.float32)*S

    def paint(self,frame,pair,thickness=1.):
        a,b=self.joints;start,finish=np.asarray(pair,np.float32)*S
        source_axis=b-a; axis=finish-start
        def normal(v):return np.float32([-v[1],v[0]])/(np.linalg.norm(v) or 1)
        src=np.float32([a,b,a+normal(source_axis)*16])-self.origin
        dst=np.float32([start,finish,start+normal(axis)*16*thickness])
        transform=cv2.getAffineTransform(src,dst)
        xy=self.bounds@transform[:,:2].T+transform[:,2]
        x0,y0=np.maximum((0,0),np.floor(xy.min(axis=0)-2).astype(int))
        x1,y1=np.minimum((W*S,H*S),np.ceil(xy.max(axis=0)+2).astype(int))
        if x1<=x0 or y1<=y0:return
        transform[:,2]-=(x0,y0)
        overlay=cv2.warpAffine(self.color, transform, (x1-x0,y1-y0), flags=cv2.INTER_LINEAR)
        frame[y0:y1,x0:x1]=covered(frame[y0:y1,x0:x1],overlay)


def spline(points,t):
    p=np.asarray(points,np.float32);x=np.clip(t,0,1)*(len(p)-1);i=min(floor(x),len(p)-2);u=x-i
    p0,p1,p2,p3=p[max(0,i-1)],p[i],p[i+1],p[min(len(p)-1,i+2)]
    return p1+.5*u*((p2-p0)+u*((2*p0-5*p1+4*p2-p3)+u*(3*(p1-p2)+p3-p0)))


class Face:
    """Paint an occluding lid above each actual stationary iris. No flow or paired facial outlines."""
    def __init__(self,raw,mid,closed):
        self.orig=raw
        self.closed=closed
        self.eyes=[]
        # Per-column envelope of the upper and lower lashes in the front drawing.
        for xvals,top,bottom,end in [
            ([105,109,115,123,131,139,146,150],[153,148,144,141,140,143,147,151],
             [154,157,162,165,166,163,157,151],[163,163,162,161,159,158,159,160]),
            ([176,179,184,191,199,207,215,220],[150,146,142,139,138,139,142,148],
             [150,155,162,164,163,162,156,149],[160,159,158,158,158,159,160,159])]:
            left,right=xvals[0]-8,xvals[-1]+8;box=(left*S,131*S,right*S,179*S)
            bx,by,rx,ry=box;strip=closed[by:ry,bx:rx,:3].copy();original=raw[by:ry,bx:rx,:3]
            ys,xs=np.mgrid[by:ry,bx:rx].astype(np.float32)/S
            def line(values):return np.interp(xs[0],xvals,values).astype(np.float32)[None,:]
            ceiling,ground,shut=line(top),line(bottom),line(end)
            span=smooth((xs-xvals[0]+2)/4)*smooth((xvals[-1]+2-xs)/4)
            # Heal only the closed, inked lash in a front-facing painting; surrounding skin stays painted.
            used=np.uint8((np.abs(ys-shut)<6.8)&(xs>xvals[0]-2)&(xs<xvals[-1]+2)&(strip[:,:,:3].mean(axis=2)<158))*255
            used=cv2.dilate(used,np.ones((3,3),np.uint8))
            blank=cv2.inpaint(strip,used,4,cv2.INPAINT_TELEA)
            # Sample the real ink from the closed pose and adapt it to a contour of a known aperture.
            ink=np.maximum(0,blank.astype(np.float32).mean(axis=2)-strip.astype(np.float32).mean(axis=2))
            ink=np.clip(ink/85.,0,1)*np.uint8(used>0)*span
            self.eyes.append((box,ys,xs,ceiling,ground,shut,span,blank,original,strip,ink))
        # The middle yawn drawing supplies an unobstructed open mouth; the hand covers it at the peak.
        self.mouth=mid[187*S:207*S,154*S:175*S,:3].copy()
        m=np.zeros(self.mouth.shape[:2],np.uint8)
        h,w=m.shape;cv2.ellipse(m,(w//2,h//2),(round(w*.41),round(h*.39)),0,0,360,255,-1,lineType=cv2.LINE_AA)
        self.mouth_alpha=cv2.GaussianBlur(m,(3,3),.65).astype(np.float32)/255
        y0,y1,x0,x1=182*S,214*S,143*S,184*S
        area=raw[y0:y1,x0:x1,:3].copy();rm=np.zeros(area.shape[:2],np.uint8)
        cv2.ellipse(rm,(21*S,16*S),(15*S,5*S),0,0,360,255,-1)
        self.skin=cv2.inpaint(area,rm,4,cv2.INPAINT_TELEA)

    def paint(self,frame,closure,mouth):
        if closure>.001:
            for box,y,x,top,bottom,shut,span,bare,original,full,ink in self.eyes:
                x0,y0,x1,y1=box
                high=top+(shut-top)*closure;low=bottom+(shut-bottom)*closure
                window=np.clip(y-high+.65,0,1)*np.clip(low-y+.7,0,1)
                # Only deform the opening and expose intact skin outside. The pupil keeps its round shape.
                region=smooth((x-x[:,0:1])/4)*smooth((x[:,-1:]-x)/4)*smooth((y-131)/6)*smooth((179-y)/7)
                eye=original*window[:,:,None]+bare*(1.-window[:,:,None])
                mapx=(x*S-x0).astype(np.float32);mapy=(y*S-y0-(high-shut)*S).astype(np.float32)
                stroke=cv2.remap(full,mapx,mapy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
                strength=cv2.remap(ink,mapx,mapy,cv2.INTER_LINEAR)*smooth(closure/.20)
                eye=eye*(1.-strength[:,:,None])+stroke*strength[:,:,None]
                shut_weight=float(smooth((closure-.84)/.16))
                eye=eye*(1.-shut_weight)+full*shut_weight
                weight=(region*smooth(closure/.16))[:,:,None]
                rgb=original*(1.-weight)+eye*weight
                frame[y0:y1,x0:x1,:3]=rgb/255.
        if mouth>.001:
            y0,y1,x0,x1=182*S,214*S,143*S,184*S
            base=self.orig[y0:y1,x0:x1,:3];v=float(smooth(mouth/.22))
            region=(base*(1.-v)+self.skin*v)/255.
            w=max(2,round((10+15*mouth)*S));h=max(1,round((1+23*mouth)*S))
            x=round((164.5-143)*S-w/2);y=round((198.-182)*S-h/2)
            sample=cv2.resize(self.mouth,(w,h),interpolation=cv2.INTER_LINEAR)/255.
            alpha=cv2.resize(self.mouth_alpha,(w,h),interpolation=cv2.INTER_LINEAR)[:,:,None]*v
            region[y:y+h,x:x+w]=sample*alpha+region[y:y+h,x:x+w]*(1.-alpha)
            frame[y0:y1,x0:x1,:3]=region


class Painter:
    def __init__(self,gesture):
        cv2.setRNGSeed(0)
        names=['idle','scratch','yawn-mid','yawn']
        self.gesture=gesture;raw={n:rgba(n) for n in names};pics={n:premul(v) for n,v in raw.items()}
        self.neutral=pics['idle'];self.still=unmul(self.neutral).resize(SIZE,Image.Resampling.LANCZOS)
        self.face=Face(raw['idle'],raw['yawn-mid'],raw['yawn']) if gesture=='yawn' else None
        self.upper=Limb(self.neutral,matte(self.neutral,UPPER,False),JOINT_UPPER)
        src=pics['yawn'];a=matte(src,SLEEVE,False)
        rgb=raw['yawn'][:,:,:3].astype(np.float32)/255
        skin=np.clip((rgb[:,:,1]-.38)*12,0,1)*np.clip((rgb[:,:,0]-rgb[:,:,1]-.060)*24,0,1)
        self.sleeve=Limb(src,a*(1-skin[:,:,None]),SLEEVE_JOINTS)
        key,joints,outline=PALMS[gesture];src=pics[key]
        # At the mouth fingertips and cheek share their ink/skin colour. An authored contour separates them.
        alpha=matte(src,outline,True) if gesture=='hair' else polygon(outline,.35)
        self.hand=Limb(src,alpha,joints)
        y,x=np.mgrid[:H*S,:W*S].astype(np.float32)/S
        side=smooth((136-x)/27)*smooth((y-343)/51)
        # In the high bent-elbow drawing, the lower jacket/hair that the neutral forearm hid is visible.
        self.back=self.neutral*(1-side[:,:,None])+pics['scratch']*side[:,:,None]
        if gesture=='hair':
            # Pull only the free temple lock between Eva's fingers. Bangs, forehead and crown keep their registration.
            ycut,xcut=slice(70*S,221*S),slice(29*S,101*S)
            self.lock_bounds=(ycut,xcut)
            yy,xx=np.mgrid[70*S:221*S,29*S:101*S].astype(np.float32)
            damp=np.exp(-.5*((xx/S-(61+.10*np.abs(yy/S-150)))/15.)**2)
            damp*=smooth((yy/S-75)/29)*smooth((218-yy/S)/42)*smooth((xx/S-30)/15)*smooth((101-xx/S)/21)
            self.lock=(xx,yy,damp)
        self.reach=np.asarray(REACH[gesture],np.float32)

    def __call__(self,ms):
        name=self.gesture;total=DURATION[name]
        if ms<=160 or ms>=total-160:return self.still
        up,down=(1180,1900) if name=='hair' else (1250,2200)
        p=float(smooth((ms-160)/(up-160))*(1-smooth((ms-down)/(total-160-down))))
        elbow,wrist,tip=spline(self.reach,p)
        hold=float(smooth((ms-up+100)/210)*smooth((down-ms+110)/190))
        if name=='hair':
            stroke=hold*sin((ms-up)*2*pi/470)
            wrist+=np.float32([.9*stroke,3.8*stroke]);tip+=np.float32([3.8*stroke,10.*stroke]);elbow[0]-=2.0*stroke
        else:
            breath=hold*sin((ms-up)*pi/860.)
            wrist+=np.float32([-.9*breath,1.5*breath]);tip+=np.float32([-.4*breath,.9*breath]);elbow[0]+=1.7*breath
        frame=self.back.copy()
        if name=='hair' and p>.62:
            xx,yy,damp=self.lock;engage=float(smooth((p-.62)/.34))
            frame[self.lock_bounds]=cv2.remap(self.neutral,xx+(4.7*engage+1.3*stroke)*S*damp,
                yy+(2.5*engage+2.*stroke)*S*damp,cv2.INTER_LINEAR)
        if self.face:
            shut=float(smooth((ms-510)/710)*smooth((total-510-ms)/670))
            open_mouth=float(smooth((ms-370)/830)*smooth((total-380-ms)/760))
            self.face.paint(frame,shut,open_mouth)
        self.upper.paint(frame,((52,303),elbow),.98)
        forearm=elbow-wrist
        overlap=wrist+forearm/max(np.linalg.norm(forearm),1)*(8 if name=='hair' else 4)
        self.hand.paint(frame,(overlap,tip),.98+min(p,.8)*.025)
        self.sleeve.paint(frame,(elbow,wrist),1.-.08*(1-p))
        # At entry/exit the relaxed cuff is entirely below the portrait. Register its cloth seam before lifting.
        mix=float(smooth(p/.095))
        if mix<1:frame=self.neutral*(1-mix)+frame*mix
        return unmul(frame).resize(SIZE,Image.Resampling.LANCZOS)


def bake(kind,proof,proof_only=False):
    painter=Painter(kind);duration=DURATION[kind]
    if proof:
        times=[0,345,480,630,770,910,1060,1260,1480,1670,1860,duration-930,duration-640,duration-390,duration-140]
        board=Image.new('RGB',(5*190,3*344),(72,82,94));pen=ImageDraw.Draw(board)
        for i,t in enumerate(times):
            cell=painter(t).copy();cell.thumbnail((186,320), Image.Resampling.LANCZOS);point=(190*(i%5),344*(i//5))
            board.paste(cell,point,cell);pen.text((point[0]+8,point[1]+322),str(t),fill='white')
        proof.mkdir(parents=True,exist_ok=True);board.save(proof/(kind+'-poses.jpg'),quality=92)
    if proof_only:return
    count=round((duration-320)*30/1000)
    ends=[round((duration-320)*i/count) for i in range(count+1)]
    frames=[painter.still]+[painter(160+(left+right)/2) for left,right in zip(ends,ends[1:])]+[painter.still]
    lengths=[160]+[b-a for a,b in zip(ends,ends[1:])]+[160]
    assert sum(lengths)==duration
    dest=ART/('idle-'+kind+'.webp');temporary=dest.with_suffix('.webp.tmp')
    try:
        frames[0].save(temporary,save_all=True,append_images=frames[1:],duration=lengths,loop=1,
                       format='WEBP',quality=88,alpha_quality=100,method=3,kmin=15,kmax=29,background=(0,0,0,0))
        temporary.replace(dest)
    finally:
        temporary.unlink(missing_ok=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gesture',choices=['hair','yawn']);parser.add_argument('--proof',type=Path)
    parser.add_argument('--proof-only',action='store_true');args=parser.parse_args();cv2.setNumThreads(1)
    for gesture in ([args.gesture] if args.gesture else DURATION):bake(gesture,args.proof,args.proof_only)
