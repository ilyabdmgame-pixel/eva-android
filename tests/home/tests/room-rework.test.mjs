import test from 'node:test';
import assert from 'node:assert/strict';
import {actionBeat,gripGrid,pointOnCel,registeredPose} from '../../../app/src/main/assets/home/eva-motion.mjs';
import {actionPose,evaPose,gait,standingPose} from '../../../app/src/main/assets/home/orientation.mjs';
import {attachedPosition,bedRest,drawBedding,expandedRoom,fitsRoom,inRoom,roomFurniture,roomView}
  from '../../../app/src/main/assets/home/room.mjs';
import {computerLayout,drawComputer,furnishingThumbnail,roomFurnishings,streamChair} from '../../../app/src/main/assets/home/room-furnishings.mjs';
import {worldObjects,worldPoint,localPath,route} from '../../../app/src/main/assets/home/district.mjs';
import {blocksActor} from '../../../app/src/main/assets/home/contact.mjs';
import {placementIssue} from '../../../app/src/main/assets/home/layout.mjs';
import {turnFixture,nextTurn} from '../../../app/src/main/assets/home/prop-finish.mjs';
import {collectMesh} from '../../../app/src/main/assets/home/mesh-preview.mjs';

test('room hands stay on the visible clean drawings as pose and facing change',()=>{
 const corners=[[0,2,1.6],[1,1,1.6],[1,1,0],[0,2,0]];
 const distance=(a,b)=>Math.hypot(a.u-b.u,a.v-b.v,a.z-b.z);
 for(const facing of ['down-right','down-left','up-right','up-left'])for(const motion of ['reach','stoop','sit','sleep']){
   let previous,previousCrown;
   for(let frame=0;frame<=70;frame++){
     const phase=frame/70,pose=registeredPose(actionPose(facing,motion,phase),phase);
     const grid=gripGrid(corners,pose.grip,pose.flip);
     const [x,y]=pose.grip.from;
     const [u,v,z]=grid.move(pose.flip?1-x:x,y);
     assert([0,3,7,...(motion==='sleep'?[5]:[])].includes(pose.column));
     assert(distance({u,v,z},grid.hand)<1e-8);
     const mirror=([x,y])=>[pose.flip?1-x:x,y];
     const {crown,other,otherFrom,support}=pose.grip;
     const pinned=[[crown.from,crown.to],...(other?[[otherFrom,other]]:[]),...(support?[[support,support]]:[])];
     for(const [from,to] of pinned){
       const [u,v,z]=grid.move(...mirror(from));
       assert(distance({u,v,z},pointOnCel(corners,mirror(to)))<1e-8);
     }
     const head=pointOnCel(corners,mirror(crown.to));
     if(previousCrown)assert(distance(previousCrown,head)<.05);
     previousCrown=head;
     if(previous)assert(distance(previous,grid.hand)<.047);
     previous=grid.hand;
   }
 }
 const p=registeredPose(actionPose('down-right','sit',1),1);
 const right=gripGrid(corners,p.grip,false).hand;
 const left=gripGrid(corners,p.grip,true).hand;
 assert(Math.abs(right.u+left.u-1)<1e-8);
 assert.equal(pointOnCel(corners,[0,0]).z,1.6);
});

test('Eva interpolates to the first step at the end of each walking cycle',()=>{
 const distance=gait.stride*(gait.frames-.5)/gait.frames;
 for(const facing of ['down-right','down-left','up-right','up-left','up','left','right','down']){
   const end=evaPose(facing,'walk',distance);
   assert.equal(end.column,7);
   assert.equal(end.step.offset,-7/8);
   assert.equal(end.step.weight,.5);
   assert.equal(end.step.offsetY,0);
   const restart=evaPose(facing,'walk',gait.stride);
   for(const [i,shoe] of end.step.feet.entries())
     assert(Math.abs(shoe+end.step.travel[i]*.5-restart.step.feet[i])<1e-9);
   assert.equal(evaPose(facing,'walk',gait.stride).column,0);
   assert.equal(evaPose(facing,'walk',gait.stride).step.weight,0);
 }
});

test('Eva can settle either facing into its stationary drawing with both feet registered',()=>{
 for(const facing of ['down-right','down-left','up-right','up-left','up','left','right','down']){
   const standing=standingPose('eva',facing);
   const stop=evaPose(facing,'walk',gait.stride*.59,1);
   assert.equal(stop.step.weight,1);
   assert.equal(stop.column+stop.step.offset*gait.columns,standing.column);
   assert.equal(stop.row+stop.step.offsetY*gait.rows,standing.row);
   assert(stop.step.feet.every(value=>value>0&&value<1));
 }
});

test('changing motion leaves and enters the shared neutral frame',()=>{
 const beats=[['reach',700,0,.85],['stoop',1400,.3,.7,3],['reach',400,.7,0]];
 for(let i=0;i<beats.length;i++){
   const beat=beats[i];
   assert.equal(actionBeat(beats,i,0,beat[2]),0);
   assert.equal(actionBeat(beats,i,beat[1],beat[3]),0);
 }
 assert.equal(actionBeat(beats,1,550,.53),.53);
});

