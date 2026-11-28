"""Bake two fixed-camera painted eyes. Only the lids move independently during a wink."""
from dataclasses import dataclass

import cv2
import numpy as np


# Anchors are on the 400x284 face crop. Rows are the lower edge of the upper lash,
# the lower lid, the resting closed lash, and the lifted smiling lash, in that order.
# Both closed lines were traced from an actual closed-eye drawing.
_GUIDES = [
    ([57,64,75,88,102,115,128,140,153], [103,99,93,88,87,87,91,97,106],
     [104,120,130,135,138,138,134,124,106], [124,126,128,130,129,128,126,126,128],
     [130,131,126,122,119,118,119,122,124]),
    ([241,249,260,274,288,302,316,328,340], [103,98,90,84,83,83,85,91,98],
     [104,115,126,132,134,132,126,117,99], [128,126,125,126,127,128,127,123,118],
     [123,120,116,113,112,113,117,122,127]),
]

# Upper and lower closure use the artwork's natural neutral-to-closed range.
# A negative upper value raises a lid. Gaze is always ONE translation for the pair.
@dataclass(frozen=True)
class Pose:
    upper: float=0
    lower: float=0
    smile: float=0
    gaze: tuple=(0,0)
    wink: float=0


REST=Pose()
KEYS={
    'warm':(Pose(.05,.08,.7),Pose(.27,.38,.85)),
    'joy':(Pose(.04,.08,.65),Pose(-.035,.13,.85)),
    'laugh':(Pose(.33,.71,1),Pose(1,1,1)),
    'curious':(Pose(-.09,.055,.2,(2,-1)),Pose(-.17,.035,.2,(3,-2))),
    'surprised':(Pose(-.14,-.06),Pose(-.34,-.11)),
    'sly':(Pose(.16,.08,.6,(1,0)),Pose(.29,.22,.55,(2,0))),
    'thinking':(Pose(.04,.08,0,(3,-4)),Pose(.23,.20,0,(5,-7))),
    'skeptical':(Pose(.09,.06,.1,(1,0)),Pose(.39,.15,.15,(4,0))),
    'shy':(Pose(-.03,.04,.3,(1,1)),Pose(.47,.33,.3,(3,3))),
    'pout':(Pose(.15,.09,.15),Pose(.23,.13,.12)),
    'confident':(Pose(.13,.08,.35),Pose(.20,.10,.35)),
    'sad':(Pose(.24,.11,0,(-1,1)),Pose(.30,.18,0,(-2,2))),
    'excited':(Pose(-.12,-.03,.4),Pose(-.26,-.07,.5)),
    'blink':(Pose(.61,.08),Pose(1,1)),
    'wink':(Pose(.05,.04,.55,wink=.53),Pose(-.075,.015,.75,wink=1)),
    'annoyed':(Pose(.13,.08),Pose(.28,.15)),
    'tired':(Pose(.35,.11,0,(0,1)),Pose(.78,.30,0,(0,2))),
    'relieved':(Pose(.25,.25,.6),Pose(1,1,.70)),
    'confused':(Pose(-.055,.025,.13,(-1,0)),Pose(-.12,.03,.13,(-3,0))),
    'glance':(REST,Pose(gaze=(16.,0))),
}


def interpolate(a,b,t):
    mix=lambda x,y: x+(y-x)*t
    return Pose(mix(a.upper,b.upper),mix(a.lower,b.lower),mix(a.smile,b.smile),
                tuple(mix(x,y) for x,y in zip(a.gaze,b.gaze)),mix(a.wink,b.wink))


def pose_at(name,index):
    mid,full=KEYS[name]
    if name=='glance':return interpolate(REST,full,index/11)
    return interpolate(REST,mid,index/5) if index<=5 else interpolate(mid,full,(index-5)/6)


def blend(a,b,weight):return a+(b-a)*weight[...,None]


def sample(image,x,y):
    return cv2.remap(image,x.astype(np.float32),y.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)


