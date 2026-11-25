import {household} from './household.mjs';
import {streetFurniture} from './street-furniture.mjs';
import {places, floorHeight} from './places.mjs';
import {neighborhood,railingBlocks} from './neighborhood.mjs';
import {wallAt,postWall,buildings,buildingEdge} from './buildings.mjs';
import {finishFixture,restoreTurn} from './prop-finish.mjs';

import {SIZE,plots,streetSurface,crossing} from './town-plan.mjs';
export {SIZE};
export const districts=Object.entries(plots).map(([key,[column,row]])=>({
  key,column,row,u:column*SIZE,v:row*SIZE,...(places[key]||neighborhood[key])
}));
const byCell=new Map(districts.map(d=>[d.column+','+d.row,d]));
const named=new Map(districts.map(d=>[d.key,d]));
export const extent={
  u0:Math.min(...districts.map(d=>d.u))-SIZE/2,
  u1:Math.max(...districts.map(d=>d.u))+SIZE/2,
  v0:Math.min(...districts.map(d=>d.v))-SIZE/2,
  v1:Math.max(...districts.map(d=>d.v))+SIZE/2
};

export const district=key=>named.get(key);
export function regionAt(u,v){
  return byCell.get(Math.floor((u+SIZE/2)/SIZE)+','+Math.floor((v+SIZE/2)/SIZE));
}
export function worldPoint(key,u,v){
  const d=district(key);
  return {u:d.u+u,v:d.v+v};
}
export function surfaceAt(u,v){
  const d=regionAt(u,v);
  if(!d)return 0;
  const floor=floorHeight(d.key,v-d.v);
  const street=streetSurface(u,v);
  if(street==='road')return .023;
  if(street)return crossing(u,v)?.030:street==='kerb'?.089:.082;
  return floor;
}
export function waterAt(u,v){
  const d=regionAt(u,v);
  return (d?.key==='beach'&&v-d.v>=2)||(d?.key==='pier'&&v-d.v>=2.9);
}
export function solidWall(u,v){
  const d=regionAt(u,v);
  if(!d)return true;
  if(d.key==='lane'&&postWall(u-d.u,v-d.v))return true;
  return wallAt(d.theme,u-d.u,v-d.v)||railingBlocks(d.theme,u-d.u,v-d.v);
}
export function visibleDistricts(center){
  // Keep direct neighbours resident in the drawing pass and clip other tiles by the camera.
  return districts.filter(d=>Math.abs(d.u-center.u)<SIZE+3&&Math.abs(d.v-center.v)<SIZE+3);
}

export function worldObjects(saved){
  return districts.flatMap(d=>{
   const interior=buildings[d.theme];
   const extras=[];
   if(interior){
     const side=interior.sides[0],ranges=[...side].sort((a,b)=>a.at-b.at);
     let left=-buildingEdge+.15,best=[left,left];
     for(const hole of [...ranges,{at:buildingEdge-.15,width:0}]){
       const right=hole.at-hole.width/2-.10;
       if(right-left>best[1]-best[0])best=[left,right];
       left=hole.at+hole.width/2+.10;
     }
     const w=Math.min(1.08,best[1]-best[0]),u=(best[0]+best[1]-w)/2;
     const key=d.theme==='cafe'?'town-menu':['shop','terrace','school'].includes(d.theme)?'town-flowers':'town-landscape';
     extras.push({id:190+Object.keys(buildings).indexOf(d.theme),name:d.theme==='cafe'?'Меню на стене':'Картина на стене',kind:'wallArt',u,v:-buildingEdge+.115,w,d:.04,solid:false,art:key,z:1.32,approach:[u+w/2,-buildingEdge+.72]});
   }
   return [...d.objects,...household(d.key),...(streetFurniture[d.key]||[]),...extras].filter(o=>!['exit','npc'].includes(o.kind)&&!saved.packed?.[o.id]).map(o=>{
    const override=saved.chairs?.[o.id];
    const du=[3,10,11,21,22,23].includes(o.id)?-.70:0;
    const dv=o.id===7?-.86:[1,5,6,25,26,64,71,73,84].includes(o.id)?-.63:0;
    return {
      ...restoreTurn(finishFixture(o),override),sector:override?.world&&named.has(override.sector)?override.sector:d.key,
      u:override?.world?override.u:d.u+(override?.u??o.u+du),
      v:override?.world?override.v:d.v+(override?.v??o.v+dv),
      approach:o.approach&&!override?[d.u+o.approach[0]+du,d.v+o.approach[1]+dv]:null
    };
  });});
}

