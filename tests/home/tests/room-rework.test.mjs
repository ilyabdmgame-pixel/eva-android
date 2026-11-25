import test from 'node:test';
import assert from 'node:assert/strict';
import {actionBeat,gripGrid,pointOnCel,registeredPose} from '../../../app/src/main/assets/home/eva-motion.mjs';
import {actionPose} from '../../../app/src/main/assets/home/orientation.mjs';
import {attachedPosition,bedRest,drawBedding,expandedRoom,fitsRoom,inRoom,roomFurniture,roomView}
  from '../../../app/src/main/assets/home/room.mjs';
import {computerLayout,drawComputer,furnishingThumbnail,roomFurnishings} from '../../../app/src/main/assets/home/room-furnishings.mjs';
import {worldObjects,worldPoint,localPath,route} from '../../../app/src/main/assets/home/district.mjs';
import {blocksActor} from '../../../app/src/main/assets/home/contact.mjs';
import {placementIssue} from '../../../app/src/main/assets/home/layout.mjs';
import {turnFixture} from '../../../app/src/main/assets/home/prop-finish.mjs';

test('room hands stay on the visible clean drawings as pose and facing change',()=>{
 const corners=[[0,2,1.6],[1,1,1.6],[1,1,0],[0,2,0]];
 const distance=(a,b)=>Math.hypot(a.u-b.u,a.v-b.v,a.z-b.z);
 for(const facing of ['down-right','down-left','up-right','up-left'])for(const motion of ['reach','stoop','sit','sleep']){
   let previous;
   for(let frame=0;frame<=70;frame++){
     const phase=frame/70,pose=registeredPose(actionPose(facing,motion,phase),phase);
     const grid=gripGrid(corners,pose.grip,pose.flip);
     const [x,y]=pose.grip.from;
     const [u,v,z]=grid.move(pose.flip?1-x:x,y);
     assert([0,3,7,...(motion==='sleep'?[5]:[])].includes(pose.column));
     assert(distance({u,v,z},grid.hand)<1e-8);
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

test('changing motion leaves and enters the shared neutral frame',()=>{
 const beats=[['reach',700,0,.85],['stoop',1400,.3,.7,3],['reach',400,.7,0]];
 for(let i=0;i<beats.length;i++){
   const beat=beats[i];
   assert.equal(actionBeat(beats,i,0,beat[2]),0);
   assert.equal(actionBeat(beats,i,beat[1],beat[3]),0);
 }
 assert.equal(actionBeat(beats,1,550,.53),.53);
});

test('pillow and quilt follow the bed when rotated and stay below the sleeper',()=>{
 const layout=roomFurniture(worldObjects({}));
 const initial=layout.get(3);
 for(const bed of [initial,turnFixture(initial)]){
   const pillow=attachedPosition(layout.get(10),initial,bed),quilt=attachedPosition(layout.get(11),initial,bed);
   const figures=[],calls=[];
   const renderer={sprite(...args){figures.push(args);},panel(...args){calls.push(args);}};
   drawBedding(renderer,bed,pillow,false);drawBedding(renderer,bed,quilt,false);
   const rest=bedRest(bed,pillow,true);
   assert.equal(figures[0][2].u,rest.u);assert.equal(figures[0][2].v,rest.v);
   assert(figures[0][5].bedPlane<rest.height);
   assert(calls.length>30);
   for(const [points,,,id] of calls){
     assert.equal(id,11);
     for(const [u,v,z] of points)assert(u>=bed.u&&u<=bed.u+bed.w&&v>=bed.v&&v<=bed.v+bed.d&&z<rest.height);
   }
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
   const render=(on,time)=>{const calls=[];const r={box(...p){calls.push(p);},panel(...p){calls.push(p);}};
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

test('furnishing previews draw the geometry of every new model within their canvases',()=>{
 const methods=['beginPath','closePath','fill','stroke'];
 const previews=[];
 for(const model of roomFurnishings){
   const points=[];
   const context=Object.fromEntries(methods.map(method=>[method,()=>{}]));
   context.moveTo=context.lineTo=(x,y)=>points.push([x,y]);
   const canvas={getContext:()=>context};
   furnishingThumbnail(canvas,model);
   assert(points.length>=12,model.name);
   assert(points.every(([x,y])=>x>=0&&x<=canvas.width&&y>=0&&y<=canvas.height),model.name);
   previews.push(JSON.stringify(points));
 }
 assert.equal(new Set(previews).size,roomFurnishings.length);
});
