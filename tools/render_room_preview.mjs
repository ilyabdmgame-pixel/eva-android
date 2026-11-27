// Offline proof for the room meshes. Requires Node and Python with Pillow; never opens Android.
// node tools/render_room_preview.mjs /tmp/room.png --yaw 45 --size 1000x820 --sleep
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {camera} from '../app/src/main/assets/home/camera.mjs';
import {faceUV} from '../app/src/main/assets/home/material-uv.mjs';
import {collectMesh,rasterMesh,sampleRoomPaint} from '../app/src/main/assets/home/mesh-preview.mjs';
import {drawRoom,drawRoomWindow,roomFurniture,room,roomCenter,drawBedding} from '../app/src/main/assets/home/room.mjs';
import {visibleRoomWalls} from '../app/src/main/assets/home/room-camera.mjs';
import {worldObjects} from '../app/src/main/assets/home/district.mjs';
import {drawComputer,drawFloorDecor,roomDesk,roomFurnishings,originalRoomDecor,studioRoomDecor} from '../app/src/main/assets/home/room-furnishings.mjs';
import {drawRoomModel,roomSurface} from '../app/src/main/assets/home/room-models.mjs';
import {propArt} from '../app/src/main/assets/home/prop-art.mjs';

const args=process.argv.slice(2);
const option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const out=args[0];
if(!out||out.startsWith('-')||args.includes('--help')){
  console.log('node tools/render_room_preview.mjs room.png [--yaw 45] [--size 960x780] [--night] [--sleep]');
  process.exit(out==='--help'?0:1);
}
const [width,height]=option('--size','960x780').split('x').map(Number);
if(![width,height].every(n=>Number.isInteger(n)&&n>=96&&n<=2400))throw Error('Image size must be 96–2400 on each axis');
const yaw=Number(option('--yaw','45'))*Math.PI/180;
if(!Number.isFinite(yaw))throw Error('Invalid yaw');
const night=args.includes('--night'),sleep=args.includes('--sleep');
const walls=visibleRoomWalls(yaw);
const layout=roomFurniture(worldObjects({}));
const desk=roomDesk(layout.get(1));layout.set(1,desk);
for(const [parent,ids] of [[1,[5,6,27]],[3,[10,11]],[21,[22,23]],[25,[26]]]){
  for(const id of ids)layout.get(id).z=roomSurface(layout.get(parent));
}
for(const [id,u,v] of [...originalRoomDecor,...studioRoomDecor]){
  const model=roomFurnishings.find(o=>o.id===id);
  layout.set(id,{...model,u:room.u+u,v:room.v+v});
}

const materials={
  oak:['anime-building.jpg',1,0,3.4],plaster:['anime-building.jpg',0,0,3.4],
  wood:['material.jpg',0,0,2.7],cloth:['material.jpg',0,1,2.7],
  glaze:['district.jpg',1,0,2.7],studio:['district.jpg',0,0,2.7]
};
const filenames=new Set();
const shadows=[];
const faces=collectMesh((renderer,faces)=>{
  function art(points,key,id=0){
    if(key==='attic-rug'){
      renderer.panel(points,[.95,.95,.95],'room-rug',id,[[0,0],[1,0],[1,1],[0,1]]);return;
    }
    const frame=propArt[key],file=key.endsWith('.jpg')?key:(frame?.[0]??key)+'.png';
    filenames.add(file);
    const [l,t,r,b]=frame?.slice(1,5)??[0,0,1,1];
    faces.push({id,points,tint:[1,1,1],file,uv:[[l,t],[r,t],[r,b],[l,b]],emissive:key.endsWith('.jpg')});
  }
  renderer.artPanel=art;
  renderer.windowPanel=(points,id)=>art(points,'room-window-hills.jpg',id);
  renderer.shadeBand=()=>{};
  renderer.streamPanel=(points,id)=>renderer.panel(points,[.35,.65,.69],null,id);
  drawRoom(renderer,false,0,walls);
  if(walls.v)drawRoomWindow(renderer,null);
  for(const o of layout.values()){
    if(o.solid!==false&&!o.z&&o.kind!=='window'){
      const x=o.u+o.w*.5,y=o.v+o.d*.5,r=o.w*.65+.03,s=o.d*.65+.025;
      shadows.push({id:0,tint:[0,0,0],points:[[x-r,y-s,.028],[x+r,y-s,.028],[x+r,y+s,.028],[x-r,y+s,.028]],
        uv:[[0,0],[1,0],[1,1],[0,1]],shadow:true});
    }
    if(o.kind==='pillow'||o.kind==='blanket')drawBedding(renderer,layout.get(3),o,false,sleep?1:0);
    else if(o.kind==='computer')drawComputer(renderer,o,true,false);
    else if(o.kind==='wallArt'&&walls.v){
      const {u,v,z,w}=o,h=w*.60;
      renderer.box(o.id,{u:u-.025,v:v-.025,z:z-.03},w+.05,.044,h+.06,[.62,.44,.30],'oak');
      art([[u,v+.023,z+h],[u+w,v+.023,z+h],[u+w,v+.023,z],[u,v+.023,z]],o.art,o.id);
    }else if(o.kind==='floorDecor')drawFloorDecor(renderer,o);
    else if(!drawRoomModel(renderer,o,{lit:o.id===5,channel:1})){
      for(const p of o.parts??[])renderer.box(o.id,{u:o.u+p.u,v:o.v+p.v,z:(o.z||0)+p.z},p.a,p.b,p.h,p.tint,p.mat);
    }
  }
});
for(const face of faces){
  if(face.paint){filenames.add('room-indie-atlas.webp');continue;}
  const material=materials[face.material];
  if(material){
    face.surface=material;face.uv=faceUV(face.points);
    filenames.add(material[0]);
  }
}
faces.push(...shadows);

