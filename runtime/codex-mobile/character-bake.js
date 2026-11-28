import {openActor} from './character-art.js';
import {evaRig,bones,boneIndex} from './model-rig/eva-rig.mjs';

const CELL_W=144,CELL_H=192, STRIDE=18;
const nextFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Не удалось записать текстуру.')),'image/png'));
function canvasAt(w,h) {
  const c=document.createElement('canvas');c.width=w;c.height=h;return c;
}
const baseInput={at:{u:0,v:0,z:0},time:0,clip:'idle',facing:'down-right',reduced:true};
const bind=evaRig(baseInput);
const convert=(p)=>[p.z,-p.x,p.y];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);

function boneName(raw) {
  const n=(raw||'').toLowerCase().replace(/mixamorig|[^a-z0-9]/g,'');
  if(/hair/.test(n))return 'hair';
  if(/head|eye|jaw|neck/.test(n))return 'head';
  if(/hips|pelvis/.test(n))return 'pelvis';
  if(/spine|chest/.test(n))return 'chest';
  const side=/left|^l(?:arm|leg|upper|lower|foot|hand|shin|thigh)|^jbipl/.test(n)?'left':
             /right|^r(?:arm|leg|upper|lower|foot|hand|shin|thigh)|^jbipr/.test(n)?'right':'';
  if(!side)return '';
  if(/upperleg|upleg|thigh/.test(n))return side+'Thigh';
  if(/lowerleg|calf|shin|leg/.test(n))return side+'Shin';
  if(/foot|toe|ankle/.test(n))return side+'Foot';
  if(/forearm|lowerarm|elbow/.test(n))return side+'Lower';
  if(/upperarm|arm/.test(n))return side+'Upper';
  if(/hand|wrist|finger|thumb|index|pinky/.test(n))return side+'Hand';
  return '';
}
function nearestMapped(object) {
  for(let o=object;o;o=o.parent){const name=boneName(o.name);if(name)return name;}
  return 'pelvis';
}
function projectLocal(frame,point) {
  const delta=sub(point,frame.origin);
  return [dot(delta,frame.right),dot(delta,frame.front),dot(delta,frame.up)];
}
function boneBindings(actor) {
  const {THREE}=actor;
  const sources=new Map(),rest=new Map();
  actor.scene.traverse(o=>{const name=boneName(o.name);if(name&&!sources.has(name))sources.set(name,o);});
  const pairs={};
  for(const side of ['left','right']){
    for(const [a,b] of [['Thigh','Shin'],['Shin','Foot'],['Upper','Lower'],['Lower','Hand']])pairs[side+a]=side+b;
  }
  for(const [name,node] of sources) {
    const target=bind.frames[name],end=sources.get(pairs[name]);
    const origin=convert(node.getWorldPosition(new THREE.Vector3()));
    const alignment=new THREE.Quaternion();
    if(end){
      const direction=new THREE.Vector3(...sub(convert(end.getWorldPosition(new THREE.Vector3())),origin));
      if(direction.lengthSq()>1e-8)alignment.setFromUnitVectors(direction.normalize(),new THREE.Vector3(...target.up));
    }
    rest.set(name,{origin,alignment});
  }
  // Rotate the source rest chain around its own shoulders and hips. Keeping the
  // model's joint spacing avoids pulling broad shoulders into a narrow torso.
  for(const side of ['left','right']){
    for(const chain of [['Upper','Lower','Hand'],['Thigh','Shin','Foot']]){
      let parent=null;
      for(const joint of chain){
        const current=rest.get(side+joint);
        if(!current){parent=null;continue;}
        if(parent){
          const offset=new THREE.Vector3(...sub(current.origin,parent.origin)).applyQuaternion(parent.alignment);
          current.placed=offset.add(new THREE.Vector3(...(parent.placed||parent.origin))).toArray();
          if(joint==='Hand')current.alignment=parent.alignment;
        }else current.placed=current.origin;
        parent=current;
      }
    }
  }
  return (point,name,vector=false)=>{
    const target=bind.frames[name],joint=rest.get(name);
    if(joint?.placed){
      const rotated=new THREE.Vector3(...(vector?point:sub(point,joint.origin))).applyQuaternion(joint.alignment);
      if(!vector)rotated.add(new THREE.Vector3(...joint.placed));
      point=rotated.toArray();
    }
    if(!vector)return projectLocal(target,point);
    return [dot(point,target.right),dot(point,target.front),dot(point,target.up)];
  };
}
function getWeights(mesh,i){
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  if(!mesh.isSkinnedMesh||!skinIndex||!skinWeight) return [[nearestMapped(mesh),1]];
  const weights=new Map();
  for(const getter of ['getX','getY','getZ','getW']){
    const w=skinWeight[getter](i);
    if(w>0){const name=nearestMapped(mesh.skeleton.bones[skinIndex[getter](i)]);weights.set(name,(weights.get(name)||0)+w);}
  }
  const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,2);
  return top.length?top:[['pelvis',1]];
}
function textureAtlas(materials) {
  const grid=Math.ceil(Math.sqrt(materials.length)),size=Math.min(1024,grid*256);
  const canvas=canvasAt(size,size),ctx=canvas.getContext('2d',{willReadFrequently:true});
  const cells=new Map();
  materials.forEach((m,i)=>{
    const x=Math.floor(i%grid*size/grid),y=Math.floor(Math.floor(i/grid)*size/grid);
    const w=Math.floor((i%grid+1)*size/grid)-x,h=Math.floor((Math.floor(i/grid)+1)*size/grid)-y;
    ctx.fillStyle=m.map?'rgba(0,0,0,0)':'white';ctx.fillRect(x,y,w,h);
    if(m.map){
      const image=m.map.image;
      if(!image?.width||!image?.height)throw Error('Не удалось декодировать текстуру модели.');
      ctx.drawImage(image,x+1,y+1,w-2,h-2);
      m.map.updateMatrix();
    }
    cells.set(m,{x:x+1,y:y+1,w:w-2,h:h-2});
  });
  return {canvas,pixels:ctx.getImageData(0,0,size,size).data,cells,size};
}
function makeGeometry(actor) {
  const {THREE}=actor,objects=[],materials=new Set();
  actor.scene.traverse(o=>{
    if(!o.isMesh)return;
    if(Array.isArray(o.material))throw Error('Экспортируй каждый материал отдельным примитивом glTF.');
    objects.push(o);materials.add(o.material);
  });
  if(!objects.length||materials.size>32)throw Error('Для комнаты нужно от 1 до 32 материалов.');
  const atlas=textureAtlas([...materials]),local=boneBindings(actor);
  const vs=[],ix=[],p=new THREE.Vector3(),n=new THREE.Vector3(),uv=new THREE.Vector2();
  for(const obj of objects){
    const g=obj.geometry,m=obj.material,attrs=g.attributes,begin=vs.length/STRIDE;
    if(!attrs.normal)g.computeVertexNormals();
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
    const cell=atlas.cells.get(m);
    for(let i=0;i<attrs.position.count;i++){
      obj.getVertexPosition(i,p).applyMatrix4(obj.matrixWorld);
      n.fromBufferAttribute(attrs.normal,i).applyNormalMatrix(normalMatrix);
      const point=convert(p),normal=convert(n);
      const top=getWeights(obj,i),other=top[1]||[top[0][0],0];
      const main=top[0][0],second=other[0],weight=other[1]/(top[0][1]+other[1]);
      const c=m.color ?? {r:1,g:1,b:1},col=attrs.color;
      const texcoord=attrs[(m.map?.channel??0)?'uv'+m.map.channel:'uv'];
      if(texcoord){uv.fromBufferAttribute(texcoord,i);if(m.map)m.map.transformUv(uv);}
      else uv.set(.5,.5);
      const u=(cell.x+Math.min(1,Math.max(0,uv.x))*(cell.w-1)+.5)/atlas.size;
      const v=(cell.y+Math.min(1,Math.max(0,uv.y))*(cell.h-1)+.5)/atlas.size;
      vs.push(...local(point,main),c.r*(col?col.getX(i):1),c.g*(col?col.getY(i):1),c.b*(col?col.getZ(i):1),u,v,
        boneIndex[main],boneIndex[second],...local(normal,main,true),...local(point,second),weight,0);
    }
    const count=g.index?g.index.count:attrs.position.count;
    for(let i=0;i<count;i++)ix.push(begin+(g.index?g.index.getX(i):i));
  }
  if(!vs.every(Number.isFinite)||vs.some(v=>Math.abs(v)>1e5))throw Error('В модели есть некорректные координаты.');
  return {vertices:Float32Array.from(vs),indices:Uint32Array.from(ix),atlas};
}
function packMesh({vertices,indices}) {
  const blob=new ArrayBuffer(16+vertices.byteLength+indices.byteLength),v=new DataView(blob);
  v.setUint32(0,0x314d5645,true);v.setUint32(4,vertices.length/STRIDE,true);
  v.setUint32(8,indices.length,true);v.setUint32(12,STRIDE,true);
  new Float32Array(blob,16,vertices.length).set(vertices);
  new Uint32Array(blob,16+vertices.byteLength,indices.length).set(indices);
  return new Blob([blob]);
}