export function route(from,destination,blocked){
  const step=.23;
  const openGoal=!blocked(destination.u,destination.v);
  const goalDistance=openGoal?step*Math.SQRT1_2+.002:.26;
  const cx=Math.round(from.u/step),cy=Math.round(from.v/step);
  const x0=Math.floor(extent.u0/step);
  const x1=Math.ceil(extent.u1/step);
  const y0=Math.floor(extent.v0/step);
  const y1=Math.ceil(extent.v1/step);
  const span=x1-x0+1,encoded=(x,y)=>x-x0+(y-y0)*span;
  const ix=n=>x0+n%span,iy=n=>y0+Math.floor(n/span);
  const start=encoded(cx,cy),parents=new Int32Array(span*(y1-y0+1));
  parents.fill(-1);parents[start]=start;
  const cost=new Float32Array(parents.length);cost.fill(Infinity);cost[start]=0;
  const heap=[];
  const estimate=(x,y)=>Math.abs(destination.u/step-x)+Math.abs(destination.v/step-y);
  const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
  function enqueue(id,rank){
    let i=heap.length;
    heap.push({id,rank});
    while(i>0){const parent=(i-1)>>1;if(heap[parent].rank<=rank)break;heap[i]=heap[parent];i=parent}
    heap[i]={id,rank};
  }
  function dequeue(){
    const winner=heap[0],last=heap.pop();
    if(!heap.length)return winner;
    let i=0;
    while(i*2+1<heap.length){
      const j=i*2+1,next=j+1<heap.length&&heap[j+1].rank<heap[j].rank?j+1:j;
      if(heap[next].rank>=last.rank)break;heap[i]=heap[next];i=next;
    }
    heap[i]=last;return winner;
  }
  const open=new Uint8Array(parents.length);
  enqueue(start,estimate(cx,cy));
  let best=start,score=Infinity;
  function free(x,y){
    if(x<x0||x>x1||y<y0||y>y1)return false;
    const id=encoded(x,y);
    if(!open[id])open[id]=blocked(x*step,y*step)?2:1;
    return open[id]===1;
  }
  while(heap.length){
    const {id,rank}=dequeue(),x=ix(id),y=iy(id),guess=estimate(x,y);
    if(rank>cost[id]+guess+.0001)continue;
    const remaining=Math.hypot(destination.u-x*step,destination.v-y*step);
    if(remaining<score){score=remaining;best=id}
    if(score<=goalDistance)break;
    for(const [dx,dy] of neighbors){
      const a=x+dx,b=y+dy,next=encoded(a,b);
      if(!free(a,b))continue;
      const straight=id===start||id-parents[id]===next-id;
      const total=cost[id]+(straight?1:1.08);
      if(total>=cost[next])continue;
      if(Math.abs(surfaceAt(x*step,y*step)-surfaceAt(a*step,b*step))>.205)continue;
      parents[next]=id;cost[next]=total;enqueue(next,total+estimate(a,b));
    }
  }
  const path=[];
  for(let p=best;p!==start;p=parents[p])path.unshift({u:ix(p)*step,v:iy(p)*step});
  if(score<.20&&openGoal){
    const end=path.at(-1),before=path.at(-2)??from;
    if(end){
      const overshoot=(end.u-before.u)*(destination.u-end.u)+(end.v-before.v)*(destination.v-end.v)<0;
      const canShorten=[.25,.5,.75].every(k=>!blocked(before.u+(destination.u-before.u)*k,before.v+(destination.v-before.v)*k));
      const levelChange=Math.abs(surfaceAt(before.u,before.v)-surfaceAt(destination.u,destination.v));
      if(overshoot&&canShorten&&levelChange<=.205)path.pop();
    }
    path.push(destination);
  }
  return path;
}

