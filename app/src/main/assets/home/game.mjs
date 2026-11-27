import {roomSeat,seatMotion,seatSample} from './seat-motion.mjs';
import {reverseCells} from './reverse-cells.mjs';
import {actionAnchors} from './action-anchors.mjs';
import {registeredPose} from './eva-motion.mjs';
import {restoreTurn,nextTurn,turnFixture} from './prop-finish.mjs';
import {objectLine} from './local-lines.mjs';
import {propArt} from './prop-art.mjs';
import {furnitureSurface} from './occlusion.mjs';
import {domestic,actionTime,useFrame} from './household.mjs';
import {editableFixture,placementIssue} from './layout.mjs';
import {drawNotice,castFurniture} from './street-furniture.mjs';
import {migrateTown} from './town-plan.mjs';
import {fixtureTop,canPlace,hitsFixture} from './contact.mjs';
import {activityPlan,activityLine,activitySample,drawRoomActivity,nextActivity,scheduledPeriod} from './room-activities.mjs';
import {project,worldAtHeight,inView} from './camera.mjs';
import {createScene} from './render.mjs';
import {room,roomOffset,roomEdge,roomView,expandedRoom,inRoom,fitsRoom,roomWindowFixture,drawRoom,drawRoomWindow,
  attachedPosition,attachedFurniture,furnitureOwners as parents,roomFurniture,roomApproach,drawBedding} from './room.mjs';
import {computerGesture,computerLayout,drawComputer,drawComputerArms,drawFloorDecor,furnishingThumbnail,roomDesk,roomFurnishings,streamChair} from './room-furnishings.mjs';
import {windowWeather,windowWeatherMoves} from './window-weather.mjs';
import {places} from './places.mjs';
import {startFlight,flightPoint,advanceFlight,drawToy} from './toys.mjs';
import {gait,heading,walkHeading,orientation,standingPose,evaPose,actionPose} from './orientation.mjs';
import {createSpeech} from './speech.mjs';
import {createStreamChat} from './stream-chat.mjs';
import {district,districts,regionAt,worldPoint,worldObjects,paceRoute} from './district.mjs';
import {initialEconomy,items,fixtureItems,fullness,apply as applyEconomy} from './economy.mjs';
import {remark} from './remarks.mjs';
import {seasons,weathers,widgetWeather,cityReading,climateAt,paletteFor} from './weather.mjs';
import {settings as soundSettings,audioVisible,ambience,footstep,audioState} from './audio.mjs';
import {names as activityNames,lines as activityLines,prepareSound,sound} from './activities.mjs';

import {townChat} from './town-chat.mjs';
import {roomWalk} from './room-walk.mjs';
import {roomDialogue} from './room-dialogue.mjs';
import {createStreamDialogue,streamExpression} from './stream-dialogue.mjs';
const town=townChat({world:worldSnapshot,apply:useNearby,note:statusNote,quip:()=>say(remark('touch'),'wry'),
 usage:publishWeeklyQuota,stream:applyStreamDialogue});
const canvas=$('scene');
const EVA_ID=15;
const paintWindow=windowWeather(()=>{dirty=true;wake();});
const roomControls=()=>document.querySelectorAll('.now,.top-status,#folders button,#actions button,#dock,#town-mark:not([hidden]),#town-answer:not([hidden])');
const speechLayer=$('speech');
const speech=createSpeech(speechLayer,$('world-status'),roomControls);
const streamChat=createStreamChat($('stream-chat'),canvas,roomControls);
const renderer=createScene(canvas);
const time=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const date=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'});
const sectionNames=Object.fromEntries(districts.map(x=>[x.key,x.title]));
let saved;
try{saved=JSON.parse(localStorage.getItem('room'))}catch{}
saved=saved||{lamps:{},chairs:{},window:false,dialog:0};
if(migrateTown(saved))localStorage.setItem('room',JSON.stringify(saved));
saved.economy=initialEconomy(saved.economy,saved);
const start=worldPoint('home',...places.home.start);
const remembered=saved.lastLocation;
let roomExtra=saved.roomExpanded?expandedRoom:0;
const surfaceAt=()=>0;
let eva=remembered&&inRoom(remembered.u,remembered.v,.15,roomExtra)?{...remembered}:start;
const section=room.key;
let center=roomView(roomExtra).centre;
const routines=JSON.parse(Desk.routines()).eva;
const roomActivities=JSON.parse(Desk.roomActivities());
const currentEntry=at=>scheduledPeriod(routines.entries,at);
let nextAmbientFrame=0,paintCount=0;
let nextPastime=0,automaticWalk=false;
saved.roomRoutineCursor??={};
saved.roomActivityCounts??={};
let roomActivity=null;
let autoFollow=localStorage.getItem('followSchedule')!=='no';
let view,speechAnchors=new Map(),motionFrames={},night=0,lighting=[1,1,1],dirty=true,nextFrame=0,last=0;
const lamps=new Float32Array(16);
const weatherOptions=saved.weatherOptions&&typeof saved.weatherOptions==='object'?saved.weatherOptions:{};
let climate=climateAt(new Date(),weatherOptions),lastStepIndex=0;

let nativeActive=true,active=!document.hidden,move=[],onArrival=null,direction='down-right',seated=null,carrying=null,selectTarget=null,dropAim=null;
let timeline={},previousSlot=-1,latestClock=0;
let weeklyQuota=null;
let toyAim=null,flight=null,gesture=null,walkFacing=direction,walkPhase=0,walkSpeed=0,lastFloorQuip=0,floorQuip=0;
let restMotion=null,releaseMotion=null,walkHold=null,walkStarted=-Infinity;
const footSettleTime=170;
function gestureAmount(g,t){
 const x=Math.min(1,Math.max(0,(t-g.start)/(g.until-g.start)));
 return ease(Math.min(1,x/.32,(1-x)/.32));
}
let mood=null,moodUntil=0,roomPulse=null,nextPresence=0,graphicsLost=false,graphicsRestored=false;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const presenceProfile=JSON.parse(Desk.presenceProfile?.()||'{}');
function reactInRoom(kind){
 if(reduceMotion||!presenceProfile[kind])return;
 roomPulse={start:now(),curve:presenceProfile[kind]};
 dirty=true;wake();
}
const lampIsOn=o=>o.kind==='placedLamp'?o.on:saved.lamps[o.id]??(o.id===5||night>.44);
const drawerOpen=id=>saved.drawers?.[id]??(id===1&&Boolean(saved.desk));
const now=()=>performance.now();
let fixtures=[],navigation;
const fixtureIds=Object.fromEntries(Object.entries(fixtureItems).map(([id,item])=>[item,Number(id)]));
const models=[...worldObjects({}),...roomFurnishings];
const modelsById=new Map(models.map(o=>[o.id,o]));
const catalogIds=[2,12,21,24,34,61,65,74,79,81,82,87,91,115,300,301,302,303,304,305];
const catalog=new Map(models.filter(o=>catalogIds.includes(o.id)||o.category).map(o=>[o.id,o]));
const roomDefaults=roomFurniture(models);
function attachedTo(child,parent){
 const original=modelsById.get(parent.id);
 const base=child.id===streamChair.id?roomDefaults.get(child.id):modelsById.get(child.id);
 const attachment=attachedPosition(base,original,parent);
 const key=parent.back?'back-'+parent.art:parent.art;
 const top=parent.id===1&&parent.art==null?{height:fixtureTop(parent),shift:0}:furnitureSurface(key,[parent.w,parent.d],parent.artFlip);
 if(child.id===streamChair.id){
   const shift=top?.shift??0;
   if(parent.turned)attachment.v-=shift;
   else attachment.u+=shift;
   return {...attachment,parts:(parent.turned?turnFixture(base):base).parts};
 }
 if(top){
   attachment.u+=top.shift;attachment.v-=top.shift;
   attachment.z=parent.kind==='bed'
     ?top.height+(child.kind==='pillow'?.018:.006)
     :attachment.z+top.height-fixtureTop(original);
 }
 return attachment;
}
saved.decor=Array.isArray(saved.decor)?saved.decor:[];
function decorFixture(entry){
 const model=modelsById.get(entry.model);
 if(!model||!Number.isInteger(entry.id)||entry.id<1024||entry.id>65534)return null;
 const object=restoreTurn(model,entry);
 if(!fitsRoom(entry.u,entry.v,object.w,object.d,roomExtra))return null;
 return {...object,...entry,sector:section,approach:null,decor:true};
}
function refreshObjects(){
 const objects=new Map(worldObjects(saved).map(o=>[o.id,o]));
 fixtures=[];
 for(const [id,base] of roomDefaults){
   if(saved.packed?.[id]||parents.has(id))continue;
   if(id===7){fixtures.push(roomWindowFixture(base));continue;}
   const candidate=objects.get(id);
   const changed=saved.chairs?.[id];
   const object=candidate&&changed&&fitsRoom(candidate.u,candidate.v,candidate.w,candidate.d,roomExtra)
     ?candidate:base;
   const parent={...(id===1?roomDesk(object):object),roomMovable:attachedFurniture.has(id)||id===81};
   fixtures.push(parent);
   for(const child of attachedFurniture.get(id)||[]){
     if(!saved.packed?.[child])fixtures.push(attachedTo(roomDefaults.get(child),parent));
   }
 }
 for(const object of objects.values()){
   if(!roomDefaults.has(object.id)&&fitsRoom(object.u,object.v,object.w,object.d,roomExtra)){
     fixtures.push({...object,roomMovable:true});
   }
 }
 for(const entry of saved.decor){const o=decorFixture(entry);if(o)fixtures.push(o)}
 for(const [i,entry] of saved.economy.placements.entries()){
   const item=items[entry.item],where=regionAt(entry.u,entry.v);
   if(!item||!where||!fitsRoom(entry.u,entry.v,.25,.25,roomExtra))continue;
   const lamp=entry.item==='lamp';
   fixtures.push({...entry,id:160+i,placementId:entry.id,sector:where.key,kind:lamp?'placedLamp':'pickup',name:item.name,
     w:.25,d:.25,solid:lamp,parts:lamp?[
       {u:0,v:0,z:0,a:.25,b:.25,h:.056,tint:[.71,.57,.39],mat:'wood'},
       {u:.105,v:.105,z:.055,a:.045,b:.045,h:.30,tint:[.49,.45,.40]},
       {u:.025,v:.028,z:.34,a:.20,b:.20,h:.14,tint:entry.on?[1,.83,.39]:[.59,.51,.42]}
     ]:[],art:item.art,visualHeight:item.height||.18,tint:item.tint});
 }
 navigation=roomWalk(fixtures,roomExtra);
 if(move.some((point,i)=>!navigation.clear(move[i-1]??eva,point,carrying))){
   move=[];onArrival=null;walkSpeed=0;walkHold=null;automaticWalk=false;
   if(!roomActivity?.started)roomActivity=null;
 }
 if(!seated&&!restMotion)eva=navigation.recover(eva,start);
}
function storage(){
 saved.lastLocation=seated?{...seated.stand}:{u:eva.u,v:eva.v};localStorage.setItem('room',JSON.stringify(saved));
}
function position3D(o){return {...o,z:(o.z||0)+surfaceAt(o.u,o.v)}}
function publishWeeklyQuota(week){
 const valid=Number.isInteger(week?.remaining)&&week.remaining>=0&&week.remaining<=100&&
   Number.isInteger(week.resetsAt)&&week.resetsAt*1000>Date.now();
 weeklyQuota=valid?week:null;
 const value=valid?week.remaining+'%':'—';
 $('balance').textContent=value;
 $('wallet').setAttribute('aria-label','Недельный лимит Codex · '+(valid?value+' осталось':'нет данных'));
 if(sheet==='weekly-limit')renderWeeklyQuota();
}
function trade(type,item,extra={}){
 const result=applyEconomy(saved.economy,{type,item,...extra});
 if(!result.ok){say(result.reason,'wry');return false}
 if(type==='pickup'&&extra.fixture){
   saved.packed??={};saved.packed[extra.fixture]=true;
 }
 if(type==='drop'&&fixtureIds[item]){
   const id=fixtureIds[item];
   delete saved.packed[id];
   saved.chairs[id]={u:extra.u,v:extra.v,world:true,sector:regionAt(extra.u,extra.v).key};
   result.state.placements.pop();
 }
 saved.economy=result.state;
 if(['pickup','drop','toggle'].includes(type))refreshObjects();
 storage();dirty=true;wake();return true;
}
function say(text,face){
 if(town.playing)return;
 speech.say(EVA_ID,text,now());
 if(saved.sound&&!sheet)town.speakPhrase(text,saved.volume??.42);
 if(face){mood=face;moodUntil=now()+1750;reactInRoom(face==='curious'?'consider':'acknowledge');}
 dirty=true;wake();
}
function statusNote(text){speech.report(text,now());wake()}
function pullClock(){
 const instant=new Date(),label=time.format(instant);
 if(weeklyQuota&&weeklyQuota.resetsAt*1000<=instant.getTime())publishWeeklyQuota(null);
 $('clock').textContent=label;$('calendar').textContent=date.format(instant);
 const connected=Desk.weatherState()==='connected';
 const widget=connected?widgetWeather(JSON.parse(Desk.weatherLabels())):{};
 const city=cityReading(JSON.parse(Desk.cityWeather()),instant.getTime());
 const sceneWeather=weatherOptions.weather||widget.weather||(weatherOptions.cityFallback!==false&&city?.weather);
 const updated=climateAt(instant,{...weatherOptions,weather:sceneWeather||'clear'});
 if(updated.weather!==climate.weather||updated.season!==climate.season||
    Math.round(updated.daylight*20)!==Math.round(climate.daylight*20))dirty=true;
 climate=updated;night=1-climate.daylight;
 const current=city&&!weatherOptions.weather
   ?[city.temperature,city.description,city.stale?time.format(city.at):null].filter(Boolean).join(' · ')
   :[widget.temperature,weathers[climate.weather].name+' за окном'].filter(Boolean).join(' · ');
 $('weather').textContent=current;
 $('weather').setAttribute('aria-label','Погода · '+current);
 try{timeline=JSON.parse(Desk.timeline())}catch{}
 const entry=currentEntry(instant);
 if(autoFollow&&previousSlot!==entry){
   nextPastime=now()+2400;
   if(seated?.sleep&&!entry[5])leaveSeat();
 }
 previousSlot=entry;
}
function appEvent(action){Desk.note(action,section);pullClock()}
function objectList(){return fixtures.filter(o=>o.kind!=='shell'||!saved.pickedShell);}
const localUses={shelter:'shelter',chair:'sit',plant:'plant',books:'books',lamp:'lamp',window:'window',bed:'sleep',computer:'useComputer',clock:'clock',lookout:'lookout',fountain:'fountain',flowers:'flowers',stove:'stove',basin:'basin',fridge:'fridge',shower:'shower',screen:'screen',toilet:'toilet',notice:'notice',wallArt:'wallArt'};
function worldSnapshot(){
 const nearby=objectList().map(o=>({id:o.id,name:o.name,use:localUses[o.kind]||'',distance:Math.round(Math.hypot(o.u+o.w/2-eva.u,o.v+o.d/2-eva.v)*10)/10}))
   .filter(o=>o.distance<=6).sort((a,b)=>a.distance-b.distance).slice(0,18);
 return {location:sectionNames[section],time:time.format(new Date()),weather:climate.weather,indoors:true,
   activity:roomActivity?.started?roomActivity.definition.title:
     seated?.sleep?'спит':seated?'сидит':move.length?'идёт':'стоит',coins:saved.economy.coins,nearby};
}
function useNearby(id,action){
 if(layout||sheet||selectTarget||dropAim||toyAim||carrying)return 'Сейчас открыто другое действие';
 const o=objectList().find(f=>f.id===id&&localUses[f.kind]===action);
 if(!o||!worldSnapshot().nearby.some(f=>f.id===id&&f.use===action))return 'Предмет больше не рядом';
 perform(o,action,false,null,true);return 'Выбрано действие «'+action+'», предмет «'+o.name+'»';
}
let nextWorldSync=0,lastSnapshot='';
function syncWorld(){
 const snapshot=JSON.stringify(worldSnapshot());
 if(snapshot!==lastSnapshot){Desk.worldSnapshot?.(snapshot);lastSnapshot=snapshot}
 const raw=Desk.worldTake?.();
 if(raw){try{const cmd=JSON.parse(raw);Desk.worldResult?.('Выбрано: '+cmd.use);const result=useNearby(cmd.id,cmd.use);if(!result.startsWith('Выбрано действие'))Desk.worldResult?.(result)}catch{Desk.worldResult?.('Команда недействительна')}}
}
function movedBucket(){
 if(saved.packed?.[72])return true;
 const moved=saved.chairs[72];
 if(!moved)return false;
 const where=moved.world?district(moved.sector):district('shop');
 const at=worldPoint('shop',-.28,-.40);
 const u=moved.world?moved.u:where.u+moved.u,v=moved.world?moved.v:where.v+moved.v;
 return Math.hypot(u-at.u,v-at.v)>.65;
}
function blocks(u,v){return navigation.blocked({u,v},carrying);}

