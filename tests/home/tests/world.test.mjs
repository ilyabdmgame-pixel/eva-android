import {streetFurniture} from '../../../app/src/main/assets/home/street-furniture.mjs';
import test from 'node:test';
import {blocksActor} from '../../../app/src/main/assets/home/contact.mjs';
import assert from 'node:assert/strict';
import {accessSync,readFileSync} from 'node:fs';
import {bubblePosition} from '../../../app/src/main/assets/home/speech.mjs';
import {floorHeight} from '../../../app/src/main/assets/home/places.mjs';
import {gait,heading,evaPose,walkPose} from '../../../app/src/main/assets/home/orientation.mjs';
import {districts,regionAt,worldPoint,surfaceAt,waterAt,solidWall,worldObjects,route,roundRoute,followRoute,paceRoute} from '../../../app/src/main/assets/home/district.mjs';
import {climateAt,seasons,weathers,seasonFor,terrainState,widgetWeather} from '../../../app/src/main/assets/home/weather.mjs';
import {initialEconomy,apply,fullness,items,fixtureItems} from '../../../app/src/main/assets/home/economy.mjs';
import {createCitizens,dialogue,people} from '../../../app/src/main/assets/home/citizens.mjs';
import {camera,project,worldAtHeight} from '../../../app/src/main/assets/home/camera.mjs';
import {buildingEdge,buildings,insideBuilding,wallAt,drawBuilding} from '../../../app/src/main/assets/home/buildings.mjs';
import {waveOnScreen} from '../../../app/src/main/assets/home/scenery.mjs';
import {propArt} from '../../../app/src/main/assets/home/prop-art.mjs';

test('a visible balloon sits above its speaker, including at the screen edge',()=>{
  const screen={w:369,h:812},size={w:170,h:52};
  for(const x of [27,184,341]){
    const head={x,y:418},box=bubblePosition(head,size,screen,[]);
    assert(box);
    assert.equal(box.x+box.tail,x);
    assert(box.y+box.h<head.y);
    assert(box.x>=8&&box.x+box.w<=screen.w-8);
  }
  assert.equal(bubblePosition({x:-10,y:410},size,screen,[]),null);
});

test('balloons avoid the launcher controls and other visible balloons',()=>{
  const screen={w:369,h:812},size={w:170,h:52};
  const first=bubblePosition({x:184,y:408},size,screen,[]);
  const second=bubblePosition({x:241,y:402},size,screen,[first]);
  assert(second&&second.y+second.h<=first.y);
  const toolbar={x:0,y:0,w:369,h:104};
  assert.equal(bubblePosition({x:184,y:91},size,screen,[toolbar]),null);
});

test('the shared map has a walkable path to all eighteen districts',()=>{
  assert.equal(districts.length,18);
  const fixtures=worldObjects({chairs:{}});
  assert.equal(new Set(fixtures.map(o=>o.id)).size,fixtures.length);
  const blocked=(u,v)=>!regionAt(u,v)||waterAt(u,v)||solidWall(u,v)||fixtures.some(o=>o.solid!==false&&
    u>o.u-.12&&u<o.u+o.w+.12&&v>o.v-.12&&v<o.v+o.d+.12);
  const start=worldPoint('home',.18,.95);
  for(const d of districts){
    const end=worldPoint(d.key,...d.start),nodes=route(start,end,blocked);
    assert(nodes.length>0,d.key);
    const point=nodes.at(-1);
    assert.equal(regionAt(point.u,point.v).key,d.key);
    assert(nodes.every(p=>!blocked(p.u,p.v)));
    assert(Math.max(...nodes.slice(1).map((p,i)=>Math.hypot(p.u-nodes[i].u,p.v-nodes[i].v)))<.5);
    assert(nodes.slice(1,-1).every((p,i)=>p.u===nodes[i].u||p.v===nodes[i].v));
    const smooth=roundRoute(start,nodes,blocked);
    assert(smooth.every(p=>!blocked(p.u,p.v)),d.key);
    assert.equal(smooth.at(-1),point);
  }
});

test('movement preserves leftover distance through route nodes at different frame rates',()=>{
  const path=[{u:.23,v:0},{u:.46,v:0},{u:.46,v:.23},{u:.46,v:.46}];
  const low={u:0,v:0},high={u:0,v:0};
  const a=followRoute(low,[...path],.54);
  const b=[...path];
  for(let i=0;i<3;i++)followRoute(high,b,.18);
  assert.equal(a.du,0);
  assert(a.dv>0);
  assert(Math.abs(low.u-high.u)<1e-9&&Math.abs(low.v-high.v)<1e-9);
  const exact={u:.40,v:0},nodes=route({u:0,v:0},exact,()=>false);
  assert(nodes.every(node=>node.u<=exact.u));
  assert.equal(followRoute({u:.412,v:0},[{u:.40,v:0}],.15).du,0);
  let checks=0;
  const betweenCells={u:.805,v:.115};
  const toward=route({u:0,v:0},betweenCells,()=>{checks++;return false;});
  assert.deepEqual(toward.at(-1),betweenCells);
  assert(checks<100,'A goal between grid cells should not scan the map');
});