// Nearby clear ground permits a natural approach at any bearing. The grid solver
// still handles walls, street crossings, level changes and longer journeys.
export function localPath(from,to,blocked){
  const du=to.u-from.u,dv=to.v-from.v,distance=Math.hypot(du,dv);
  if(distance>6||distance<.015)return null;
  const steps=Math.ceil(distance/.065),ground=surfaceAt(from.u,from.v);
  for(let i=1;i<=steps;i++){
    const u=from.u+du*i/steps,v=from.v+dv*i/steps;
    if(blocked(u,v)||Math.abs(surfaceAt(u,v)-ground)>.095)return null;
  }
  return [to];
}

export function roundRoute(from,path,blocked){
  const rounded=[];
  for(let i=0;i<path.length-1;i++){
    const {u,v}=path[i],before=path[i-1]??from,after=path[i+1];
    const inU=before.u-u,inV=before.v-v,outU=after.u-u,outV=after.v-v;
    const incoming=Math.hypot(inU,inV),outgoing=Math.hypot(outU,outV);
    const angle=(inU*outU+inV*outV)/(incoming*outgoing);
    if(Math.min(incoming,outgoing)<.13||Math.abs(angle)>.8){
      rounded.push(path[i]);
      continue;
    }
    const radius=Math.min(.11,.38*incoming,.38*outgoing);
    const points=[0,.25,.5,.75,1].map(t=>({
      u:u+radius*((1-t)**2*inU/incoming+t*t*outU/outgoing),
      v:v+radius*((1-t)**2*inV/incoming+t*t*outV/outgoing)
    }));
    const ground=surfaceAt(u,v);
    const free=(a,b)=>!blocked(a,b)&&Math.abs(surfaceAt(a,b)-ground)<1e-4;
    if(points.every((p,j)=>free(p.u,p.v)&&(!j||free((p.u+points[j-1].u)/2,(p.v+points[j-1].v)/2))))rounded.push(...points);
    else rounded.push(path[i]);
  }
  if(path.length)rounded.push(path.at(-1));
  return rounded;
}

export function followRoute(actor,path,budget){
  let remaining=budget,du=0,dv=0;
  while(path.length&&remaining>0){
    const target=path[0],u=target.u-actor.u,v=target.v-actor.v;
    const length=Math.hypot(u,v);
    if(length>(path.length===1?.12:1e-6)){du=u/length;dv=v/length;}
    if(length<=remaining){
      actor.u=target.u;actor.v=target.v;
      remaining-=length;
      path.shift();
    }else{
      actor.u+=u*remaining/length;
      actor.v+=v*remaining/length;
      remaining=0;
    }
  }
  return {distance:budget-remaining,du,dv};
}

export function paceRoute(actor,path,dt,speed,cruise){
  const acceleration=4.4,braking=4.8;
  const horizon=cruise**2/(2*braking)+cruise*dt;
  let remaining=0,previous=actor;
  for(const point of path){
    remaining+=Math.hypot(point.u-previous.u,point.v-previous.v);
    if(remaining>=horizon)break;
    previous=point;
  }
  // Reserve braking distance after the movement taken in this frame.
  const halfStep=braking*dt*.5;
  const stoppingSpeed=Math.sqrt(Math.max(0,halfStep**2+2*braking*remaining-braking*speed*dt))-halfStep;
  const target=Math.max(0,Math.min(cruise,stoppingSpeed));
  const next=Math.max(speed-braking*dt,Math.min(target,speed+acceleration*dt));
  const budget=remaining<.001?remaining+1e-9:(speed+next)*dt*.5;
  const movement=followRoute(actor,path,budget);
  return {...movement,speed:path.length?next:0};
}
