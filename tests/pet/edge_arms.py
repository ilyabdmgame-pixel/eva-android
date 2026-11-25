"""Probe the painted elbow, sleeve and hand where the two arms cross in projection."""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

# Shoulder, elbow, wrist, bearing point on the palm, in the registered cels.
# These contact samples are independent of the production asset generator.
POSES={
    'rope_edge_19': [((175,141),(166,216),(200,283),(222,288)), ((200,144),(194,212),(227,269),(240,283))],
    'rope_edge_21': [((174,146),(162,221),(208,272),(231,275)), ((198,149),(197,215),(244,257),(260,269))],
    'rope_edge_24': [((173,148),(162,220),(220,243),(243,244)), ((198,150),(214,211),(269,227),(288,235))],
    'rope_edge_26': [((175,148),(167,218),(228,224),(251,224)), ((200,150),(224,206),(280,208),(300,214))],
    'rope_edge_28': [((177,146),(177,212),(234,202),(257,199)), ((201,149),(226,202),(280,188),(300,190))],
    'rope_edge_30': [((178,149),(190,210),(240,181),(263,174)), ((200,152),(224,203),(270,171),(289,168))],
    'rope_edge_31': [((178,151),(197,208),(242,172),(265,162)), ((199,154),(224,204),(262,164),(282,158))],
    'rope_edge_32': [((178,153),(203,207),(245,164),(267,152)), ((198,157),(225,205),(255,158),(274,149))],
    'mantle_mid_07': [((195,146),(169,211),(207,256),(232,261))],
    'mantle_mid_09': [((161,208),(145,277),(186,325),(211,335))],
}

def check_arm(label,rgba,points,mirror):
    ink=rgba[...,3]>180
    skin=ink&(rgba[...,0]>150)&(rgba[...,0]-rgba[...,1]>10)&(rgba[...,1]-rgba[...,2]>5)
    shoulder,elbow,wrist,palm=points
    # A valid centreline must run through the actual opaque silhouette, even
    # when the opposite hand briefly occludes its jacket fabric.
    for start,end in ((shoulder,elbow),(elbow,wrist)):
        for t in np.linspace(.10,.90,17):
            x,y=np.rint(start*(1-t)+end*t).astype(int)
            assert ink[y-2:y+3,x-2:x+3].any(),(label,'gap',x,y)
    x,y=elbow
    assert (ink[y-3:y+4,x-3:x+4]&(rgba[y-3:y+4,x-3:x+4,0]<132)).sum()>=18,(label,'fabric')
    x,y=palm
    assert skin[y-4:y+5,x-4:x+5].sum()>=25,(label,'hand')
    u=elbow-shoulder;v=wrist-elbow
    angle=np.degrees(np.arctan2(u[0]*v[1]-u[1]*v[0],u@v))
    assert -152<(angle if not mirror else -angle)<-12,(label,angle)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets',type=Path,default=Path(__file__).resolve().parents[2]/'app/src/main/assets/eva-pet')
    parser.add_argument('tables',type=Path,nargs='*',help='Optional freshly baked registration rows')
    args=parser.parse_args()
    rows={}
    for table in (args.assets/'frames.tsv',*args.tables):
        for line in table.read_text().splitlines():
            name,*values=line.split()
            rows[name]=tuple(map(int,values))
    for name,arms in POSES.items():
        l,t,w,h=rows[name]
        sprite=Image.new('RGBA',(402,540))
        with Image.open(args.assets/(name+'.png')) as source:
            assert source.size==(w,h)
            sprite.paste(source.convert('RGBA'),(l,t))
        for mirror in (False,True):
            image=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if mirror else sprite
            rgba=np.asarray(image,dtype=np.int16)
            for arm in arms:
                points=np.array(arm)
                if mirror:points[:,0]=sprite.width-1-points[:,0]
                check_arm((name,mirror),rgba,points,mirror)
    print('Verified both screen directions for 16 rope sleeves and 2 mantle transfers')

if __name__=='__main__':
    main()