test('walking builds up speed and stops at the same destination across frame rates',()=>{
  for(const dt of [1/60,1/30,.085]){
    const walker={u:0,v:0};
    const target={u:2,v:.45};
    const path=[{u:2,v:0},target];
    const speeds=[];
    let speed=0;
    for(let i=0;path.length&&i<300;i++){
      ({speed}=paceRoute(walker,path,dt,speed,1.62));
      speeds.push(speed);
    }
    assert(speeds[0]<.4);
    assert(speeds[1]>speeds[0]);
    assert(speeds.includes(1.62));
    assert(speeds.at(-2)<.5);
    assert.equal(speeds.at(-1),0);
    assert.deepEqual(walker,target);
  }
});

test('walking rounds open bends and retains the original bend beside a barrier',()=>{
  const start={u:0,v:0},corner={u:.23,v:0},end={u:.23,v:.23};
  const rounded=roundRoute(start,[corner,end],()=>false);
  assert(rounded.some(p=>p.u<corner.u&&p.v>corner.v));
  assert.equal(rounded.at(-1),end);
  assert.deepEqual(roundRoute(start,[corner,end],(u,v)=>u<corner.u&&v>corner.v),[corner,end]);
});

test('walls, windows and open thresholds share the building footprint in both camera views',()=>{
  for(const plot of districts.filter(d=>buildings[d.theme])){
    const [u,v]=[plot.u,plot.v];
    assert(insideBuilding(plot,u,v));
    assert(!insideBuilding(plot,u+buildingEdge+.2,v));
    for(const viewMode of ['interior','exterior','neighbour']){
      const masonry=[];
      const renderer={box:(id,p,w,d,h)=>id===251&&p.z===0&&h>.15&&masonry.push({p,w,d}),panel(){},artPanel(){},shadeBand(){},triangle(){}};
      drawBuilding(renderer,{...plot,viewMode},{daylight:1},false);
      for(const [side,holes] of buildings[plot.theme].sides.entries()){
        for(const hole of holes){
          const fixed=buildingEdge*(side<2?-1:1),vertical=side===1||side===2;
          const at=along=>vertical?[fixed,along]:[along,fixed];
          const [x,y]=at(hole.at);
          for(const along of [hole.at-.35,hole.at,hole.at+.35])assert.equal(wallAt(plot.theme,...at(along)),hole.kind==='window');
          const present=masonry.some(({p,w,d})=>u+x>p.u&&u+x<p.u+w&&v+y>p.v&&v+y<p.v+d);
          assert.equal(present,hole.kind==='window',plot.key+' '+viewMode+' '+side);
        }
      }
    }
  }
  accessSync(new URL('../../../app/src/main/assets/home/art/building-materials.jpg',import.meta.url));
});

test('woodwork around doors and windows does not overlap a visible face at the same depth',()=>{
  for(const plot of districts.filter(d=>buildings[d.theme])){
    for(const viewMode of ['exterior','interior','neighbour'])for(const windowOpen of [false,true]){
      const volumes=[];
      const renderer={box(id,p,w,d,h){
        if(id&&h>0)volumes.push({a:[p.u,p.v,p.z],b:[p.u+w,p.v+d,p.z+h]});
      },panel(){},artPanel(){},shadeBand(){}};
      drawBuilding(renderer,{...plot,viewMode},{daylight:0},windowOpen);
      for(const [i,a] of volumes.entries())for(const b of volumes.slice(i+1)){
        for(const axis of [0,1,2]){
          const samePlane=Math.abs(a.b[axis]-b.b[axis])<1e-8;
          const area=[0,1,2].filter(d=>d!==axis).every(d=>Math.min(a.b[d],b.b[d])-Math.max(a.a[d],b.a[d])>.005);
          assert(!(samePlane&&area),plot.key+' '+viewMode+' repeats a visible face');
        }
      }
    }
  }
});

test('roofs have pitched slopes, an overhang and an underside in every building',()=>{
  for(const plot of districts.filter(d=>buildings[d.theme])){
    const panels=[];
    drawBuilding({box(){},artPanel(){},shadeBand(){},panel(points,tint,material){panels.push({points,material})}},plot,{daylight:1},false);
    const roof=panels.filter(p=>p.points.every(v=>v[2]>2.7));
    assert(roof.some(p=>Math.max(...p.points.map(v=>v[2]))-Math.min(...p.points.map(v=>v[2]))>.5),plot.key);
    assert(roof.some(p=>p.points.some(v=>Math.abs(v[0]-plot.u)>buildingEdge+.15)),plot.key);
    assert(roof.some(p=>p.material==='oak'&&p.points.every(v=>v[2]===p.points[0][2]))||panels.some(p=>p.material==='oak'&&p.points.every(v=>Math.abs(v[2]-2.669)<.001)),plot.key);
  }
});
test('water wave animation uses the visible camera bounds',()=>{
  const beach=districts.find(d=>d.key==='beach');
  const viewAt=(u,v)=>camera({width:400,height:850,pixelsPerMeter:70,u,v});
  assert(waveOnScreen(viewAt(beach.u,beach.v),beach));
  assert(!waveOnScreen(viewAt(-16,-8),beach));
});

