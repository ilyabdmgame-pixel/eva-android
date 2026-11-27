import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('returning from Android overview clears a stale modal lock even when its logical sheet was lost',()=>{
 const elements=new Map(),events=new Map();
 const get=id=>{
   if(!elements.has(id))elements.set(id,{
     hidden:true,inert:false,dataset:{},focus(){},contains(){return false;},
     addEventListener(){},replaceChildren(){},style:{},scrollTop:0
   });
   return elements.get(id);
 };
 const context={
   window:{},document:{getElementById:get,activeElement:null,addEventListener:(name,fn)=>events.set(name,fn)},
   folderButton:()=>null
 };
 context.window=context;
 vm.createContext(context);
 const source=readFileSync(new URL('../../../app/src/main/assets/home/launcher.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(0,source.indexOf('window.setHomeBattery=')),context);
 get('screen').inert=true;get('scrim').hidden=false;
 vm.runInContext('repairHomeSheet(true)',context);
 assert.equal(get('screen').inert,false);
 assert.equal(get('scrim').hidden,true);
 vm.runInContext('showSheet("device-monitor","Диспетчер")',context);
 assert.equal(get('screen').inert,true);
 vm.runInContext('repairHomeSheet()',context);
 assert.equal(get('sheet').hidden,false);
 vm.runInContext('repairHomeSheet(true)',context);
 assert.equal(get('screen').inert,false);
 assert.equal(get('sheet').hidden,true);
 vm.runInContext('showSheet("device-monitor","Диспетчер")',context);
 assert.equal(get('sheet').hidden,false);
});

test('the same device monitor opens from the desktop or menu and accepts Android measurements',()=>{
 const elements=new Map(),requests=[];
 const make=()=>{
   const item={children:[],dataset:{},hidden:false,attributes:{},classList:{},
     append(...children){this.children.push(...children);},
     replaceChildren(...children){this.children=children;},
     setAttribute(key,value){this.attributes[key]=value;},
     addEventListener(name,fn){this[name]=fn;}
   };
   return item;
 };
 const get=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const context={
   window:{},document:{hidden:false,addEventListener(){}},sheet:'',
   $:get,apps:[],node:(tag,text)=>Object.assign(make(),{textContent:text}),
   btn:(text,cls,fn)=>Object.assign(make(),{textContent:text,click:fn}),
   menuSection:make,showSheet(id){context.sheet=id;return get('content');},
   setTimeout:()=>1,clearTimeout(){},Intl,
   Desk:{deviceSnapshot:(tab,id)=>requests.push({tab,id})}
 };
 context.window=context;
 vm.createContext(context);
 const source=readFileSync(new URL('../../../app/src/main/assets/home/monitor.js',import.meta.url),'utf8');
 vm.runInContext(source,context);
 get('device-monitor').click();
 assert.equal(context.sheet,'device-monitor');
 const first=requests.at(-1);
 context.evaDeviceSnapshot(first.id,{battery:74,batteryTemp:32.5,memoryFree:1e9,memoryTotal:4e9});
 const metrics=get('content').children[2].children[0].children;
 assert.equal(metrics[0].children[1].textContent,'74%');
 context.sheet='';
 context.openDeviceMonitor();
 assert.equal(context.sheet,'device-monitor');
 const tabs=get('content').children[0].children;
 tabs[1].click();assert.equal(requests.at(-1).tab,'apps');
 tabs[2].click();assert.equal(requests.at(-1).tab,'services');
});

test('leaving Home cancels a delayed long-press without discarding a completed tap',()=>{
 const handlers=new Map(),timers=new Map(),taps=[];
 let capture;
 let nextTimer=0;
 const canvas={
   addEventListener:(name,fn)=>handlers.set(name,fn),
   setPointerCapture(id){capture=id;},
   hasPointerCapture(id){return capture===id;},
   releasePointerCapture(){capture=undefined;},
 };
 const context={
   canvas,window:{addEventListener:(name,fn)=>handlers.set(name,fn)},
   view:{},layout:null,sheet:'',saved:{},selectTarget:false,toyAim:false,dropAim:false,
   floorAt:()=>({x:20,y:20,p:{u:1,v:1}}),renderer:{pick:()=>42},night:false,lamps:[],lighting:{},
   tapAt:(hit,long)=>taps.push([hit.id,long]),
   setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},
   clearTimeout:id=>timers.delete(id),
 };
 vm.createContext(context);
 const source=readFileSync(new URL('../../../app/src/main/assets/home/game.mjs',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('let hold=null,'),source.indexOf("canvas.addEventListener('contextmenu'")),context);
 const pointer={isPrimary:true,button:0,clientX:20,clientY:20,pointerId:7};
 function fireTimers(ms){
   for(const [id,timer] of [...timers]){
     if(timer.ms!==ms)continue;
     timers.delete(id);timer.fn();
   }
 }
 function longPress(){
   handlers.get('pointerdown')(pointer);
   fireTimers(400);
   handlers.get('pointerup')(pointer);
   capture=undefined;
   handlers.get('lostpointercapture')(pointer);
 }
 longPress();
 fireTimers(85);
 assert.deepEqual(taps,[[42,true]]);
 longPress();
 context.window.cancelHomeInput();
 fireTimers(85);
 assert.deepEqual(taps,[[42,true]]);
 handlers.get('pointerdown')(pointer);
 handlers.get('pointercancel')(pointer);
 assert.equal(capture,undefined);
 assert.equal(timers.size,0);
});
