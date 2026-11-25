"""Check the petite seated atlas and its actual opaque sleeve/prop silhouettes."""
from pathlib import Path
from PIL import Image

assets=Path(__file__).resolve().parents[2]/'app/src/main/assets/eva-pet'
atlas=Image.open(assets/'play_seated.png').convert('RGBA')
assert atlas.size==(156,187)
alpha=atlas.getchannel('A')
# Both sleeves must have continuous cloth across the painted elbow and cuff.
# A colour threshold used for removing loose red hair previously ate the jacket.
for x,y,w,h,samples in [(0,82,48,85,(12,28,48,68)),(49,82,48,105,(10,22,46,62,84))]:
    for row in samples:
        scan=list(alpha.crop((x,y+row,x+w,y+row+1)).tobytes())
        covered=[index for index,value in enumerate(scan) if value>160]
        assert len(covered)>=8 and covered[-1]-covered[0]+1<=len(covered)+2,(x,row,'pierced cuff')
for box in ((0,0,40,35),(42,0,116,50),(120,0,150,37),(0,50,55,81),(56,50,111,81)):
    tile=alpha.crop(box)
    assert tile.getbbox() and sum(value>=170 for value in tile.tobytes())>100,(box,'missing ink')
assert 'play_seated\t0\t0\t156\t187' in (assets/'frames.tsv').read_text().splitlines()
print('Seated atlas: five prop/face tiles and nine closed sleeve cross-sections checked.')