test('old local and new global furniture positions reopen at the right addresses',()=>{
 const old=worldObjects({chairs:{72:{u:.8,v:1.2}}}).find(o=>o.id===72);
 const moved=worldPoint('cafe',.74,.82);
 const newer=worldObjects({chairs:{72:{...moved,world:true,sector:'cafe'}}}).find(o=>o.id===72);
 assert.equal(old.u,worldPoint('shop',.8,1.2).u);
 assert.equal(old.v,1.2);
 assert.deepEqual([newer.u,newer.v,newer.sector],[moved.u,moved.v,'cafe']);
});
test('screen rays round trip through each beach level',()=>{
  const view=camera({width:738,height:1624,pixelsPerMeter:150,u:.28,v:.17});
  for(const v of [-2,-.9,-.6,0,1.9]){
    const z=floorHeight('beach',v),{x,y}=project(view,{u:.47,v,z});
    const hit=worldAtHeight(view,x,y,z);
    assert(Math.abs(hit.u-.47)<1e-9&&Math.abs(hit.v-v)<1e-9);
  }
});

test('each movement heading has a sprite for each interaction pose',()=>{
  for(const [u,v,name] of [[1,0,'down-right'],[-1,0,'up-left'],[0,1,'down-left'],[0,-1,'up-right']]){
    assert.equal(heading(u,v),name);
    for(const phase of [0,1])for(const action of ['idle','walk','reach','stoop','sit']){
      const pose=evaPose(name,action,phase);
      accessSync(new URL('../../../app/src/main/assets/home/art/'+pose.key+'.png',import.meta.url));
    }
  }
});

test('all six walkers have eight painted distance-driven poses in each view',()=>{
  for(const actor of ['eva',...people.map(p=>p.key)]){
    const png=readFileSync(new URL('../../../app/src/main/assets/home/art/walk-'+actor+'.png',import.meta.url));
    assert.equal(png.readUInt32BE(16),gait.columns*(actor==='eva'?210:160));
    assert.equal(png.readUInt32BE(20),gait.rows*(actor==='eva'?252:192));
    for(const [direction,row,flip] of [['down-right',0,false],['down-left',0,true],['up-right',1,false],['up-left',1,true]]){
      const columns=Array.from({length:gait.frames},(_,i)=>i);
      const poses=columns.map(i=>walkPose(actor,direction,(i+.5)*gait.stride/gait.frames));
      assert.deepEqual(poses,columns.map(column=>({key:'walk-'+actor,row,flip,column})));
      assert.deepEqual(walkPose(actor,direction,gait.stride+.01),poses[0]);
    }
  }
});

test('every textured prop in each location has an exported image',()=>{
  const physical=worldObjects({chairs:{}}).filter(o=>!['window','seasonTree'].includes(o.kind));
  const portable=new Set(Object.values(fixtureItems));
  const loose=Object.entries(items).filter(([key])=>!portable.has(key)).map(([,item])=>item);
  for(const object of [...physical,...loose]){
    const authoredMesh=Object.values(streetFurniture).flat().some(o=>o.id===object.id);
    if(authoredMesh)assert(object.parts.length&&object.parts.every(p=>p.a>0&&p.b>0&&p.h>0),object.name);
    const key=object.poster||object.art;
    if(authoredMesh&&!key)continue;
    assert(key,object.name);
    const sheet=propArt[key]?.[0]??key;
    accessSync(new URL('../../../app/src/main/assets/home/art/'+sheet+'.png',import.meta.url));
  }
});

test('finished props and alternate poses lie within packed transparent atlas cells',()=>{
  for(const [name,frame] of Object.entries(propArt)){
    const [sheet,u0,v0,u1,v1,aspect]=frame;
    const bytes=readFileSync(new URL('../../../app/src/main/assets/home/art/'+sheet+'.png',import.meta.url));
    assert(bytes[25]===6,name+' must carry RGBA');
    assert(u0>=0&&v0>=0&&u1<=1&&v1<=1&&u0<u1&&v0<v1&&aspect>0,name);
  }
  for(const key of ['folded-throw','closed-umbrella','desk-drawer','attic-rug','amber-sconce'])assert(propArt[key],key);
  const lifted=worldObjects({chairs:{2:{world:true,u:.7,v:9.2,sector:'cafe'}}}).find(o=>o.id===2);
  assert.equal(lifted.art,'desk-chair');
  assert.equal(lifted.sector,'cafe');
  assert.equal(lifted.seatDirection,'down-right');
});

test('work consumes supplies, pays once, and can be repeated after restocking',()=>{
 const t=1_000_000;
 const a=initialEconomy(null,{},t);
 const b=apply(a,{type:'make',item:'bouquet'},t).state;
 assert.equal(b.stock.ribbon,undefined);
 const payment=apply(b,{type:'sell',item:'bouquet'},t);
 assert(payment.ok);assert.equal(payment.state.coins,10);
 assert(!apply(payment.state,{type:'sell',item:'bouquet'},t).ok);
 const refill=apply(payment.state,{type:'buy',item:'ribbon'},t).state;
 assert(apply(refill,{type:'make',item:'bouquet'},t).ok);
 assert(!apply(a,{type:'buy',item:'lamp'},t).ok);
 assert.equal(a.coins,4);
});

