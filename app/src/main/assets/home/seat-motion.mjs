import {bedRest} from './room.mjs';

const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const x=clamp(value);return x*x*(3-2*x);};
const interpolate=(from,to,t)=>from+(to-from)*t;

export function seatMotion(seat,fromPoint,toPoint,facing,start,from=0,to=1){
 const duration=seat.sleep?930:to>from?720:620;
 return {seat,fromPoint,toPoint,facing,start,from,to,duration:duration*Math.max(.18,Math.abs(to-from))};
}

export function seatSample(motion,time,reduced=false){
 const t=reduced?1:clamp((time-motion.start)/motion.duration);
 const sitting=motion.to>motion.from;
 const pose=smooth(sitting?(t-.05)/.87:(t-.035)/.89);
 const step=smooth(sitting?(t-.27)/.65:(t-.08)/.65);
 return {
  amount:interpolate(motion.from,motion.to,pose),
  u:interpolate(motion.fromPoint.u,motion.toPoint.u,step),
  v:interpolate(motion.fromPoint.v,motion.toPoint.v,step),
  complete:t===1
 };
}

export function roomSeat(fixture,walk,pillow=null,asleep=false){
 const bed=fixture.kind==='bed';
 const office=fixture.kind==='streamChair';
 const reversed=office||fixture.back;
 const alongU=Boolean(fixture.turned)!==bed;
 const sign=reversed?-1:1;
 const front=alongU?'u':'v';
 const size=alongU?'w':'d';
 const at=bed?bedRest(fixture,pillow,asleep):{
   u:fixture.u+fixture.w/2,v:fixture.v+fixture.d/2,
   height:fixture.seatHeight??.48
 };
 const entry=asleep?bedRest(fixture,null,false):at;
 const standing={u:entry.u,v:entry.v};
 const across=alongU?'v':'u',width=alongU?'d':'w';
 const approaches=office?[1,-1].map(side=>({...standing,[across]:at[across]+side*(fixture[width]/2+.20)})):
   [{...standing,[front]:fixture[front]+(sign>0?fixture[size]+.20:-.20)}];
 const stand=approaches.find(p=>!walk.blocked(p)&&walk.clear(p,at,fixture.id));
 if(!stand)return null;
 const facing=alongU?(sign>0?'down-right':'up-left'):(sign>0?'down-left':'up-right');
 return {id:fixture.id,stand,at,facing,sleep:asleep,height:at.height};
}