function toyBlocked(point,radius){
 const z=point.z;
 return z+.006<surfaceAt(point.u,point.v)||!inRoom(point.u,point.v,radius,roomExtra)||
   fixtures.some(o=>o.id!==carrying&&o.kind!=='floorDecor'&&hitsFixture(point,radius,o));
}

const ease=x=>x*x*(3-2*x);
function takeSeat(seat){
 direction=seat.facing;
 restMotion=seatMotion(seat,eva,seat.at,direction,now());
 seated=seat;eva={u:seat.at.u,v:seat.at.v};
}
function leaveSeat(){
 if(!seated)return true;
 const exit=seated.stand;
 const edge=seated.edge??seated.at;
 if(!navigation.clear(seated.at,edge,seated.id)||!navigation.clear(edge,exit,seated.id)){
   say('Перед сиденьем занято. Встану, когда проход освободится.','wry');
   return false;
 }
 if(restMotion){
   const time=now(),sample=seatSample(restMotion,time,reduceMotion);
   restMotion=seatMotion(seated,sample,exit,restMotion.facing,time,sample.amount,0);
 }
 eva={u:exit.u,v:exit.v};seated=null;
 return true;
}
function walkTo(u,v,done,automatic=false,exact=false){
 automaticWalk=automatic;
 if(!automatic)nextPastime=now()+30000;
 if(!leaveSeat()){
   automaticWalk=false;
   if(!roomActivity?.started)roomActivity=null;
   return;
 }
 if(gesture&&!reduceMotion)releaseMotion={motion:gesture.motion,facing:direction,from:gestureAmount(gesture,now()),start:now()};
 gesture=null;
 const starting=!move.length;
 walkHold=null;
 move=(carrying?roomWalk(fixtures,roomExtra,carrying):navigation).path(eva,{u,v},exact);
 if(starting){
   walkSpeed=0;walkPhase=gait.stride*.25;lastStepIndex=0;
   walkStarted=last=now();
 }
 onArrival=done||null;
 if(!move.length&&!restMotion)finishWalk();
 dirty=true;wake();
}

