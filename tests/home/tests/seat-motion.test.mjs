import test from 'node:test';
import assert from 'node:assert/strict';
import {roomSeat,seatMotion,seatSample} from '../../../app/src/main/assets/home/seat-motion.mjs';

import {roomWalk} from '../../../app/src/main/assets/home/room-walk.mjs';
import {room,roomFurniture,attachedPosition} from '../../../app/src/main/assets/home/room.mjs';
import {computerArms,computerGesture,streamChair} from '../../../app/src/main/assets/home/room-furnishings.mjs';
import {turnFixture} from '../../../app/src/main/assets/home/prop-finish.mjs';
import {worldObjects} from '../../../app/src/main/assets/home/district.mjs';
import {actionPose} from '../../../app/src/main/assets/home/orientation.mjs';
import {seatedUpperBody,gripGrid,registeredPose} from '../../../app/src/main/assets/home/eva-motion.mjs';

const seat={id:7};
const floor={u:2,v:3};
const chair={u:3,v:4};

test('sit and rise end at their anchors and keep fewer frames in reduced motion',()=>{
 const sit=seatMotion(seat,floor,chair,'down-left',100);
 assert.deepEqual(seatSample(sit,100),{...floor,amount:0,complete:false});
 assert.deepEqual(seatSample(sit,1000),{...chair,amount:1,complete:true});
 assert.deepEqual(seatSample(sit,100,true),{...chair,amount:1,complete:true});
 const rise=seatMotion(seat,chair,floor,'down-left',1000,1,0);
 assert.ok(rise.duration<sit.duration);
 assert.deepEqual(seatSample(rise,1000),{...chair,amount:1,complete:false});
 assert.deepEqual(seatSample(rise,2000),{...floor,amount:0,complete:true});
});

test('standing part way through a sit begins from the rendered position and pose',()=>{
 const sit=seatMotion(seat,floor,chair,'down-left',0),before=seatSample(sit,330);
 assert.ok(before.amount>0&&before.amount<1);
 const reverse=seatMotion(seat,before,floor,sit.facing,330,before.amount,0);
 assert.deepEqual(seatSample(reverse,330),before);
 assert.deepEqual(seatSample(reverse,1200),{...floor,amount:0,complete:true});
});

test('walking cannot cut a furniture corner between free waypoints, even on narrow diagonal segments',()=>{
 const {u,v}=room;
 const desk={id:1,u,v,w:.9,d:.6};
 const from={u:u-.23,v:v+.71},to={u:u+.48,v:v+.93};
 const walk=roomWalk([desk]);
 assert(!walk.blocked(from)&&!walk.blocked(to));
 assert(!walk.clear(from,to));
 const path=walk.path(from,to,true);
 assert(path.length>1);
 assert.equal(path.at(-1),to);
 assert(path.every((p,i)=>walk.clear(path[i-1]||from,p)));
 const inside={u:u+.25,v:v+.30};
 assert.deepEqual(walk.path(from,inside,true),[]);
 const stopped=walk.path(from,inside).at(-1);
 assert(stopped&&!walk.blocked(stopped));
});

test('each chair uses its open side and a clear transfer after rotation',()=>{
 const layout=roomFurniture(worldObjects({})),desk=layout.get(1),original=layout.get(streamChair.id);
 for(const [furniture,chair] of [[desk,original],[turnFixture(desk),turnFixture(original)]]){
   const attached={...chair,...attachedPosition(original,desk,furniture)};
   const walk=roomWalk([furniture,attached]);
   const seat=roomSeat(attached,walk);
   assert(seat);
   const depth=attached.turned?'u':'v',across=attached.turned?'v':'u';
   assert.equal(seat.stand[depth],seat.at[depth]);
   assert(seat.stand[across]>seat.at[across]);
   assert(walk.clear(seat.stand,seat.at,attached.id));
   const obstacle=(point,id)=>({id,u:point.u-.05,v:point.v-.05,w:.10,d:.10});
   const first=obstacle(seat.stand,1122);
   const second=roomSeat(attached,roomWalk([furniture,attached,first]));
   assert(second&&second.stand[across]<second.at[across]);
   assert.equal(roomSeat(attached,roomWalk([furniture,attached,first,obstacle(second.stand,1123)])),null);
 }
 for(const id of [2,81,3]){
   const chair=layout.get(id);
   for(const o of [chair,turnFixture(chair)]){
     const sit=roomSeat(o,roomWalk([o]));
     assert(sit&&(sit.stand.u!==sit.at.u||sit.stand.v!==sit.at.v));
   }
 }
});

test('sitting keeps head and torso scale while grounding the painted sole',()=>{
 for(const facing of ['down-left','down-right','up-left','up-right']){
   const source=registeredPose(actionPose(facing,'sit',1),1);
   const corners=[[-.41,.86,1.56],[.50,-.05,1.56],[.50,-.05,-.27],[-.41,.86,-.27]];
   const anchor=[.38,.675];
   const before=gripGrid(corners,seatedUpperBody(corners,source.grip,anchor,0,.012),source.flip);
   const full=gripGrid(corners,seatedUpperBody(corners,source.grip,anchor,1,.012),source.flip);
   const scale=(mesh)=>{
     const a=mesh.move(.40,.38),b=mesh.move(.60,.38);
     return Math.hypot(a[0]-b[0],a[1]-b[1]);
   };
   assert(Math.abs(scale(full)/scale(before)-1.19)<1e-8);
   const [x,y]=source.grip.foot.from,shoe=source.flip?1-x:x;
   assert(Math.abs(full.move(shoe,y)[2]-.012)<1e-8);
   assert(full.head.z>before.head.z);
 }
});

test('both forearms reach the keyboard through fixed shoulders in either desk orientation',()=>{
 for(const turned of [false,true]){
   const fixture={u:0,v:0,z:.80,turned},actor=turned?{u:.91,v:.60,z:.51}:{u:.60,v:.91,z:.51};
   const gesture=computerGesture(fixture,{index:1,phase:.087});
   const arm=computerArms(actor,fixture,gesture);
   assert.deepEqual(arm.map(x=>x.hand),[gesture.left.point,gesture.right.point]);
   assert(gesture.key.pressure>0);
   const last=computerArms(actor,fixture,computerGesture(fixture,{index:3,phase:1}));
   assert.deepEqual(arm.map(x=>x.shoulder),last.map(x=>x.shoulder));
   assert.equal(last[0].reach+last[1].reach,0);
 }
});
