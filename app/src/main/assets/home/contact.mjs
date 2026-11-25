import {seatFront} from './prop-finish.mjs';
import {walkingRestricted,streetSurface} from './town-plan.mjs';
import {regionAt,solidWall,surfaceAt,waterAt} from './district.mjs';
import {hitsDoor} from './toys.mjs';

export function fixtureTop(o){
  return (o.z||0)+(o.surfaceHeight??(o.parts?.length?Math.max(...o.parts.map(p=>p.z+p.h))-(o.z||0):o.visualHeight)??.25);
}
export function blocksActor(u,v,fixtures,openDoors,ignore,extra=0){
  if(!regionAt(u,v)||waterAt(u,v)||solidWall(u,v)||walkingRestricted(u,v))return true;
  const gap=.12+extra;
  return fixtures.some(o=>o.id!==ignore&&o.solid!==false&&u>o.u-gap&&u<o.u+o.w+gap&&v>o.v-gap&&v<o.v+o.d+gap)||
    openDoors.some(d=>Math.abs(d.u-u)<1.8&&Math.abs(d.v-v)<1.8&&hitsDoor({u,v,z:1},gap,d));
}
export function canPlace(u,v,w,d,blocked){
  const z=surfaceAt(u,v),nx=Math.max(1,Math.ceil(w/.10)),ny=Math.max(1,Math.ceil(d/.10));
  for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
    const x=u+w*i/nx,y=v+d*j/ny;
    if(streetSurface(x,y)||blocked(x,y)||surfaceAt(x,y)!==z)return false;
  }
  return true;
}
export function hitsFixture(point,radius,o){
  if(o.kind==='window')return false;
  const dx=Math.max(o.u-point.u,point.u-o.u-o.w,0),dy=Math.max(o.v-point.v,point.v-o.v-o.d,0);
  if(dx*dx+dy*dy>radius*radius)return false;
  const ground=surfaceAt(o.u,o.v);
  return point.z+radius>ground+(o.z||0)&&point.z-radius<ground+fixtureTop(o);
}
export function approach(o,actor,blocked){
  if(o.approach&&!blocked(...o.approach))return o.approach;
  const midU=o.u+o.w*.5,midV=o.v+o.d*.5,gap=o.kind==='npc'?.47:.28;
  const front=seatFront(o,gap);
  if((['chair','easel','sink','shelf','fridge','basin','stove'].includes(o.kind)||o.back)&&!blocked(...front))return front;
  if(o.kind==='fridge'){
    // A fridge against a wall can be reached from the hinge-free end.
    const sides=o.turned?[[midU,o.v-gap],[midU,o.v+o.d+gap]]:[[o.u-gap,midV],[o.u+o.w+gap,midV]];
    const side=sides.find(p=>!blocked(...p));if(side)return side;
  }
  const spots=[];
  for(const f of [.5,.22,.78]){
    const u=o.u+o.w*f,v=o.v+o.d*f;
    spots.push([u,o.v+o.d+gap],[o.u+o.w+gap,v],[o.u-gap,v],[u,o.v-gap]);
  }
  const nearby=spots.filter(([u,v])=>!blocked(u,v));
  return nearby.sort((a,b)=>Math.hypot(a[0]-actor.u,a[1]-actor.v)-Math.hypot(b[0]-actor.u,b[1]-actor.v))[0]||front;
}