test('dropped items round-trip without duplication, even after serializing a save',()=>{
 const t=1_000_000;
 let state=initialEconomy(null,{pickedShell:true},t);
 state=apply(state,{type:'drop',item:'shell',u:8,v:9},t).state;
 assert.equal(state.stock.shell,undefined);
 state=JSON.parse(JSON.stringify(state));
 const id=state.placements[0].id;
 state=apply(state,{type:'pickup',item:'shell',id},t).state;
 assert.equal(state.stock.shell,1);
 assert.equal(state.placements.length,0);
 assert(!apply(state,{type:'pickup',item:'shell',id},t).ok);
});

test('hunger persists and a broke hungry player can return to work',()=>{
 const t=1_000_000;
 const a={...initialEconomy(null,{},t),stock:{},coins:0,fullness:14};
 const later=t+4_500_000;
 assert(fullness(a,later)<10);
 assert(!apply(a,{type:'shift'},later).ok);
 const fed=apply(a,{type:'break'},later);
 assert(fed.ok);
 const paid=apply(fed.state,{type:'shift'},later);
 assert(paid.ok&&paid.state.coins===3);
 assert(!apply(paid.state,{type:'shift'},later+1).ok);
 const food=apply(paid.state,{type:'buy',item:'bun'},later);
 assert(food.ok&&!food.state.coins);
 const meal=apply(food.state,{type:'eat',item:'bun'},later);
 assert(meal.ok&&meal.state.fullness>paid.state.fullness);
});

test('all five residents have repeatable local conversation decks',()=>{
 const residents=createCitizens(12);
 assert.equal(residents.length,5);
 for(const person of residents){
   assert(regionAt(person.u,person.v));
   const variants=new Set([0,1,2,3].map(i=>dialogue(person,i,{sector:'home'})[0]));
   assert.equal(variants.size,4);
 }
});

test('boardwalk surfaces share the same world scale',()=>{
 assert.equal(surfaceAt(14,12.4),.54);
 assert.equal(surfaceAt(14,13.2),.36);
 assert.equal(surfaceAt(14,14.1),0);
 assert(waterAt(14,16.2));
});

test('railings block the posts and leave the central passage to the pier clear',()=>{
  assert(solidWall(25.7,17.68));
  assert(solidWall(30.3,17.68));
  assert(!solidWall(28,17.68));
});

test('a packed fixture is absent from the map',()=>{
 assert(!worldObjects({chairs:{},packed:{72:true}}).some(o=>o.id===72));
 assert(worldObjects({chairs:{},packed:{72:false}}).some(o=>o.id===72));
});


test('season follows Moscow dates and changes at the correct local boundary',()=>{
  const before=new Date('2026-02-28T20:59:00Z');
  const after=new Date('2026-02-28T21:00:00Z');
  assert.equal(climateAt(before).season,'winter');
  assert.equal(climateAt(after).season,'spring');
  assert.equal(seasonFor(8),'summer');
  assert.equal(seasonFor(11),'autumn');
});

test('weather is deterministic, seasonal, and honors independent local selections',()=>{
  for(const date of ['2026-01-02T12:00Z','2026-05-03T18:00Z','2026-08-02T08:00Z']){
    const t=new Date(date);
    assert.deepEqual(climateAt(t),climateAt(new Date(date)));
    const forced=climateAt(t,{season:'winter',weather:'snow'});
    assert.equal(forced.season,'winter');
    assert.equal(forced.weather,'snow');
    assert(terrainState(forced).snow);
    assert(typeof weathers[climateAt(t,{season:'bad',weather:'wrong'}).weather]==='object');
  }
  assert(terrainState(climateAt(new Date('2026-06-01T12:00Z'),{weather:'rain'})).wet);
});

test('all four seasonal trees and weather terrain were packed',()=>{
  for(const season of Object.values(seasons))accessSync(new URL('../../../app/src/main/assets/home/art/'+season.trees+'.png',import.meta.url));
  accessSync(new URL('../../../app/src/main/assets/home/art/terrain.jpg',import.meta.url));
});

test('dock work pays its own wage and foraging adds a seasonal item with a cooldown',()=>{
   const now=1_000_000,s=initialEconomy(null,{},now);
   const dock=apply(s,{type:'shift',site:'pier'},now);
   assert(dock.ok&&dock.state.coins===8);
   assert(!apply(dock.state,{type:'shift',site:'pier'},now).ok);
   assert(apply(dock.state,{type:'shift',site:'street'},now).ok);
   const gather=apply(dock.state,{type:'forage',item:'pinecone'},now);
   assert(gather.ok&&gather.state.stock.pinecone===1);
   assert(!apply(gather.state,{type:'forage',item:'pinecone'},now+5_000).ok);
});

