import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activityDuration,activityEffects,activityLine,activityPlan,activitySample,drawRoomActivity,nextActivity,scheduledPeriod}
  from '../../../app/src/main/assets/home/room-activities.mjs';
import {roomFurniture,roomApproach,roomWindowFixture} from '../../../app/src/main/assets/home/room.mjs';
import {worldObjects,worldPoint,district} from '../../../app/src/main/assets/home/district.mjs';
import {roomSeat} from '../../../app/src/main/assets/home/seat-motion.mjs';
import {roomWalk} from '../../../app/src/main/assets/home/room-walk.mjs';
import {computerGesture,drawComputer,streamChair} from '../../../app/src/main/assets/home/room-furnishings.mjs';

import {roomDialogue} from '../../../app/src/main/assets/home/room-dialogue.mjs';
import {drawStreamFrame} from '../../../app/src/main/assets/home/stream-game.mjs';

const assets=new URL('../../../app/src/main/assets/home/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,assets),'utf8'));
const activities=read('room-activities.json'),entries=read('routines.json').eva.entries;

test('every room activity has a distinct animated track and effect, plus rotating reactions',()=>{
 const keys=Object.keys(activities);
 assert(keys.length>=20);
 assert.deepEqual(Object.keys(activityEffects).sort(),keys.filter(key=>key!=='computer').sort());
 const tracks=new Set(),treatments=new Set(),titles=new Set();
 for(const [key,activity] of Object.entries(activities)){
   const duration=activityDuration(activity,false), reduced=activityDuration(activity,true);
   assert(duration>2200&&reduced<duration,key);
   assert(activity.beats.length>=2,key);
   assert(activity.event&&!titles.has(activity.title),key);
   titles.add(activity.title);
   assert.equal(new Set(activity.lines).size,3,key);
   assert.equal(activityLine(activity,0),activityLine(activity,3),key);
   assert.notEqual(activityLine(activity,0),activityLine(activity,1),key);
   const track=JSON.stringify(activity.beats);
   assert(!tracks.has(track),key);tracks.add(track);
   const effects=[];
   for(let n=0;n<=30;n++){
     const sample=activitySample(activity,duration*n/30,false),frame=[];
     assert(sample.amount>=0&&sample.amount<=1,key);
     assert(Number.isFinite(sample.swing)&&sample.progress>=0&&sample.progress<=1,key);
     const renderer=Object.fromEntries(['box','triangle','sprite','panel','streamPanel'].map(type=>[type,(...args)=>frame.push([type,args.filter(arg=>arg!==undefined)])]));
     if(key==='computer'){
       const pc={id:27,u:-13.07,v:.42,z:.9};
       drawComputer(renderer,pc,true,true,sample.seconds,computerGesture(pc,sample));
     }else drawRoomActivity(renderer,key,sample,{u:-13,v:0,z:0},{u:-13.07,v:.42,z:.9},'down-right');
     effects.push(JSON.stringify(frame));
     assert(!effects.at(-1).includes('null'),key);
   }
   assert(new Set(effects).size>1,key+' has to change on screen');
   const treatment=JSON.stringify(effects);
   assert(!treatments.has(treatment),key);treatments.add(treatment);
   assert.deepEqual(activitySample(activity,0,true),activitySample(activity,reduced,true),key);
 }
});

test('every activity is on the daily programme and can be reached in the default room',()=>{
 const fixtures=[...roomFurniture(worldObjects({})).values()].map(o=>o.kind==='window'?roomWindowFixture(o):o);
 const start=worldPoint('home',...district('home').start);
 const walk=roomWalk(fixtures);
 assert.deepEqual([...new Set(entries.flatMap(row=>row[6]))].sort(),Object.keys(activities).sort());
 for(const [key,activity] of Object.entries(activities)){
   const o=fixtures.find(item=>item.id===activity.fixture);
   assert(o||activity.spot,key);
   const chair=key==='computer'&&fixtures.find(item=>item.id===streamChair.id);
   const seat=activity.rest||chair?roomSeat(chair||o,walk,fixtures.find(item=>item.id===10),activity.rest==='bed'):null;
   if(activity.rest||chair)assert(seat,key);
   const p=o&&roomApproach(o,fixtures,start,(u,v)=>walk.blocked({u,v}));
   const goal=seat?.stand??(p?{u:p[0],v:p[1]}:worldPoint('home',...activity.spot));
   assert(!walk.blocked(goal),key);
   const path=walk.path(start,goal,true);
   const end=path.at(-1)||start;
   assert(Math.hypot(end.u-goal.u,end.v-goal.v)<.025,key);
   assert(path.every((point,i)=>walk.clear(path[i-1]??start,point)),key);
 }
});

test('the daily programme uses local time and skips unavailable activities without stalling',()=>{
 const hour=n=>new Date(2026,10,25,n,0).getTime();
 assert.deepEqual(scheduledPeriod(entries,hour(3))[6],['sleep']);
 assert.equal(scheduledPeriod(entries,hour(7))[6][0],'stretch');
 assert.equal(scheduledPeriod(entries,hour(9))[6][0],'sweep');
 assert.equal(scheduledPeriod(entries,hour(18))[6][0],'rest');
 const programme=['tea','read','wash'];
 assert.deepEqual(nextActivity(programme,1,key=>key==='tea'),{key:'tea',next:1});
 assert.deepEqual(nextActivity(programme,2,()=>true),{key:'wash',next:0});
 assert.equal(nextActivity(programme,0,()=>false),null);
});

test('every session lasts three to five minutes and only sustains its specified beats',()=>{
 for(const [key,activity] of Object.entries(activities)){
   for(const sample of [0,.5,1]){
     const plan=activityPlan(activity,sample);
     assert(plan.duration>=180000&&plan.duration<=300000,key);
     const [first,last]=activity.loop;
     assert(first>=0&&last>=first&&last<activity.beats.length,key);
     const sustained=activitySample(activity,plan.start+plan.cycle*2+1,false,plan);
     assert.equal(sustained.index,first,key);
     assert.equal(activitySample(activity,plan.duration,false,plan).index,activity.beats.length-1,key);
     assert.deepEqual(activitySample(activity,60000,true,plan),
       activitySample(activity,150000,true,plan),key);
   }
 }
});

test('stream repeats typing and mouse phases, then releases the hands exactly once',()=>{
 const activity=activities.computer,plan=activityPlan(activity,.5);
 const phase=ms=>activitySample(activity,ms,false,plan).index;
 assert.equal(phase(20),0);
 assert.equal(phase(plan.start+plan.cycle*4+10),1);
 assert.equal(phase(plan.start+plan.cycle*4+activity.beats[1][1]+10),2);
 assert.equal(phase(plan.end+20),3);
 assert.equal(phase(plan.duration),3);
});

test('simulated stream chat asks a question and Eva replies without needing a model response',()=>{
 assert.equal(roomDialogue('computer','Творчество',13000,0),null);
 const chat=roomDialogue('computer','Творчество',14500,0);
 const reply=roomDialogue('computer','Творчество',21000,0);
 assert(chat.chat&&chat.text.includes('?'));
 assert(!reply.chat&&reply.text.length>12);
 assert.equal(reply.id,chat.id+1);
 assert.equal(roomDialogue('computer','Творчество',19300,0),null);
 assert.notEqual(roomDialogue('computer','Творчество',37500,0).text,chat.text);
 assert(roomDialogue('read','Отдых',14500,0).text.length>10);
});

test('the stream monitor paints a colored scrolling game with a visible jump',()=>{
 const records=frame=>{
   const calls=[];
   drawStreamFrame({fillRect(...args){calls.push([this.fillStyle,...args]);}},frame);
   return calls;
 };
 const running=records(6),jump=records(17);
 assert(running.length>100);
 assert(new Set(running.map(([color])=>color)).size>16);
 const player=calls=>calls.filter(([color])=>color==='#a885e1').map(([,x,y])=>y);
 assert(Math.min(...player(jump))<Math.min(...player(running))-12);
 assert.notDeepEqual(records(1300),running);
});
