import {seatMotion,seatSample} from './seat-motion.mjs';
import {reverseCells} from './reverse-cells.mjs';
import {nextStation,jobPose} from './workstations.mjs';
import {actionAnchors} from './action-anchors.mjs';
import {shelterPoint,stepPrints,raining} from './rain-life.mjs';
import {restoreTurn,nextTurn,seatFront} from './prop-finish.mjs';
import {witness,recall} from './witness.mjs';
import {objectLine} from './local-lines.mjs';
import {propArt} from './prop-art.mjs';
import {domestic,actionTime,useFrame} from './household.mjs';
import {editableFixture,placementIssue} from './layout.mjs';
import {drawNotice,castFurniture} from './street-furniture.mjs';
import {streetLife} from './street-life.mjs';
import {SIZE,migrateTown} from './town-plan.mjs';
import {fixtureTop, approach, blocksActor, canPlace, hitsFixture} from './contact.mjs';
import {choosePastime} from './pastimes.mjs';
import {project,worldAtHeight,inView} from './camera.mjs';
import {createScene,cameraScale,cameraOffset} from './render.mjs';
import {places} from './places.mjs';
import {drawScenery,drawSurroundings,waveOnScreen} from './scenery.mjs';
import {startFlight,flightPoint,advanceFlight,hitsDoor,drawToy} from './toys.mjs';
import {gait,heading,walkHeading,orientation,standingPose,evaPose,walkPose,actionPose} from './orientation.mjs';
import {createSpeech} from './speech.mjs';
import {district, districts, extent, regionAt, worldPoint, surfaceAt, waterAt, solidWall, worldObjects, route, localPath, roundRoute, paceRoute} from './district.mjs';
import {createCitizens, dialogue} from './citizens.mjs';
import {initialEconomy,items,fixtureItems,fullness,apply as applyEconomy} from './economy.mjs';
import {remark} from './remarks.mjs';
import {outsideAt} from './neighborhood.mjs';
import {buildings,buildingEdge,insideBuilding,doorsFor,drawDoor} from './buildings.mjs';
import {seasons,weathers,widgetWeather,cityReading,climateAt,paletteFor,terrainState} from './weather.mjs';
import {atmosphere} from './atmosphere.mjs';
import {settings as soundSettings,audioVisible,ambience,footstep,audioState} from './audio.mjs';
import {names as activityNames,lines as activityLines,prepareSound,sound} from './activities.mjs';

import {townChat} from './town-chat.mjs';
const town=townChat({world:worldSnapshot,apply:useNearby,note:statusNote,quip:()=>say(remark('touch'),'wry')});
const canvas=$('scene');
const EVA_ID=15;
const townLife=streetLife(start=>pathTo(worldPoint('shop',-2.75,1.13),start));
const prints=stepPrints();
const speech=createSpeech($('speech'),$('world-status'),()=>document.querySelectorAll('.now,#places,#wallet,#folders button,#actions button,#dock,#town-mark:not([hidden])'));
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
const rememberedPlot=remembered&&regionAt(remembered.u,remembered.v);
let eva=rememberedPlot&&!waterAt(remembered.u,remembered.v)&&!solidWall(remembered.u,remembered.v)?{...remembered}:
  rememberedPlot?worldPoint(rememberedPlot.key,...rememberedPlot.start):start;
let section=regionAt(eva.u,eva.v).key,center={...eva};
const routines=JSON.parse(Desk.routines());
const moscowHour=at=>(Math.floor(at/3600000)+3)%24;
const currentEntry=(key,at)=>routines[key].entries.findLast(row=>row[0]<=moscowHour(at))??routines[key].entries.at(-1);
const citizens=createCitizens(0);
function settleResidents(at,resuming=false){
 for(const person of citizens){
   const entry=currentEntry(person.key,at);
   if(resuming&&person.entry===entry)continue;
   Object.assign(person,worldPoint(entry[1],entry[2],entry[3]),{entry,doing:entry[4],sleeping:!!entry[5],job:null,journey:[],speed:0,wait:performance.now()+450+(person.id%7)*130});
 }
}
settleResidents(Date.now());
let nextAmbientFrame=0,wavesVisible=false,sceneryFading=false,paintCount=0,scheduled=null;
let nextPastime=0,automaticWalk=false;
saved.pastimeCursor??={};
let autoFollow=localStorage.getItem('followSchedule')!=='no';
let view,speechAnchors=new Map(),motionFrames={},night=0,lighting=[1,1,1],dirty=true,nextFrame=0,last=0;
const lamps=new Float32Array(16);
const weatherOptions=saved.weatherOptions&&typeof saved.weatherOptions==='object'?saved.weatherOptions:{};
let climate=climateAt(new Date(),weatherOptions),lastAir=0,lastStepIndex=0,focusedBuilding='';

