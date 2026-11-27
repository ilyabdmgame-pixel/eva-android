import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {camera,project,worldAtHeight} from '../../../app/src/main/assets/home/camera.mjs';
import {roomCamera,visibleRoomWalls,bindRoomCamera} from '../../../app/src/main/assets/home/room-camera.mjs';
import {fixtureFrame,roomMesh} from '../../../app/src/main/assets/home/room-mesh.mjs';
import {collectMesh,rasterMesh,sampleRoomPaint} from '../../../app/src/main/assets/home/mesh-preview.mjs';
import {roomMaterials} from '../../../app/src/main/assets/home/room-materials.mjs';
import {worldObjects,worldPoint,district} from '../../../app/src/main/assets/home/district.mjs';
import {roomFurniture,roomApproach,roomWindowFixture,fitsRoom,attachedPosition} from '../../../app/src/main/assets/home/room.mjs';
import {roomWalk} from '../../../app/src/main/assets/home/room-walk.mjs';
import {roomSeat} from '../../../app/src/main/assets/home/seat-motion.mjs';
import {roomFurnishings,studioRoomDecor,originalRoomDecor,computerLayout,streamChair} from '../../../app/src/main/assets/home/room-furnishings.mjs';
import {placementIssue} from '../../../app/src/main/assets/home/layout.mjs';
import {nextTurn} from '../../../app/src/main/assets/home/prop-finish.mjs';

const close=(a,b)=>Math.abs(a-b)<1e-8;

test('painted furnishings keep their local grain after moving or turning and sample only their atlas cell',()=>{
  const finishes=Object.entries(roomMaterials);
  assert.deepEqual([...new Set(finishes.map(([,m])=>m.cell))].sort((a,b)=>a-b),Array.from({length:16},(_,n)=>n));
  const atlas={width:32,data:new Uint8Array(32*32*4)};
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const start=4*(y*32+x),index=(x>>3)+4*(y>>3);
    for(let c=0;c<3;c++)atlas.data[start+c]=25+index*12;
  }
  const corners=[[.28,.12,.4],[.63,.12,.4],[.64,.77,.4],[.29,.77,.4]];
  for(const [key,material] of finishes){
    for(const [turned,back] of [[false,false],[true,false],[false,true],[true,true]]){
      const o={id:100,u:-24.32,v:7.37,z:.2,w:turned?.8:1,d:turned?1:.8,turned,back};
      const [face]=collectMesh(renderer=>roomMesh(renderer,o).face(corners,[.68,.69,.74],key,false));
      assert.deepEqual(face.uv,corners.map(p=>p.slice(0,2)),key);
      const grain=sampleRoomPaint(face,1,.23,.43,.34,atlas,[0,0,0]);
      assert(Math.abs(grain[1]/face.paintTint[1]-(25+12*material.cell))<1e-5,key);
      const local=fixtureFrame(o);
      assert(face.points.every((p,i)=>local.local(p).every((v,j)=>close(v,corners[i][j]))),key);
    }
  }
});

test('all camera yaws share the same inverse touch ray, world height and depth order',()=>{
  for(let degrees=-360;degrees<=720;degrees+=7.5){
    const yaw=roomCamera({yaw:degrees*Math.PI/180,zoom:1.17}).yaw;
    const view=camera({width:430,height:913,pixelsPerMeter:77,u:-14,v:.28,yaw});
    for(const z of [0,.44,.8,1.4,2.76]){
      const at={u:-12.4,v:1.28,z},p=project(view,at),pick=worldAtHeight(view,p.x,p.y,z);
      assert(close(pick.u,at.u)&&close(pick.v,at.v));
      const along={u:at.u+Math.cos(yaw),v:at.v+Math.sin(yaw),z:z+Math.SQRT1_2};
      const front=project(view,along);
      assert(close(front.x,p.x)&&close(front.y,p.y)&&front.depth>p.depth);
    }
  }
  const opposite=[45,135,225,315].map(n=>visibleRoomWalls(n*Math.PI/180));
  assert.deepEqual(opposite,[{u:true,v:true},{u:false,v:true},{u:false,v:false},{u:true,v:false}]);
  assert.equal(roomCamera({zoom:7}).zoom,1.45);
  assert.equal(roomCamera({zoom:-3}).zoom,.75);
});

test('depth buffer picks the near triangle independently of batching order or viewpoint',()=>{
  for(const yaw of [0,.29,Math.PI/4,Math.PI,4.81]){
    const view=camera({width:24,height:24,pixelsPerMeter:11,yaw});
    const p=[[-.6,-.4],[.7,-.43],[0,.75]].map(([x,y])=>worldAtHeight(view,12+11*x,12+11*y));
    const face=distance=>({id:distance>0?22:11,tint:[.3,.5,.7],points:p.map(({u,v})=>
      [u+Math.cos(yaw)*distance,v+Math.sin(yaw)*distance,Math.SQRT1_2*distance])});
    for(const layers of [[face(1),face(0)],[face(0),face(1)]]){
      const ids=new Uint16Array(24*24);
      rasterMesh(layers,view,new Uint8ClampedArray(24*24*4),null,ids);
      assert.equal(ids[12*24+12],22);
    }
  }
});

