// An isolated view of each activity, using the normal room fixtures, routing
// approach, seating path, contact targets, props and GPU-ready actor pose.
import {evaClips,EVA_FPS} from '../app/src/main/assets/home/eva-clips.mjs';
import {evaRig} from '../app/src/main/assets/home/eva-rig.mjs';
import {drawEvaProps} from '../app/src/main/assets/home/eva-props.mjs';
import {worldObjects,worldPoint} from '../app/src/main/assets/home/district.mjs';
import {heading} from '../app/src/main/assets/home/orientation.mjs';
import {activitySample,activityContacts} from '../app/src/main/assets/home/room-activities.mjs';
import {roomFurniture,roomWindowFixture,windowLatch,drawWindowSash,quiltApproach,attachedPosition,
  roomApproach,room,furnitureOwners,drawBedding} from '../app/src/main/assets/home/room.mjs';
import {roomWalk} from '../app/src/main/assets/home/room-walk.mjs';
import {roomSeat,seatMotion,seatSample} from '../app/src/main/assets/home/seat-motion.mjs';
import {useProgress} from '../app/src/main/assets/home/household.mjs';
import {nextTurn} from '../app/src/main/assets/home/prop-finish.mjs';
import {drawRoomModel,roomSurface} from '../app/src/main/assets/home/room-models.mjs';
import {computerGesture,drawComputer,roomDesk} from '../app/src/main/assets/home/room-furnishings.mjs';

const compass=['down-right','down','down-left','left','up-left','up','up-right','right'];
const facingAngle=facing=>compass.indexOf(facing)*45;
const center=o=>({u:o.u+o.w/2,v:o.v+o.d/2,z:0});
const rotated=(o,turns)=>{
 let next=o;
 for(let i=0;i<turns;i++)next=nextTurn(next);
 return next;
};

export function createMotionStage(activities){
 const defaults=roomFurniture(worldObjects({}));
 defaults.set(1,roomDesk(defaults.get(1)));
 defaults.set(7,roomWindowFixture(defaults.get(7)));
 for(const [id,parent] of furnitureOwners){
   if(id===307)continue;
   const item=defaults.get(id),z=roomSurface(defaults.get(parent));
   if(item&&z!=null)defaults.set(id,{...item,z});
 }
 const fixtures=[...defaults.values()],walk=roomWalk(fixtures);
 const blocked=(u,v)=>walk.blocked({u,v});
 const initial=worldPoint('home',.85,1.65);
 const templates=new Map();
 function setup(key,turns){
   const ref=key+'/'+turns;
   if(templates.has(ref))return templates.get(ref);
   const meta=activities[key],object=defaults.get(meta?.fixture??(key==='sit'?81:0));
   const own=defaults.get(furnitureOwners.get(object?.id))??object;
   const bed=rotated(defaults.get(3),turns);
   const sheet=id=>{const ref=defaults.get(id);return turns?attachedPosition(ref,defaults.get(3),bed):ref;};
   const pillow=sheet(10),quilt=sheet(11);
   const asleep=meta?.rest==='bed',seated=asleep||meta?.rest==='seat'||key==='sit'||key==='computer';
   const desk=rotated(defaults.get(1),turns);
   const peripheral=id=>turns?attachedPosition(defaults.get(id),defaults.get(1),desk):defaults.get(id);
   const pc={...peripheral(27),z:roomSurface(desk)},chair=peripheral(307);
   const sofa=rotated(defaults.get(81),turns);
   const support=asleep?bed:key==='computer'?chair:sofa;
   const nav=turns&&seated?roomWalk([support,...(key==='computer'?[desk]:[])]):walk;
   const seat=seated?roomSeat(support,nav,asleep?pillow:null,asleep):null;
   if(seated&&!seat)throw Error('Нет подхода к мебели для '+key);
   let stance=meta?.spot?worldPoint('home',...meta.spot):initial;
   if(seat)stance=seat.at;
   else if(object){
     const route=(key==='makeBed'?quiltApproach(bed,initial,walk):null)??roomApproach(object,fixtures,initial,blocked);
     stance={u:route[0],v:route[1]};
   }
   const target=key==='air'?windowLatch(0):object?center(object):null;
   const facing=seat?.facing??(target?heading(target.u-stance.u,target.v-stance.v):'down');
   const workTop=own?{...center(own),z:roomSurface(own)??own.visualHeight??.8}:null;
   const result={meta,object,own,asleep,seated,seat,stance,facing,workTop,support,pc,desk,chair,sofa,bed,pillow,quilt,nav};
   templates.set(ref,result);
   return result;
 }
 return function frame(key,seconds,{enter=1,turns=0,mood=null,facing:direct}={}){
   const setup0=setup(key,turns),{meta,object,own,seat,support,pc,desk,chair,sofa,bed,pillow,quilt,nav}=setup0;
   const sample=meta?activitySample(meta,seconds*1000,false):null;
   const motion=seat&&seatMotion(seat,seat.stand,seat.at,seat.facing,0);
   const settling=motion&&seatSample(motion,enter*motion.duration);
   const origin={u:settling?.u??setup0.stance.u,v:settling?.v??setup0.stance.v,z:0};
   const contacts=activityContacts(key,object,sample,origin,false,nav.clear);
   const stream=key==='computer'&&settling.complete?computerGesture(pc,sample):null;
   const facing=direct??setup0.facing;
   const rig=evaRig({...contacts,clip:key,clipSeconds:seconds,time:seconds*1000,facing,mood,
     seat,seatSample:settling,support,desk:stream,workTop:setup0.workTop,workArea:own,
     ...(key==='walk'?{walkDistance:seconds*1.14*EVA_FPS/evaClips.walk.count,walkWeight:1}:{})});
   const area=setup0.asleep?center(bed):key==='computer'?
     {u:chair.u+chair.w/2,v:chair.v+chair.d/2-.18}:contacts.at;
   const yaw=setup0.asleep?45+90*turns:key==='computer'?55+90*turns:key==='air'?28:key==='fridge'?52:
     own&&own.kind!=='window'?facingAngle(facing)+(key==='vinyl'||key==='dust'?55:65):facingAngle(facing)+20;
   function furniture(r){
     const model=(o,state)=>drawRoomModel(r,o,state);
     if(key==='air'){
       const o=object,h=1.46,frame=[.70,.49,.31];
       r.box(7,{u:o.u,v:o.v,z:1.178},o.w,.13,.043,frame,'oak');
       for(let i=0;i<=3;i++){
         r.box(7,{u:o.u+o.w*i/3-.021,v:o.v,z:1.22},.042,.10,h,frame,'oak');
       }
       drawWindowSash(r,contacts.windowOpen);
     }else if(setup0.asleep||own?.kind==='bed'){
       model(bed);
       if(key!=='fluff')drawBedding(r,bed,pillow,false,rig.recline,false,rig);
       if(key!=='fold')drawBedding(r,bed,quilt,false,rig.recline,false,rig);
     }else if(key==='computer'){
       model(desk);model(chair);drawComputer(r,pc,true,true,seconds,stream);
     }else if(setup0.seated)model(sofa);
     else if(own){
       model(own,{stage:useProgress(own.kind,1,sample.progress),kettleInHand:key==='kettle'});
       if(object!==own&&key!=='tea')model(object,{spin:seconds});
     }
   }
   return {rig,at:contacts.at,area,yaw,asleep:setup0.asleep,seated:setup0.seated,furniture,
     props:r=>drawEvaProps(r,15,rig,key,seconds)};
 };
}