const doors=doorsFor(districts).map(door=>({...door,open:0}));
const openDoors=doors.map(door=>({...door,open:1}));
let nativeActive=true,active=!document.hidden,move=[],onArrival=null,direction='down-right',seated=null,carrying=null,selectTarget=null,dropAim=null;
let reply=null,timeline={},previousSlot=-1,latestClock=0;
let toyAim=null,flight=null,gesture=null,walkFacing=direction,walkPhase=0,walkSpeed=0,lastFloorQuip=0,floorQuip=0;
let restMotion=null,releaseMotion=null;
function gestureAmount(g,t){
 const x=Math.min(1,Math.max(0,(t-g.start)/(g.until-g.start)));
 return ease(Math.min(1,x/.32,(1-x)/.32));
}
let mood=null,moodUntil=0,suspendedAt=0;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const air=atmosphere($('air'),reduceMotion);
const outdoors=()=>outsideAt(regionAt(eva.u,eva.v),eva.u,eva.v);
const lampIsOn=o=>o.kind==='placedLamp'?o.on:saved.lamps[o.id]??(o.sector!=='home'&&night>.44);
const drawerOpen=id=>saved.drawers?.[id]??(id===1&&Boolean(saved.desk));
const now=()=>performance.now();
const citizen=id=>citizens.find(n=>n.id===id);
let fixtures=[];
const fixtureIds=Object.fromEntries(Object.entries(fixtureItems).map(([id,item])=>[item,Number(id)]));
const catalogIds=[12,91,2,9,34,115,119,111,125,128,113,33,41,42,50,133,144,93,300,301,302,303,304,305,61,65,21];
const catalog=new Map(worldObjects({}).filter(o=>catalogIds.includes(o.id)).map(o=>[o.id,o]));
saved.decor=Array.isArray(saved.decor)?saved.decor:[];
function decorFixture(entry){
 const model=catalog.get(entry.model),where=regionAt(entry.u,entry.v);
 if(!model||!where||!Number.isInteger(entry.id)||entry.id<1024||entry.id>65534)return null;
 return {...restoreTurn(model,entry),...entry,sector:where.key,approach:null,decor:true};
}
function refreshObjects(){
 fixtures=worldObjects(saved);
 for(const entry of saved.decor){const o=decorFixture(entry);if(o)fixtures.push(o)}
 for(const [i,entry] of saved.economy.placements.entries()){
   const item=items[entry.item],where=regionAt(entry.u,entry.v);
   if(!item||!where)continue;
   const lamp=entry.item==='lamp';
   fixtures.push({...entry,id:160+i,placementId:entry.id,sector:where.key,kind:lamp?'placedLamp':'pickup',name:item.name,
     w:.25,d:.25,solid:lamp,parts:lamp?[
       {u:0,v:0,z:0,a:.25,b:.25,h:.056,tint:[.71,.57,.39],mat:'wood'},
       {u:.105,v:.105,z:.055,a:.045,b:.045,h:.30,tint:[.49,.45,.40]},
       {u:.025,v:.028,z:.34,a:.20,b:.20,h:.14,tint:entry.on?[1,.83,.39]:[.59,.51,.42]}
     ]:[],art:item.art,visualHeight:item.height||.18,tint:item.tint});
 }
}
function storage(){
 saved.lastLocation=seated?{u:seated.stand[0],v:seated.stand[1]}:{u:eva.u,v:eva.v};localStorage.setItem('room',JSON.stringify(saved));
}
function position3D(o){return {...o,z:(o.z||0)+surfaceAt(o.u,o.v)}}
function positionCitizen(n){
 return {...n,actor:n.key,kind:'npc',w:.23,d:.23,sector:regionAt(n.u,n.v)?.key,solid:false};
}
function publishHUD(){
 const wallet=$('wallet');
 if(wallet){$('balance').textContent=saved.economy.coins;wallet.setAttribute('aria-label','Инвентарь, монет '+saved.economy.coins);}
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
 storage();publishHUD();dirty=true;wake();return true;
}
function say(text,face){
 if(town.playing)return;
 speech.say(EVA_ID,text,now());
 if(face){mood=face;moodUntil=now()+1750;}
 dirty=true;wake();
}
function npcSays(person,text){
 if(!person){say(text);return;}
 speech.say(person.id,text,now());dirty=true;wake();
}
function statusNote(text){speech.report(text,now());wake()}
function respondLater(person,text){reply={speaker:person.id,text,at:speech.until(person.id)+150}}
function pullClock(){
 const instant=new Date(),label=time.format(instant);
 $('clock').textContent=label;$('calendar').textContent=date.format(instant);
 const connected=Desk.weatherState()==='connected';
 const widget=connected?widgetWeather(JSON.parse(Desk.weatherLabels())):{};
 const city=cityReading(JSON.parse(Desk.cityWeather()),instant.getTime());
 const sceneWeather=weatherOptions.weather||widget.weather||(weatherOptions.cityFallback!==false&&city?.weather);
 climate=climateAt(instant,{...weatherOptions,weather:sceneWeather||'clear'});night=1-climate.daylight;
 const current=city?[city.temperature,city.description,city.stale?time.format(city.at):null].filter(Boolean).join(' · '):'Нет данных о погоде';
 $('weather').textContent=current;
 $('weather').setAttribute('aria-label','Погода · '+current);
 try{timeline=JSON.parse(Desk.timeline())}catch{}
 const entry=currentEntry('eva',instant);
 if(!layout&&autoFollow&&previousSlot!==entry){scheduled=entry;if(seated?.sleep&&!entry[5])leaveSeat();}
 previousSlot=entry;
 dirty=true;
}
function appEvent(action){
 if(['bouquet','sell','cargo','mail'].includes(action)){
   const indoor=insideBuilding(district(section),eva.u,eva.v);
   witness(saved,action,eva,citizens.filter(n=>insideBuilding(district(section),n.u,n.v)===indoor).map(n=>({...n,sector:regionAt(n.u,n.v)?.key})),section,Date.now());
 }
 Desk.note(action,section);pullClock()}
