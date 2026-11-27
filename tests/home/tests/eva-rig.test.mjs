import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaClips,EVA_FPS,evaClipFrame} from '../../../app/src/main/assets/home/eva-clips.mjs';
import {evaRig,createEvaAnimator,bones,place,proportions} from '../../../app/src/main/assets/home/eva-rig.mjs';
import {evaModel} from '../../../app/src/main/assets/home/eva-model.mjs';
import {drawEvaProps} from '../../../app/src/main/assets/home/eva-props.mjs';
import {roomSeat,seatSample,seatMotion} from '../../../app/src/main/assets/home/seat-motion.mjs';
import {worldObjects} from '../../../app/src/main/assets/home/district.mjs';
import {roomFurniture,attachedPosition,roomWindowFixture,roomApproach,windowLatch,room} from '../../../app/src/main/assets/home/room.mjs';
import {roomWalk} from '../../../app/src/main/assets/home/room-walk.mjs';
import {computerGesture,roomDesk} from '../../../app/src/main/assets/home/room-furnishings.mjs';
import {nextTurn} from '../../../app/src/main/assets/home/prop-finish.mjs';
import {activityContacts} from '../../../app/src/main/assets/home/room-activities.mjs';
import {fixtureFrame} from '../../../app/src/main/assets/home/room-mesh.mjs';
import {useProgress} from '../../../app/src/main/assets/home/household.mjs';
import {kitchenWorkPoint} from '../../../app/src/main/assets/home/room-appliances.mjs';

const home='../../../app/src/main/assets/home/';
const activities=JSON.parse(readFileSync(new URL(home+'room-activities.json',import.meta.url)));
const at={u:0,v:0,z:0},workTop={u:0,v:.52,z:.80};
const neutral={at,time:0,clip:'idle',facing:'down',workTop};
const q=p=>[p.u,p.v,p.z];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const near=(a,b,eps=1e-6)=>assert(Math.abs(a-b)<eps,`${a} should equal ${b}`);

test('each scheduled activity has its own seamless 30 fps animation',()=>{
 assert.equal(EVA_FPS,30);assert(Object.keys(activities).length>=20);
 const signatures=new Set();
 for(const name of Object.keys(activities)){
   const c=evaClips[name];assert(c,name);
   assert(c.count>=45);assert.equal(c.frames.length,c.count*c.stride);
   assert(c.frames.every(Number.isFinite));
   let travel=0,biggest=0;const poses=new Set();
   for(let i=0;i<c.count;i++){
     const a=evaClipFrame(name,(i+.025)/EVA_FPS),b=evaClipFrame(name,(i+1.025)/EVA_FPS);
     const change=distance(a.right,b.right)+distance(a.left,b.left);
     biggest=Math.max(biggest,change);travel+=change;
     poses.add([a.right,a.left,a.lean].flat().map(v=>v.toFixed(5)).join(','));
   }
   assert(poses.size>=30,name+' is missing in-betweens');
   assert(travel>.05,name+' should not be static');assert(biggest<.17,name+' has a wrist jump at a key or seam');
   const a=evaClipFrame(name,0),loop=evaClipFrame(name,(c.count+.04)/EVA_FPS);
   assert.deepEqual(loop,a);
   signatures.add([...c.frames].slice(0,30).join(','));
   assert.deepEqual(evaClipFrame(name,0,true),evaClipFrame(name,125600,true));
 }
 assert.equal(signatures.size,Object.keys(activities).length);
});

test('articulated limbs and head retain their size in every baked pose',()=>{
 for(const name of Object.keys(evaClips)){
   const c=evaClips[name],isSeat=activities[name]?.rest==='seat'||name==='computer'||name==='sit';
   const isBed=activities[name]?.rest==='bed';
   for(let i=0;i<c.count;i+=4){
     const time=(i+.01)*1000/EVA_FPS;
     const extra=isBed||isSeat?{seat:{sleep:isBed,height:isBed?.67:.51,edge:{height:.57}},
       seatSample:{amount:1,...(isBed?{pose:'sleep',recline:1}:{})},support:{kind:isBed?'bed':'chair'}}:{};
     const p=evaRig({...neutral,...extra,clip:name,time});
     for(const side of ['left','right']){
       const {hip,knee,ankle,shoulder,elbow,hand}=p.joints[side];
       near(distance(hip,knee),proportions.thigh);near(distance(knee,ankle),proportions.shin);
       near(distance(shoulder,elbow),proportions.arm);near(distance(elbow,hand),proportions.forearm);
     }
     for(const name of bones){
       const frame=p.frames[name];
       for(const a of [frame.right,frame.front,frame.up])near(Math.hypot(...a),1);
       near(distance(place(frame,0,0,0),place(frame,.107,.093,.174)),Math.hypot(.107,.093,.174));
     }
     assert(p.matrices.every(Number.isFinite));
   }
 }
});