const resolution=256,artDir=fileURLToPath(new URL('../app/src/main/assets/home/art/',import.meta.url));
const files=[...filenames];
function python(source,args,input,maxBuffer=1024*1024){
  const p=spawnSync('python3',['-c',source,...args],{input,maxBuffer});
  if(p.error)throw p.error;
  if(p.status!==0)throw Error(p.stderr?.toString()||'Python exited with '+p.status);
  return p.stdout;
}
const raw=python(
  'from PIL import Image\nimport sys,os\nn=int(sys.argv[2])\nfor f in sys.argv[3:]:\n with Image.open(os.path.join(sys.argv[1],f)) as im: sys.stdout.buffer.write(im.convert("RGBA").resize((n,n),Image.Resampling.LANCZOS).tobytes())',
  [artDir,String(resolution),...files],undefined,files.length*resolution*resolution*4+8192);
const tex=new Map(files.map((f,i)=>[f,raw.subarray(i*resolution*resolution*4,(i+1)*resolution*resolution*4)]));
const pixels=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const q=y/height,glow=Math.exp(-6*((x/width-.5)**2*.7+(q-.5)**2*1.8));
  const a=night?[33,34,49]:[68,83,96],b=night?[50,43,54]:[118,91,84];
  const at=4*(y*width+x);
  for(let i=0;i<3;i++)pixels[at+i]=a[i]*(1-q)+b[i]*q+glow*(i===0?20:12);
  pixels[at+3]=255;
}
const view=camera({width,height,pixelsPerMeter:Math.min(width*.087,height*.14),...roomCenter,yaw});
view.y+=height*.109;
const mirror=v=>1-Math.abs(((v%2)+2)%2-1);
const rgb=[0,0,0],paintAtlas={width:resolution,data:tex.get('room-indie-atlas.webp')};
rasterMesh(faces,view,pixels,(face,index,u,v,w,base,pixelIndex)=>{
  let color=base;
  if(face.material==='room-glass')return null;
  if(face.paint)color=sampleRoomPaint(face,index,u,v,w,paintAtlas,rgb);
  else if(face.uv){
    const q=face.uv;
    let x=q[0][0]*u+q[index][0]*v+q[index+1][0]*w,y=q[0][1]*u+q[index][1]*v+q[index+1][1]*w;
    if(face.shadow){
      const r=2*Math.hypot(x-.5,y-.5);
      if(r>=1)return null;
      const opacity=.38*(1-r*r);
      for(let i=0;i<3;i++)rgb[i]=pixels[pixelIndex*4+i]*(1-opacity)+(i===2?36:27)*opacity;
      return rgb;
    }
    const surface=face.surface;
    if(surface){
      const [,column,row,metres]=surface;
      x=x/metres+.213;y=y/metres+.367;
      if(surface[0]==='anime-building.jpg'&&column===1)y*=1.7;
      x=column*.5+.012+.476*mirror(x);y=row*.5+.012+.476*mirror(y);
    }
    const data=tex.get(surface?.[0]??face.file);
    const at=4*(Math.max(0,Math.min(resolution-1,Math.floor(y*resolution)))*resolution+
                Math.max(0,Math.min(resolution-1,Math.floor(x*resolution))));
    if(data[at+3]<112)return null;
    for(let i=0;i<3;i++)rgb[i]=base[i]*data[at+i]/255;
    color=rgb;
  }
  if(!face.emissive){
    const p=face.points,wu=p[0][0]*u+p[index][0]*v+p[index+1][0]*w,wv=p[0][1]*u+p[index][1]*v+p[index+1][1]*w;
    const lamp=night?Math.max(0,1-Math.hypot(wu-desk.u-.93,wv-desk.v-.52)/4.2):0;
    const light=night?[.73+.49*lamp,.74+.32*lamp,.80+.13*lamp]:[1.03,1.005,.96];
    for(let i=0;i<3;i++)rgb[i]=color[i]*light[i];
    return rgb;
  }
  return color;
});
python('from PIL import Image\nimport sys\nImage.frombytes("RGBA",(int(sys.argv[2]),int(sys.argv[3])),sys.stdin.buffer.read()).convert("RGB").save(sys.argv[1])',
  [out,String(width),String(height)],pixels);
console.log(out+' · '+faces.reduce((sum,f)=>sum+f.points.length-2,0)+' triangles');
