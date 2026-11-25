// Registered to the clean drawings in the 210 x 252 action atlas. The other columns contain blended silhouettes.
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
 const grip={from:ratio(row[source]),to:ratio(mix(row[start],row[end],part))};
 if(pose.row===2)grip.other=ratio(mix(lap[pose.key][start],lap[pose.key][end],part));
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

export function gripGrid(corners,grip,flip){
 const mirror=([x,y])=>[flip?1-x:x,y];
 const from=mirror(grip.from),to=mirror(grip.to);
 const initial=pointOnCel(corners,from),target=pointOnCel(corners,to);
 const delta=[target.u-initial.u,target.v-initial.v,target.z-initial.z];
 const move=(x,y)=>{
   const xFall=Math.max(0,1-Math.abs(x-from[0])/.33);
   const yFall=Math.max(0,1-Math.abs(y-from[1])/.30);
   const p=pointOnCel(corners,[x,y]),weight=xFall*yFall;
   return [p.u+delta[0]*weight,p.v+delta[1]*weight,p.z+delta[2]*weight];
 };
 const grid=coordinate=>[...new Set([0,.25,.5,.75,1,coordinate])].sort((a,b)=>a-b);
 return {hand:target,other:grip.other?pointOnCel(corners,mirror(grip.other)):null,
   xs:grid(from[0]),ys:grid(from[1]),move,warped:delta.some(x=>Math.abs(x)>.0005)};
}