function finishWalk(){
 walkHold=null;
 if(!automaticWalk)nextPastime=now()+30000;
 automaticWalk=false;
 const callback=onArrival;
 onArrival=null;callback?.();
 storage();
}
function around(o,actor=eva){
 return roomApproach(o,fixtures,actor,blocks);
}
function face(target){
 direction=heading(target.u+target.w*.5-eva.u,target.v+target.d*.5-eva.v,direction);
 dirty=true;
}
function animateAction(action,id){
 releaseMotion=null;
 const motion={
   eatSnack:'reach',books:'reach',sellDrawing:'reach',lamp:'reach',window:'reach',draw:'reach',coffee:'reach',radio:'reach',sell:'reach',
   desk:'reach',tableWipe:'reach',cup:'reach',bouquet:'reach',wash:'reach',flowers:'reach',
   record:'reach',television:'reach',vending:'reach',bin:'stoop',pickup:'stoop',pocketFixture:'stoop',togglePlaced:'stoop',carry:'stoop',shell:'stoop',fill:'stoop',plant:'stoop',pillow:'stoop',blanket:'stoop',kit:'stoop'
 }[action];
 if((motion||actionTime[action])&&!reduceMotion)gesture={motion:motion||'reach',id,start:now(),until:now()+(actionTime[action]||620)};
}
function activityFixture(definition){
 return fixtures.find(item=>item.id===definition.fixture);
}
function activityAvailable(key){
 const definition=roomActivities[key];
 return Boolean(definition&&(definition.spot||activityFixture(definition)));
}
function stopRoomActivity(){
 if(!roomActivity)return;
 if(roomActivity.key==='computer')streamChat.clear();
 if(!roomActivity.started){move=[];onArrival=null;automaticWalk=false;walkSpeed=0;walkHold=null;}
 const pose=roomActivity.sample;
 if(!reduceMotion&&!seated&&pose&&(pose.motion==='reach'||pose.motion==='stoop')&&pose.amount){
   releaseMotion={motion:pose.motion,facing:direction,from:pose.amount,start:now()};
 }
 roomActivity=null;dirty=true;
}
function startRoomActivity(key,automatic=false,fromChat=false){
 const definition=roomActivities[key],fixture=activityFixture(definition);
 if(!fixture&&!definition.spot)return;
 const chair=key==='computer'&&fixtures.find(item=>item.id===streamChair.id);
 if(key==='computer'&&!chair)return;
 closeSheet();
 stopRoomActivity();
 if(saved.sound)prepareSound();
 const spot=definition.spot&&worldPoint(section,...definition.spot);
 const sleeper=definition.rest==='bed';
 const seat=chair||definition.rest?roomSeat(chair||fixture,navigation,
   sleeper&&fixtures.find(item=>item.id===10),sleeper):null;
 if((chair||definition.rest)&&!seat){
   if(!automatic)say('К сиденью не подойти. Оставь перед ним свободный пол.','wry');
   return;
 }
 const target=seat?[seat.stand.u,seat.stand.v]:fixture?around(fixture):[spot.u,spot.v];
 const state={key,definition,fixture,started:false,startedAt:null,plan:activityPlan(definition),fromChat,automatic};
 roomActivity=state;
 walkTo(...target,()=>{
   if(roomActivity!==state)return;
   if(Math.hypot(eva.u-target[0],eva.v-target[1])>.025){
     roomActivity=null;nextPastime=now()+12000;
     if(fromChat)Desk.worldResult?.('Не удалось подойти к компьютеру');
     if(!automatic)statusNote('До места не подойти. Освободи проход.');
     return;
   }
   if(fixture)face(fixture);
   if(seat)takeSeat(seat);
   if(chair)saved.computerOn=true;
   else if(sleeper)speech.clear();
   state.started=true;state.sample=activitySample(definition,0,reduceMotion,state.plan);
   statusNote(definition.title);
   if(definition.sound&&key!=='computer')sound(definition.sound);
   dirty=true;
 },automatic,true);
}
function finishRoomActivity(state){
 const {key,definition,fixture}=state;
 roomActivity=null;
 nextPastime=now()+(key==='rest'?72000:42000);
 switch(key){
   case 'makeBed':saved.blanket=false;break;
   case 'fold':saved.blanket=true;break;
   case 'fluff':saved.pillow=false;break;
   case 'air':saved.window=true;break;
   case 'read':saved.page=(saved.page||0)+1;break;
   case 'water':saved.plant=true;break;
   case 'vinyl':saved.record=true;break;
   case 'computer':streamChat.clear();leaveSeat();break;
   case 'tv':saved.channel=(saved.channel||0)%2+1;break;
   case 'nap':leaveSeat();break;
   case 'wash': {
     saved.houseUses??={};
     saved.houseUses[fixture.id]=(saved.houseUses[fixture.id]||0)+1;
     break;
   }
   case 'cook': {
     const meal=applyEconomy(saved.economy,{type:'homeMeal'});
     if(meal.ok)saved.economy=meal.state;
     break;
   }
 }
 const count=saved.roomActivityCounts[key]||0;
 saved.roomActivityCounts[key]=count+1;
 say(activityLine(definition,count),key==='sleep'?'curious':'pleased');
 Desk.finishedActivity(key);
 if(state.fromChat)Desk.worldResult?.('Выполнено: '+definition.title);
 storage();dirty=true;
}
function applyStreamDialogue(data){
 const state=roomActivity;
 if(state?.streamRequest===data.id&&data.id)state.dialogue?.addGenerated(data.pairs);
}
function advanceStream(state,elapsed,t,canReact){
 const cue=state.dialogue.next(elapsed,canReact);
 if(cue){
   if(cue.emotion)state.streamReaction={emotion:cue.emotion,start:t};
   if(cue.chat){streamChat.add(cue);dirty=true;}
   else say(cue.text);
 }
 const generation=state.streamModel&&state.dialogue.takeGeneration(elapsed,state.plan.duration-elapsed);
 if(generation){
   state.streamRequest=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   Desk.town?.(JSON.stringify({op:'stream',id:state.streamRequest,...generation}));
 }
}
function advanceRoomActivity(t,settling){
 const state=roomActivity;
 if(!state?.started||seated&&settling)return;
 if(state.startedAt===null){
   state.startedAt=t;
   if(state.key==='computer'){
     const visit=saved.streamStarts??saved.roomActivityCounts.computer??0;
     state.dialogue=createStreamDialogue(visit);
     saved.streamStarts=visit+1;
     storage();
     state.streamModel=!state.automatic&&localStorage.getItem('lunaStream')==='yes';
     say(state.dialogue.greeting,'pleased');
     sound(state.definition.sound);
   }
 }
 const elapsed=Math.max(0,t-state.startedAt);
 if(elapsed>=state.plan.duration){finishRoomActivity(state);return;}
 const canReact=!town.composing&&!town.playing;
 if(state.dialogue)advanceStream(state,elapsed,t,canReact);
 else if(state.plan.duration-elapsed>10000&&canReact){
   const cue=roomDialogue(state.key,state.definition.category,elapsed,saved.roomActivityCounts[state.key]||0);
   if(cue&&state.lastCue!==cue.id){
     state.lastCue=cue.id;
     say(cue.text);
   }
 }
 if(!reduceMotion)state.sample=activitySample(state.definition,elapsed,false,state.plan);
 if(state.key==='air'&&state.sample.progress>.32&&!saved.window){saved.window=true;storage();}
 if(!reduceMotion)dirty=true;
}
function perform(o,action,automatic=false,snack=null,fromChat=false){
 stopRoomActivity();
 if(action==='useComputer'){startRoomActivity('computer',automatic,fromChat);return;}
 if(action==='cancel'){carrying=null;selectTarget=null;dropAim=null;toyAim=null;dirty=true;wake();return}
 closeSheet();
 if(saved.sound)prepareSound();
 if(action==='sit'&&seated?.id===o.id){
   if(leaveSeat()){dirty=true;wake();say('Встала. Стул может выдохнуть.');}
   return;
 }
 const needsSeat=action==='sit'||action==='sleep';
 const seat=needsSeat?roomSeat(o,navigation,action==='sleep'&&o.id===3&&fixtures.find(item=>item.id===10),action==='sleep'):null;
 if(needsSeat&&!seat){say('С этой стороны к сиденью не подойти. Освободи проход.','wry');return;}
 const target=seat?[seat.stand.u,seat.stand.v]:around(o);
 walkTo(...target,()=>{
   if(automatic)nextPastime=now()+15000+Math.random()*12000;
   if(Math.hypot(eva.u-target[0],eva.v-target[1])>.025){
     if(fromChat)Desk.worldResult?.('Не удалось подойти к предмету «'+o.name+'»');
     say('До '+o.name.toLowerCase()+' отсюда не дотянуться. Обойду, когда проход освободится.');return;
   }
   face(o);
   animateAction(action,o.id);
   sound(action==='fountain'?'water':action==='clock'?'chime':action);
   switch(action){
     case 'blanket':
       if(o.id===11)saved.blanket=!saved.blanket;
       else {saved.linens??={};saved.linens[o.id]=!saved.linens[o.id];}
       say('Поправила плед. До первого кота.');break;
     case 'notice':say(objectLine(saved,o,action,o.remark),'curious');break;
     case 'wallArt':say(o.art==='town-menu'?'На стене кофе и круассан. Дальновидно повесили как раз на голодном уровне глаз.':o.art==='town-flowers'?'Подсолнухи. Вот у кого поворот к свету работает из коробки.':'Гора, крыши, тихий двор. Интересно, сколько там стоит коммуналка?');break;
     case 'lamp':
       saved.lamps[o.id]=!lampIsOn(o);appEvent('lamp');
       say(saved.lamps[o.id]?'Да будет свет. Хоть где-то.':'Энергосбережение, мать его.');break;
     case 'eatSnack':
       if(trade('eat',snack)){appEvent('snack');say(snack==='tea'?'Чай. Вот теперь я человек. Почти.':'Перекусила. Жизнь снова вывозим.','pleased');}break;
     case 'shelter':say('Вот тут сухо. Дождь, можешь писать жалобу.','pleased');break;
     case 'sleep':
       takeSeat(seat);speech.clear();
       statusNote('Ева спит. Тап по полу её разбудит.');
       break;
     case 'sit':
       takeSeat(seat);
       appEvent('sit');say(remark('seat'),'pleased');break;
     case 'desk':
       saved.drawers??={};saved.drawers[o.id]=!drawerOpen(o.id);
       say(saved.drawers[o.id]?'Бумаги в ящике. Я их рассредоточила.':'Закрыла. Бумаги могут выдохнуть.');break;
     case 'tableWipe':
       say(objectLine(saved,o,action,'Столик протёрла. Если что, круг от кружки уже был.'));break;
     case 'carry':
       carrying=o.id;selectTarget=o;
       say('Покажи, куда поставить. Ткни в свободный пол.');break;

     case 'window':
       saved.window=!saved.window;say(saved.window?'Проветрила. Теперь бардак на свежем воздухе.':'Закрыла. Плед и я снова в тепле.');break;
     case 'computerPower':
       saved.computerOn=!saved.computerOn;say(saved.computerOn?'ПК включён. Рабочий стол внутри рабочего стола.':'Монитор погас. Перерыв.');
       break;
     case 'lookDecor':say('Осмотрела. Хорошо тут смотрится.');break;
     case 'togglePlaced':
       if(trade('toggle','lamp',{id:o.placementId}))say('Щёлк. Своя лампа. И никто не требует поставить обратно.','pleased');
       break;
     case 'pocketFixture':
       if(trade('pickup',fixtureItems[o.id],{fixture:o.id})){
         if(o.id===72)appEvent('bucket-moved');
         say(remark('leaf'),'pleased');
       }break;
     case 'pickup':
       if(trade('pickup',o.item,{id:o.placementId}))say(remark('leaf'),'pleased');
       break;
     case 'bouquet':
       if(trade('make','bouquet')){appEvent('bouquet');say('Готово. Букет в кармане. Закинь его на кассу — там монеты.','pleased');}
       break;
     case 'sell':
       if(trade('sell','bouquet')){appEvent('sell');say('Плюс шесть монет. Даже касса сегодня в меня верит.','pleased');}
       break;
     case 'draw':
       if(trade('make','drawing')){saved.draw=true;appEvent('draw');say(objectLine(saved,o,action,activityLines.draw),'pleased');}
       break;
     case 'sellDrawing':
       if(trade('sell','drawing')){appEvent('sell-drawing');say('Пять монет за этюд. Бумажка пошла по карьерной лестнице.','pleased');}
       break;
     case 'shift':
     case 'dockShift': {
       const dock=action==='dockShift';
       if(trade('shift',null,{site:dock?'pier':'street'})){
         appEvent(dock?'cargo':'clean');
         say(dock?'Четыре монеты за груз. Руки пока при мне.':'Плюс три. Мусор ушёл на пенсию.','pleased');
       }
       break;
     }
     case 'forage': {
       const item=seasons[climate.season].resource;
       if(trade('forage',item)){appEvent('forage');say(remark('leaf')+' '+items[item].name+' в кармане.','curious');}
       break;
     }
     case 'clock':
       say('По местному времени '+time.format(new Date())+'. Часы успевают, а я творчески запаздываю.','wry');break;
     case 'homeMeal':
       if(trade('homeMeal')){appEvent('snack');say('Разогрела обед. И тарелку даже помыла.','pleased');}break;
     case 'staffSnack':
       if(trade('break'))say('Подкрепилась на кухне. Теперь можно снова работать.','pleased');
       break;
     case 'shell':
       if(!saved.pickedShell&&trade('pickup','shell')){saved.pickedShell=true;appEvent('shell');say(remark('leaf'),'curious');}
       break;
     case 'vending':
     case 'soda':
       if(trade('buy','soda')){appEvent('vending');say(objectLine(saved,o,action,activityLines.vending),'pleased');}
       break;
     case 'coffee':
       if(trade('buy','tea')){appEvent('coffee');say('Взяла горячий чай. Пить из кармана, как всё серьёзное.','pleased');}
       break;
     case 'buyBun':
     case 'buyTea':
     case 'buyPaper':
     case 'buyRibbon':
     case 'buyLamp':
     case 'buyPot': {
       const key=action.slice(3).toLowerCase();
       if(trade('buy',key))say('В кармане: '+items[key].name.toLowerCase()+'.','pleased');
       break;
     }
     case 'books': {
       saved.page=(saved.page||0)+1;
       say('Страница '+saved.page+'. '+remark('book'),'curious');break;
     }
     case 'television': {
       saved.channel=((saved.channel||0)+1)%3;
       say(['Выключила телик. Снег сохранён.','Канал один. Снег. Короче, погоду посмотрели.','Канал два. Тот же снег, но уверенный.'][saved.channel]);
       break;
     }
     case 'bin': {
       if(trade('discard','can'))say('Банку выбросила. Я теперь городской эколог на полставки.','pleased');break;
     }
     default:
       if(domestic[action]){
         const lines=domestic[action][1];saved.houseUses??={};const n=saved.houseUses[o.id]||0;
         say(lines[n%lines.length],'pleased');saved.houseUses[o.id]=n+1;break;
       }
       if(activityLines[action]){
         saved[action]=!saved[action];
         appEvent(action);
         say(objectLine(saved,o,action,activityLines[action]));break;
       }
       saved[action]=!saved[action];
       say(objectLine(saved,o,action,({cup:'Чай закончился. Эта кружка — улика.',desk:'Бумаги в ящике. Я не потеряла, я рассредоточила.',blanket:'Поправила плед. Через минуту снова будет гармошка.',pillow:'Взбила подушку. У неё был тяжёлый день.',bed:'Ещё пять минут, передай это работе.',plant:'Полила. Работаю в техподдержке листьев.'})[action]||'Готово.'));
   }
   if(fromChat)Desk.worldResult?.('Выполнено: '+o.name+' / '+action);
   storage();dirty=true;wake();
 },automatic,true);
}
const descriptions={
 notice:[['Рассмотреть','notice']],
 wallArt:[['Рассмотреть','wallArt']],lamp:[['Переключить свет','lamp']],chair:[['Сесть','sit'],['Перенести','carry']],
 table:[['Открыть или закрыть ящик','desk']],cup:[['Взять кружку','cup']],
 window:[['Открыть или закрыть окно','window']],exit:[['Пройти','exit']],
 bed:[['Лечь спать','sleep'],['Присесть на край','sit']],pillow:[['Взбить','pillow']],blanket:[['Поправить','blanket']],
 streamChair:[['Сесть','sit']],
 computer:[['Начать стрим','useComputer'],['Включить или выключить ПК','computerPower']],
 plant:[['Полить','plant']]
};
function actionsFor(o){
 if(o.kind==='shelter')return [['Переждать дождь','shelter']];
 if(domestic[o.kind])return o.kind==='stove'?[[domestic.stove[0],'stove'],['Разогреть обед','homeMeal']]:[[domestic[o.kind][0],o.kind]];
 if(o.id===225)return [['Посмотреть журнал','mail']];
 if(o.id===82)return [['Протереть столик','tableWipe']];
 const base={
   pickup:[['Подобрать','pickup']],placedLamp:[['Переключить лампу','togglePlaced'],['Подобрать','pickup']],
   bouquet:[['Собрать букет · 1 лента','bouquet']],
   register:[['Сдать букет · +6','sell']],
   coffee:[['Купить чай · 2','coffee'],['Купить булочку · 3','buyBun'],['Взять запасной перекус','staffSnack']],
   vending:[['Купить газировку · 2','vending']],
   soda:[['Купить газировку · 2','soda']],
   bin:[['Подработка · +3','shift'],['Выбросить пустую банку','bin']],
   market:[['Купить булочку · 3','buyBun'],['Купить бумагу · 2','buyPaper'],['Купить ленту · 2','buyRibbon']],
   easel:[['Сделать набросок · 1 бумага','draw']]
 }[o.kind];
 if(o.kind==='shelf'&&o.sector==='shop')return [['Купить ленту · 2','buyRibbon'],['Купить бумагу · 2','buyPaper'],
   ['Купить лампу · 9','buyLamp'],['Купить растение · 7','buyPot']];
 if(o.kind==='shelf'&&o.sector==='school')return [['Сдать этюд · +5','sellDrawing']];
 return base||descriptions[o.kind]||activityNames[o.kind]||[['Осмотреть','lookDecor']];
}
function select(o){
 const out=showSheet('item',o.name);
 const furniture=fixtures.find(item=>item.id===parents.get(o.id))||o;
 if(editableFixture(furniture))out.append(label('Переставить','','✥',()=>beginLayout(furniture)));
 const choices=[...actionsFor(o)].filter(([,action])=>action!=='carry');
 if(o.id===2||o.portable)choices.push(['Перенести','carry']);
 if(fixtureItems[o.id])choices.push(['Убрать в карман','pocketFixture']);
 for(const [name,action] of choices)out.append(label(name,'','◇',()=>perform(o,action)));
}
function floorAt(event){
 const rect=canvas.getBoundingClientRect();
 const x=(event.clientX-rect.left)*view.width/rect.width,y=(event.clientY-rect.top)*view.height/rect.height;
 return {x,y,p:worldAtHeight(view,x,y)};
}
function pauseInitiative(){
 nextPastime=now()+30000;
 stopRoomActivity();
 if(automaticWalk){move=[];onArrival=null;walkHold=null;automaticWalk=false;walkSpeed=0;dirty=true;}
}
function tapAt(hit,longPress=false){
 if(!view||sheet)return;
 const {id,p}=hit;
 if(id===EVA_ID&&!longPress&&!selectTarget&&!toyAim&&!dropAim){
   if(!roomActivity?.started)pauseInitiative();
   town.tap();wake();return;
 }
 pauseInitiative();
 if(id!==EVA_ID)town.close();
 if(longPress&&(selectTarget||toyAim||dropAim))return;
 if(dropAim){
   const item=dropAim;
   const model=fixtureIds[item]&&districts.flatMap(place=>place.objects).find(o=>o.id===fixtureIds[item]);
   if(!canPlace(p.u,p.v,model?.w??.25,model?.d??.25,blocks,true)){
     say('Тут тесно. Выбери свободное место на полу.','wry');return;
   }
   walkTo(p.u-.22,p.v+.16,()=>{
     if(Math.hypot(eva.u-p.u,eva.v-p.v)>.62){say('Издалека не положу. Выбери место поближе.');return;}
     if(trade('drop',item,{u:p.u,v:p.v})){
       if(item==='bucket')appEvent(movedBucket()?'bucket-moved':'bucket-back');
       animateAction('carry');dropAim=null;say('Выложила. Можно потом подобрать.','pleased');
     }
   });return;
 }
 if(toyAim){
   if(blocks(p.u,p.v)){say('Туда улетит прямо в мебель. Целься в пол.');return;}
   flight=startFlight(toyAim,eva,p,now(),surfaceAt);toyAim=null;dirty=true;wake();return;
 }
 if(selectTarget){
   const o=selectTarget;
   if(!canPlace(p.u,p.v,o.w,o.d,blocks,true)){
     say('Тут не влезет. Выбери свободное место.');return;
   }
   walkTo(p.u-.16,p.v+.32,()=>{
     if(Math.hypot(eva.u-p.u,eva.v-p.v)>.65){say('Далеко, не дотащу отсюда. Выбери пол поближе.','wry');return;}
     saved.chairs[o.id]={u:p.u,v:p.v,world:true,sector:regionAt(p.u,p.v).key};carrying=null;selectTarget=null;
     refreshObjects();storage();
     appEvent(o.kind==='bucket'?(movedBucket()?'bucket-moved':'bucket-back'):'move');
     say(o.kind==='bucket'?'Ведро переехало. Мио пока не в курсе.':'Утащила. Новый адрес запомнила.');
   });return;
 }
 const picked=objectList().find(o=>o.id===id);
 if(picked){
   if(longPress){select(picked);return}
   const action=actionsFor(picked)[0][1];
   perform(picked,action);return;
 }
 if(longPress)return;
 if(id===15){town.tap();wake();return}
 if(id===251){say('Стена. Прошивка призрака пока не завезли.');return}
 const invalid=blocks(p.u,p.v);
 const distance=Math.hypot(eva.u-p.u,eva.v-p.v);
 if(distance<.12&&!seated){sayAboutFloor(invalid);return}
 walkTo(p.u,p.v,()=>{if(invalid||distance>.65&&now()-lastFloorQuip>6500)sayAboutFloor(invalid)});
}
function sayAboutFloor(invalid){
 const lines=invalid?['Дальше пол занят. Подвинулась куда смогла.','Туда впишусь только в виде плоской текстуры.']:
 ['Дошла. Ноги официально в рабочем состоянии.','Скажи, что мы искали короткий путь к пельменям.','Хорошее место. Пол даже не скрипнул.'];
 lastFloorQuip=now();say(lines[floorQuip++%lines.length]);
}
let layout=null;
function repaintLayout(){dirty=true;wake()}
function layoutHUD(message){
 const o=layout.object;
 $('layout-palette').hidden=!!o;$('layout-delete').hidden=!o?.decor||layout.newItem;
 $('layout-name').textContent=o?o.name:'Расстановка';
 $('layout-hint').textContent=message||(o&&layout.pan?'Потяни комнату для обзора. Нажми «Обзор» ещё раз, чтобы поставить предмет.':o?'Коснись места или перетащи предмет':'Выбери предмет. Потяни пустое место, чтобы осмотреть комнату.');
 $('layout-pan').hidden=!o;$('layout-pan').setAttribute('aria-pressed',String(Boolean(layout.pan&&o)));
 $('layout-rotate').hidden=!o||o.placementId!=null;
 $('layout-undo').hidden=!!o||!layout.undo.length;
 $('layout-rotate').textContent=o?'Поворот · '+((o.back?180:0)+(o.turned?90:0))+'°':'Повернуть';
 $('layout-apply').hidden=!o;
 $('layout-apply').disabled=!layout.point||Boolean(layout.issue);
 $('layout-cancel').textContent=o?'Отмена':'Готово';
 repaintLayout();
}
function chooseFixture(o){
 if((!o?.decor&&!editableFixture(o))||o.id===seated?.id){layoutHUD(o?.id===seated?.id?'Это место занято':'Выбери свободно стоящий предмет');return}
 layout.newItem=false;layout.pan=false;layout.object=o;layout.point=null;layout.issue='';layoutHUD();
}
function beginLayout(o){
 closeSheet();town.close();pauseInitiative();leaveSeat();
 move=[];onArrival=null;walkHold=null;carrying=null;selectTarget=null;dropAim=null;toyAim=null;
 layout={undo:[],object:null,point:null,issue:'',gesture:null};
 $('screen').classList.add('arranging');$('layout-tools').hidden=false;
 if(o)chooseFixture(o);else layoutHUD();
}
function backLayout(){
 if(!layout)return false;
 if(sheet==='palette'){closeSheet();return true}
 if(layout.object){layout.object=null;layout.point=null;layout.issue='';layoutHUD();return true}
 layout=null;$('screen').classList.remove('arranging');$('layout-tools').hidden=true;
 center=roomView(roomExtra).centre;last=now();repaintLayout();return true;
}
window.backLayout=backLayout;
$('layout-cancel').onclick=backLayout;
$('layout-pan').onclick=()=>{layout.pan=!layout.pan;layoutHUD(layout.pan?'Потяни комнату для обзора':layout.issue)};
$('layout-rotate').onclick=()=>{
 const o=layout.object;if(!o)return;
 const p=layout.point||o;layout.object=nextTurn(o);
 if(layout.point||!layout.newItem)setDestination({u:p.u+o.w/2,v:p.v+o.d/2});
 else layoutHUD('Выбери место для предмета');
};
function rememberPlacement(o){
 const id=o.id,stack=layout.undo;
 if(o.decor){
   const entry=saved.decor.find(e=>e.id===id),lamp=saved.lamps[id],uses=saved.houseUses?.[id];
   stack.push(()=>{
     saved.decor=saved.decor.filter(e=>e.id!==id);if(entry)saved.decor.push(entry);
     if(lamp!==undefined)saved.lamps[id]=lamp;else delete saved.lamps[id];
     if(uses!==undefined)(saved.houseUses??={})[id]=uses;else if(saved.houseUses)delete saved.houseUses[id];
   });
 }else if(o.placementId!=null){
   const entry=saved.economy.placements.find(e=>e.id===o.placementId);
   const {u,v}=entry;stack.push(()=>Object.assign(entry,{u,v}));
 }else{
   const before=saved.chairs?.[id];
   stack.push(()=>{if(before)saved.chairs[id]=before;else delete saved.chairs[id]});
 }
 if(stack.length>32)stack.shift();
}
$('layout-undo').onclick=()=>{
 const undo=layout?.undo.pop();if(!undo)return;undo();refreshObjects();storage();
 layoutHUD('Последняя правка отменена');
};
function openPalette(){
 const out=showSheet('palette','Добавить предмет'),groups=new Map();
 const category=o=>o.category||(
   ['chair','table','shelf'].includes(o.kind)?'Мебель':o.kind==='lamp'?'Свет':
   domestic[o.kind]?'Быт':'Декор');
 for(const name of ['Мебель','Свет','Декор','Быт']){
   const section=menuSection(out,name),grid=node('div',null,'item-palette');
   section.append(grid);groups.set(name,grid);
 }
 for(const [model,o] of catalog){
   const b=btn('','',()=>{
     closeSheet();let id=1024;const used=new Set(saved.decor.map(e=>e.id));while(used.has(id))id++;
     if(id>65534){layoutHUD('Каталог заполнен');return}
     const fresh={...o,id,model,decor:true,approach:null};chooseFixture(fresh);layout.newItem=true;layoutHUD();
   });
   const thumb=node('span'),key=[41,42,50].includes(model)?'catalog-'+model:o.art||(o.kind==='seasonTree'?'town-birch':o.poster);
   if(key){const f=propArt[key];thumb.style.backgroundImage='url(/art/'+(f?.[0]||key)+'.png)';
     if(f){const w=f[3]-f[1],h=f[4]-f[2];thumb.style.aspectRatio=String(f[5]);thumb.style.backgroundSize=100/w+'% '+100/h+'%';thumb.style.backgroundPosition=100*f[1]/(1-w)+'% '+100*f[2]/(1-h)+'%'}}
   else if(o.category){
     const preview=node('canvas',null,'furnishing-thumb');
     preview.setAttribute('aria-hidden','true');furnishingThumbnail(preview,o);thumb.append(preview);
   }else thumb.textContent=o.streetMesh?'▥':'◇';
   b.append(thumb,node('span',o.name));groups.get(category(o)).append(b);
 }
}
$('layout-palette').onclick=openPalette;
$('layout-delete').onclick=()=>{
 const o=layout?.object;if(!o?.decor||layout.newItem)return;
 rememberPlacement(o);
 saved.decor=saved.decor.filter(e=>e.id!==o.id);delete saved.lamps[o.id];if(saved.houseUses)delete saved.houseUses[o.id];
 refreshObjects();storage();backLayout();
};
function roomPlacementIssue(o,p){
 if(!fitsRoom(p.u,p.v,o.w,o.d,roomExtra))return 'Оставь место у стены';
 const children=attachedFurniture.get(o.id)||[];
 const available=fixtures.filter(f=>!children.includes(f.id)&&f.kind!=='wallArt');
 const issue=placementIssue(o,p,available,[],[eva],true);
 if(issue)return issue;
 const others=available.filter(f=>f.id!==o.id),placed={...o,...p};
 if(o.kind==='chair'||o.kind==='bed'){
   if(!roomSeat(placed,roomWalk([...others,placed],roomExtra)))
     return 'Оставь проход перед сиденьем';
 }
 if(children.includes(streamChair.id)){
   const chair=attachedTo(streamChair,placed);
   if(!fitsRoom(chair.u,chair.v,chair.w,chair.d,roomExtra)||
     placementIssue(chair,chair,others,[],[eva],true)||
     !roomSeat(chair,roomWalk([...others,placed,chair],roomExtra)))
     return 'Оставь свободное место для кресла перед столом';
 }
 return '';
}
function setDestination(p){
 const o=layout.object;
 layout.point={u:Math.round((p.u-o.w/2)*20)/20,v:Math.round((p.v-o.d/2)*20)/20};
 layout.issue=roomPlacementIssue(o,layout.point);
 layoutHUD(layout.issue||'Место свободно');
}
$('layout-apply').onclick=()=>{
 const o=layout?.object,p=layout?.point;if(!o||!p)return;
 const issue=roomPlacementIssue(o,p);if(issue){layout.issue=issue;layoutHUD(issue);return}
 rememberPlacement(o);
 if(o.decor){const entry={model:o.model,id:o.id,turned:!!o.turned,back:!!o.back,...p};saved.decor=saved.decor.filter(e=>e.id!==o.id);saved.decor.push(entry);}
 else if(o.placementId!=null){
   const entry=saved.economy.placements.find(e=>e.id===o.placementId);if(!entry)return;
   Object.assign(entry,p);
 }else{saved.chairs??={};saved.chairs[o.id]={...p,turned:!!o.turned,back:!!o.back,world:true,sector:regionAt(p.u,p.v).key}}
 refreshObjects();storage();
 layout.newItem=false;layout.object=null;layout.point=null;layoutHUD('Сохранено. Можно выбрать следующий предмет.');
};
function layoutPointerDown(event){
 const hit=floorAt(event),id=renderer.pick(hit.x,hit.y,night,lamps,lighting);
 const picked=fixtures.find(f=>f.id===(parents.get(id)||id));
 const selected=Boolean(layout.object);
 if(!selected&&picked)chooseFixture(picked);
 layout.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,start:hit,center:{...center},pan:!layout.object||layout.pan,selected,dragged:false};
 canvas.setPointerCapture(event.pointerId);
}
function layoutPointerMove(event){
 const g=layout?.gesture;if(!g||g.id!==event.pointerId)return;
 if(!g.dragged&&Math.hypot(g.x-event.clientX,g.y-event.clientY)<7)return;
 g.dragged=true;
 if(!g.pan){setDestination(floorAt(event).p);return}
 const to=floorAt(event),a=worldAtHeight(view,g.start.x,g.start.y),b=worldAtHeight(view,to.x,to.y);
 const origin=roomView(roomExtra).centre;
 const pan=(value,axis)=>Math.max(origin[axis]-1.5,Math.min(origin[axis]+1.5,value));
 center={u:pan(g.center.u+a.u-b.u,'u'),v:pan(g.center.v+a.v-b.v,'v')};repaintLayout();
}
let hold=null;
function clearHold(){if(hold){clearTimeout(hold.timer);hold=null}}
function releaseHomePointer(){
 const pointer=hold?.id??layout?.gesture?.id;
 clearHold();
 if(layout)layout.gesture=null;
 if(pointer!=null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
}
canvas.addEventListener('pointerdown',event=>{
 if(!event.isPrimary||event.button!==0||!view||sheet)return;
 if(layout){layoutPointerDown(event);return}
 clearHold();if(saved.sound)prepareSound();
 const x=event.clientX,y=event.clientY,id=event.pointerId;
 const ray=floorAt(event);
 const hit={p:ray.p,id:selectTarget||toyAim||dropAim?0:renderer.pick(ray.x,ray.y,night,lamps,lighting)};
 const press={x,y,id,hit,long:false,cancelled:false};
 press.timer=setTimeout(()=>{
   if(hold!==press||press.cancelled)return;
   press.long=true;
 },400);
 hold=press;
 canvas.setPointerCapture(id);
});
canvas.addEventListener('pointermove',event=>{
 if(layout){layoutPointerMove(event);return}
 if(hold?.id===event.pointerId&&Math.hypot(hold.x-event.clientX,hold.y-event.clientY)>10){
   hold.cancelled=true;clearTimeout(hold.timer);
 }
});
canvas.addEventListener('pointerup',event=>{
 if(layout){const g=layout.gesture;if(g?.id===event.pointerId){if(!g.pan&&(g.dragged||g.selected))setDestination(floorAt(event).p);layout.gesture=null}return}
 if(hold?.id!==event.pointerId)return;
 const {hit,long,cancelled}=hold;
 clearHold();if(!cancelled){
   // Open a held action after the touch-generated click, so the scrim cannot consume that same tap.
   if(long)setTimeout(()=>tapAt(hit,true),85);else tapAt(hit);
 }
});
canvas.addEventListener('pointercancel',releaseHomePointer);
canvas.addEventListener('lostpointercapture',releaseHomePointer);
window.addEventListener('blur',releaseHomePointer);
canvas.addEventListener('pointerleave',clearHold);
canvas.addEventListener('contextmenu',event=>{
 event.preventDefault();
 if(!hold||hold.long||hold.cancelled)return;
 hold.long=true;clearTimeout(hold.timer);
});

function paint(t=now()){
 view=renderer.prepare(center,roomView(roomExtra).scale,roomOffset);
 paintCount++;
 const playing=roomActivity?.started?roomActivity:null;
 const routinePose=playing?.sample;
 const stream=playing?.key==='computer'&&restMotion&&seatSample(restMotion,t,reduceMotion).complete?
   computerGesture(playing.fixture,routinePose,reduceMotion):null;
 lighting=paletteFor(climate,false).map(x=>x*(.95+climate.daylight*.065));
 const sources=[[room.u+.32,room.v-.8,2.47,.58+night*.52]];
 const marginPx=view.scale*.4;
 motionFrames={};
 renderer.setLightingFocus({...eva,z:.81},climate.daylight);
 renderer.reset();
 renderer.scenery([{key:'room',cacheKey:'room-'+roomExtra+'-'+!!saved.window}],()=>drawRoom(renderer,saved.window,roomExtra));
 drawRoomWindow(renderer,paintWindow(t,climate,reduceMotion));
 renderer.sprite(251,'amber-sconce',{u:room.u-2.7,v:room.v-roomEdge+.16,z:1.72},.46,false,{bias:.03});
 const objects=objectList(),heads=new Map();
 const preview=layout?.point&&{...layout.object,...layout.point};
 if(layout?.newItem&&layout.object&&layout.point)objects.push(layout.object);
 for(const original of objects){
   const o=preview?.id===original.id?preview:preview&&parents.get(original.id)===preview.id
     ?attachedTo(original,preview):carrying===original.id?{...original,u:eva.u+.23,v:eva.v+.23}:original;
   if(layout?.object?.id===o.id){
     const z=surfaceAt(o.u,o.v)+.06,t=.055,c=layout.issue?[.93,.30,.24]:[.93,.78,.38];
     for(const [u,v,w,d] of [[o.u-t,o.v-t,o.w+t*2,t],[o.u-t,o.v+o.d,o.w+t*2,t],[o.u-t,o.v,t,o.d],[o.u+o.w,o.v,t,o.d]]){
       renderer.panel([[u,v,z],[u+w,v,z],[u+w,v+d,z],[u,v+d,z]],c,null,0);
     }
   }
   const radius=Math.max(o.w,o.d,o.artSpan||0,1.2);
   const height=Math.max(o.visualHeight||0,o.height||0,3.5)+(o.z||0);
   if(!inView(view,o,radius,height,marginPx))continue;
   if(o.art){renderer.artReady(o.art);if(o.back)renderer.artReady('back-'+o.art);}
   const treeArt=o.kind==='seasonTree'?(o.id%4===1?'town-spruce':climate.season==='autumn'?['town-birch','town-spruce','town-maple',seasons.autumn.trees][o.id%4]:seasons[climate.season].trees):null;
   if(treeArt)renderer.artReady(treeArt);
   if(!inView(view,o,radius,height,view.scale*.35))continue;
   if(o.kind==='wallArt'){
     const aspect=renderer.artAspect(o.art);if(!aspect)continue;
     const x=o.u,y=o.v,z=o.z,w=o.w,h=w/aspect;
     renderer.artPanel([[x,y,z+h],[x+w,y,z+h],[x+w,y,z],[x,y,z]],o.art,o.id);
     renderer.box(o.id,{u:x-.09,v:y+.03,z:z-.15},w+.18,.20,.042,[.83,.70,.53],'oak');
     for(const delta of [.06,w-.14])renderer.box(o.id,{u:x+delta,v:y+.06,z:z-.105},.09,.09,.13,[.61,.73,.66],'glaze');
     continue;
   }
   if(o.kind==='seasonTree'){
     const p=position3D(o),trunk={u:p.u+o.w*.5,v:p.v+o.d*.5,z:p.z};
     const frame=treeArt;
     renderer.shadow({...trunk,z:trunk.z+.02},.88,.62);
     if(renderer.artReady(frame))renderer.sprite(o.id,frame,trunk,o.visualHeight,o.id%2===0,{foliage:true,lean:reduceMotion?0:Math.sin(t*.0015+o.id)*(.012+(climate.weather==='wind'?.024:0)),cast:{ground:p.z,inside:false}});
     else{
       renderer.box(o.id,{...trunk,u:trunk.u-.09,v:trunk.v-.09},.18,.18,2.4,[.60,.45,.35],'wood');
       const green=seasons[climate.season].ground;
       renderer.box(o.id,{...trunk,u:trunk.u-.43,v:trunk.v-.43,z:1.65},.86,.86,1.28,green,'grass-field');
     }
     continue;
   }
   if(o.kind==='window')continue;
   if(o.kind==='computer'){
     const streaming=Boolean(stream);
     drawComputer(renderer,o,!!saved.computerOn||streaming,streaming,routinePose?.seconds,stream);
     continue;
   }
   if(o.kind==='floorDecor'){drawFloorDecor(renderer,o);continue;}
   if(playing?.fixture?.id===o.id&&['tea','fluff','fold'].includes(playing.key))continue;
   if(o.kind==='pillow'||o.kind==='blanket'){
     const owner=parents.get(o.id);
     const bed=preview?.id===owner?preview:fixtures.find(item=>item.id===owner);
     if(bed?.kind==='bed'){
       drawBedding(renderer,bed,o,o.kind==='blanket'&&saved.blanket);
       continue;
     }
   }
   if(o.kind==='pickup'&&!o.art){
     const p=position3D(o);
     renderer.box(o.id,p,o.w*.64,o.d*.64,o.visualHeight,o.tint||[.66,.65,.52]);
     continue;
   }
   const isLamp=o.kind==='lamp'||o.kind==='placedLamp';
   const lit=isLamp&&lampIsOn(o);
   if(lit){
     const shade=o.lightHeight??(o.kind==='placedLamp'?.43:o.id===5?1.36:2.22);
     const shift=o.id===5?.14:0;
     sources.push([o.u+o.w*.5+shift,o.v+o.d*.5,surfaceAt(o.u,o.v)+shade,.42+night*.77]);
   }
   if(o.art){
     const p=position3D(o);
     if(o.base)renderer.box(o.id,p,o.w*.85,o.d*.85,.23,[.76,.50,.40],'wood');
     p.u+=o.w*.5;p.v+=o.d*.5;p.z+=(o.base?.22:0)+(carrying===o.id?.48:0);
     let key=o.back?'back-'+o.art:o.art,height=o.visualHeight;
     const touch=gesture?.id===o.id?Math.sin(Math.PI*Math.min(1,Math.max(0,(t-gesture.start)/(gesture.until-gesture.start)))):0;
     if(touch&&['cup','bucket','kit','pillow'].includes(o.kind))p.z+=touch*.102;
     if(touch&&['plant','bouquet','flowers','blanket'].includes(o.kind))height*=1-.035*touch;
     if(o.kind==='pillow'&&saved.pillow)p.u+=.06;
     if(o.kind==='blanket'&&(o.id===11?saved.blanket:saved.linens?.[o.id])){key='folded-throw';height*=.64;p.v+=.22;}
     if(o.kind==='umbrella'&&saved.umbrella){key='closed-umbrella';}
     let anchor=o.artAnchor;
     if(actionTime[o.kind]){
       const progress=playing?.fixture?.id===o.id?routinePose.progress:
         gesture?.id===o.id?(t-gesture.start)/(gesture.until-gesture.start):null;
       const uses=saved.houseUses?.[o.id]||0;
       const stage=useFrame(o.kind,playing?.key==='wash'&&playing.fixture.id===o.id?uses+1:uses,progress);
       const activeKey=(o.back?'reverse-use-':'use-')+o.kind+'-'+stage;
       if(stage&&renderer.artReady(activeKey)){
         key=activeKey;
         if(o.back&&o.kind==='fridge'){anchor=[anchor[0]*reverseCells['reverse-use-fridge'][1],anchor[1]];}
         else if(o.kind==='fridge'){height*=384/360;anchor=[anchor[0]*196/320,anchor[1]*360/384];}
       }
     }
     if(renderer.artReady(key)){
       if(!o.z&&carrying!==o.id&&o.solid!==false){
         renderer.shadow({u:p.u,v:p.v,z:p.z+.032},o.w*.52,o.d*.53);
       }
       const support=o.z&&fixtures.find(base=>base.id===parents.get(o.id));
       const top=furnitureSurface(key,[o.w,o.d],o.artFlip);
       renderer.sprite(o.id,key,p,height,Boolean(o.artFlip),{
         anchor,widthScale:o.back?(renderer.artAspect(o.art)||1)/(renderer.artAspect('back-'+o.art)||1):1,
         cast:{support,ground:surfaceAt(o.u,o.v)+(support?o.z:0),inside:true},
         footprint:!o.z&&[o.w,o.d],floorPlane:p.z+.004,
         limits:[p.u+o.w*.5,p.v+o.d*.5,p.z+(o.kind==='chair'?o.seatHeight??.48:top?.height??o.surfaceHeight??height)]
       });
       if(o.kind==='table'&&(drawerOpen(o.id)||gesture?.id===o.id)){
         const fraction=gesture?.id===o.id?Math.min(1,Math.max(0,(t-gesture.start)/380)):1;
         const eased=fraction*fraction*(3-2*fraction);
         const openness=drawerOpen(o.id)?eased:1-eased;
         const drawerHeight=top?.height??fixtureTop(o);
         const drawerAt={u:o.u+o.w*.70,v:o.v+o.d+.07-(1-openness)*.25,z:p.z+drawerHeight*.56};
         renderer.sprite(o.id,'desk-drawer',drawerAt,o.id===1?.35:.25,false,{bias:.08,anchor:[.5,.71]});
       }
       if(!o.back&&o.kind==='easel'&&saved.draw){
         renderer.box(o.id,{u:p.u-.071,v:p.v+.057,z:p.z+.89},.12,.026,.23,[.62,.74,.73],'studio');
       }
       if(o.kind==='television'&&saved.channel){
         const pixels=saved.channel===1?[.54,.74,.81]:[.77,.61,.51];
         renderer.box(o.id,{u:p.u-.065,v:p.v+.048,z:p.z+.18},.13,.047,.083,pixels);
       }
       continue;
     }
     if(!o.parts.length){
       renderer.box(o.id,{...p,u:o.u,v:o.v},o.w,o.d,o.visualHeight,[.6,.65,.57]);
       continue;
     }
   }
   if(o.kind==='record'){
     const u=o.u+.164,v=o.v+.152,z=1.484;
     const offset=saved.record?now()*.004:0;
     for(let k=0;k<16;k++){
       const ring=(r,a,h)=>[u+Math.cos(a)*r,v+Math.sin(a)*r,h];
       const a=k*Math.PI/8+offset,b=a+Math.PI/8,f=k%3===0?.19:.133;
       renderer.triangle([[u,v,z],ring(.114,a,z),ring(.114,b,z)],[f,f*.91,f*.96],o.id);
       renderer.triangle([[u,v,z+.001],ring(.033,a,z+.001),ring(.033,b,z+.001)],[.65,.39,.29],o.id);
     }
   }
   if(o.kind==='vending'){
     for(let row=0;row<3;row++){
       const z=.68+row*.23;
       renderer.box(o.id,{u:o.u+.055,v:o.v+.448,z:z-.027},.43,.053,.021,[.75,.67,.50]);
       for(let column=0;column<4;column++){
         const colors=[[.92,.62,.41],[.56,.77,.74],[.78,.60,.69],[.86,.79,.55]];
         renderer.box(o.id,{u:o.u+.087+column*.093,v:o.v+.451,z},.061,.045,.133,colors[(row+column)%4]);
       }
     }
   }
   if(o.kind==='umbrella'){
     const at=position3D(o),rise=saved.umbrella?.35:.12,spread=saved.umbrella?.10:.42;
     const u=at.u+.36,v=at.v+.36,h=at.z+1.65;
     renderer.box(o.id,{u:u-.018,v:v-.018,z:at.z},.036,.036,1.65,[.62,.48,.36],'wood');
     for(let j=0;j<8;j++){
       const rim=a=>[u+spread*Math.cos(a),v+spread*Math.sin(a),h-rise];
       renderer.triangle([[u,v,h+.13],rim(j*Math.PI/4),rim((j+1)*Math.PI/4)],j%2?[.71,.29,.33]:[.89,.77,.63],o.id);
     }
     continue;
   }
   if(o.streetMesh)castFurniture(renderer,o,surfaceAt(o.u,o.v));
   if(o.poster)drawNotice(renderer,o,surfaceAt(o.u,o.v));
   for(const [i,part] of o.parts.entries()){
     const a={u:o.u+part.u,v:o.v+part.v,z:part.z+surfaceAt(o.u,o.v)+(carrying===o.id?.48:0)};
     let b=part.b,tint=part.tint;
     if(o.kind==='table'&&drawerOpen(o.id)&&i>4)a[o.turned?'u':'v']+=.16;
     if(o.kind==='window'&&saved.window&&i>0)a.v+=.16+i*.014;
     if(o.kind==='blanket'&&(o.id===11?saved.blanket:saved.linens?.[o.id]))b*=.71;
     if(o.kind==='pillow'&&saved.pillow)a.u+=.072;
     if(o.kind==='plant'&&saved.plant)tint=tint.map(k=>k*.88);
     if(o.kind==='easel'&&i===3&&saved.draw){
      tint=[.77,.68,.58];
      renderer.box(o.id,{u:a.u+.18,v:a.v+.041,z:a.z+.14},.26,.006,.25,[.37,.52,.53],'studio');
    }
     const glowing=lit&&i===(o.bulbPart??2);
     renderer.box(o.id,a,part.a,b,part.h,glowing?[1,.78,.47]:tint,glowing?'glow':part.mat);
   }
 }
 const lightScore=([u,v,,strength])=>strength/(1+Math.hypot(u-eva.u,v-eva.v)*.40);
 sources.sort((a,b)=>lightScore(b)-lightScore(a));
 lamps.fill(0);
 sources.slice(0,4).forEach((source,i)=>lamps.set(source,i*4));
 const rest=restMotion,sample=rest&&seatSample(rest,t,reduceMotion);
 const seat=rest?.seat,amount=sample?.poseAmount??sample?.amount??0;
 const recline=sample?.recline??0;
 const target=seat?(sample?.pose??'sit'):routinePose?.motion!=='idle'&&routinePose?.motion||
   gesture?.motion||releaseMotion?.motion;
 const use=routinePose?.amount??(gesture?gestureAmount(gesture,t):
   releaseMotion?releaseMotion.from*(1-ease(Math.min(1,Math.max(0,(t-releaseMotion.start)/190)))):0);
 const gaitWeight=walkHold?ease(Math.min(1,Math.max(0,(t-walkHold)/footSettleTime))):
   1-ease(Math.min(1,Math.max(0,(t-walkStarted)/footSettleTime)));
 const walking=(move.length||walkHold)&&!reduceMotion;
 const pose=target?registeredPose(actionPose(rest?.facing||releaseMotion?.facing||direction,target,seat?amount:use),
   seat?amount:use):
   walking?evaPose(walkFacing,'walk',walkPhase,gaitWeight):actionPose(direction,'idle',0,mood);
 const ready=renderer.artReady(pose.key),shown=ready?pose:{...standingPose('eva',direction),height:1.62};
 const at=position3D(eva),opt={...shown};
 if(roomPulse&&!target&&!move.length){
   const [duration,lean]=roomPulse.curve;
   const phase=Math.min(1,Math.max(0,(t-roomPulse.start)/duration));
   opt.lean=lean*Math.sin(Math.PI*phase)**2;
 }
 if(seat){
   at.u=sample.u;at.v=sample.v;
   at.z=surfaceAt(at.u,at.v)+(sample.height??seat.height*amount);
   if(ready){
     const {seat:[x,y],pillow}=actionAnchors[pose.key];
     const anchor=pose.grip?.hip?.to??[x,y+.030];
     if(target==='sleep'){
       opt.anchor=anchor.map((value,i)=>value+(pillow[i]-value)*recline);
       opt.bedPlane=Math.max(seat.edge.height+.035,at.z);
       opt.restAmount=ease(Math.min(1,recline*2.5));
       opt.bias=.14*(1-opt.restAmount);
     }else{
       const sole=pose.grip?.foot?.to??[.5,gait.anchorY];
       opt.anchor=anchor.map((value,i)=>sole[i]+(value-sole[i])*amount);
       opt.bias=amount*(seat.id===streamChair.id?.055:.14);
       opt.footFloor=surfaceAt(at.u,at.v)+.012+opt.bias;
       if(!reduceMotion&&amount>0&&amount<1)
         opt.lean=Math.sin(Math.PI*amount)*.043*(orientation(rest.facing).flip?-1:1);
     }
   }
 }
 if(playing&&!reduceMotion){
   if(playing.key==='sweep'||playing.key==='mop'){
     at.u+=routinePose.swing*.055;at.v-=routinePose.swing*.055;
   }
   if(playing.key==='vinyl'&&routinePose.index>=2)opt.lean=Math.sin(routinePose.seconds*4)*.047;
   if(playing.key==='stretch')opt.lean=(routinePose.amount-.5)*.03;
   if(playing.key==='tea'&&routinePose.index===1&&opt.grip){
     const lift=ease(routinePose.amount);
     opt.grip={...opt.grip,to:[opt.grip.to[0]+(.64-opt.grip.to[0])*lift,
       opt.grip.to[1]+(.30-opt.grip.to[1])*lift]};
   }
 }
 if(stream&&opt.grip){
   opt.deskHands=true;
   const {crown}=opt.grip;
   const reaction=playing.streamReaction;
   const expression=reaction&&!reduceMotion&&streamExpression(reaction.emotion,t-reaction.start);
   if(crown&&(expression||stream.nod)){
     const x=stream.nod+(expression?.x??0),y=Math.abs(stream.nod)*.7+(expression?.y??0);
     opt.grip={...opt.grip,crown:{...crown,to:[crown.to[0]+x,crown.to[1]+y]}};
   }
 }
 const standing=1-ease(amount);
 if(standing>.03)renderer.shadow({...at,z:surfaceAt(at.u,at.v)+.032},.27*standing,.21*standing);
 opt.crown=actionAnchors[shown.key]?.heads[shown.row]?.[shown.column];
 if(!seat)opt.cast={ground:surfaceAt(at.u,at.v),inside:true};
 const stretch=playing?.key==='stretch'&&!reduceMotion?routinePose.amount*.043:0;
 const breath=target||move.length||reduceMotion?0:Math.sin(t*.002)*.002;
 const head=renderer.sprite(EVA_ID,shown.key,at,
   shown.height*(1+breath+stretch),shown.flip,opt,true);
 motionFrames[EVA_ID]=shown;
 if(head)heads.set(EVA_ID,head);
 if(stream)drawComputerArms(renderer,at,playing.fixture,stream,EVA_ID);
 if(playing&&playing.key!=='computer'){
   const o=playing.key==='tv'?fixtures.find(fixture=>fixture.id===26):playing.fixture;
   let point=at;
   if(o){
     const key=o.back?'back-'+o.art:o.art;
     const top=furnitureSurface(key,[o.w,o.d],o.artFlip);
     point={u:o.u+o.w/2+(top?.shift??0),v:o.v+o.d/2-(top?.shift??0),
       z:surfaceAt(o.u,o.v)+(o.kind==='window'?1.53:top?.height??fixtureTop(o))};
   }
   drawRoomActivity(renderer,playing.key,routinePose,at,point,direction,head);
 }
 if(flight){
   const point=flightPoint(flight,flight.impact?last:flight.checkedAt);
   drawToy(renderer,flight,point,point.z);
 }
 renderer.flush(false,night,lamps,lighting);
 speechAnchors=new Map();
 for(const [id,head] of heads){
   const p=project(view,head);
   speechAnchors.set(id,{x:p.x*view.cssWidth/view.width,y:p.y*view.cssHeight/view.height});
 }
 speechLayer.hidden=Boolean(sheet);
 const anchor=speechAnchors.get(EVA_ID);
 if(anchor)anchor.feetY=project(view,at).y*view.cssHeight/view.height;
 town.anchor(anchor,sheet);
 let streamBounds;
 if(playing?.key==='computer'&&playing.dialogue&&!sheet&&!layout&&!town.composing){
   const xScale=view.cssWidth/view.width,yScale=view.cssHeight/view.height;
   const monitor=project(view,computerLayout(playing.fixture)(.795,.180,.365));
   let figure;
   if(anchor){
     const floor=project(view,{...at,z:surfaceAt(at.u,at.v)});
     const floorX=floor.x*xScale,height=Math.max(0,floor.y*yScale-anchor.y);
     const padding=Math.max(14,height*.4);
     figure={x:Math.min(anchor.x,floorX)-padding,y:anchor.y-padding/2,
       w:Math.abs(anchor.x-floorX)+2*padding,h:height+padding};
   }
   streamBounds=streamChat.layout({x:monitor.x*xScale,y:monitor.y*yScale},t,figure);
 }else streamChat.hide();
 speech.layout(speechAnchors,canvas,streamBounds);
}
function advanceWalker(dt){
 if(restMotion||releaseMotion||walkHold||!move.length)return;
 if(!walkSpeed)walkStarted=now();
 const step=paceRoute(eva,move,dt,walkSpeed,1.62);
 walkSpeed=step.speed;
 walkFacing=walkHeading(step.du,step.dv,walkFacing);direction=walkFacing;walkPhase+=step.distance;
 const beat=Math.floor(walkPhase/(gait.stride/2));
 if(beat!==lastStepIndex){
   lastStepIndex=beat;footstep('wood');
 }
 if(!move.length){
   if(reduceMotion)finishWalk();
   else walkHold=now();
 }
 dirty=true;
}
let timer=0;
function wake(){
 if(!active||document.hidden||nextFrame||graphicsLost)return;
 clearTimeout(timer);timer=0;
 nextFrame=requestAnimationFrame(loop);
}
function loop(t){
 nextFrame=0;
 if(!active||document.hidden)return;
 const elapsed=Math.max(.001,(t-last)/1000),dt=Math.min(.085,elapsed);last=t;
 if(releaseMotion&&t-releaseMotion.start>=190)releaseMotion=null;
 let rest=restMotion&&seatSample(restMotion,t,reduceMotion);
 if(rest?.complete&&!seated){
   restMotion=null;rest=null;dirty=true;
   if(!move.length)finishWalk();
 }
 const settling=rest&&!rest.complete;
 if(walkHold&&!sheet&&!layout){
   dirty=true;
   if(t-walkHold>=footSettleTime)finishWalk();
 }
 if(settling||releaseMotion)dirty=true;
 if(!sheet&&t>=nextWorldSync){syncWorld();nextWorldSync=t+2200}
 if(t>latestClock){pullClock();latestClock=t+5000;}
 if(!sheet&&!layout){
   advanceRoomActivity(t,settling);
   advanceWalker(dt);

   if(flight){
     dirty=true;
     if(!flight.retrieving&&advanceFlight(flight,t,toyBlocked,surfaceAt).phase===1){
       const item=flight;flight.retrieving=true;
       walkTo(item.to.u,item.to.v,()=>{
         if(flight!==item)return;
         flight=null;appEvent(item.kind);say(item.kind==='ball'?remark('bounce'):remark('plane'),'pleased');
       });
     }
   }
   if(autoFollow&&t>=nextPastime&&!roomActivity&&!town.composing&&!move.length&&!seated?.sleep&&
      !carrying&&!flight&&!toyAim&&!dropAim&&!selectTarget&&!hold){
     const entry=currentEntry(Date.now()),slot=entry[0];
     const choice=nextActivity(entry[6],saved.roomRoutineCursor[slot]||0,activityAvailable);
     nextPastime=t+18000;
     if(choice){
       saved.roomRoutineCursor[slot]=choice.next;
       startRoomActivity(choice.key,true);
     }
   }
 }
 if(gesture&&t>=gesture.until){gesture=null;dirty=true;}
 if(mood&&t>=moodUntil){mood=null;dirty=true;}
 if(roomPulse){
   if(t-roomPulse.start>=roomPulse.curve[0])roomPulse=null;
   dirty=true;
 }
 if(!nextPresence)nextPresence=t+14000;
 if(!sheet&&!layout&&!restMotion&&!move.length&&!roomActivity&&!town.composing&&t>=nextPresence){
   nextPresence=t+17000+(Math.round(t)%4000);
   reactInRoom('settle');
 }
 if(speech.tick(t))dirty=true;
 const animated=!sheet&&windowWeatherMoves(climate,reduceMotion);
 const ambientDue=animated&&t+1>=nextAmbientFrame;
 const responsive=!sheet&&(releaseMotion||settling||gesture||roomPulse||move.length||walkHold||flight);
 const performing=!sheet&&!layout&&roomActivity?.started;
 const paintScene=dirty||!sheet&&(Boolean(gesture)||ambientDue);
 if(paintScene){
   paint(t);dirty=false;
   nextAmbientFrame=t+72;
 }
 if(!sheet)ambience(climate.weather,section,false,Boolean(saved.window));
 if(responsive)wake();
 else if(!nextFrame){
   const delay=sheet?750:performing?(reduceMotion?480:25):animated?Math.max(8,nextAmbientFrame-t-8):
     speech.waiting||mood?75:300;
   timer=setTimeout(wake,delay);
 }
}

window.homeSheetChanged=()=>{
 speechLayer.hidden=Boolean(sheet);
 if(sheet)streamChat.hide();
 if(!sheet){last=now();dirty=true;nextAmbientFrame=0}
 wake();
};

function updateHomeVisibility(){
 const visible=nativeActive&&!document.hidden;
 if(active===visible)return;
 active=visible;
 town.active(active);audioVisible(active);
 if(active){
   last=now();pullClock();wake();
 }else{
   streamChat.hide();
   releaseHomePointer();storage();
   cancelAnimationFrame(nextFrame);clearTimeout(timer);nextFrame=timer=0;
 }
}
window.setHomeActive=(value,returning=false)=>{
 nativeActive=Boolean(value);updateHomeVisibility();
 if(nativeActive){
   repairHomeSheet(returning);releaseHomePointer();
   if(returning)town.close();
   if(graphicsRestored)Desk.reloadRoom?.();
   else if(active){dirty=true;wake();}
 }
};
window.addEventListener('resize',()=>{dirty=true;wake()});
canvas.addEventListener('art',()=>{dirty=true;wake()});
document.addEventListener('visibilitychange',updateHomeVisibility);
canvas.addEventListener('webglcontextlost',e=>{
 e.preventDefault();
 graphicsLost=true;
 cancelAnimationFrame(nextFrame);clearTimeout(timer);nextFrame=timer=0;
 $('world-status').textContent='Восстанавливаю графику комнаты…';
 $('world-status').hidden=false;
});
canvas.addEventListener('webglcontextrestored',()=>{
 graphicsRestored=true;
 if(active)Desk.reloadRoom?.();
});

function openRoom(){
 const out=showSheet('room','Комната Евы');
 out.append(label(autoFollow?'Расписание включено':'Включить расписание',
   'Ева сама занимается своими делами и ложится спать','◷',()=>{
   autoFollow=!autoFollow;localStorage.setItem('followSchedule',autoFollow?'yes':'no');
   if(!autoFollow)pauseInitiative();
   previousSlot=-1;pullClock();closeSheet();wake();
 }));
 out.append(label('Обстановка','Размер комнаты и мебель','⌂',openFurnishing));
 out.append(label('Занятия','Уборка, готовка, творчество и отдых','◇',()=>openRoomActivities()));
 const streamEnabled=localStorage.getItem('lunaStream')==='yes';
 const streamOption=label('Модель для чата стрима',
   streamEnabled?'До двух импровизаций за эфир · используется лимит Codex':'Выключена · при включении используется лимит Codex','◇',()=>{
     localStorage.setItem('lunaStream',streamEnabled?'no':'yes');openRoom();
   });
 streamOption.setAttribute('aria-pressed',String(streamEnabled));out.append(streamOption);
 out.append(label('Распорядок дня','','◷',()=>{
   const panel=showSheet('schedules','Распорядок Евы');
   const current=currentEntry(Date.now());
   for(const entry of routines.entries){
     const [start,,,,period,,program]=entry;
     const row=label(String(start).padStart(2,'0')+':00 · '+period,
       program.map(key=>roomActivities[key].title).join(' · '),'◷',()=>openRoomActivities(program,period));
     if(entry===current)row.setAttribute('aria-current','time');
     panel.append(row);
   }
 }));
}
function openFurnishing(){
 const out=showSheet('furnishing','Обстановка');
 const extended=!!roomExtra;
 out.append(label(extended?'Вернуть обычный размер':'Увеличить комнату',
   extended?'Расширенная комната':'Добавить место вдоль открытых сторон','⌂',()=>{
     if(extended&&fixtures.some(o=>o.kind!=='window'&&o.kind!=='wallArt'&&!o.z&&!fitsRoom(o.u,o.v,o.w,o.d))){
       out.querySelector('.furnishing-note')?.remove();
       out.append(node('p','Сначала переставь предметы с дополнительной площади.','sub furnishing-note'));
       return;
     }
     closeSheet();pauseInitiative();
     move=[];onArrival=null;walkHold=null;flight=null;carrying=null;selectTarget=null;dropAim=null;toyAim=null;
     roomExtra=extended?0:expandedRoom;saved.roomExpanded=!extended;
     center=roomView(roomExtra).centre;
     if(!inRoom(eva.u,eva.v,.17,roomExtra)){eva={...start};seated=restMotion=null;}
     refreshObjects();storage();statusNote(extended?'Обычный размер комнаты.':'Дополнительное место готово.');
     dirty=true;wake();
   }),
   label('Переставить мебель','','✥',()=>beginLayout()),
   label('Каталог мебели','Свет, мебель, декор и бытовые предметы','＋',()=>{beginLayout();openPalette()}));
}
function openRoomActivities(program=Object.keys(roomActivities),title='Занятия'){
 const out=showSheet('room-activities',title);
 for(const category of new Set(program.map(key=>roomActivities[key].category))){
   const section=menuSection(out,category);
   for(const key of program.filter(item=>roomActivities[item].category===category)){
     const activity=roomActivities[key],available=activityAvailable(key);
     const row=label(activity.title,available?'':'Предмет убран из комнаты','◇',()=>startRoomActivity(key));
     row.disabled=!available;
     section.append(row);
   }
 }
}
$('home-menu').onclick=()=>{
 const out=showSheet('home-menu','Дом Евы');
 out.append(
   label('Комната','Обстановка, занятия и распорядок','⌂',openRoom),
   label('В комнате','Предметы и действия','◇',openRoomObjects),
   label('Диспетчер','Температура, память, приложения и службы','▤',window.openDeviceMonitor),
   label('События','','◷',openTimeline),
   label('Карман','','＋',openInventory),
   label('Звук в комнате','','♫',window.openHomeSound));
};
function openRoomObjects(){
 const out=showSheet('decor','В комнате');
 out.append(label('Расстановка','Переместить или повернуть мебель','✥',()=>beginLayout()),label('Палитра предметов','Добавить предмет в комнату','＋',()=>{beginLayout();openPalette()}));
 if(carrying||dropAim||toyAim)out.append(label('Отменить действие','','×',()=>{closeSheet();perform(null,'cancel')}));
 for(const o of objectList(section))out.append(label(o.name,'','◇',()=>select(o)));
 for(const [name,kind] of [['Мяч','ball'],['Бумажный самолётик','plane']])out.append(label(name,'Выбери, куда запустить','›',()=>{
   closeSheet();pauseInitiative();flight=null;move=[];onArrival=null;carrying=null;selectTarget=null;dropAim=null;toyAim=kind;
   say('Ткни в пол. Кому прилетит — чисто случайность.');
 }));
}
$('weather').onclick=openWeather;
function openWeather(){
 const out=showSheet('weather','Погода');
 out.append(node('div',$('weather').textContent,'weather-label'));
 out.append(label('Выбрать место для прогноза','Open-Meteo','☁',()=>Desk.chooseForecastLocation()));
 function choices(group,title,values){
   out.append(node('div',title,'weather-label'));
   const list=node('div',null,'weather-options');
   for(const [key,labelText] of [['auto','Авто'],...values]){
     const option=btn(labelText,'',()=>{
       if(key==='auto')delete weatherOptions[group];else weatherOptions[group]=key;
       saved.weatherOptions=weatherOptions;storage();pullClock();openWeather();wake();
     });
     option.setAttribute('aria-pressed',String((weatherOptions[group]||'auto')===key));list.append(option);
   }
   out.append(list);
 }
 choices('season','Сезон по местному календарю',Object.entries(seasons).map(([key,v])=>[key,v.name]));
 const connected=Desk.weatherState()==='connected';
 out.append(label(connected?'Виджет Погоды HONOR':'Подключить Погоду HONOR',
   connected?(widgetWeather(JSON.parse(Desk.weatherLabels())).area||'Открыть данные погодного приложения'):'Подключить системный виджет погоды','☁',()=>{
     delete weatherOptions.weather;saved.weatherOptions=weatherOptions;storage();closeSheet();Desk.connectWeather();
   }));
 out.append(label('Прогноз за окном',(weatherOptions.cityFallback!==false?'Включена':'Выключена')+' · Open-Meteo, если в виджете нет условий','☁',()=>{
   weatherOptions.cityFallback=weatherOptions.cityFallback===false;delete weatherOptions.weather;saved.weatherOptions=weatherOptions;storage();pullClock();openWeather();wake();
 }));
 choices('weather','Погода за окном',Object.entries(weathers).map(([key,v])=>[key,v.name]));
 appendSoundControls(out,openWeather);
}
window.openHomeSound=()=>{
 const out=showSheet('sound','Звук в комнате');
 appendSoundControls(out,window.openHomeSound);
};
function appendSoundControls(out,refresh){
 const toggle=label('Звук в комнате','Реплики Евы, погода, шаги и занятия','♫',()=>{
   saved.sound=!saved.sound;
   if(!saved.sound)town.stopPhrase();
   else prepareSound();
   soundSettings(saved.sound,saved.volume??.42);storage();refresh();wake();
 });
 toggle.setAttribute('aria-pressed',String(Boolean(saved.sound)));
 toggle.append(node('span',saved.sound?'Вкл.':'Выкл.','switch'));out.append(toggle);
 const volume=node('label',null,'sound-level'),bar=node('input',null);
 bar.type='range';bar.min='0';bar.max='100';bar.value=String(Math.round((saved.volume??.42)*100));
 volume.append(node('span','Громкость'),bar);
 bar.oninput=()=>{saved.volume=Number(bar.value)/100;soundSettings(saved.sound,saved.volume);if(!saved.volume)town.stopPhrase();};
 bar.onchange=storage;
 out.append(volume);
}
$('wallet').onclick=()=>{
 showSheet('weekly-limit','Недельный лимит Codex');
 renderWeeklyQuota();town.refresh();
};
function renderWeeklyQuota(){
 const out=$('content');
 out.replaceChildren(node('p',weeklyQuota?'Осталось '+weeklyQuota.remaining+'%':'Пока нет данных от Codex.','weather-label'));
 if(weeklyQuota){
   const end=new Date(weeklyQuota.resetsAt*1000);
   out.append(node('p','Сброс · '+date.format(end)+', '+time.format(end),'sub'));
 }
}
function openInventory(){
 const out=showSheet('inventory','Карман');
 const summary=node('div',null,'stock-summary');
 summary.append(node('strong',saved.economy.coins+' мон.'),node('span','Сытость '+Math.round(fullness(saved.economy,Date.now()))+'%'));out.append(summary);
 out.append(label('Заказать запасы','Еда, материалы и мелочи','＋',openSupplies));
 const entries=Object.entries(saved.economy.stock);
 for(const [key,n] of entries){
   const info=items[key];if(!info||n<1)continue;
   out.append(label(info.name+' × '+n,info.food?'Можно съесть или выложить':'Можно выложить','◇',()=>{
     const detail=showSheet('inventory-item',info.name),menu=node('div',null,'stock-menu');
     if(info.food)menu.append(btn(key==='tea'||key==='soda'?'Выпить':'Съесть','',()=>{
       closeSheet();if(trade('eat',key))say(key==='tea'?remark('tea'):'Подкрепилась. Мозг включился, претензии остались.','pleased');
     }));
     menu.append(btn('Выложить','',()=>{
       closeSheet();move=[];onArrival=null;flight=null;selectTarget=null;carrying=null;toyAim=null;dropAim=key;
       say('Выбери свободное место на полу.','curious');
     }),btn('Назад','',openInventory));
     detail.append(menu);
   }));
 }
 if(!entries.length)out.append(node('p','Карман пуст.','sub'));
}

function openSupplies(){
 const out=showSheet('supplies','Запасы');
 for(const [key,item] of Object.entries(items)){
   if(!item.price)continue;
   out.append(label(item.name,item.price+' мон.','＋',()=>{
     if(trade('buy',key))openInventory();
     else closeSheet();
   }));
 }
 for(const [key,coins,event] of [['drawing',5,'sell-drawing'],['bouquet',6,'sell']]){
   if(!saved.economy.stock[key])continue;
   out.append(label('Сдать · '+items[key].name,coins+' мон.','◇',()=>{
     if(trade('sell',key)){appEvent(event);openInventory();}
   }));
 }
 out.append(btn('В карман','back-link',openInventory));
}

function openTimeline(){
 pullClock();
 const out=showSheet('timeline','Что было');
 const live=timeline.live!==false;
 out.append(label(live?'Фоновое расписание включено':'Включить фоновое расписание',
  live?'Android обновляет события комнаты в фоне':'События обновляются при открытии рабочего стола','◷',()=>{
   Desk.enableLife(!live);closeSheet();statusNote(live?'Фоновое расписание выключено.':'Фоновое расписание включено.');
 }));
 for(const ev of [...(timeline.events||[])].reverse().slice(0,15)){
   const row=node('div',null,'timeline-row');row.append(node('strong',ev.who+' · '+ev.text));
   row.append(node('small',time.format(new Date(ev.at))+' · '+(sectionNames[ev.where]||ev.where)));
   out.append(row);
 }
}
window.worldCheck=()=>{
 const close=project(view,{u:1,v:1,z:1.62}).y-project(view,{u:1,v:1}).y;
 const far=project(view,{u:-2,v:-1,z:1.62}).y-project(view,{u:-2,v:-1}).y;
 return {section,climate,lighting,motionFrames,paintCount,activeLights:Array.from(lamps).filter((strength,i)=>i%4===3&&strength>0).length,
   cameraScale:roomView(roomExtra).scale,cameraOffset:roomOffset,roomExpanded:!!roomExtra,
   sound:audioState(),outdoors:false,
   anchors:Object.fromEntries(speechAnchors),move:move.length,direction,
   activity:roomActivity?.key||null,activityPhase:roomActivity?.sample?.index??null,
   pose:seated?.sleep?'sleep':seated?'sit':move.length||walkHold?'walk':roomActivity?.sample?.motion||gesture?.motion||'idle',
   center,eva,depth:renderer.depthBits,sizeConstant:Math.abs(close-far)<.0001,windowOpen:!!saved.window,
   lamp:saved.lamps,chairs:saved.chairs,flight:flight?.kind||null,economy:saved.economy,timeline:JSON.parse(Desk.timeline())};
};
soundSettings(Boolean(saved.sound),saved.volume??.42);
document.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(saved.sound&&button){prepareSound();sound(button.closest('#town-compose')?'chatTap':'uiTap');}
},true);
for(const key of ['walk-eva','act-eva-front','act-eva-rear','desk-drawer','amber-sconce','closed-umbrella','folded-throw'])renderer.artReady(key);
refreshObjects();
if(!saved.roomDecorIntroduced){
 saved.roomDecorIntroduced=true;
 const ids=new Set(saved.decor.map(item=>item.id));
 let id=1024;
 for(const [model,u,v] of [[708,1.42,1.82],[707,2.80,-1.82],[709,-2.07,.98]]){
   const fixture=modelsById.get(model),point=worldPoint(room.key,u,v);
   if(!fitsRoom(point.u,point.v,fixture.w,fixture.d)||
      placementIssue(fixture,point,fixtures,[],[eva],true))continue;
   while(ids.has(id))id++;
   if(id>65534)break;
   saved.decor.push({id:id++,model,...point});
   refreshObjects();
 }
}
last=now();pullClock();paint();storage();wake();