test('the restored or rotated PC and chair continue to face each other in all four orientations',()=>{
  const fixtures=roomFurniture(worldObjects({})),original=fixtures.get(1);
  let desk={...original,u:-16.3,v:1.12};
  for(let i=0;i<4;i++,desk=nextTurn(desk,true)){
    const pc=attachedPosition(fixtures.get(27),original,desk),chair=attachedPosition(fixtures.get(streamChair.id),original,desk);
    const frame=fixtureFrame(desk),screen=computerLayout(pc)(.595,.09,.36);
    const center=frame.local([chair.u+chair.w/2,chair.v+chair.d/2,.51]);
    const display=frame.local([screen.u,screen.v,screen.z]);
    assert(center[1]>frame.depth&&display[1]<frame.depth);
    assert(Math.abs(center[0]-display[0])<.08);
    assert.equal(roomSeat({...chair,kind:'streamChair'},{blocked:()=>false,clear:()=>true}).facing,
      ['up-right','up-left','down-left','down-right'][i]);
    const p=frame.point(.08,.22,.54),back=frame.local(p);
    assert(back.every((n,j)=>close(n,[.08,.22,.54][j])));
  }
});

test('the furnished floor leaves every activity, sleep entrance and stream chair reachable',()=>{
  const activityFile=new URL('../../../app/src/main/assets/home/room-activities.json',import.meta.url);
  const activities=JSON.parse(readFileSync(activityFile));
  const fixtures=[...roomFurniture(worldObjects({})).values()].map(o=>o.kind==='window'?roomWindowFixture(o):o);
  const start=worldPoint('home',...district('home').start);
  for(const [model,u,v] of [...originalRoomDecor,...studioRoomDecor]){
    const item={...roomFurnishings.find(f=>f.id===model),...worldPoint('home',u,v)};
    assert(fitsRoom(item.u,item.v,item.w,item.d),item.name);
    assert.equal(placementIssue(item,item,fixtures,[],[start],true),'',item.name);
    fixtures.push(item);
  }
  const walk=roomWalk(fixtures);
  for(const [key,activity] of Object.entries(activities)){
    const target=fixtures.find(f=>f.id===activity.fixture);
    const support=key==='computer'?fixtures.find(f=>f.id===streamChair.id):activity.rest?target:null;
    const seat=support&&roomSeat(support,walk,fixtures.find(f=>f.id===10),activity.rest==='bed');
    if(support)assert(seat,key);
    const p=target&&roomApproach(target,fixtures,start,(u,v)=>walk.blocked({u,v}));
    const goal=seat?.stand??(p?{u:p[0],v:p[1]}:worldPoint('home',...activity.spot));
    assert(!walk.blocked(goal),key);
    const path=walk.path(start,goal,true),last=path.at(-1)??start;
    assert(Math.hypot(last.u-goal.u,last.v-goal.v)<.025,key);
    assert(path.every((p,i)=>walk.clear(path[i-1]??start,p)),key);
  }
});

test('a two-finger camera drag commits once; lifting the first or adding a third finger never taps furniture',()=>{
  const previous=globalThis.window,win=new EventTarget(),canvas=new EventTarget(),captured=new Set();
  globalThis.window=win;
  try{
    canvas.clientWidth=420;
    canvas.setPointerCapture=id=>captured.add(id);canvas.hasPointerCapture=id=>captured.has(id);
    canvas.releasePointerCapture=id=>captured.delete(id);
    let pose=roomCamera(),released=0,writes=0,roomTaps=0;
    const cancel=bindRoomCamera(canvas,{enabled:()=>true,read:()=>pose,write:(p,save)=>{pose=p;if(save)writes++;},releaseTouch:()=>released++});
    canvas.addEventListener('pointerup',()=>roomTaps++);
    const touch=(type,id,x=0,y=0)=>{
      const event=new Event(type,{cancelable:true});
      Object.assign(event,{pointerId:id,pointerType:'touch',clientX:x,clientY:y});
      canvas.dispatchEvent(event);
    };
    touch('pointerdown',1,100,220);touch('pointerup',1);assert.equal(roomTaps,1);
    touch('pointerdown',3,130,220);touch('pointerdown',4,230,220);touch('pointermove',4,270,241);
    assert(pose.zoom>1.3);assert.equal(released,1);
    touch('pointerup',3);touch('pointerdown',5,210,250);touch('pointerup',4);
    assert.equal(writes,1);assert.equal(roomTaps,1);cancel();assert.equal(writes,1);
    touch('pointerdown',8,153,100);touch('pointerdown',9,263,108);win.dispatchEvent(new Event('blur'));
    assert.equal(writes,2);assert(!captured.has(8)&&!captured.has(9));
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
