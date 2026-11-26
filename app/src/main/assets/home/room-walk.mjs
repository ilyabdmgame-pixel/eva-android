import {roundRoute} from './district.mjs';
import {inRoom} from './room.mjs';

const actorClearance=.17;
const distance=(a,b)=>Math.hypot(a.u-b.u,a.v-b.v);
const inside=(p,r)=>p.u>=r.left&&p.u<=r.right&&p.v>=r.top&&p.v<=r.bottom;

function footprint(o,gap){
 const parts=o.art?[]:o.parts??[];
 const solid=parts.filter(p=>p.z<1.55&&p.z+p.h>.025);
 return {
  left:o.u+Math.min(0,...solid.map(p=>p.u))-gap,
  right:o.u+Math.max(o.w,...solid.map(p=>p.u+p.a))+gap,
  top:o.v+Math.min(0,...solid.map(p=>p.v))-gap,
  bottom:o.v+Math.max(o.d,...solid.map(p=>p.v+p.b))+gap
 };
}

// Clip the whole segment against the inflated furniture, including between nodes.
function intersects(a,b,r){
 let enter=0,exit=1;
 for(const [start,delta,min,max] of [[a.u,b.u-a.u,r.left,r.right],[a.v,b.v-a.v,r.top,r.bottom]]){
   if(Math.abs(delta)<1e-9){if(start<min||start>max)return false;continue;}
   const p=(min-start)/delta,q=(max-start)/delta;
   enter=Math.max(enter,Math.min(p,q));exit=Math.min(exit,Math.max(p,q));
   if(enter>exit)return false;
 }
 return true;
}

export function roomWalk(fixtures,extension=0,carried=null,clearance=actorClearance){
 const walls=fixtures.filter(o=>o.id!==carried&&o.solid!==false&&(o.z??0)<1.55)
   .map(o=>({id:o.id,...footprint(o,clearance)}));
 const onFloor=p=>inRoom(p.u,p.v,actorClearance,extension);
 const blocked=(p,ignore)=>!onFloor(p)||walls.some(r=>r.id!==ignore&&inside(p,r));
 const clear=(a,b,ignore)=>onFloor(a)&&onFloor(b)&&!walls.some(r=>r.id!==ignore&&intersects(a,b,r));
 const padding=.014;
 const corners=walls.flatMap(r=>[r.left-padding,r.right+padding].flatMap(u=>
   [r.top-padding,r.bottom+padding].map(v=>({u,v})))).filter(p=>!blocked(p));

 function path(from,goal,exact=false){
   if(blocked(from))return [];
   if(clear(from,goal))return distance(from,goal)<.001?[]:[goal];

   // A shortest path around rectangles bends at free corners. Also consider
   // nearby edges when the destination lies inside a piece of furniture.
   const bounds=walls.flatMap(r=>nearestEdges(goal,r,padding)).filter(p=>!blocked(p));
   const nodes=[from,...corners,...bounds];
   if(!blocked(goal))nodes.push(goal);
   const open=new Set(nodes.keys()),cost=nodes.map(()=>Infinity),parent=nodes.map(()=>-1);
   const remaining=nodes.map(p=>distance(p,goal));
   cost[0]=0;
   let best=0;
   while(open.size){
     let current=-1,rank=Infinity;
     for(const i of open){
       const score=cost[i]+remaining[i];
       if(score<rank){rank=score;current=i;}
     }
     if(current<0)break;
     open.delete(current);
     if(remaining[current]<remaining[best])best=current;
     if(nodes[current]===goal)break;
     for(const i of open){
       const next=cost[current]+distance(nodes[current],nodes[i]);
       if(next>=cost[i]||!clear(nodes[current],nodes[i]))continue;
       cost[i]=next;parent[i]=current;
     }
   }
   if(exact&&nodes[best]!==goal)return [];
   const result=[];
   for(let i=best;i>0;i=parent[i])result.unshift(nodes[i]);
   const rounded=roundRoute(from,result,(u,v)=>blocked({u,v}));
   return rounded.every((point,i)=>clear(rounded[i-1]??from,point))?rounded:result;
 }

 function recover(point,fallback){
   if(!blocked(point))return point;
   if(!blocked(fallback))return fallback;
   const options=[...corners,...walls.flatMap(r=>nearestEdges(point,r,padding))].filter(p=>!blocked(p));
   return options.sort((a,b)=>distance(a,point)-distance(b,point))[0]??fallback;
 }

 return {blocked,clear,path,recover};
}

function nearestEdges(p,r,padding){
 const u=Math.max(r.left,Math.min(r.right,p.u)),v=Math.max(r.top,Math.min(r.bottom,p.v));
 return [{u:r.left-padding,v},{u:r.right+padding,v},{u,v:r.top-padding},{u,v:r.bottom+padding}];
}