def spline(coords,values,x):
    # Monotone cubic Hermite, so the ink at the canthi cannot overshoot or fold back.
    coords=np.asarray(coords,np.float32);values=np.asarray(values,np.float32)
    slopes=np.diff(values)/np.diff(coords)
    tangents=np.zeros(len(values),np.float32);tangents[0],tangents[-1]=slopes[0],slopes[-1]
    for i in range(1,len(values)-1):
        if slopes[i-1]*slopes[i]>0:tangents[i]=2/(1/slopes[i-1]+1/slopes[i])
    ix=np.clip(np.searchsorted(coords,x,side='right')-1,0,len(values)-2)
    dx=coords[ix+1]-coords[ix];t=np.clip((x-coords[ix])/dx,0,1)
    return ((2*t**3-3*t**2+1)*values[ix]+(t**3-2*t**2+t)*dx*tangents[ix]
            +(-2*t**3+3*t**2)*values[ix+1]+(t**3-t**2)*dx*tangents[ix+1])


class PaintedEyes:
    def __init__(self,idle,closed,smiling,wide,excited):
        self.idle=idle.astype(np.float32)
        self.closed=closed.astype(np.float32);self.smiling=smiling.astype(np.float32)
        self.wide=wide.astype(np.float32);self.excited=excited.astype(np.float32)
        self.regions=[]
        for guide in _GUIDES:
            coords,*curves=guide
            start=max(0,coords[0]-9);end=coords[-1]+9
            y,x=np.mgrid[49:155,start:end].astype(np.float32)
            upper,lower,sleep,smile=[spline(coords,q,x) for q in curves]
            # The key drawings sometimes put an eye higher than neutral. Take it out
            # before interpolating the expression so that a second iris cannot survive.
            midx=(coords[0]+coords[-1])*.5
            radius=((x-midx)/((coords[-1]-coords[0])*.5+8))**6+((y-105)/51)**6
            support=np.clip((1-radius)/.36,0,1)
            self.regions.append((slice(49,155),slice(start,end),x,y,upper,lower,sleep,smile,support))

    def remove_key_eyes(self,image):
        result=image.astype(np.float32).copy()
        for sy,sx,_,_,_,_,_,_,support in self.regions:
            result[sy,sx]=blend(result[sy,sx],self.idle[sy,sx],support)
        return np.rint(result).astype(np.uint8)

    def draw(self,background,pose,name):
        result=background.astype(np.float32).copy()
        dx,dy=pose.gaze
        for side,(sy,sx,x,y,upper,lower,sleep,smile,support) in enumerate(self.regions):
            gx,*curves=_GUIDES[side]
            edge=np.minimum(x-gx[0],gx[-1]-x)
            closure=pose.upper;lift=pose.lower
            if side==1 and pose.wink:
                closure+=(1-closure)*pose.wink;lift+=(1-lift)*pose.wink
            closed_line=sleep+(smile-sleep)*pose.smile
            opening=np.clip(edge/16,0,1)
            top=upper+(closed_line-upper)*closure*(opening if closure<0 else 1)
            bottom=np.maximum(top,lower+(closed_line-lower)*lift*(opening if lift<0 else 1))
            # Expose the eye on a single, rigid paint plate; never remesh or crossfade
            # the two irises separately. Only the aperture controls visibility.
            px,py=x-dx,y-dy
            src_top=spline(gx,curves[0],px);src_bottom=spline(gx,curves[1],px)
            inside=np.clip((py-src_top-.45)*1.3,0,1)*np.clip((src_bottom-py-.4)*1.3,0,1)
            inside*=np.clip((px-gx[0]-1)*.7,0,1)*np.clip((gx[-1]-1-px)*.7,0,1)
            if closure<0:
                spread=min(1,-closure*5)
                inside*=1-spread*(1-np.clip((py-src_top-1.2)/4.,0,1))
            texture=sample(self.idle,px,py)
            # Parts revealed beyond the neutral artwork sample the fully open eye,
            # aligned to the same pupil. Outside its rim the sclera falls into shadow.
            cx,cy=(109.8,106.7) if side==0 else (288.7,101.5)
            # Register the neutral and open drawings on their actual catchlights.
            wx,wy=(112.76,104.21) if side==0 else (288.67,100.69)
            wide_x=wx+(px-cx)*.89;wide_y=wy+(py-cy)*.96
            wide=sample(self.wide,wide_x,wide_y)
            rim=((px-cx)/30.3)**2+((py-cy)/31.0)**2
            iris=np.clip((1-rim)*14,0,1)
            depth=np.clip((y-top)/np.maximum(1,bottom-top),0,1)
            white=np.array([201,187,184],np.float32)+(np.array([245,235,227])-np.array([201,187,184]))*(np.clip(depth*1.65,0,1)[...,None])
            # Carve the open drawing's eyelash off the eye plate. It belongs to the lid.
            wide_top=(79.5 if side==0 else 75.5)+.0038*(wide_x-wx)**2
            wide=blend(white,wide,np.clip((wide_y-wide_top)/1.75,0,1))
            if dx or dy:
                # The canthus belongs to the fixed eyelid. Moving that dark outer
                # corner with the pupil would leave an extra rotating stroke in white.
                center_rim=((x-cx)/33.5)**2+((y-cy)/34.0)**2
                sclera=np.clip((center_rim-1)*7,0,1)*np.clip(y-upper-1,0,1)*np.clip(lower-y-1,0,1)
                fixed_white=blend(white,self.idle[sy,sx],sclera)
                plate=blend(fixed_white,blend(wide,texture,inside),iris)
            else:
                plate=blend(blend(white,wide,iris),texture,inside)
            if name=='excited' and closure<0:
                # The four-point reflection belongs to the same moving iris plate.
                star=sample(self.excited,px+(1.7 if side==0 else -1.2),py)
                shine=np.clip((star[:,:,1]-187)/49,0,1)*np.clip((star[:,:,0]-222)/28,0,1)
                plate=blend(plate,star,np.clip((-closure-.11)*6.6,0,1)*shine*iris)
            # Re-register the painted lash strips to their moving edge, maintaining
            # texture above/below it and increasingly using the original closed line.
            # Translate the ink at its painted thickness. A short whole-lid warp
            # can fold when a full blink travels farther than the warp's support.
            du=np.clip(1-np.maximum(top-y-13,0)/76,0,1)
            dl=np.clip(1-np.maximum(y-bottom-9,0)/50,0,1)
            up=sample(self.idle,x,y+(upper-top)*du)
            down=sample(self.idle,x,y+(lower-bottom)*dl)
            mix=np.clip(max(closure,lift),0,1)
            cheerful=name in ('warm','joy','laugh','sly','confident','relieved') or (name=='wink' and side==1)
            shut_ink=self.smiling if cheerful else self.closed
            shut_line=smile if cheerful else sleep
            if mix:
                shut=sample(shut_ink,x,y+(shut_line-top)*du)
                up=blend(up,shut,np.full_like(x,mix))
                shut_lower=sample(shut_ink,x,y+(shut_line-bottom)*dl)
                down=blend(down,shut_lower,np.full_like(x,mix))
            # A blink never moves a strand of fringe or the cheek below the lashes.
            # Keep the fixed painted skin outside a narrow strip around each lid.
            fixed=shut_ink[sy,sx]
            fixed_up=blend(self.idle[sy,sx],fixed,np.clip((top-upper)/12,0,1))
            fixed_down=blend(self.idle[sy,sx],fixed,np.clip((lower-bottom)/10,0,1))
            up=blend(fixed_up,up,np.clip((25-(top-y))/13,0,1))
            down=blend(fixed_down,down,np.clip((19-(y-bottom))/10,0,1))
            upper_side=np.clip(y-top+.55,0,1)
            lower_side=np.clip(y-bottom+.55,0,1)
            painted=blend(blend(up,plate,upper_side),down,lower_side)
            # Faded support lets the original fringe, eyebrows and cheeks frame the eyes.
            result[sy,sx]=blend(result[sy,sx],painted,support*np.clip((edge+2)/7,0,1))
        return np.uint8(np.clip(result+.5,0,255))