test('land and tall objects enter the preload margin before crossing a portrait viewport',async()=>{
 const {inView}=await import('../../../app/src/main/assets/home/camera.mjs');
 for(const height of [600,840,1000]){
   const view=camera({width:390,height,pixelsPerMeter:67,u:-8,v:0});
   for(const radius of [.5,4.4]){
     let warmed=false,visible=false;
     for(let i=0;i<400;i++){
       const o={u:-28+i*.06,v:-20+i*.06};
       const warm=inView(view,o,radius,4,3*view.scale);
       const draw=inView(view,o,radius,4,.4*view.scale);
       if(draw&&!visible)assert(warmed);
       warmed=warm;visible=draw;
     }
     assert(visible);
   }
 }
});

test('the room schedule stays indoors and legacy entrances have unique door IDs',async()=>{
 const {doorsFor}=await import('../../../app/src/main/assets/home/buildings.mjs');
 const {inRoom}=await import('../../../app/src/main/assets/home/room.mjs');
 const doors=doorsFor(districts);
 assert.equal(new Set(doors.map(d=>d.id)).size,doors.length);
 assert.equal(doors.length,Object.values(buildings).flatMap(b=>b.sides.flat()).filter(h=>h.kind==='door').length+1);
 const plans=JSON.parse(readFileSync(new URL('../../../app/src/main/assets/home/routines.json',import.meta.url)));
 assert.deepEqual(Object.keys(plans),['eva']);
 const objects=worldObjects({chairs:{}});
 const blocked=(u,v)=>!inRoom(u,v,.17)||solidWall(u,v)||objects.some(o=>o.solid!==false&&u>o.u-.12&&u<o.u+o.w+.12&&v>o.v-.12&&v<o.v+o.d+.12);
 for(const {entries} of Object.values(plans)){
   assert.equal(entries.filter(a=>a[5]).length,1);
   assert.deepEqual(entries.map(a=>a[0]),entries.map(a=>a[0]).sort((a,b)=>a-b));
   let previous=entries.at(-1);
   for(const row of entries){
     assert.equal(row[1],'home');
     const target=worldPoint(row[1],row[2],row[3]);
     assert(!blocked(target.u,target.v));
     const path=route(worldPoint(previous[1],previous[2],previous[3]),target,blocked);
     assert.deepEqual(path.at(-1),target);
     previous=row;
   }
 }
});

test('Eva chooses available local activities and respects inventory, hunger and sold work',async()=>{
 const {choosePastime}=await import('../../../app/src/main/assets/home/pastimes.mjs');
 const at=Date.parse('2026-11-20T10:00:00+03:00');
 const saved={economy:initialEconomy(null,{},at)};
 const objects=worldObjects({chairs:{}});
 for(const plot of districts){
   const targets=new Set();
   let cursor=0;
   for(let i=0;i<12;i++){
     const choice=choosePastime(plot.key,objects,saved,cursor,at);
     assert.equal(choice.object.sector,plot.key);
     targets.add(choice.object.id);cursor=choice.next;
   }
   assert(targets.size>=2,plot.key);
 }
 const pick=(where,i=0)=>choosePastime(where,objects,saved,i,at);
 assert.equal(pick('school').action,'draw');
 saved.economy=apply(saved.economy,{type:'make',item:'drawing'},at).state;
 assert.equal(pick('school').action,'wash');
 assert.equal(pick('school',2).action,'sellDrawing');
 assert.equal(choosePastime('school',objects.filter(o=>o.id!==64),saved,1,at).action,'sellDrawing');
 saved.economy.fullness=25;
 assert.equal(pick('cafe').item,'bun');
 delete saved.economy.stock.bun;
 assert.equal(pick('cafe').action,'coffee');
 saved.economy.coins=0;saved.economy.fullness=3;
 assert.equal(pick('cafe').action,'staffSnack');
});

test('actor billboards preserve the source aspect after projection',async()=>{
 const {project,camera,actorBillboardSpan}=await import('../../../app/src/main/assets/home/camera.mjs');
 const view=camera({width:380,height:830,pixelsPerMeter:68});
 for(const aspect of [.42,160/192,.96]){
   const h=1.62,span=actorBillboardSpan(h,aspect);
   const foot=project(view,{u:0,v:0}),top=project(view,{u:0,v:0,z:h});
   const right=project(view,{u:span/2,v:-span/2});
   assert(Math.abs((right.x-foot.x)*2/(foot.y-top.y)-aspect)<1e-9);
 }
});

test('toy sweeps catch walls on a skipped frame and use the rotating door leaf',async()=>{
 const {startFlight,advanceFlight,hitsDoor}=await import('../../../app/src/main/assets/home/toys.mjs');
 const {doorsFor}=await import('../../../app/src/main/assets/home/buildings.mjs');
 const from=worldPoint('home',0,1.5),to=worldPoint('home',0,buildingEdge+1);
 for(const kind of ['ball','plane']){
   const flight=startFlight(kind,from,to,0);
   const result=advanceFlight(flight,3500,p=>solidWall(p.u,p.v));
   assert(flight.impact);assert(result.v<buildingEdge&&result.phase===1);assert.equal(result.v,flight.to.v);
 }
 const door=doorsFor(districts).find(d=>d.sector==='home'&&d.vertical&&d.sign===1);
 const check=open=>{
   const start={u:door.u-.7,v:door.v},end={u:door.u+.7,v:door.v};
   const flight=startFlight('ball',start,end,0);
   advanceFlight(flight,2200,(p,r)=>solidWall(p.u,p.v)||hitsDoor(p,r,{...door,open}));
   return flight;
 };
 assert(check(0).impact);
 assert(!check(1).impact);
});