test('the mattress, pillow and quilt share a physical surface in all four orientations',()=>{
 const layout=roomFurniture(worldObjects({})),initial=layout.get(3);
 let bed=initial;
 for(let turn=0;turn<4;turn++,bed=nextTurn(bed,true)){
   const pillow=attachedPosition(layout.get(10),initial,bed),quilt=attachedPosition(layout.get(11),initial,bed);
   const rest=bedRest(bed,pillow,true),seat=bedRest(bed,null,false);
   const corners=id=>collectMesh(r=>drawBedding(r,bed,id===10?pillow:quilt,false)).flatMap(f=>f.points);
   const pillowPoints=corners(10);
   assert(pillowPoints.length>24);
   for(const [u,v,z] of pillowPoints){
     assert(u>=pillow.u&&u<=pillow.u+pillow.w&&v>=pillow.v&&v<=pillow.v+pillow.d);
     assert(z>=seat.height&&z<=rest.height+.025);
   }
   assert.equal(rest.u,pillow.u+pillow.w/2);assert.equal(rest.v,pillow.v+pillow.d/2);
   const topAtRest=Math.max(...corners(11).map(p=>p[2]));
   const occupied=collectMesh(r=>drawBedding(r,bed,quilt,false,1)).flatMap(f=>f.points);
   const highest=Math.max(...occupied.map(p=>p[2]));
   assert(highest>topAtRest+.20&&highest<topAtRest+.32);
   for(const [u,v] of occupied)assert(u>=bed.u&&u<=bed.u+bed.w&&v>=bed.v&&v<=bed.v+bed.d);
   const atPillow=occupied.some(([u,v])=>Math.hypot(u-rest.u,v-rest.v)<.15);
   assert.equal(atPillow,false);
 }
});

test('the desktop PC rotates with the desk, and its monitor and keyboard animate',()=>{
 const layout=roomFurniture(worldObjects({}));
 const desk=layout.get(1),canonical=layout.get(27);
 for(const table of [desk,turnFixture(desk)]){
   const pc=attachedPosition(canonical,desk,table),at=computerLayout(pc);
   assert.equal(pc.turned,!!table.turned);
   const monitor=at(.5,.16,.25),keyboard=at(.7,.40,0);
   assert(monitor.z>keyboard.z);
   for(const p of [monitor,keyboard])assert(p.u>=table.u&&p.u<=table.u+table.w&&p.v>=table.v&&p.v<=table.v+table.d);
   const chair=attachedPosition(layout.get(streamChair.id),desk,table),center=at(.595,.177,0);
   if(table.turned){
     assert(Math.abs(chair.v+chair.d/2-center.v)<1e-8);
     assert(chair.u>table.u+table.w);
   }else{
     assert(Math.abs(chair.u+chair.w/2-center.u)<1e-8);
     assert(chair.v>table.v+table.d);
   }
   const render=(on,time)=>{const calls=[];const r={box(...p){calls.push(p);},panel(...p){calls.push(p);},streamPanel(...p){calls.push(p);}};
     drawComputer(r,pc,on,on,time);return calls;};
   assert(render(false,0).length>20);
   assert.notDeepEqual(render(false,0),render(true,0));
   assert.notDeepEqual(render(true,0),render(true,1.2));
 }
});

test('room expansion adds usable floor and leaves old placements intact',()=>{
 const corner=worldPoint('home',4.0,3.93);
 assert(!fitsRoom(corner.u,corner.v,.4,.38));
 assert(fitsRoom(corner.u,corner.v,.4,.38,expandedRoom));
 assert(roomView(expandedRoom).scale<roomView(0).scale);
 const objects=[...roomFurniture(worldObjects({})).values()];
 assert.equal(new Set(roomFurnishings.map(o=>o.id)).size,roomFurnishings.length);
 assert(roomFurnishings.every(model=>!worldObjects({}).some(o=>o.id===model.id)));
 const start=worldPoint('home',.38,.92);
 const blocked=(u,v)=>!inRoom(u,v,.17,expandedRoom)||blocksActor(u,v,objects,[],null,0,true);
 const end=(localPath(start,corner,blocked)||route(start,corner,blocked)).at(-1);
 assert.deepEqual(end,corner);
 const rug=roomFurnishings.find(o=>o.kind==='floorDecor');
 assert.equal(placementIssue(rug,start,objects,[],[start],true),'');
});

test('furnishing previews rasterize every solid model with a clean margin and a unique silhouette',()=>{
 const previews=[];
 const ids=new Set([2,12,21,24,34,61,65,74,81,82,87,91,300,301,302,303,304,305]);
 const fixtures=[...roomFurnishings,...worldObjects({}).filter(o=>ids.has(o.id))];
 for(const model of fixtures){
   let image;
   const canvas={getContext:()=>({
     createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
     putImageData:result=>{image=result.data;}
   })};
   furnishingThumbnail(canvas,model);
   const pixels=[];
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
     const i=4*(y*canvas.width+x);
     if(image[i+3]){
       assert(x>1&&x<canvas.width-2&&y>1&&y<canvas.height-2,model.name);
       pixels.push((image[i]<<16)+(image[i+1]<<8)+image[i+2]);
     }
   }
   assert(pixels.length>260,model.name);
   previews.push(pixels.join(','));
 }
 assert(new Set(previews).size>=fixtures.length-2);
});
