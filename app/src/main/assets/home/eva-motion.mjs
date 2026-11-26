import {actionAnchors} from './action-anchors.mjs';

// Registered to the clean drawings in the 210 x 252 action atlas.
const clean=[[0,3,7],[0,3,7],[0,3,7],[0,3,5,7]];
const wrists={
 'act-eva-front':[
   [[128,120],[158,86],[166,68]],
   [[128,120],[155,177],[148,193]],
   [[128,120],[122,148],[116,156]],
   [[128,120],[122,148],[180,188],[174,180]]
 ],
 'act-eva-rear':[
   [[131,134],[161,68],[165,55]],
   [[131,134],[156,171],[149,183]],
   [[131,134],[126,143],[118,154]],
   [[131,134],[122,156],[181,190],[174,180]]
 ]
};
const lap={
 'act-eva-front':[[91,132],[104,151],[100,158]],
 'act-eva-rear':[[124,127],[111,142],[103,149]]
};
// Lowest load-bearing soles in the clean sitting cels.
const soles={
 'act-eva-front':[[91,230],[108,232],[110,232]],
 'act-eva-rear':[[121,229],[133,229],[127,232]]
};
const ratio=value=>[value[0]/210,value[1]/252];
const mix=(a,b,t)=>a.map((number,i)=>number+(b[i]-number)*t);

export function registeredPose(pose,amount){
 const columns=clean[pose.row];
 if(!columns||!Object.hasOwn(wrists,pose.key))return pose;
 const phase=Math.max(0,Math.min(7,amount*7));
 const end=columns.findIndex(value=>value>=phase),start=Math.max(0,end-1);
 const part=end===start?0:(phase-columns[start])/(columns[end]-columns[start]);
 const source=part<.5?start:end;
 const row=wrists[pose.key][pose.row];
 const heads=actionAnchors[pose.key].heads[pose.row];
 const grip={
   from:ratio(row[source]),to:ratio(mix(row[start],row[end],part)),
   crown:{from:heads[columns[source]],to:mix(heads[columns[start]],heads[columns[end]],part)}
 };
 if(pose.row===2){
   grip.other=ratio(mix(lap[pose.key][start],lap[pose.key][end],part));
   grip.otherFrom=ratio(lap[pose.key][source]);
   grip.foot={from:ratio(soles[pose.key][source]),to:ratio(mix(soles[pose.key][start],soles[pose.key][end],part))};
 }else if(pose.row!==3)grip.support=[.5,.935];
 return {...pose,column:columns[source],grip};
}

// Blend only short movement arcs between actions. A change of pose passes through the shared neutral drawing.
export function actionBeat(beats,index,ms,amount){
 const [kind,length,from,to,strokes]=beats[index];
 const incoming=beats[index-1],outgoing=beats[index+1];
 const edge=Math.min(145,length*.29);
 const ease=t=>t*t*(3-2*t);
 if(ms<edge){
   const t=ease(ms/edge);
   const start=incoming?.[0]===kind?(incoming[4]?incoming[2]:incoming[3]):0;
   return start+(amount-start)*t;
 }
 if(ms>length-edge&&(!outgoing||outgoing[0]!==kind)){
   return amount*ease((length-ms)/edge);
 }
 return amount;
}

export function pointOnCel(corners,[x,y]){
 const upper=mix(corners[0],corners[1],x),lower=mix(corners[3],corners[2],x);
 const [u,v,z]=mix(upper,lower,y);
 return {u,v,z};
}

export function seatedUpperBody(corners,grip,anchor,amount,floor){
 const [top,,,bottom]=corners;
 const y=(top[2]-floor)/(top[2]-bottom[2]);
 return {...grip,
   foot:{...grip.foot,to:[grip.foot.to[0],y]},
   upper:{anchor,scale:amount*.19}
 };
}

export function gripGrid(corners,grip,flip){
 const mirror=([x,y])=>[flip?1-x:x,y];
 const landmark=(first,last)=>{
   const from=mirror(first),to=mirror(last);
   return {from,dx:to[0]-from[0],dy:to[1]-from[1]};
 };
 const points=[landmark(grip.from,grip.to)];
 if(grip.crown)points.push(landmark(grip.crown.from,grip.crown.to));
 if(grip.otherFrom)points.push(landmark(grip.otherFrom,grip.other));
 if(grip.support)points.push(landmark(grip.support,grip.support));
 if(grip.foot)points.push(landmark(grip.foot.from,grip.foot.to));
 const upper=grip.upper&&mirror(grip.upper.anchor);
 const map=([x,y])=>{
   if(!upper)return pointOnCel(corners,[x,y]);
   const [u,v]=upper;
   const t=Math.max(0,Math.min(1,(v-y)/.16));
   const scale=1+grip.upper.scale*t*t*(3-2*t);
   return pointOnCel(corners,[u+(x-u)*scale,v+(y-v)*scale]);
 };
 const move=(x,y)=>{
   let dx=0,dy=0,total=1;
   for(const point of points){
     const distance=Math.hypot((x-point.from[0])/.45,(y-point.from[1])/.42);
     if(distance<1e-8){dx=point.dx;dy=point.dy;total=1;break;}
     if(distance>=1)continue;
     const weight=(1-distance)**2/distance**2;
     dx+=weight*point.dx;dy+=weight*point.dy;total+=weight;
   }
   const p=map([x+dx/total,y+dy/total]);
   return [p.u,p.v,p.z];
 };
 const grid=axis=>[...new Set([0,.25,.5,.75,1,...points.map(point=>point.from[axis]),
   ...(upper&&axis===1?[upper[1]-.16,upper[1]]:[])])].sort((a,b)=>a-b);
 return {hand:map(mirror(grip.to)),other:grip.other?map(mirror(grip.other)):null,
   head:grip.crown?map(mirror(grip.crown.to)):null,xs:grid(0),ys:grid(1),move,
   warped:grip.upper?.scale>0||points.some(point=>Math.hypot(point.dx,point.dy)>.0005)};
}