test('widget separates current readings from location, clock and forecast',()=>{
  assert.deepEqual(widgetWeather(['area=Нижегородский район','19:27','Максимум 5°']),{weather:null,temperature:null,area:'Нижегородский район'});
  assert.deepEqual(widgetWeather(['Облачно','Дождь','−3°C','Завтра 4°']),{weather:'rain',temperature:'−3°',area:null});
  assert.equal(widgetWeather(['Мин. 3°','10° / 4°','32℉']).temperature,'32°F');
});

test('every placed fixture has a reachable interaction point outside the collision footprint',async()=>{
 const {approach,blocksActor}=await import('../../../app/src/main/assets/home/contact.mjs');
 const {doorsFor}=await import('../../../app/src/main/assets/home/buildings.mjs');
 const fixtures=worldObjects({}),doors=doorsFor(districts).map(d=>({...d,open:1}));
 const blocked=(u,v)=>blocksActor(u,v,fixtures,doors);
 for(const plot of districts){
   const start=worldPoint(plot.key,...plot.start);
   for(const o of fixtures.filter(o=>o.sector===plot.key)){
     const [u,v]=approach(o,start,blocked),end={u,v};
     assert(!blocked(u,v),'blocked approach '+o.id+' '+o.name);
     const path=route(start,end,blocked);
     assert(Math.hypot((path.at(-1)??start).u-u,(path.at(-1)??start).v-v)<.025,'unreachable '+o.id+' '+o.name);
     let previous=start;
     for(const p of roundRoute(start,path,blocked)){
       const samples=Math.max(1,Math.ceil(Math.hypot(p.u-previous.u,p.v-previous.v)/.025));
       for(let i=1;i<=samples;i++){
         const k=i/samples;
         assert(!blocked(previous.u+(p.u-previous.u)*k,previous.v+(p.v-previous.v)*k),'route clips fixture on approach to '+o.id);
       }
       previous=p;
     }
   }
 }
});
test('sprite front and top share the same projected silhouette and stop at the support surface',async()=>{
 const {surfaceTriangles}=await import('../../../app/src/main/assets/home/occlusion.mjs');
 const corners=[[-1,1,1],[1,-1,1],[1,-1,-1],[-1,1,-1]],limits=[.4,.7,.53];
 const vertices=surfaceTriangles(corners,[0,0,1,1],limits);
 assert(vertices.length>=6);
 for(const [u,v,z,s,t] of vertices){
   const x=2*s-1,up=1-2*t;
   assert(Math.abs((u-x)-(v+x))<1e-8&&Math.abs((u-x)-(z-up))<1e-8);
   assert(Math.abs(Math.min(limits[0]-u,limits[1]-v,limits[2]-z))<1e-8);
 }
 const aboveFloor=surfaceTriangles(corners,[0,0,1,1],limits,.04);
 assert(aboveFloor.every(p=>p[2]>=.04-1e-9));
 assert(aboveFloor.every(([u,v,z,s,t])=>
   Math.abs(u-v-(4*s-2))<1e-8&&Math.abs(u+v-2*z-(4*t-2))<1e-8));
});
test('placement checks the whole footprint and projectiles hit furniture at its own elevation',async()=>{
 const {canPlace,hitsFixture}=await import('../../../app/src/main/assets/home/contact.mjs');
 assert(!canPlace(0,0,1,1,(u,v)=>Math.abs(u-.5)<.07&&Math.abs(v-.5)<.07));
 const bed=worldObjects({}).find(o=>o.kind==='bed'),pt={u:bed.u+.3,v:bed.v+.6,z:.32};
 assert(hitsFixture(pt,.09,bed));
 assert(!hitsFixture({...pt,z:1.4},.09,bed));
});

