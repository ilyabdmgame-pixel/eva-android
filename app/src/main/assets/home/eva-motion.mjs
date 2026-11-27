import {actionAnchors} from './action-anchors.mjs';

// Registered to the clean drawings in the 210 x 252 action atlas.
const clean=[[0,3,7],[0,3,7],[0,3,7],[0,3,5,7]];
const wrists={
 'act-eva-front':[
   [[128,120],[158,86],[166,68]],
   [[128,120],[155,177],[148,193]],
   [[128,120],[122,148],[116,156]],
   [[128,120],[116,156],[180,188],[174,180]]
 ],
 'act-eva-rear':[
   [[131,134],[161,68],[165,55]],
   [[131,134],[156,171],[149,183]],
   [[131,134],[126,143],[118,154]],
   [[131,134],[118,154],[181,190],[174,180]]
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

// Head widths are measured across the hairline on the original atlas cels.
// Each drawing gets one correction, based on the standing drawing in that view.
const seatedDrawings={
 'act-eva-front':{
   width:37,
   2:[[37,62,101,119],[35,96,82,164],[31,111,82,173]],
   3:[null,[31,111,82,173],[37,149,109,175],[37,170,105,181]]
 },
 'act-eva-rear':{
   width:36,
   2:[[36,59,102,119],[37,94,76,164],[33,123,78,176]],
   3:[null,[33,123,78,176],[35,151,106,175],[36,168,104,181]]
 }
};

function drawingProfile(key,row,index){
 const view=seatedDrawings[key],drawing=view[row]?.[index];
 if(!drawing)return null;
 const [width,neck,hipX,hipY]=drawing;
 return {width,reference:view.width,neck:neck/252,hip:ratio([hipX,hipY])};
}

const smooth=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};

function normalizeBody(point,body){
 if(!body||body.width===body.reference)return point;
 const [x,y]=point,[u,v]=body.hip;
 const scale=body.reference/body.width;
 return [u+(x-u)*scale,v+(y-v)*scale];
}

export function registeredPose(pose,amount){
 const columns=clean[pose.row];
 if(!columns||!Object.hasOwn(wrists,pose.key))return pose;
 const phase=Math.max(0,Math.min(7,amount*7));
 const end=columns.findIndex(value=>value>=phase),start=Math.max(0,end-1);
 const part=end===start?0:(phase-columns[start])/(columns[end]-columns[start]);
 const source=part<.5?start:end;
 const row=wrists[pose.key][pose.row];
 const heads=actionAnchors[pose.key].heads[pose.row];
 const startProfile=drawingProfile(pose.key,pose.row,start);
 const endProfile=start===end?startProfile:drawingProfile(pose.key,pose.row,end);
 const target=(first,last)=>mix(normalizeBody(first,startProfile),normalizeBody(last,endProfile),part);
 const grip={
   from:ratio(row[source]),to:target(ratio(row[start]),ratio(row[end])),
   crown:{from:heads[columns[source]],to:target(heads[columns[start]],heads[columns[end]])}
 };
 const body=source===start?startProfile:endProfile;
 if(body){
   grip.body=body;
   const first=startProfile?.hip??body.hip,last=endProfile?.hip??body.hip;
   grip.hip={from:body.hip,to:mix(first,last,part)};
 }
 if(pose.row===2){
   const hands=lap[pose.key],shoes=soles[pose.key];
   grip.other=target(ratio(hands[start]),ratio(hands[end]));
   grip.otherFrom=ratio(hands[source]);
   grip.foot={from:ratio(shoes[source]),to:ratio(mix(shoes[start],shoes[end],part))};
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

export function groundSole(corners,grip,floor){
 if(!grip.foot)return grip;
 const [top,,,bottom]=corners;
 const y=(top[2]-floor)/(top[2]-bottom[2]);
 return {...grip,foot:{...grip.foot,to:[grip.foot.to[0],y]}};
}

export function gripGrid(corners,grip,flip){
 const mirror=([x,y])=>[flip?1-x:x,y];
 const landmark=(first,last)=>{
   const from=mirror(first),base=mirror(normalizeBody(first,grip.body)),to=mirror(last);
   return {from,dx:to[0]-base[0],dy:to[1]-base[1]};
 };
 const points=[landmark(grip.from,grip.to)];
 const crown=grip.crown&&landmark(grip.crown.from,grip.crown.to);
 if(crown)points.push(crown);
 if(grip.otherFrom)points.push(landmark(grip.otherFrom,grip.other));
 if(grip.hip)points.push(landmark(grip.hip.from,grip.hip.to));
 if(grip.support)points.push(landmark(grip.support,grip.support));
 if(grip.foot)points.push(landmark(grip.foot.from,grip.foot.to));
 const body=grip.body;
 const map=point=>pointOnCel(corners,point);
 const move=(x,y)=>{
   let dx=0,dy=0,total=1;
   for(const point of points){
     const distance=Math.hypot((x-point.from[0])/.45,(y-point.from[1])/.42);
     if(distance<1e-8){dx=point.dx;dy=point.dy;total=1;break;}
     if(distance>=1)continue;
     const weight=(1-distance)**2/distance**2;
     dx+=weight*point.dx;dy+=weight*point.dy;total+=weight;
   }
   const [u,v]=mirror(normalizeBody(mirror([x,y]),body));
   // Keep the head rigid while the arms, hips and soles follow their contacts.
   const lock=body&&crown?1-smooth((y-body.neck)/.026):0;
   const p=map([u+dx/total*(1-lock)+(crown?.dx??0)*lock,
     v+dy/total*(1-lock)+(crown?.dy??0)*lock]);
   return [p.u,p.v,p.z];
 };
 const grid=axis=>[...new Set([0,.25,.5,.75,1,...points.map(point=>point.from[axis]),
   ...(body&&axis===1?[body.neck,body.neck+.026,body.hip[1]]:[])])].sort((a,b)=>a-b);
 return {hand:map(mirror(grip.to)),other:grip.other?map(mirror(grip.other)):null,
   head:grip.crown?map(mirror(grip.crown.to)):null,xs:grid(0),ys:grid(1),move,
   warped:Boolean(body&&body.width!==body.reference)||points.some(point=>Math.hypot(point.dx,point.dy)>.0005)};
}