test('during stance the loaded sole stays stationary as the pelvis travels through the step',()=>{
 for(const facing of ['down-right','up-left','down-left','up-right']){
   const forward={'down-right':[1,0],'up-left':[-1,0],'down-left':[0,1],'up-right':[0,-1]}[facing];
   let first;
   for(let i=0;i<=40;i++){
     const d=i/40*.52*1.14;
     const p=evaRig({...neutral,at:{u:d*forward[0],v:d*forward[1],z:0},time:1000+d*1000,
       clip:'walk',walkDistance:d,walkWeight:1,facing});
     const ankle=p.joints.left.ankle;
     near(ankle[2],proportions.ankle);
     if(first)near(distance(ankle,first),0);
     first=ankle;
   }
 }
});

test('bed entry and exit clear the side rail and place the occiput on the pillow for each orientation',()=>{
 const models=worldObjects({}),defaults=roomFurniture(models);
 const base=defaults.get(3),pillow=defaults.get(10);
 let bed=base;
 for(let turn=0;turn<4;turn++,bed=nextTurn(bed)){
   const moved={...pillow,...attachedPosition(pillow,base,bed)};
   const seat=roomSeat(bed,roomWalk([bed]),moved,true);
   assert(seat);
   for(const exit of [false,true]){
     const m=seatMotion(seat,exit?seat.at:seat.stand,exit?seat.stand:seat.at,seat.facing,0,exit?1:0,exit?0:1);
     for(let i=0;i<=60;i++){
       const time=i/60*m.duration,s=seatSample(m,time);
       const p=evaRig({at:{u:s.u,v:s.v,z:0},clip:'sleep',time,seat,seatSample:s,support:bed,facing:m.facing});
       for(const side of ['left','right']){
         const [u,v,z]=p.joints[side].ankle;
         const onMattress=u>bed.u+.015&&u<bed.u+bed.w-.015&&v>bed.v+.015&&v<bed.v+bed.d-.015;
         if(onMattress)assert(z>=seat.edge.height+.035,`turn ${turn}, frame ${i}, ${side}, ankle ${z}`);
       }
       if(s.recline===1){
         const headBase=place(p.frames.head,0,-.118,.162);
         assert(Math.hypot(headBase[0]-seat.at.u,headBase[1]-seat.at.v)<.14);
         assert(headBase[2]>=seat.edge.height+.078&&headBase[2]<=seat.edge.height+.145,`pillow at ${headBase[2]}`);
       }
     }
   }
 }
});

test('streaming palms follow the real keys and mouse after each desk rotation',()=>{
 const defs=roomFurniture(worldObjects({})),baseDesk=roomDesk(defs.get(1)),chair0=defs.get(307),pc0=defs.get(27);
 let desk=baseDesk;
 for(let turn=0;turn<4;turn++,desk=nextTurn(desk)){
   const chair=attachedPosition(chair0,baseDesk,desk),pc={...attachedPosition(pc0,baseDesk,desk),z:.80};
   const seat=roomSeat(chair,roomWalk([desk,chair]));assert(seat);
   for(const index of [1,2])for(const phase of [0,.12,.31,.5,.79,1]){
     const gesture=computerGesture(pc,{index,phase});
     const rig=evaRig({...neutral,facing:seat.facing,at:{u:seat.at.u,v:seat.at.v,z:0},time:1500+phase*3000,
       clip:'computer',seat,seatSample:{amount:1},support:chair,desk:gesture});
     const hands=[rig.joints.left.hand,rig.joints.right.hand];
     const goals=[gesture.left,gesture.right].map(g=>q(g.point));
     for(const goal of goals)assert(Math.min(...hands.map(h=>distance(h,goal)))<.018,
       `desk turn ${turn}, motion ${index}, phase ${phase}`);
     assert(distance(...hands)>.121);
   }
 }
});

test('an interrupted activity starts its transition on the visible wrist pose',()=>{
 const run=createEvaAnimator();
 const prior=run({...neutral,clip:'stretch',time:2200});
 const start=run({...neutral,clip:'chop',time:2200});
 near(distance(prior.joints.right.hand,start.joints.right.hand),0,.001);
 near(distance(prior.joints.left.hand,start.joints.left.hand),0,.001);
 const end=run({...neutral,clip:'chop',time:2600});
 assert(distance(end.joints.right.hand,start.joints.right.hand)>.30);
 const instant=run({...neutral,clip:'tea',time:2650,reduced:true});
 near(distance(instant.joints.right.hand,evaRig({...neutral,clip:'tea',time:2650,reduced:true}).joints.right.hand),0);
});