test('town grid migrates saved locations and pocket placements exactly once',async()=>{
 const {migrateTown}=await import('../../../app/src/main/assets/home/town-plan.mjs');
 const save={lastLocation:{u:-8.3,v:.2},chairs:{2:{u:.5,v:.8},72:{world:true,sector:'pier',u:16.44,v:15.83}},economy:{coins:19,placements:[{id:18,u:-16.25,v:-8.88}]}};
 assert(migrateTown(save));
 const expected=worldPoint('garden',-.25,-.88);
 assert.equal(save.economy.placements[0].u,expected.u);
 assert(Math.abs(save.economy.placements[0].v-expected.v)<1e-8);
 assert.equal(save.lastLocation.u,-14.3);
 assert.equal(save.chairs[72].u,28.44);
 assert.deepEqual(save.chairs[2],{u:.5,v:.8});
 const previous=structuredClone(save);assert(!migrateTown(save));assert.deepEqual(save,previous);
});
test('car remains on asphalt through every turn and walkers can use every marked crossing',async()=>{
 const {vehicleAt}=await import('../../../app/src/main/assets/home/street-life.mjs');
 const {roads,streetSurface,crossing,walkingRestricted}=await import('../../../app/src/main/assets/home/town-plan.mjs');
 for(let at=0;at<100;at+=.08){
   const a=vehicleAt(at),b=vehicleAt(at+.08);
   assert.equal(streetSurface(a.u,a.v),'road');assert(regionAt(a.u,a.v));
   assert(Math.hypot(b.u-a.u,b.v-a.v)<.081);
 }
 const fixtures=worldObjects({}),blocked=(u,v)=>blocksActor(u,v,fixtures,[]);
 for(const road of roads)for(const pos of road.cross){
   const h=road.axis==='u',at=d=>h?{u:pos,v:road.at+d}:{u:road.at+d,v:pos};
   const src=at(-2.35),dest=at(2.35),path=route(src,dest,blocked);
   assert.deepEqual(path.at(-1),dest);
   for(const p of path)if(streetSurface(p.u,p.v)==='road')assert(crossing(p.u,p.v));
 }
 assert(walkingRestricted(-24,-7));
});
test('separate sleeping addresses connect to shifts over pedestrian routes',async()=>{
 const routines=JSON.parse(readFileSync(new URL('../../../app/src/main/assets/home/routines.json',import.meta.url)));
 const fixtures=worldObjects({}),blocked=(u,v)=>blocksActor(u,v,fixtures,[]);
 const assigned=new Set();
 for(const [key,{entries}] of Object.entries(routines)){
   const bed=entries.find(e=>e[5]),prev=entries[entries.indexOf(bed)-1];
   const start=worldPoint(prev[1],prev[2],prev[3]),end=worldPoint(bed[1],bed[2],bed[3]);
   assert(!assigned.has(JSON.stringify(end)));assigned.add(JSON.stringify(end));
   assert.deepEqual(route(start,end,blocked).at(-1),end,key);
 }
});
test('city forecast has a source timestamp and expires offline',async()=>{
 const {cityReading}=await import('../../../app/src/main/assets/home/weather.mjs');
 const t=1700000000000;
 assert.equal(cityReading({degrees:1.3,code:71,at:t},t+300000).weather,'snow');
 assert(cityReading({degrees:1.3,code:71,at:t},t+2*3600000).stale);
 assert.equal(cityReading({degrees:1.3,code:71,at:t},t+7*3600000),null);
 assert.equal(cityReading({},t),null);
 const cloudy=cityReading({degrees:-2.3,code:3,at:t},t);
 assert.equal(cloudy.temperature,'-2 °C');
 assert.equal(cloudy.description,'пасмурно');
 assert.equal(cityReading({degrees:3,code:60,at:t},t),null);
});

