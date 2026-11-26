import test from 'node:test';
import assert from 'node:assert/strict';
import {roomSeat,seatMotion,seatSample} from '../../../app/src/main/assets/home/seat-motion.mjs';

import {roomWalk} from '../../../app/src/main/assets/home/room-walk.mjs';
import {room,roomFurniture,attachedPosition} from '../../../app/src/main/assets/home/room.mjs';
import {computerArms,computerGesture,streamChair} from '../../../app/src/main/assets/home/room-furnishings.mjs';
import {turnFixture} from '../../../app/src/main/assets/home/prop-finish.mjs';
import {worldObjects} from '../../../app/src/main/assets/home/district.mjs';
import {actionPose} from '../../../app/src/main/assets/home/orientation.mjs';
import {groundSole,gripGrid,registeredPose} from '../../../app/src/main/assets/home/eva-motion.mjs';

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

test('the head has one registered size through every frame of a sit, rise or recline',()=>{
 const corners=[[-.41,.86,1.56],[.50,-.05,1.56],[.50,-.05,-.27],[-.41,.86,-.27]];
 const width=corners[1][0]-corners[0][0];
 for(const facing of ['down-left','down-right','up-left','up-right']){
   let reference;
   for(const [motion,start] of [['sit',0],['sleep',3/7]]){
     for(let frame=0;frame<=120;frame++){
       const amount=start+(1-start)*frame/120;
       const {grip,flip}=registeredPose(actionPose(facing,motion,amount),amount);
       const mesh=gripGrid(corners,groundSole(corners,grip,.012),flip);
       const [x,y]=grip.crown.from,half=grip.body.width/420;
       const fx=flip?1-x:x;
       const left=mesh.move(fx-half,y+16/252),right=mesh.move(fx+half,y+16/252);
       const headSize=right[0]-left[0];
       reference??=headSize;
       assert(Math.abs(headSize-reference)<1e-8);
       assert(Math.abs(headSize-(width*grip.body.reference/210))<1e-8);
       assert(Math.abs(left[2]-right[2])<1e-8);
       const skull=mesh.move(fx,y),brow=mesh.move(fx,y+grip.body.width/504);
       assert(Math.abs(skull[2]-brow[2]-(corners[0][2]-corners[3][2])*grip.body.reference/504)<1e-8);
       if(grip.foot){
         const [x,y]=grip.foot.from;
         assert(Math.abs(mesh.move(flip?1-x:x,y)[2]-.012)<1e-8);
       }
     }
   }
   const sit=registeredPose(actionPose(facing,'sit',1),1);
   const lie=registeredPose(actionPose(facing,'sleep',3/7),3/7);
   assert.deepEqual(sit.grip.crown,lie.grip.crown);
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

test('bed entry pauses above the mattress before reclining, and exiting reverses the same path',()=>{
 const layout=roomFurniture(worldObjects({}));
 const bed=layout.get(3);
 for(const [fixture,pillow] of [[bed,layout.get(10)],[turnFixture(bed),attachedPosition(layout.get(10),bed,turnFixture(bed))]]){
   const seat=roomSeat(fixture,roomWalk([fixture]),pillow,true);
   assert(seat);
   const motion=seatMotion(seat,seat.stand,seat.at,seat.facing,0);
   let onEdge=false,reclined=false;
   for(let ms=0;ms<=motion.duration;ms+=5){
     const sample=seatSample(motion,ms);
     const inside=sample.u>=fixture.u&&sample.u<=fixture.u+fixture.w&&
       sample.v>=fixture.v&&sample.v<=fixture.v+fixture.d;
     if(inside)assert(sample.height>=seat.edge.height-.006);
     if(sample.pose==='sit'&&sample.poseAmount===1)onEdge=true;
     if(sample.pose==='sleep'){assert(onEdge);reclined=true;}
   }
   assert(reclined);
   const before=seatSample(motion,1000);
   const reverse=seatMotion(seat,before,seat.stand,seat.facing,1000,before.amount,0);
   assert.deepEqual(seatSample(reverse,1000),before);
   assert.deepEqual(seatSample(reverse,1001+reverse.duration),{
     ...seat.stand,complete:true,amount:0,pose:'sit',poseAmount:0,height:0
   });
   const end=seatSample(motion,motion.duration);
   assert.equal(end.u,pillow.u+pillow.w/2);
   assert.equal(end.v,pillow.v+pillow.d/2);
 }
});