test('the moving window lever is reachable from the normal room path',()=>{
 const defaults=roomFurniture(worldObjects({})),window=roomWindowFixture(defaults.get(7));
 defaults.set(7,window);
 const fixtures=[...defaults.values()],walk=roomWalk(fixtures);
 const [u,v]=roomApproach(window,fixtures,room,(u,v)=>walk.blocked({u,v}));
 assert(walk.path({u:room.u+.83,v:room.v+1.60},{u,v},true).length>0);
 for(let n=0;n<=24;n++){
   const seconds=.65+n/30,contact=activityContacts('air',window,{seconds},{u,v,z:0},false,walk.clear);
   const pose=evaRig({...contact,clip:'air',facing:'up-right',time:seconds*1000});
   near(distance(pose.joints.right.hand,q(windowLatch(contact.windowOpen))),0,.003);
 }
});

test('Eva steps clear of the swinging fridge door and keeps her grip in all four orientations',()=>{
 const defaults=roomFurniture(worldObjects({}));
 let fridge=defaults.get(302);
 for(let turn=0;turn<4;turn++,fridge=nextTurn(fridge)){
   const f=fixtureFrame(fridge),[u,v]=f.point(f.width/2,f.depth+.28,0);
   const origin={u,v,z:0},side=fridge.turned?'left':'right';
   const facing=fridge.turned?(fridge.back?'down-right':'up-left'):(fridge.back?'down-left':'up-right');
   const clear=turn===0?roomWalk([...defaults.values()]).clear:()=>true;
   for(let n=0;n<=60;n++){
     const progress=n/60,seconds=progress*3.64;
     const c=activityContacts('fridge',fridge,{progress,seconds},origin,false,clear);assert(c.stepAside);
     const pose=evaRig({...c,clip:'fridge',clipSeconds:seconds,time:seconds*1000,facing});
     if(c.grip.weight>.999)near(distance(pose.joints[side].hand,c.grip.point),0,.018);
     const [x,y]=f.local(q(c.at)),angle=useProgress('fridge',0,progress)*Math.PI*.43;
     const clearance=(y-f.depth+.008)*Math.cos(angle)-(x-.014)*Math.sin(angle);
     assert(clearance>.24,'body intersects the opening door');
     for(const joints of Object.values(pose.joints)){
       const distanceToDoor=p=>p.reduce((sum,value,i)=>sum+(value-c.barrier.origin[i])*c.barrier.normal[i],0);
       assert(distanceToDoor(joints.elbow)>.109,'the sleeve must stay in front of the door');
       assert(distanceToDoor(joints.hand)>.072,'the palm must stay above the panel');
     }
     assert(Math.min(pose.joints.left.ankle[2],pose.joints.right.ankle[2])<proportions.ankle+.003);
   }
 }
 const stove=defaults.get(300);
 near(kitchenWorkPoint(stove)[2],.848);
 assert(kitchenWorkPoint(stove)[0]<stove.u+stove.w/2,'use the empty hob');
});

test('the shipped indexed mesh, materials and portable props fit the mobile renderer',()=>{
 const mesh=evaModel();assert.equal(evaModel(),mesh);
 const size=mesh.vertices.length/mesh.stride;
 assert(size<65536&&mesh.indices.length/3<15000);
 for(const id of mesh.indices)assert(id<size);
 for(let i=0;i<mesh.vertices.length;i+=mesh.stride){
   const v=mesh.vertices.subarray(i,i+mesh.stride);assert(v.every(Number.isFinite));
   for(const ix of [8,9])assert(Number.isInteger(v[ix])&&v[ix]>=0&&v[ix]<bones.length);
   assert(v[16]>=0&&v[16]<=1);assert(v[6]>=0&&v[6]<=1&&v[7]>=0&&v[7]<=1);
 }
 const atlas=readFileSync(new URL(home+'art/eva-rig-skin.png',import.meta.url));
 assert.equal(atlas.readUInt32BE(16),1024);assert.equal(atlas.readUInt32BE(20),512);
 for(const name of Object.keys(activities)){
   const p=evaRig({...neutral,clip:name,time:2700});let count=0;
   const drawn=drawEvaProps({triangle(points,color,id){
     assert(points.flat().every(Number.isFinite));assert(color.every(Number.isFinite));
     assert.equal(id,15);count++;
   }},15,p,name,2.70);
   assert.equal(drawn,count>0);assert(count<750);
 }
});
