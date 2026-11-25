import test from 'node:test';
import assert from 'node:assert/strict';
import {districts,worldObjects} from '../../../app/src/main/assets/home/district.mjs';
import {turnFixture} from '../../../app/src/main/assets/home/prop-finish.mjs';
import {blocksActor} from '../../../app/src/main/assets/home/contact.mjs';
import {doorsFor} from '../../../app/src/main/assets/home/buildings.mjs';
import {witness,recall} from '../../../app/src/main/assets/home/witness.mjs';
import {useFrame} from '../../../app/src/main/assets/home/household.mjs';
import {shelterPoint,stepPrints} from '../../../app/src/main/assets/home/rain-life.mjs';
import {streetLife} from '../../../app/src/main/assets/home/street-life.mjs';
import {camera} from '../../../app/src/main/assets/home/camera.mjs';

test('a reloaded bench uses its rotated footprint, seat facing and illustrated side',()=>{
 const base=worldObjects({}).find(o=>o.id===114),turned=turnFixture(base);
 const loaded=worldObjects({chairs:{114:{world:true,u:1,v:2,sector:'street',turned:true}}}).find(o=>o.id===114);
 for(const k of ['parts','artFlip','w','d','seatDirection'])assert.deepEqual(loaded[k],turned[k]);
 assert.deepEqual([loaded.w,loaded.d],[base.d,base.w]);
 assert.deepEqual(turnFixture(loaded).parts,base.parts);
});
test('only a nearby awake witness can recall the event after saving, once',()=>{
 const state={},point={u:2,v:2},p={...point,key:'mio',sector:'shop'};
 const others=[{...p,key:'kir',u:20},{...p,key:'ren',sector:'lane'},{...p,key:'asya',sleeping:true}];
 witness(state,'bouquet',point,[p,...others],'shop',100);
 assert.deepEqual(Object.keys(state.witnesses),['mio']);
 witness(state,'bouquet',point,[p],'shop',150);
 const save=JSON.parse(JSON.stringify(state));
 assert.equal(recall(save,p,200),null);assert.match(recall(save,p,40100)[0],/букет/);
 assert.equal(recall(save,p,50100),null);
});
test('kitchen action endpoints and saved privacy screen agree with the animation',()=>{
 assert.equal(useFrame('fridge',1,.5),8);assert.equal(useFrame('fridge',1,1),0);
 for(const kind of ['screen','basin','fridge'])for(let n=1;n<=3;n++)assert.equal(useFrame(kind,n,1),useFrame(kind,n,null));
 assert.equal(useFrame('screen',1,null),8);assert.equal(useFrame('screen',2,null),0);
});
test('rain shelters have open slots, and tracked-in footprints dry up',()=>{
 const fixtures=worldObjects({}),doors=doorsFor(districts).map(d=>({...d,open:1}));
 for(const plot of districts)for(let i=0;i<5;i++){
   const p=shelterPoint(plot,i);
   if(p)assert.equal(blocksActor(p.u,p.v,fixtures,doors),false,plot.key+' '+i);
 }
 const trail=stepPrints(),p={u:1,v:2},sizes=[];
 trail.step(15,p,1,0,1,100,true,true,true);
 trail.step(15,p,1,0,2,200,true,false,true);
 trail.draw(200,(p,k)=>sizes.push(k));assert.equal(sizes.length,2);assert(sizes[0]>sizes[1]);
 trail.draw(12000,()=>assert.fail('expired print'));
});
test('rain stops both cats under shelter, and the florist car unloads then yields and leaves',()=>{
 const scene=streetLife(),view=camera({width:1200,height:1200,pixelsPerMeter:4});
 const renderer=new Proxy({},{get:()=>()=>{}});
 const frame=()=>{scene.draw(renderer,view,0,false);return Object.fromEntries(scene.visible.map(o=>[o.id,o]))};
 let parked,passenger;
 for(let i=0;i<800;i++){
   scene.tick(.1,[],true);
   if(scene.passenger){parked=frame()[217];passenger={...scene.passenger};break;}
 }
 assert(parked);assert(Math.abs(parked.v-2.72)<.03);assert(parked.u>7.9);
 scene.tick(.2,[],true);assert(scene.passenger.stride>passenger.stride);
 for(let i=0;i<120;i++)scene.tick(.1,[{u:7.7,v:.25}],true);
 const a=frame();assert.equal(scene.passenger,null);assert(a[217].v>1.5&&a[217].v<parked.v);
 for(let i=0;i<15;i++)scene.tick(.1,[{u:7.7,v:.25}],true);
 const b=frame();
 for(const id of [219,220,217])assert.deepEqual([a[id].u,a[id].v],[b[id].u,b[id].v]);
 for(const [id,key] of [[219,'lane'],[220,'garden']]){
   const roof=worldObjects({}).find(o=>o.kind==='shelter'&&o.sector===key);
   assert(a[id].u>roof.u&&a[id].u<roof.u+roof.w&&a[id].v>roof.v&&a[id].v<roof.v+1.04);
 }
 for(let i=0;i<12;i++)scene.tick(.1,[],false);
 const c=frame();assert(c[217].v<b[217].v);for(const id of [219,220])assert(c[id].distance>b[id].distance);
});
