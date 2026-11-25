"""Verify contacts in the actual RGBA that ships in the APK."""
from math import atan2,degrees,hypot,pi,sin
from pathlib import Path
import sys

from PIL import Image

assets=Path(__file__).resolve().parents[2]/'app/src/main/assets/eva-pet'
rows={parts[0]:tuple(map(int,parts[1:])) for parts in (line.split() for line in (assets/'frames.tsv').read_text().splitlines())}

def painted(name):
    im=Image.new('RGBA',(402,540))
    with Image.open(assets/(name+'.png')) as png:
        l,t,w,h=rows[name]
        assert png.size==(w,h)
        im.paste(png,(l,t))
    return im

def palm(im,x,y):
    pts=[im.getpixel((round(x)+dx,round(y)+dy)) for dx in (-1,0,1) for dy in (-1,0,1)]
    return sum(a>=185 and r>g>b and r>=153 for r,g,b,a in pts)>=5

def ease(t):
    t=min(1,max(0,t))
    return t*t*(3-2*t)

shoe_height=[[],[]]
for i in range(36):
    im=painted(f'rope_grip_{i:02}')
    u=(i%18)/18
    travel=ease((u-.10)/.72)
    free=ease((u-.28)/.60)
    mobile_x=301+(-24 if i>=18 else 20)*sin(pi*free)
    assert palm(im,301,168-74*travel),('support palm',i)
    assert palm(im,mobile_x,94-74*travel+148*free),('passing palm',i)
    # White laces/uppers at the shaft verify that the painted foot actually
    # meets the rope. A moving root or the bounding box alone cannot pass.
    shoes=[y for y in range(355,535) if (lambda p:p[3]>175 and min(p[:3])>110)(im.getpixel((301,y)))]
    assert len(shoes)>=15,('foot clamp',i,len(shoes))
    if i%18>=8:
        # Once pressure is back, the two shoes stay on the same *world*
        # segment despite several more frames of downward torso travel.
        shoe_height[i//18].append((shoes[0]+74*travel,shoes[-1]+74*travel))

for samples in shoe_height:
    for contour in zip(*samples):
        assert max(contour)-min(contour)<4,('locked shoe slipped',contour)

for name,a,b in [
        ('ledge','rope_edge_36','rope_mount_00'),('take weight','rope_mount_11','rope_grip_00'),
        ('short slide','rope_brake_00','rope_grip_00'),('squeeze','rope_brake_11','rope_grip_00'),
        ('touchdown','rope_grip_00','rope_release_00'),('side standing','rope_release_11','rope_recover_00'),
        ('free behavior','rope_recover_11','spring_00')]:
    assert painted(a).tobytes()==painted(b).tobytes(),name

targets=(482,489,502,519,530,530,530,530,530,530,530,530)
for i,target in enumerate(targets):
    im=painted(f'rope_release_{i:02}')
    assert im.getchannel('A').getbbox()[3]==target,('sole',i,im.getchannel('A').getbbox())
    if i>=4:
        assert max(im.getpixel((x,528))[3] for x in range(243,248))>150,('bearing sole / x245',i)
for i in range(12):
    t=ease(i/11)
    assert palm(painted(f'rope_mount_{i:02}'),271+30*t,110-16*t),('mount / edge',i)
for bank,n in [('grip',36),('mount',12),('release',12),('recover',12),('brake',12)]:
    frames=[painted(f'rope_{bank}_{i:02}').tobytes() for i in range(n)]
    if bank=='brake':frames.pop()
    if bank=='grip':
        # 2–3 held keys are the grip after the recovery hand accepts weight.
        for start in (0,18):
            work=frames[start+2:start+16]
            assert len(set(work))==len(work),'frozen while feeding the rope'
        loop=frames+frames[:3]
        assert all(len(set(loop[i:i+4]))>1 for i in range(n)),'long static hold'
    else:
        assert len(set(frames))==len(frames),(bank,'repeated frozen frame')
def skin_component(im,center):
    # Connected knuckle silhouette around the authored contact. This fails
    # if an adjacent elbow crushed the hand or pulled a long strip from it.
    x,y=center
    skin=set()
    for py in range(y-23,y+24):
        for px in range(x-28,x+29):
            r,g,b,a=im.getpixel((px,py))
            if a>190 and r>140 and r-g>8 and g-b>1:
                skin.add((px,py))
    seeds=sorted(skin,key=lambda p:(p[0]-x)**2+(p[1]-y)**2)
    assert seeds and (seeds[0][0]-x)**2+(seeds[0][1]-y)**2<54,('lost knuckles',center)
    stack=[seeds[0]]
    component=set()
    while stack:
        pt=stack.pop()
        if pt not in skin:continue
        skin.remove(pt);component.add(pt)
        a,b=pt
        stack.extend((a+dx,b+dy) for dx,dy in ((0,-1),(0,1),(1,0),(-1,0)))
    xs,ys=zip(*component)
    return max(xs)-min(xs)+1,max(ys)-min(ys)+1,len(component)

for name,center in [('mount_06',(283,169)),('release_01',(298,168)),
        ('release_02',(296,167)),('release_04',(292,208))]:
    w,h,area=skin_component(painted('rope_'+name),center)
    assert 16<=w<=31 and 20<=h<=35 and area>=265,(name,'collapsed or stretched fist',w,h,area)

# On the two loaded holds, the outer cuff and the inside fall of the upper
# sleeve follow different contours for each arm. A single near sleeve bent
# to the same fixed-length hinge on both sides fails these profiles.
def coat_pixel(pixel):
    r,g,b,a=pixel
    return a>=185 and max(r,g,b)<135

for name,row,last in [('grip_00',140,289),('grip_18',152,276),('brake_00',140,289)]:
    im=painted('rope_'+name)
    edge=max(x for x in range(260,323) if coat_pixel(im.getpixel((x,row))))
    assert abs(edge-last)<=4,(name,'raised cuff/elbow projected forward',row,edge)
    flipped=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    assert coat_pixel(flipped.getpixel((401-edge,row))),('mirrored sleeve',name)

# Probe the actual two projected joints, on both plane orientations, along
# with pixels inside the sleeve. A wrong elbow branch can keep both hands
# perfectly anchored and would pass contact-only tests.
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prepare_rope import elbow_pose,vec
angles={True:[],False:[]}
for i in range(36):
    u=(i%18)/18
    mobile_near=i>=18
    feed=ease((u-.10)/.72)
    pass_hand=ease((u-.28)/.60)
    lift=sin(pi*pass_hand)
    lean=(-1 if mobile_near else 1)*lift
    shoulders=vec(5*lean-3*lift,4*lift)
    im=painted(f'rope_grip_{i:02}')
    for far in (True,False):
        shoulder=(vec(213,184)-vec(2*lean,2*lean) if far else vec(195,188))+shoulders
        passing=far!=mobile_near
        palm_pos=(vec(301+(-24 if mobile_near else 20)*lift,94-74*feed+148*pass_hand)
            if passing else vec(301,168-74*feed))
        elbow,wrist=elbow_pose(far,shoulder,palm_pos,lift if passing else 0)
        upper=elbow-shoulder
        forearm=wrist-elbow
        for facing in (1,-1):
            # A reflection changes the sign of the bend, not the chosen
            # anatomical branch or the arc it follows.
            dot=upper[0]*forearm[0]+upper[1]*forearm[1]
            cross=(upper[0]*forearm[1]-upper[1]*forearm[0])*facing
            turn=-facing*degrees(atan2(cross,dot))
            assert 22<=turn<=106,('inside-out elbow',i,far,facing,turn)
        assert 42<hypot(*upper)<75 and 59<hypot(*forearm)<90,('projected arm proportions',i,far)
        # Arm skin, head, and jacket may overlap, but no background may
        # pierce a sleeve between the hinge and cuff at these load points.
        for sample in (elbow,elbow*.60+wrist*.40):
            x,y=map(round,map(float,sample))
            assert im.getpixel((x,y))[3]>170,('gap in bent sleeve',i,far,x,y)
        angles[far].append(turn)
for series in angles.values():
    assert max(abs(a-b) for a,b in zip(series,series[1:]+series[:1]))<21,'elbow snapped across the passing cycle'

print('Rope v0.48: 36 hand passes and shoe clamps, 7 joins, 12 mounting palms, 8 planted toes, independent sleeve profiles and intact knuckles.')