test('exterior stone and interior skirting have distinct faces, and closed leaves clear both jambs',async()=>{
  const {doorsFor}=await import('../../../app/src/main/assets/home/buildings.mjs');
  for(const plot of districts.filter(d=>buildings[d.theme])){
    const faces=[];
    drawBuilding({box(){},shadeBand(){},artPanel(){},panel(points,tint,mat){faces.push({points,mat});}},plot,{daylight:1},false);
    const stone=faces.filter(f=>f.mat==='slate'&&f.points[0][2]===.26);
    const skirts=faces.filter(f=>f.mat==='oak'&&f.points[0][2]===.11);
    assert(stone.length&&skirts.length);
    for(const {points} of stone){
      const axis=points[0][0]===points[1][0]?0:1;
      assert(skirts.every(f=>!f.points.every(p=>Math.abs(p[axis]-points[0][axis])<1e-5)));
    }
    for(const [side,openings] of buildings[plot.theme].sides.entries()){
      for(const h of openings.filter(h=>h.kind==='door')){
        const leaf=doorsFor([plot]).find(d=>d.vertical===(side===1||side===2)&&d.sign===(side<2?-1:1)&&Math.abs((d.vertical?d.v-plot.v:d.u-plot.u)-h.at)<.001);
        assert(leaf);assert(leaf.width>h.width-.15&&leaf.width<h.width-.104);
      }
    }
  }
});
test('the desk feet and worktops align after a move or quarter turn',async()=>{
 const {furnitureCorners,furnitureSurface}=await import('../../../app/src/main/assets/home/occlusion.mjs');
 const at={u:-11.37,v:1.82,z:.16};
 for(const flip of [false,true]){
   const size=flip?[.72,1.62]:[1.62,.72];
   const [a,b,,d]=furnitureCorners('writing-desk',at,size,flip);
   const local=([s,t])=>a.map((value,i)=>value+s*(b[i]-value)+t*(d[i]-value));
   for(const [sprite,[x,y]] of [[[.054,.683],[.03,.95]],[[.722,.993],[.97,.95]],[[.953,.841],[.97,.05]]]){
     const [u,v,z]=local(sprite);
     const [du,dv]=flip?[(y-.5)*size[0],(x-.5)*size[1]]:[(x-.5)*size[0],(y-.5)*size[1]];
     assert(Math.abs((u-v)-(at.u+du-at.v-dv))<1e-8);
     assert(Math.abs((u+v-2*z)-(at.u+du+at.v+dv-2*at.z))<1e-8);
   }
 }
 const cabinet=furnitureSurface('tv-cabinet',[.53,.45],false);
 const rotated=furnitureSurface('tv-cabinet',[.45,.53],true);
 assert(cabinet.height>.30&&cabinet.height<.36);
 assert(Math.abs(cabinet.height-rotated.height)<1e-8);
 assert(Math.abs(cabinet.shift+rotated.shift)<1e-8);
});
test('roof texture axes follow the slope across both triangles and either winding',async()=>{
  const {faceUV}=await import('../../../app/src/main/assets/home/material-uv.mjs');
  const pts=[[0,0,3],[4,0,3],[3,2,4],[1,2,4]];
  const uv=faceUV(pts,true);
  for(const order of [[0,2,3],[2,1,0],[1,2,3]]){
    const triangle=faceUV(order.map(i=>pts[i]),true);
    for(const [j,i] of order.entries()){
      assert(Math.hypot(triangle[j][0]-uv[i][0],triangle[j][1]-uv[i][1])<1e-9);
    }
  }
  assert(Math.abs(Math.abs(uv[0][1]-uv[2][1])-Math.sqrt(5))<1e-9);
});
test('directional shadows point behind the subject and respect the edges of supporting furniture',async()=>{
  const {clipToReceiver,shadowOffset,wallShadow}=await import('../../../app/src/main/assets/home/lighting.mjs');
  const bands=[],height=2.5;
  wallShadow({shadeBand:p=>bands.push(p)},0,0,3,3,height);
  for(const [a,b,end] of bands){
    const [du,dv]=shadowOffset(height);
    assert(du<0&&dv<0);
    assert(Math.abs(end[0]-b[0]-du)<1e-9&&Math.abs(end[1]-b[1]-dv)<1e-9);
  }
  const clipped=clipToReceiver([[-1,-1,1,0,0],[3,-1,1,1,0],[3,3,1,1,1],[-1,3,1,0,1]],{u:0,v:0,w:1,d:1});
  assert.equal(clipped.length,4);
  for(const [x,y,z,s,t] of clipped){
    assert(x>=0&&x<=1&&y>=0&&y<=1&&z===1);
    assert.equal(s,(x+1)/4);assert.equal(t,(y+1)/4);
  }
});

test('street actors follow their nose through corners; birds take off and land smoothly',async()=>{
 const {vehicleAt,animalAt}=await import('../../../app/src/main/assets/home/street-life.mjs');
 const {blocksActor}=await import('../../../app/src/main/assets/home/contact.mjs');
 const fs=worldObjects({});
 const {streetSurface}=await import('../../../app/src/main/assets/home/town-plan.mjs');
 for(let i=0;i<7;i++){
   let grounded=false,airborne=false;
   const sample=t=>i<2?vehicleAt(t,i===1):animalAt(i-2,t);
   for(let t=0;t<65;t+=.079){
     const a=sample(t),b=sample(t+.001);
     const dx=b.u-a.u,dy=b.v-a.v,len=Math.hypot(dx,dy);
     assert((dx*a.du+dy*a.dv)/len>.998,'heading drift '+i);
     if(i<2){
       for(const x of [-1.35,1.35])for(const y of [-.62,.62])
         assert.equal(streetSurface(a.u+x*a.du-y*a.dv,a.v+x*a.dv+y*a.du),'road','corner rides kerb');
       continue;
     }
     if(a.lift<.25)assert(!blocksActor(a.u,a.v,fs,[]),'animal intersects street furniture '+i);
     if(a.lift<.00001)grounded=true;
     if(a.lift>1.5&&a.spread>.8)airborne=true;
     assert(Math.abs(b.z-a.z)<.003,'vertical jump '+i);
   }
   if(i>=2)assert(grounded);
   if(i>=4)assert(airborne);
 }
});
test('street furniture clears walls, driving lanes and ramps in each district',async()=>{
 const {streetSurface,crossing}=await import('../../../app/src/main/assets/home/town-plan.mjs');
 const {insideBuilding}=await import('../../../app/src/main/assets/home/buildings.mjs');
 for(const [key,objects] of Object.entries(streetFurniture))for(const o of objects){
   for(const x of [0,.5,1])for(const y of [0,.5,1]){
     const p=worldPoint(key,o.u+x*o.w,o.v+y*o.d);
     assert(!insideBuilding(regionAt(p.u,p.v),p.u,p.v,.08)&&!solidWall(p.u,p.v)&&!waterAt(p.u,p.v),o.name+' '+key);
     assert(!['road','kerb'].includes(streetSurface(p.u,p.v))&&!crossing(p.u,p.v),o.name+' '+key);
   }
 }
});