function objectList(sector){
 const objects=fixtures.filter(o=>(!sector||o.sector===sector)&&(o.kind!=='shell'||!saved.pickedShell));
 const npcs=citizens.filter(n=>!n.sleeping).map(positionCitizen).filter(n=>!sector||n.sector===sector);
 return [...objects,...npcs];
}
const localUses={shelter:'shelter',chair:'sit',plant:'plant',books:'books',lamp:'lamp',npc:'npc',bed:'sleep',clock:'clock',lookout:'lookout',fountain:'fountain',flowers:'flowers',stove:'stove',basin:'basin',fridge:'fridge',shower:'shower',screen:'screen',toilet:'toilet',notice:'notice',wallArt:'wallArt'};
function worldSnapshot(){
 const nearby=objectList(section).map(o=>({id:o.id,name:o.name,use:localUses[o.kind]||'',distance:Math.round(Math.hypot(o.u+o.w/2-eva.u,o.v+o.d/2-eva.v)*10)/10}))
   .filter(o=>o.distance<=6).sort((a,b)=>a.distance-b.distance).slice(0,18);
 return {location:sectionNames[section],time:time.format(new Date()),weather:climate.weather,indoors:!outdoors(),
   activity:seated?.sleep?'спит':seated?'сидит':move.length?'идёт':'стоит',coins:saved.economy.coins,nearby};
}
function useNearby(id,action){
 if(layout||sheet||selectTarget||dropAim||toyAim||carrying)return 'Сейчас открыто другое действие';
 const o=objectList(section).find(f=>f.id===id&&localUses[f.kind]===action);
 if(!o||!worldSnapshot().nearby.some(f=>f.id===id&&f.use===action))return 'Предмет больше не рядом';
 if(citizens.some(n=>n.sleeping&&n.bed===id))return 'Кровать занята';
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
function blocks(u,v,extra=0){
 return blocksActor(u,v,fixtures,openDoors,carrying,extra);
}
function toyBlocked(point,radius){
 const z=point.z;
 return z+.006<surfaceAt(point.u,point.v)||solidWall(point.u,point.v)||
   doors.some(door=>hitsDoor(point,radius,door))||fixtures.some(o=>o.id!==carrying&&hitsFixture(point,radius,o));
}
function pathTo(target,actor=eva){return localPath(actor,target,blocks)||roundRoute(actor,route(actor,target,blocks),blocks)}
const ease=x=>x*x*(3-2*x);
function takeSeat(seat,at){
 restMotion=seatMotion(seat,{u:eva.u,v:eva.v},at,direction,now());
 seated=seat;eva=at;
}
function leaveSeat(){
 if(!seated)return;
 const exit={u:seated.stand[0],v:seated.stand[1]};
 if(restMotion){
   const time=now(),sample=seatSample(restMotion,time,reduceMotion);
   restMotion=seatMotion(seated,sample,exit,restMotion.facing,time,sample.amount,0);
 }
 eva=exit;seated=null;
}
function walkTo(u,v,done,automatic=false){
 automaticWalk=automatic;
 if(!automatic)nextPastime=now()+30000;
 scheduled=null;leaveSeat();
 if(gesture&&!reduceMotion)releaseMotion={motion:gesture.motion,facing:direction,from:gestureAmount(gesture,now()),start:now()};
 gesture=null;
 const starting=!move.length;
 move=pathTo({u,v});
 if(starting){
   walkSpeed=0;
   // Idle time before a tap should not count toward the first step.
   last=now();
 }
 onArrival=done||null;
 if(!move.length){automaticWalk=false;const callback=onArrival;onArrival=null;callback?.();}
 dirty=true;wake();
}
function around(o,actor=eva){
 return approach(o,actor,blocks);
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
function standFrom(o){
 const front=seatFront(o);
 return blocks(...front)?around(o):front;
}
function navigate(to){
 const plot=district(to);if(!plot)return;
 const destination=worldPoint(to,...plot.start);
 walkTo(destination.u,destination.v,()=>storage());
}
function trackDistrict(){
 const next=regionAt(eva.u,eva.v);
 if(!next||next.key===section)return;
 section=next.key;
 $('place').textContent=section==='shop'?'Лавка':next.title;
 dirty=true;
}
function perform(o,action,automatic=false,snack=null,fromChat=false){
 reply=null;
 if(action==='cancel'){carrying=null;selectTarget=null;dropAim=null;toyAim=null;dirty=true;wake();return}
 closeSheet();
 if(saved.sound)prepareSound();
 const resident=citizens.find(n=>n.sleeping&&n.bed===o.id);
 if(resident&&['sit','sleep'].includes(action)){say(resident.name+' спит. В расписание вторжение в кровать не входило.');return;}
 const person=o.kind==='npc'?citizen(o.id):null;
 if(person){person.job=null;person.wait=now()+10500;person.talking=person.wait;person.journey=[];person.speed=0;person.entry=null;}
 if(o.kind==='chair'&&action==='sit'&&seated?.id===o.id){
   leaveSeat();direction='down-left';dirty=true;say('Встала. Стул может выдохнуть.');return;
 }
 const target=around(o);
 walkTo(...target,()=>{
   if(automatic)nextPastime=now()+15000+Math.random()*12000;
   if(Math.hypot(eva.u-target[0],eva.v-target[1])>.28){
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
       direction='down-right';takeSeat({id:o.id,stand:target,height:.75,sleep:true},{u:o.u+o.w*.48,v:o.v+.27});
       statusNote('Ева спит. Тап по полу её разбудит.');break;
     case 'sit':
       direction=o.seatDirection||'down-left';
       const pos=o.back?.40:.60;
       takeSeat({id:o.id,depth:Math.max(o.w,o.d)>1?.32:.16,stand:standFrom(o),height:o.seatHeight||.5},
         {u:o.u+o.w*(o.kind==='bed'?.87:o.turned?pos:.5),v:o.v+o.d*(o.turned?.5:pos)});
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
       saved.window=!saved.window;say(saved.window?'Проветрила. Теперь бардак на свежем воздухе.':'Закрыла. Хватит городу смотреть на мой плед.');break;
     case 'npc':
       if(!person)break;
       person.direction=heading(eva.u-person.u,eva.v-person.v,person.direction);
       saved.dialog++;
       {
         const index=saved.dialogByPerson?.[person.key]||0;
         saved.dialogByPerson??={};saved.dialogByPerson[person.key]=index+1;
         const [line,answer]=recall(saved,person,Date.now())||dialogue(person,index,{bucket:movedBucket(),sector:section});
         appEvent(person.key==='mio'?'mio':person.key==='ren'?'dialog':'meeting');
         npcSays(person,line);respondLater(person,answer);
       }
       break;
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
 },automatic);
}
const descriptions={
 notice:[['Рассмотреть','notice']],
 wallArt:[['Рассмотреть','wallArt']],lamp:[['Переключить свет','lamp']],chair:[['Сесть','sit'],['Перенести','carry']],
 table:[['Открыть или закрыть ящик','desk']],cup:[['Взять кружку','cup']],
 window:[['Открыть или закрыть окно','window']],exit:[['Пройти','exit']],
 bed:[['Лечь спать','sleep'],['Присесть на край','sit']],pillow:[['Взбить','pillow']],blanket:[['Поправить','blanket']],
 npc:[['Заговорить','npc']],plant:[['Полить','plant']]
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
 return base||descriptions[o.kind]||activityNames[o.kind];
}
function select(o){
 const out=showSheet('item',o.name);
 if(editableFixture(o))out.append(label('Переставить на карте','','✥',()=>beginLayout(o)));
 const choices=[...actionsFor(o)].filter(([,action])=>action!=='carry');
 if(o.id===2||o.portable)choices.push(['Перенести','carry']);
 if(fixtureItems[o.id])choices.push(['Убрать в карман','pocketFixture']);
 for(const [name,action] of choices)out.append(label(name,'','◇',()=>perform(o,action)));
}
function floorAt(event){
 const rect=canvas.getBoundingClientRect();
 const x=(event.clientX-rect.left)*view.width/rect.width,y=(event.clientY-rect.top)*view.height/rect.height;
 let p=worldAtHeight(view,x,y);
 for(const z of [.54,.36,.18,.089,.082,.030,.023,0]){
   const q=worldAtHeight(view,x,y,z);
   if(Math.abs(surfaceAt(q.u,q.v)-z)<.001){p=q;break;}
 }
 return {x,y,p};
}
function pauseInitiative(){
 nextPastime=now()+30000;
 if(automaticWalk){move=[];onArrival=null;automaticWalk=false;walkSpeed=0;dirty=true;}
}
function tapAt(hit,longPress=false){
 if(!view||sheet)return;
 pauseInitiative();
 const {id,p}=hit;
 if(id!==EVA_ID)town.close();
 if(longPress&&(selectTarget||toyAim||dropAim))return;
 if(dropAim){
   const item=dropAim;
   const model=fixtureIds[item]&&districts.flatMap(place=>place.objects).find(o=>o.id===fixtureIds[item]);
   if(!canPlace(p.u,p.v,model?.w??.25,model?.d??.25,blocks)){
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
   if(blocks(p.u,p.v)&&!solidWall(p.u,p.v)){say('Туда улетит прямо в мебель. Целься в пол.');return;}
   flight=startFlight(toyAim,eva,p,now(),surfaceAt);toyAim=null;dirty=true;wake();return;
 }
 if(selectTarget){
   const o=selectTarget;
   if(!canPlace(p.u,p.v,o.w,o.d,blocks)){
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
 const door=doors.find(d=>d.id===id);
 if(door){
   const side=(door.vertical?eva.u-door.u:eva.v-door.v)>=0?-1:1;
   walkTo(door.u+(door.vertical?side*.53:0),door.v+(door.vertical?0:side*.53),()=>{
     if(door.residence)statusNote(side<0?'Почта. Здесь сортируют посылки.':'Жилой переулок.');
   });return;
 }
 const sleeper=citizens.find(n=>n.sleeping&&n.id===id);
 if(sleeper){say(sleeper.name+' спит. Пусть досмотрит серию.');return;}
 const picked=objectList().find(o=>o.id===id);
 if(picked){
   if(longPress){select(picked);return}
   const action=actionsFor(picked)[0][1];
   perform(picked,action);return;
 }
 if(longPress)return;
 const passer=townLife.visible.find(a=>a.id===id);
 if(passer){say(id===397?'У человека важная миссия. Судя по маршруту, за цветами.':id===218||id===217?'Пропущу машину. Бампер в диалогах не участвует.':passer.name==='Голубь'&&passer.lift>.15?'Вот у кого маршрут без светофоров.':passer.name==='Голубь'?'Шагает так, будто площадь на него записана.':'Кис-кис. Ушёл. Запишем это как успешные переговоры.');return;}
 if(id===15){town.tap();wake();return}
 if(id===251){say('Стена. Прошивка призрака пока не завезли.');return}
 if(id===252){say('Окно с видом. Я тут работу работаю, честно.');return}
 const invalid=blocks(p.u,p.v);
 const distance=Math.hypot(eva.u-p.u,eva.v-p.v);
 if(distance<.12&&!seated){sayAboutFloor(invalid,p.v);return}
 walkTo(p.u,p.v,()=>{if(invalid||distance>.65&&now()-lastFloorQuip>6500)sayAboutFloor(invalid,p.v)});
}
function sayAboutFloor(invalid,v){
 if(section==='beach'&&v>=district('beach').v+2){say(remark('edge'),'surprised');return}
 const lines=invalid?['Дальше пол занят. Подвинулась куда смогла.','Туда впишусь только в виде плоской текстуры.']:
 section==='beach'?['О, песок в кедах. Теперь у меня переносной пляж.','Новая точка, тот же песок. Масштабно погуляли.']:
 ['Дошла. Ноги официально в рабочем состоянии.','Скажи, что мы искали короткий путь к пельменям.','Новая точка. Если это было свидание, пол очень молчаливый.'];
 lastFloorQuip=now();say(lines[floorQuip++%lines.length]);
}
let layout=null;
function repaintLayout(){dirty=true;wake()}
function layoutHUD(message){
 const o=layout.object;
 $('layout-palette').hidden=!!o;$('layout-delete').hidden=!o?.decor||layout.newItem;
 $('layout-name').textContent=o?o.name:'Расстановка';
 $('layout-hint').textContent=message||(o&&layout.pan?'Потяни карту. Нажми «Обзор» ещё раз, чтобы поставить предмет.':o?'Коснись места или перетащи предмет':'Выбери предмет. Потяни пустое место, чтобы осмотреть карту.');
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
 closeSheet();town.close();pauseInitiative();
 move=[];onArrival=null;carrying=null;selectTarget=null;dropAim=null;toyAim=null;
 layout={undo:[],object:null,point:null,issue:'',gesture:null};
 $('screen').classList.add('arranging');$('layout-tools').hidden=false;
 if(o)chooseFixture(o);else layoutHUD();
}
function backLayout(){
 if(!layout)return false;
 if(sheet==='palette'){closeSheet();return true}
 if(layout.object){layout.object=null;layout.point=null;layout.issue='';layoutHUD();return true}
 layout=null;$('screen').classList.remove('arranging');$('layout-tools').hidden=true;
 center={...eva};last=now();repaintLayout();return true;
}
window.backLayout=backLayout;
$('layout-cancel').onclick=backLayout;
$('layout-pan').onclick=()=>{layout.pan=!layout.pan;layoutHUD(layout.pan?'Потяни карту для обзора':layout.issue)};
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
 for(const n of citizens)if(n.journey.length)n.journey=pathTo(n.journey.at(-1),n);
 layoutHUD('Последняя правка отменена');
};
function openPalette(){
 const out=showSheet('palette','Добавить предмет'),grid=node('div',null,'item-palette');out.append(grid);
 for(const [model,o] of catalog){
   const b=btn('','',()=>{
     closeSheet();let id=1024;const used=new Set(saved.decor.map(e=>e.id));while(used.has(id))id++;
     if(id>65534){layoutHUD('Каталог заполнен');return}
     const fresh={...o,id,model,decor:true,approach:null};chooseFixture(fresh);layout.newItem=true;layoutHUD();
   });
   const thumb=node('span'),key=[41,42,50].includes(model)?'catalog-'+model:o.art||(o.kind==='seasonTree'?'town-birch':o.poster);
   if(key){const f=propArt[key];thumb.style.backgroundImage='url(/art/'+(f?.[0]||key)+'.png)';
     if(f){const w=f[3]-f[1],h=f[4]-f[2];thumb.style.aspectRatio=String(f[5]);thumb.style.backgroundSize=100/w+'% '+100/h+'%';thumb.style.backgroundPosition=100*f[1]/(1-w)+'% '+100*f[2]/(1-h)+'%'}}
   else thumb.textContent=o.streetMesh?'▥':'◇';
   b.append(thumb,node('span',o.name));grid.append(b);
 }
}
$('layout-palette').onclick=openPalette;
$('layout-delete').onclick=()=>{
 const o=layout?.object;if(!o?.decor||layout.newItem)return;
 rememberPlacement(o);
 saved.decor=saved.decor.filter(e=>e.id!==o.id);delete saved.lamps[o.id];if(saved.houseUses)delete saved.houseUses[o.id];
 refreshObjects();storage();backLayout();
};
function setDestination(p){
 const o=layout.object;
 layout.point={u:Math.round((p.u-o.w/2)*20)/20,v:Math.round((p.v-o.d/2)*20)/20};
 layout.issue=placementIssue(o,layout.point,fixtures,doors,[eva,...citizens]);
 layoutHUD(layout.issue||'Место свободно');
}
$('layout-apply').onclick=()=>{
 const o=layout?.object,p=layout?.point;if(!o||!p)return;
 const issue=placementIssue(o,p,fixtures,doors,[eva,...citizens]);if(issue){layout.issue=issue;layoutHUD(issue);return}
 rememberPlacement(o);
 if(o.decor){const entry={model:o.model,id:o.id,turned:!!o.turned,back:!!o.back,...p};saved.decor=saved.decor.filter(e=>e.id!==o.id);saved.decor.push(entry);}
 else if(o.placementId!=null){
   const entry=saved.economy.placements.find(e=>e.id===o.placementId);if(!entry)return;
   Object.assign(entry,p);
 }else{saved.chairs??={};saved.chairs[o.id]={...p,turned:!!o.turned,back:!!o.back,world:true,sector:regionAt(p.u,p.v).key}}
 refreshObjects();storage();
 for(const n of citizens)if(n.journey.length)n.journey=pathTo(n.journey.at(-1),n);
 layout.newItem=false;layout.object=null;layout.point=null;layoutHUD('Сохранено. Можно выбрать следующий предмет.');
};
function layoutPointerDown(event){
 const hit=floorAt(event),id=renderer.pick(hit.x,hit.y,night,lamps,lighting);
 const picked=fixtures.find(f=>f.id===id);
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
 center={u:Math.max(extent.u0,Math.min(extent.u1,g.center.u+a.u-b.u)),v:Math.max(extent.v0,Math.min(extent.v1,g.center.v+a.v-b.v))};repaintLayout();
}
let hold=null;
function clearHold(){if(hold){clearTimeout(hold.timer);hold=null}}
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
canvas.addEventListener('pointercancel',()=>{if(layout)layout.gesture=null;clearHold()});
canvas.addEventListener('pointerleave',clearHold);
canvas.addEventListener('contextmenu',event=>{
 event.preventDefault();
 if(!hold||hold.long||hold.cancelled)return;
 hold.long=true;clearTimeout(hold.timer);
});

function paint(t=now()){
 view=renderer.prepare(center);
 paintCount++;
 sceneryFading=false;
 const terrain=terrainState(climate);
 const style=terrain.season+'-'+(terrain.snow?'snow':terrain.wet?'wet':'dry');
 lighting=paletteFor(climate,true);
 const sources=[];
  motionFrames={};
 const current=regionAt(eva.u,eva.v);
 const margin=focusedBuilding===current?.key ? .25 : -.06;
 focusedBuilding=insideBuilding(current,eva.u,eva.v,margin)?current.key:'';
 const coast=district('beach');
 const marginPx=view.scale*3;
 const nearby=districts.filter(plot=>inView(view,plot,SIZE/2+.5,4,marginPx));
 wavesVisible=!reduceMotion&&nearby.includes(coast)&&waveOnScreen(view,coast);
 const visible=nearby.map(plot=>{
   const building=buildings[plot.theme];
   const preload=!inView(view,plot,SIZE/2+.5,4,view.scale*.4);
   if(building){
     const [x,y,z]=building.light;
     sources.push([plot.u+x,plot.v+y,z,(plot.key===focusedBuilding ? .46 : .30)+night*.64]);
   }
   const windowStyle=plot.theme==='home'&&saved.window?'-window-open':'';
   return {...plot,preload,cacheKey:plot.key+'-'+style+windowStyle+(plot.key===focusedBuilding?'-inside':'')+(building&&climate.daylight<.65?'-lit':'')};
 });
 renderer.setLightingFocus({u:eva.u,v:eva.v,z:surfaceAt(eva.u,eva.v)+(seated?.sleep ? .77 : seated ? 1.09 : .81)},climate.daylight);
 renderer.reset();
 renderer.scenery([{key:'ground',cacheKey:'ground-'+style},...visible],plot=>{
   if(plot.key==='ground')drawSurroundings(renderer,extent,terrain);
   else drawScenery(renderer,plot,{...terrain,daylight:climate.daylight,occupied:plot.key===focusedBuilding},saved.window);
 });
 for(const door of doors){
   if(!inView(view,door,1.8,2.2,marginPx))continue;
   renderer.structure(()=>drawDoor(renderer,door,door.open));
 }
 renderer.setWavePhase(reduceMotion?0:(t*.00053)%(Math.PI*2));
 for(const plot of visible){
   if(plot.preload||plot.key!==focusedBuilding||!buildings[plot.theme])continue;
   const u=plot.u+buildings[plot.theme].sconce,v=plot.v-buildingEdge+.21;
   renderer.sprite(251,'amber-sconce',{u,v,z:1.76},.39,false,{bias:.03});
 }
 prints.draw(t,(p,strength)=>{
   if(inView(view,p,.2,.2,0))renderer.shadow({...p,z:surfaceAt(p.u,p.v)+.014},.06*strength,.12*strength);
 });
 townLife.draw(renderer,view,t||now(),reduceMotion);
 const objects=objectList(),heads=new Map();
 if(layout?.newItem&&layout.object&&layout.point)objects.push(layout.object);
 for(const original of objects){
   const o=layout?.object?.id===original.id&&layout.point?{...layout.object,...layout.point}:carrying===original.id?{...original,u:eva.u+.23,v:eva.v+.23}:original;
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
   if(o.kind==='npc'){
     const moving=o.journey.length>0&&o.speed>.025;
     const idle=standingPose(o.actor,o.direction);
     const painted=moving&&!reduceMotion?walkPose(o.actor,o.walkFacing||o.direction,o.stride):jobPose(o,t,reduceMotion)||idle;
     const step=renderer.artReady(painted.key)?painted:idle;
     const frame=step.key;
     const p=position3D(o);
     renderer.shadow({...p,z:p.z+.032},.27,.19);
     const breath=!reduceMotion&&!moving?Math.sin(t*.0022+o.id)*.003:0;
     const head=renderer.sprite(o.id,frame,p,o.height*(1+breath),step.flip,{...step,lean:breath*.8,cast:{ground:p.z,inside:insideBuilding(regionAt(p.u,p.v),p.u,p.v)}},true);
     if(step)motionFrames[o.id]=step;
     if(head)heads.set(o.id,head);
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
   if(o.kind==='pickup'&&!o.art){
     const p=position3D(o);
     renderer.box(o.id,p,o.w*.64,o.d*.64,o.visualHeight,o.tint||[.66,.65,.52]);
     continue;
   }
   const isLamp=o.kind==='lamp'||o.kind==='placedLamp';
   const lit=isLamp&&lampIsOn(o);
   if(lit){
     const shade=o.kind==='placedLamp'?.43:o.id===5?1.36:2.22;
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
       const stage=useFrame(o.kind,saved.houseUses?.[o.id]||0,gesture?.id===o.id?(t-gesture.start)/(gesture.until-gesture.start):null);
       const activeKey=(o.back?'reverse-use-':'use-')+o.kind+'-'+stage;
       if((stage||gesture?.id===o.id)&&renderer.artReady(activeKey)&&stage){
         key=activeKey;
         if(o.back&&o.kind==='fridge'){anchor=[anchor[0]*reverseCells['reverse-use-fridge'][1],anchor[1]];}
         else if(o.kind==='fridge'){height*=384/360;anchor=[anchor[0]*196/320,anchor[1]*360/384];}
       }
     }
     if(renderer.artReady(key)){
       if(!o.z&&carrying!==o.id&&o.solid!==false){
         renderer.shadow({u:p.u,v:p.v,z:p.z+.032},o.w*.52,o.d*.53);
       }
       const support=o.z&&fixtures.find(base=>base!==o&&!base.z&&base.solid!==false&&
         p.u>=base.u&&p.u<=base.u+base.w&&p.v>=base.v&&p.v<=base.v+base.d&&Math.abs(fixtureTop(base)-o.z)<.20);
       renderer.sprite(o.id,key,p,height,Boolean(o.artFlip),{
         anchor,widthScale:o.back?(renderer.artAspect(o.art)||1)/(renderer.artAspect('back-'+o.art)||1):1,
         cast:{support,ground:surfaceAt(o.u,o.v)+(support?fixtureTop(support):0),inside:insideBuilding(regionAt(o.u,o.v),o.u,o.v)},
         limits:[p.u+o.w*.5,p.v+o.d*.5,p.z+(o.surfaceHeight??height)]
       });
       if(o.kind==='table'&&(drawerOpen(o.id)||gesture?.id===o.id)){
         const fraction=gesture?.id===o.id?Math.min(1,Math.max(0,(t-gesture.start)/380)):1;
         const eased=fraction*fraction*(3-2*fraction);
         const openness=drawerOpen(o.id)?eased:1-eased;
         const drawerAt={u:o.u+o.w*.70,v:o.v+o.d+.07-(1-openness)*.25,z:p.z+(o.id===1?.49:.28)};
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
     if(o.kind==='table'&&drawerOpen(o.id)&&i>4)a.v+=.16;
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
 for(const person of citizens){
   if(!person.sleeping)continue;
   const bed=fixtures.find(o=>o.id===person.bed);
   if(!bed||!inView(view,bed,2.5,1.4,0))continue;
   const p={u:bed.u+bed.w*.48,v:bed.v+.29,z:.76};
   renderer.sleepingSprite(person.id,p,'sleep-'+person.key);
 }
 const rest=restMotion,sample=rest&&seatSample(rest,t,reduceMotion);
 const seat=rest?.seat,amount=sample?.amount??0;
 const target=seat?(seat.sleep?'sleep':'sit'):gesture?.motion||releaseMotion?.motion;
 const use=gesture?gestureAmount(gesture,t):releaseMotion?releaseMotion.from*(1-ease(Math.min(1,Math.max(0,(t-releaseMotion.start)/190)))):0;
 const pose=target?actionPose(rest?.facing||releaseMotion?.facing||direction,target,seat?amount:use):
   move.length&&!reduceMotion?evaPose(walkFacing,'walk',walkPhase):actionPose(direction,'idle',0,mood);
 const ready=renderer.artReady(pose.key),shown=ready?pose:{...standingPose('eva',direction),height:1.62};
 const at=position3D(eva),opt={...shown};
 if(seat){
   at.u=sample.u;at.v=sample.v;
   at.z=surfaceAt(at.u,at.v)+seat.height*amount;
   if(ready){
     const anchor=actionAnchors[pose.key][seat.sleep?'pillow':'seat'];
     opt.anchor=[.5+(anchor[0]-.5)*amount,gait.anchorY+(anchor[1]-gait.anchorY)*amount];
     if(seat.sleep){opt.bedPlane=at.z;opt.restAmount=amount;}else opt.bias=amount*seat.depth;
   }
 }
 if(!seat||amount<.05)renderer.shadow({...at,z:surfaceAt(at.u,at.v)+.032},.27,.21);
 opt.crown=actionAnchors[shown.key]?.heads[shown.row]?.[shown.column];
 if(!seat)opt.cast={ground:surfaceAt(at.u,at.v),inside:Boolean(focusedBuilding)};
 const breath=target||move.length||reduceMotion?0:Math.sin(t*.002)*.002;
 const head=renderer.sprite(EVA_ID,shown.key,at,shown.height*(1+breath+(seat?.sleep ? .14*amount : 0)),shown.flip,opt,true);
 motionFrames[EVA_ID]=shown;
 if(head)heads.set(EVA_ID,head);
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
 $('speech').hidden=Boolean(sheet);
 speech.layout(speechAnchors,canvas);
 const anchor=speechAnchors.get(EVA_ID);
 if(anchor)anchor.feetY=project(view,at).y*view.cssHeight/view.height;
 town.anchor(anchor,sheet);
}
function updateDoors(dt){
 for(const door of doors){
   const near=actor=>Math.hypot(actor.u-door.u,actor.v-door.v)<(door.open>.01?1.95:1.75);
   const target=near(eva)||townLife.passenger&&near(townLife.passenger)||citizens.some(n=>!n.sleeping&&near(n))?1:0;
   if(door.open===target)continue;
   door.open=reduceMotion?target:door.open+Math.sign(target-door.open)*Math.min(Math.abs(target-door.open),dt*3.2);
   dirty=true;
 }
}
function waitingForDoor(actor,path){
 const end=path[0],dx=end.u-actor.u,dy=end.v-actor.v;
 const k=Math.min(1,.15/Math.max(.001,Math.hypot(dx,dy)));
 const point={u:actor.u+k*dx,v:actor.v+k*dy,z:1};
 return doors.some(door=>door.open<.999&&Math.abs(door.u-actor.u)<1.8&&Math.abs(door.v-actor.v)<1.8&&hitsDoor(point,.12,door));
}
function wetStep(id,p,step,beat,t){
 if(reduceMotion)return;
 const plot=regionAt(p.u,p.v);
 const near=doors.some(d=>Math.hypot(p.u-d.u,p.v-d.v)<2.5);
 prints.step(id,p,step.du,step.dv,beat,t,raining(climate.weather),!insideBuilding(plot,p.u,p.v),near);
}
function advanceWalker(dt){
 if(restMotion||releaseMotion)return;
 if(!move.length||waitingForDoor(eva,move))return;
 const step=paceRoute(eva,move,dt,walkSpeed,1.62);
 walkSpeed=step.speed;
 walkFacing=walkHeading(step.du,step.dv,walkFacing);direction=walkFacing;walkPhase+=step.distance;trackDistrict();
 const beat=Math.floor(walkPhase/(gait.stride/2));
 if(beat!==lastStepIndex){
   lastStepIndex=beat;wetStep(EVA_ID,eva,step,beat,now());
   const t=terrainState(climate);
   footstep(!outdoors()?(buildings[section]?.tile==='slate'?'stone':'wood'):t.wet?'wet':t.snow?'snow':section==='beach'?'sand':
     ['park','garden','headland'].includes(section)?'grass':section==='pier'?'wood':'stone');
 }
 if(!move.length){if(!automaticWalk)nextPastime=now()+30000;automaticWalk=false;const callback=onArrival;onArrival=null;callback?.();storage();}
 dirty=true;
}
function startWork(person,t,entry){
 const choice=nextStation(person,entry[1],fixtures,citizens);if(!choice)return false;
 const [u,v]=around(choice.object,person),path=pathTo({u,v},person),end=path.at(-1)||person;
 if(Math.hypot(end.u-u,end.v-v)>.21)return false;
 person.job={id:choice.id,u,v,label:choice.label,seconds:choice.seconds};
 person.journey=path;person.doing='идёт к месту работы';person.wait=t+1000;
 return true;
}
function atStation(person,t){
 const job=person.job;if(!job||person.journey.length)return false;
 const o=fixtures.find(o=>o.id===job.id&&o.sector===person.entry[1]);
 if(!o||Math.hypot(person.u-job.u,person.v-job.v)>.29||
    Math.hypot(person.u-o.u-o.w*.5,person.v-o.v-o.d*.5)>Math.max(o.w,o.d)*.65+.75){
   person.job=null;person.wait=t+380;return false;
 }
 if(!job.arrived){
   Object.assign(job,{arrived:true,start:t,end:t+job.seconds*1000});
   person.direction=heading(o.u+o.w*.5-person.u,o.v+o.d*.5-person.v,person.direction);
   person.doing=job.label;person.speed=0;dirty=true;
   if(o.sector==='school'&&t>(person.nextStudioLine||10000)&&section==='school'&&Math.hypot(person.u-eva.u,person.v-eva.v)<4){
     const lines=o.id===61?['Свет по краю. Вот теперь похоже на стекло.','Только бы эту тень не замазать.']:o.id===64?['Ещё немного синей краски, и вода сама станет этюдом.','Чистая кисть. Чудеса водопровода.']:['Здесь была охра. О, нашлась.','Сверю оттенок на полях.'];
     npcSays(person,lines[(person.studioLine||0)%lines.length]);person.studioLine=(person.studioLine||0)+1;person.nextStudioLine=t+57000+person.id%9*1600;
   }
 }
 if(t<job.end)return true;
 person.job=null;person.wait=t+320;return false;
}
function advanceNPC(t,dt){
 const at=Date.now();
 for(const person of citizens){
   const entry=currentEntry(person.key,at);
   if(t<person.talking)continue;
   if(person.entry!==entry){
     person.job=null;person.sheltering=false;person.entry=entry;person.sleeping=false;person.doing=entry[4];
     const dest=worldPoint(entry[1],entry[2],entry[3]);
     person.journey=pathTo(dest,person);
     if(!person.journey.length)person.sleeping=!!entry[5]&&Math.hypot(person.u-dest.u,person.v-dest.v)<.45;
     dirty=true;
   }
   if(person.sleeping&&seated?.id===person.bed){leaveSeat();say('Кровать понадобилась. Уступаю место, пока меня не свернули вместе с пледом.');}
   const plot=regionAt(person.u,person.v),wet=raining(climate.weather);
   if(!wet&&person.sheltering){person.sheltering=false;person.wait=0;person.doing=entry[4];}
   if(wet&&!entry[5]&&!person.sheltering&&!person.journey.length&&plot?.key===entry[1]&&!insideBuilding(plot,person.u,person.v)&&t>=person.wait){
     const dest=shelterPoint(plot,person.id);
     if(dest&&!blocks(dest.u,dest.v)){
       const path=pathTo(dest,person),end=path.at(-1)||person;
       if(Math.hypot(end.u-dest.u,end.v-dest.v)<.38){person.job=null;person.journey=path;person.sheltering=true;person.doing='пережидает дождь под навесом';}
     }
   }
   if(atStation(person,t))continue;
   if(!person.job&&!person.sheltering&&!entry[5]&&!person.journey.length&&t>=person.wait&&
      !(plot?.key===entry[1]&&startWork(person,t,entry))){
     const local=person.spots.filter(spot=>spot[0]===entry[1]);
     person.wait=t+19000+(person.id%9)*1250;
     if(local.length){
       const point=local[person.index++%local.length];
       let dest=worldPoint(point[0],point[1],point[2]);
       person.doing=point[3];
       if(person.key==='mio'&&point[3]==='ищет ведро'){
         const bucket=fixtures.find(o=>o.id===72);
         if(bucket){const [u,v]=around(bucket,person);dest={u,v};}
         if(!person.noticed&&movedBucket()&&Math.hypot(person.u-eva.u,person.v-eva.v)<2.6){
           person.noticed=true;npcSays(person,'Ведро переехало. Даже у ведра планы на жизнь.');
         }
       }
       person.journey=pathTo(dest,person);
     }
   }
   if(!person.journey.length)continue;
   if(waitingForDoor(person,person.journey)){person.speed=0;continue;}
   const target=person.journey[0],du=target.u-person.u,dv=target.v-person.v,d=Math.hypot(du,dv);
   const peers=[eva,...citizens.filter(n=>n.id!==person.id&&!n.sleeping)];
   const nearest=peers.reduce((a,b)=>Math.hypot(a.u-person.u,a.v-person.v)<Math.hypot(b.u-person.u,b.v-person.v)?a:b);
   const gap=Math.hypot(person.u-nearest.u,person.v-nearest.v);
   if(gap<.43&&t>=person.yieldUntil&&d>.02){
     const offset={u:-dv/d*.24,v:du/d*.24};
     const sidestep=[1,-1].map(s=>({u:person.u+s*offset.u,v:person.v+s*offset.v}))
       .find(p=>peers.every(n=>Math.hypot(p.u-n.u,p.v-n.v)>gap)&&!blocks(p.u,p.v)
         &&!blocks((p.u+person.u)/2,(p.v+person.v)/2)
         &&surfaceAt(p.u,p.v)===surfaceAt(person.u,person.v));
     person.yieldUntil=t+850;
     if(sidestep){
       const onward=pathTo(person.journey.at(-1),sidestep);
       person.journey=[sidestep,...onward];
     }
   }
   const step=paceRoute(person,person.journey,dt,person.speed,1.15);
   person.speed=step.speed;
   person.walkFacing=walkHeading(step.du,step.dv,person.walkFacing||person.direction);
   person.direction=person.walkFacing;
   const beat=Math.floor(person.stride/(gait.stride/2));
   person.stride+=step.distance;
   const nextBeat=Math.floor(person.stride/(gait.stride/2));
   if(beat!==nextBeat)wetStep(person.id,person,step,nextBeat,t);
   if(!person.journey.length)person.wait=t+(entry[1]==='school'?650:9000+(person.id%9)*500);
   if(!person.journey.length&&entry[5]){
     const door=worldPoint(entry[1],entry[2],entry[3]);
     person.sleeping=Math.hypot(person.u-door.u,person.v-door.v)<.45;
   }
   if(Math.hypot(eva.u-person.u,eva.v-person.v)<9)dirty=true;
 }
}
let timer=0;
function wake(){
 if(!active||document.hidden||nextFrame)return;
 clearTimeout(timer);timer=0;
 nextFrame=requestAnimationFrame(loop);
}
function loop(t){
 nextFrame=0;
 if(!active||document.hidden)return;
 const elapsed=Math.max(.001,(t-last)/1000),dt=Math.min(.085,elapsed);last=t;
 if(releaseMotion&&t-releaseMotion.start>=190)releaseMotion=null;
 let rest=restMotion&&seatSample(restMotion,t,reduceMotion);
 if(rest?.complete&&!seated){restMotion=null;rest=null;dirty=true}
 const settling=rest&&!rest.complete;
 if(settling||releaseMotion)dirty=true;
 if(!sheet&&t>=nextWorldSync){syncWorld();nextWorldSync=t+2200}
 if(t>latestClock){pullClock();latestClock=t+5000;}
 if(!sheet&&!layout){
   updateDoors(dt);advanceWalker(dt);advanceNPC(t,dt);if(!reduceMotion)townLife.tick(Math.min(.35,elapsed),[eva,...citizens.filter(p=>!p.sleeping)],raining(climate.weather));

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
   if(autoFollow&&!move.length&&!carrying&&!flight&&!toyAim&&!dropAim&&!selectTarget&&!hold&&!reply){
     if(scheduled){
       const entry=scheduled;scheduled=null;
       const bed=fixtures.find(o=>o.kind==='bed');
       if(entry[5]&&bed)perform(bed,'sleep',true);
       else{
         const dest=worldPoint(entry[1],entry[2],entry[3]);
         walkTo(dest.u,dest.v,()=>{nextPastime=now()+1600;},true);
       }
     }else if(t>=nextPastime&&!seated?.sleep){
       const entry=currentEntry('eva',Date.now());
       const bed=entry[5]&&fixtures.find(o=>o.kind==='bed');
       nextPastime=t+15000;
       if(bed)perform(bed,'sleep',true);
       else{
         const cover=raining(climate.weather)&&outdoors()&&shelterPoint(district(section),0);
         if(cover&&!blocks(cover.u,cover.v)&&fullness(saved.economy,Date.now())>48){
           if(Math.hypot(cover.u-eva.u,cover.v-eva.v)>.27)walkTo(cover.u,cover.v,()=>{nextPastime=now()+23000;},true);
         }else{
         const choice=choosePastime(section,fixtures,saved,saved.pastimeCursor[section]||0,Date.now());
         if(choice){
           saved.pastimeCursor[section]=choice.next;
           perform(choice.object,choice.action,true,choice.item);
         }}
       }
     }
   }
 }
 const focus=rest||eva,u=focus.u-center.u,v=focus.v-center.v;
 if(!layout&&Math.hypot(u,v)>.006){
   const ease=reduceMotion?1:1-Math.exp(-dt*7.8);
   center.u+=u*ease;center.v+=v*ease;dirty=true;
 }
 if(gesture&&t>=gesture.until){gesture=null;dirty=true;}
 if(mood&&t>=moodUntil){mood=null;dirty=true;}
 if(reply&&t>=reply.at&&!sheet){
   const line=reply;reply=null;const person=citizen(line.speaker);if(person&&Math.hypot(person.u-eva.u,person.v-eva.v)<3.5)say(line.text,'wry');
 }
 if(speech.tick(t))dirty=true;
 const working=view&&!reduceMotion&&citizens.some(n=>n.job?.arrived&&inView(view,n,.5,1.8));
 const streetMoving=!reduceMotion&&(townLife.visible.length||townLife.nearTraffic(view));
 const precipitation=outdoors()&&['rain','storm','snow'].includes(climate.weather)&&!reduceMotion;
 const animated=!sheet&&(wavesVisible||streetMoving||working||precipitation);
 const ambientDue=animated&&t+1>=nextAmbientFrame;
 const moving=!sheet&&(move.length||flight||!layout&&Math.hypot(u,v)>.006||
   citizens.some(p=>p.journey.length&&Math.abs(p.u-eva.u)+Math.abs(p.v-eva.v)<12));
 const responsive=!sheet&&(releaseMotion||settling||sceneryFading||gesture||moving);
 const paintScene=dirty||!sheet&&(sceneryFading||Boolean(gesture)||ambientDue);
 if(paintScene){
   paint(t);dirty=false;
   nextAmbientFrame=t+1000/30;
 }
 if(!sheet&&(precipitation?paintScene:t>=lastAir)){
   air.draw(t,climate,outdoors());
   ambience(climate.weather,section,outdoors());
   lastAir=t+(reduceMotion?210:1000/30);
 }
 if(responsive)wake();
 else if(!nextFrame){
   const delay=sheet?750:animated?Math.max(8,nextAmbientFrame-t-8):
     speech.waiting||mood||reply?75:300;
   timer=setTimeout(wake,delay);
 }
}

window.homeSheetChanged=()=>{
 $('speech').hidden=Boolean(sheet);
 if(sheet)air.clear();
 else{last=now();dirty=true;nextAmbientFrame=0}
 wake();
};

function updateHomeVisibility(){
 const visible=nativeActive&&!document.hidden;
 if(active===visible)return;
 active=visible;
 town.active(active);audioVisible(active);
 if(active){
   if(suspendedAt&&Math.floor(Date.now()/900000)>Math.floor(suspendedAt/900000)){
     settleResidents(Date.now(),true);reply=null;speech.clear();
   }
   suspendedAt=0;last=now();pullClock();wake();
 }else{
   air.clear();suspendedAt=suspendedAt||Date.now();storage();
   cancelAnimationFrame(nextFrame);clearTimeout(timer);nextFrame=timer=0;
 }
}
window.setHomeActive=value=>{nativeActive=Boolean(value);updateHomeVisibility()};
window.addEventListener('resize',()=>{dirty=true;wake()});
canvas.addEventListener('art',()=>{dirty=true;wake()});
document.addEventListener('visibilitychange',updateHomeVisibility);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();statusNote('Графика приостановлена. Папки доступны.')});
canvas.addEventListener('webglcontextrestored',()=>location.reload());

$('places').onclick=()=>{
 const out=showSheet('places','Куда пойдём?');
 out.append(label(autoFollow?'Расписание включено':'Включить расписание',
   'Ева сама ходит по делам, занимается предметами и ложится спать','◷',()=>{
   autoFollow=!autoFollow;localStorage.setItem('followSchedule',autoFollow?'yes':'no');
   if(!autoFollow){scheduled=null;pauseInitiative();}previousSlot=-1;pullClock();closeSheet();wake();
 }));
 const grid=node('div',null,'district-map');
 const firstColumn=Math.min(...districts.map(d=>d.column)),firstRow=Math.min(...districts.map(d=>d.row));
 const width=1+Math.max(...districts.map(d=>d.column))-firstColumn;
 grid.style.gridTemplateColumns='repeat('+width+',minmax(49px,1fr))';
 const short={home:'Дом',lane:'Дома',terrace:'Сквер',courtyard:'Двор',garden:'Сад',square:'Площадь',shop:'Лавка',promenade:'Берег'};
 for(const plot of districts){
   const b=btn(short[plot.key]||plot.title,'',()=>{scheduled=null;closeSheet();navigate(plot.key)});
   b.setAttribute('aria-label',plot.title);
   b.style.gridColumn=String(plot.column-firstColumn+1);b.style.gridRow=String(plot.row-firstRow+1);
   b.setAttribute('aria-current',String(plot.key===section));grid.append(b);
 }
 const plan=node('img');plan.src='town-map.svg';plan.alt='План кварталов, тротуаров и пешеходных переходов';plan.style.width='100%';out.append(plan,grid);
 out.append(label('Распорядок жителей','Занятия и сон по Москве','◷',()=>{
   const panel=showSheet('schedules','Распорядок');
   for(const person of Object.values(routines)){
     const group=document.createElement('details');
     group.append(node('summary',person.name));
     for(const [hour,place,,,activity] of person.entries){
       group.append(node('p',String(hour).padStart(2,'0')+':00 · '+activity+' · '+district(place).title));
     }
     panel.append(group);
   }
 }));
};
$('interact').onclick=()=>{
 const out=showSheet('decor','Вокруг');
 out.append(label('Расстановка','Переместить мебель и городской декор','✥',()=>beginLayout()),label('Палитра предметов','Добавить предмет в город','＋',()=>{beginLayout();openPalette()}));
 if(carrying||dropAim||toyAim)out.append(label('Отменить действие','','×',()=>{closeSheet();perform(null,'cancel')}));
 for(const o of objectList(section))out.append(label(o.name,o.kind==='npc'?o.doing||'':'','◇',()=>select(o)));
 for(const [name,kind] of [['Мяч','ball'],['Бумажный самолётик','plane']])out.append(label(name,'Выбери, куда запустить','›',()=>{
   closeSheet();flight=null;move=[];onArrival=null;carrying=null;selectTarget=null;dropAim=null;toyAim=kind;
   say('Ткни в пол. Кому прилетит — чисто случайность.');
 }));
};
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
 out.append(label('Погода города в сцене',(weatherOptions.cityFallback!==false?'Включена':'Выключена')+' · Open-Meteo, если в виджете нет условий','☁',()=>{
   weatherOptions.cityFallback=weatherOptions.cityFallback===false;delete weatherOptions.weather;saved.weatherOptions=weatherOptions;storage();pullClock();openWeather();wake();
 }));
 choices('weather','Погода в сцене',Object.entries(weathers).map(([key,v])=>[key,v.name]));
 appendSoundControls(out,openWeather);
}
window.openHomeSound=()=>{
 const out=showSheet('sound','Звуки города');
 appendSoundControls(out,window.openHomeSound);
};
function appendSoundControls(out,refresh){
 out.append(label(saved.sound?'Звук включён':'Звук выключен','Улица, осадки, шаги и предметы','♪',()=>{
   saved.sound=!saved.sound;soundSettings(saved.sound,saved.volume??.42);storage();refresh();wake();
 }));
 const volume=node('label',null,'sound-level'),bar=node('input',null);
 bar.type='range';bar.min='0';bar.max='100';bar.value=String(Math.round((saved.volume??.42)*100));
 volume.append(node('span','Громкость'),bar);
 bar.oninput=()=>{saved.volume=Number(bar.value)/100;soundSettings(saved.sound,saved.volume);};
 bar.onchange=storage;
 out.append(volume);
}
$('toys').onclick=openTimeline;
$('wallet').onclick=openInventory;
function openInventory(){
 const out=showSheet('inventory','Карман');
 const summary=node('div',null,'stock-summary');
 summary.append(node('strong',saved.economy.coins+' мон.'),node('span','Сытость '+Math.round(fullness(saved.economy,Date.now()))+'%'));out.append(summary);
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

function openTimeline(){
 pullClock();
 const out=showSheet('timeline','Что было');
 const live=timeline.live!==false;
 out.append(label(live?'Фоновое расписание включено':'Включить фоновое расписание',
  live?'Android обновляет события города в фоне':'События обновляются при открытии рабочего стола','◷',()=>{
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
 return {section,climate,lighting,motionFrames,paintCount,wavesVisible,sceneryFading, doors:doors.map(({id,u,v,open})=>({id,u,v,open})),focusedBuilding,activeLights:Array.from(lamps).filter((strength,i)=>i%4===3&&strength>0).length,cameraScale,cameraOffset,sound:audioState(),outdoors:outdoors(),anchors:Object.fromEntries(speechAnchors),move:move.length,direction,pose:seated?.sleep?'sleep':seated?'sit':move.length?'walk':gesture?.motion||'idle',center,eva,depth:renderer.depthBits,sizeConstant:Math.abs(close-far)<.0001,
    lamp:saved.lamps,chairs:saved.chairs,dialog:saved.dialog,flight:flight?.kind||null,citizens:citizens.map(({id,name,u,v,doing,sleeping})=>({id,name,u,v,doing,sleeping})),economy:saved.economy,level:surfaceAt(eva.u,eva.v),timeline:JSON.parse(Desk.timeline())};
};
$('place').textContent=section==='shop'?'Лавка':district(section).title;
soundSettings(Boolean(saved.sound),saved.volume??.42);
document.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(saved.sound&&button){prepareSound();sound(button.closest('#town-compose')?'chatTap':'uiTap');}
},true);
for(const p of citizens){
 renderer.artReady('walk-'+p.key);
}
for(const key of ['walk-eva','act-eva-front','act-eva-rear','desk-drawer','amber-sconce','closed-umbrella','folded-throw'])renderer.artReady(key);
refreshObjects();publishHUD();last=now();pullClock();paint();storage();wake();
