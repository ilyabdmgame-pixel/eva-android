import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activityDuration,activityEffects,activityLine,activitySample,drawRoomActivity,nextActivity,scheduledPeriod}
  from '../../../app/src/main/assets/home/room-activities.mjs';
import {roomFurniture,inRoom,roomApproach,roomWindowFixture} from '../../../app/src/main/assets/home/room.mjs';
import {worldObjects,worldPoint,district,route,localPath} from '../../../app/src/main/assets/home/district.mjs';
import {blocksActor} from '../../../app/src/main/assets/home/contact.mjs';

const assets=new URL('../../../app/src/main/assets/home/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,assets),'utf8'));
const activities=read('room-activities.json'),entries=read('routines.json').eva.entries;

test('every room activity has a distinct animated track and effect, plus rotating reactions',()=>{
 const keys=Object.keys(activities);
 assert(keys.length>=20);
 assert.deepEqual(Object.keys(activityEffects).sort(),keys.sort());
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
     const renderer=Object.fromEntries(['box','triangle','sprite'].map(type=>[type,(...args)=>frame.push([type,args])]));
     drawRoomActivity(renderer,key,sample,{u:-13,v:0,z:0},{u:-13.07,v:.42,z:.9},'down-right');
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
 const blocked=(u,v)=>!inRoom(u,v,.17)||blocksActor(u,v,fixtures,[]);
 assert.deepEqual([...new Set(entries.flatMap(row=>row[6]))].sort(),Object.keys(activities).sort());
 for(const [key,activity] of Object.entries(activities)){
   const o=fixtures.find(item=>item.id===activity.fixture);
   assert(o||activity.spot,key);
   const p=o?roomApproach(o,fixtures,start,blocked):Object.values(worldPoint('home',...activity.spot));
   assert(!blocked(...p),key);
   const destination={u:p[0],v:p[1]};
   const path=localPath(start,destination,blocked)||route(start,destination,blocked);
   const end=path.at(-1)||start;
   assert(Math.hypot(end.u-p[0],end.v-p[1])<.28,key);
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