function poseAt(row,column){
  const phase=column/8, time=phase*2400;
  const input={...baseInput,reduced:false,time,clip:['idle','walk','sit','stretch'][row],clipSeconds:time/1000};
  if(row===1){input.walkWeight=1;input.walkDistance=phase*1.14;}
  if(row===2){input.seat={height:.48};input.seatSample={amount:1,poseAmount:1,pose:'sit'};}
  return evaRig(input).matrices;
}
// Tiny CPU depth buffer for the floating Android pet. Import works even without
// a WebGL context, and the pet never needs a background 3D renderer or network.
function drawPose(geo,palette,yaw,ctx,px,py,portrait=false) {
  const width=portrait?576:CELL_W,height=portrait?864:CELL_H;
  const {vertices:v,indices,atlas}=geo, count=v.length/STRIDE;
  const points=new Float32Array(count*6), rgb=(c)=>Math.pow(Math.max(0,Math.min(1,c)),1/2.2);
  const c=Math.cos(yaw),s=Math.sin(yaw),zoom=portrait?height/1.15:height*.91/1.65;
  const at=(j,axis,x,y,z)=>palette[j+axis]*x+palette[j+4+axis]*y+palette[j+8+axis]*z+palette[j+12+axis];
  for(let i=0;i<count;i++){
    const k=i*STRIDE,b=v[k+8]*16,b2=v[k+9]*16,w=v[k+16],j=i*6;
    const p=[];
    for(let a=0;a<3;a++)p[a]=(1-w)*at(b,a,v[k],v[k+1],v[k+2])+w*at(b2,a,v[k+13],v[k+14],v[k+15]);
    points[j]=width*.5+zoom*(-p[1]*c+p[0]*s);
    points[j+1]=(portrait?height*.04+1.65*zoom:height*.965)-zoom*(p[2]-.075*p[0]);points[j+2]=p[0]*c+p[1]*s+.075*p[2];
    const light=.78+.22*Math.max(0,palette[b+1]*v[k+10]+palette[b+5]*v[k+11]+palette[b+9]*v[k+12]);
    for(let a=0;a<3;a++)points[j+3+a]=rgb(v[k+3+a])*light;
  }
  const image=ctx.createImageData(width,height), z=new Float32Array(width*height).fill(-Infinity),rgba=image.data;
  for(let k=0;k<indices.length;k+=3){
    const ia=indices[k],ib=indices[k+1],ic=indices[k+2],a=ia*6,b=ib*6,d=ic*6;
    const ax=points[a],ay=points[a+1],bx=points[b],by=points[b+1],cx=points[d],cy=points[d+1];
    const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    if(Math.abs(area)<.015)continue;
    const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
    const y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const u=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/area, vv=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/area,t=1-u-vv;
      if(u<0||vv<0||t<0)continue;
      const p=y*width+x,depth=u*points[a+2]+vv*points[b+2]+t*points[d+2];
      if(depth<=z[p])continue;
      const tx=Math.min(atlas.size-1,Math.max(0,Math.floor(atlas.size*(u*v[ia*STRIDE+6]+vv*v[ib*STRIDE+6]+t*v[ic*STRIDE+6]))));
      const ty=Math.min(atlas.size-1,Math.max(0,Math.floor(atlas.size*(u*v[ia*STRIDE+7]+vv*v[ib*STRIDE+7]+t*v[ic*STRIDE+7]))));
      const sample=(ty*atlas.size+tx)*4,alpha=atlas.pixels[sample+3];
      if(alpha<40)continue;
      z[p]=depth;
      for(let channel=0;channel<3;channel++)rgba[p*4+channel]=atlas.pixels[sample+channel]*(u*points[a+3+channel]+vv*points[b+3+channel]+t*points[d+3+channel]);
      rgba[p*4+3]=alpha;
    }
  }
  ctx.putImageData(image,px,py);
}
export async function bakeActor(input,progress=()=>{}) {
  const actor=await openActor(input);
  try{
    const geo=makeGeometry(actor), sheet=canvasAt(CELL_W*8,CELL_H*4),ctx=sheet.getContext('2d');
    for(let row=0;row<4;row++)for(let col=0;col<8;col++){
      const yaw=row===1?.44:.12*Math.sin(col*Math.PI/4);
      drawPose(geo,poseAt(row,col),yaw,ctx,col*CELL_W,row*CELL_H);
      progress((row*8+col+1)/32);await nextFrame();
    }
    const poster=canvasAt(576,864);
    drawPose(geo,poseAt(0,0),0,poster.getContext('2d'),0,0,true);
    return {mesh:packMesh(geo),atlas:await png(geo.atlas.canvas),poses:await png(sheet),poster:await png(poster)};
  }finally{actor.dispose();}
}
