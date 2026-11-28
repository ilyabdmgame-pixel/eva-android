// Exercise the shipped WebView entry points in an isolated Chromium profile.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=fileURLToPath(new URL('../',import.meta.url));
const home=path.join(repo,'app/src/main/assets/home'),chat=path.join(repo,'runtime/codex-mobile');
const profile=await mkdtemp(path.join(tmpdir(),'eva-browser-'));
const output=path.resolve(process.argv[2]||path.join(repo,'app/build/ui-check'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const data={
 '/status':{ready:true,codexReady:true},'/limits':{fiveHour:null,week:null},'/models':{models:[],providers:[]},
 '/backup/status':{},'/rpc':{result:{data:[]}},'/drafts':{drafts:[]},'/voice-settings':{settings:{},sileroAvailable:false}
};
async function site(root){
  const server=createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://localhost');
      if(root===chat&&u.pathname==='/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(': connected\n\n');return;}
      if(root===chat&&u.pathname==='/chat-image'){
        const file=(u.searchParams.get('path')||'').match(/\/eva-builtin-20261116\/((?:speech|emotions)\/[a-z0-9-]+\.(?:png|webp))$/);
        if(!file){res.writeHead(404);res.end();return;}
        const image=await readFile(path.join(repo,'runtime/eva-builtins',file[1]));
        res.writeHead(200,{'Content-Type':mime[path.extname(file[1])]});res.end(image);return;
      }
      const name=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
      const publicRoot=root===home&&['question-options.js','ui-icons.js'].includes(name)?chat:root;
      let target=path.resolve(publicRoot,name);
      if(!target.startsWith(publicRoot+path.sep)){res.writeHead(403);res.end();return;}
      let contents;
      if(root===chat&&/^avatar\/[a-z][a-z0-9-]*\.png$/.test(name)){
        const prepared=target.replace(/\.png$/,'.webp');
        contents=await readFile(prepared).catch(()=>null);
        if(contents)target=prepared;
      }
      contents??=await readFile(target).catch(()=>null);
      if(root===home&&name==='icon'&&u.searchParams.has('id')){
        res.writeHead(200,{'Content-Type':'image/svg+xml'});
        res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#29786f"/><circle cx="24" cy="24" r="10" fill="#fff2cf"/></svg>');
        return;
      }
      if(contents){res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(contents);}
      else if(root===chat&&!path.extname(name)){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data[u.pathname]||{}));}
      else{res.writeHead(404);res.end();}
    }catch{res.writeHead(500);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
async function page(devtools,source){
  const tab=await (await fetch(devtools+'/json/new?about:blank',{method:'PUT',signal:AbortSignal.timeout(10000)})).json();
  const ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Chromium debugging socket did not open')),10000);
    ws.onopen=()=>{clearTimeout(timer);resolve();};
    ws.onerror=()=>{clearTimeout(timer);reject(Error('Chromium debugging socket failed'));};
  });
  const requests=new Map(),errors=[];
  let next=0;
  ws.onmessage=({data})=>{
    const msg=JSON.parse(data);
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    const receive=requests.get(msg.id);
    if(receive){requests.delete(msg.id);receive(msg);}
  };
  function rpc(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++next,timer=setTimeout(()=>{requests.delete(id);reject(Error(method+' timed out'));},18000);
      requests.set(id,msg=>{clearTimeout(timer);msg.error?reject(Error(msg.error.message)):resolve(msg.result);});
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  const evaluate=async expression=>{
    if(process.env.EVA_UI_TRACE)console.log(expression.slice(0,140));
    const result=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  async function until(expression,description,timeout=20000){
    const start=Date.now();
    while(Date.now()-start<timeout){
      if(errors.length)throw Error(errors[0]);
      const value=await evaluate(expression);
      if(value)return value;
      await wait(125);
    }
    throw Error(description);
  }
  async function press(expression,label){
    const point=await until(`(()=>{
      const element=(${expression});
      if(!element||element.closest('[inert]')||element.disabled)return false;
      element.scrollIntoView({block:'nearest',inline:'nearest'});
      const r=element.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      if(!r.width||!r.height||!element.contains(document.elementFromPoint(x,y)))return false;
      return {x,y};
    })()`,label+' could not be tapped');
    await rpc('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
    await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  }
  async function shot(name){
    if(process.env.EVA_UI_NO_CAPTURE==='1')return;
    await rpc('Page.bringToFront');
    const capture=await rpc('Page.captureScreenshot',{format:'png',fromSurface:process.env.EVA_SCREENSHOT_VIEW!=='1',captureBeyondViewport:false});
    await writeFile(path.join(output,name+'.png'),Buffer.from(capture.data,'base64'));
  }
  await rpc('Page.enable');await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride',{width:432,height:850,deviceScaleFactor:1,mobile:true});
  if(source)await rpc('Page.addScriptToEvaluateOnNewDocument',{source});
  return {rpc,evaluate,until,press,shot,errors,close:async()=>{ws.close();await fetch(devtools+'/json/close/'+tab.id,{signal:AbortSignal.timeout(3000)}).catch(()=>{});}};
}

async function verifyRoomTouches(page){
  await page.rpc('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const dispatch=(type,touchPoints)=>page.rpc('Input.dispatchTouchEvent',{type,touchPoints});
  const tap=async point=>{await dispatch('touchStart',[{...point,id:1}]);await dispatch('touchEnd',[]);};
  const center={x:173,y:519};
  const fingers=(deg,radius)=>{
    const angle=deg*Math.PI/180,x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
    return [{id:1,x:center.x-x,y:center.y-y},{id:2,x:center.x+x,y:center.y+y}];
  };
  const current=()=>page.evaluate('({yaw:worldCheck().cameraYaw,scale:worldCheck().cameraScale})');
  const delta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
  const initial=await current();
  const start=fingers(166,44);
  await dispatch('touchStart',[start[0]]);await dispatch('touchStart',start);
  let last=initial.yaw;
  for(const [angle,radius] of [[174,47],[179,50],[183,53],[191,55],[204,57]]){
    await dispatch('touchMove',fingers(angle,radius));
    const measured=await current();
    assert(Math.abs(delta(measured.yaw,last))<.34,'Camera jumped when the pair crossed ±π');
    last=measured.yaw;
  }
  await dispatch('touchEnd',[]);
  const saved=await page.until('JSON.parse(localStorage.getItem("room"))?.camera','The gesture did not persist');
  assert(Math.abs(delta(saved.yaw,initial.yaw)-38*Math.PI/180)<.045,'Two fingers did not rotate the room');
  assert(Math.abs(saved.zoom-57/44)<.04,'The same gesture did not zoom the room');
  assert(await page.evaluate('document.querySelector("#sheet").hidden'),'Lifting the pinch activated furniture');
  await page.rpc('Page.reload',{ignoreCache:true});
  await page.until('window.worldCheck && worldCheck().paintCount>0','Room did not reload after the gesture');
  const restored=await current();
  assert(Math.abs(delta(restored.yaw,saved.yaw))<.001 && Math.abs(restored.scale/initial.scale-saved.zoom)<.001);
  const drawer=await page.evaluate('(()=>{const r=document.querySelector("#all").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await tap(drawer);
  await page.until('!document.querySelector("#sheet").hidden && !!document.querySelector("#app-search")','Dock failed to open on a single touch after rotating');
  await page.press("document.querySelector('#close')",'Close app drawer');
  const floor=await page.evaluate(`(async()=>{
    const {camera,project}=await import('./camera.mjs'),{room}=await import('./room.mjs');
    const state=worldCheck(),bounds=document.querySelector('#scene').getBoundingClientRect();
    const view=camera({width:bounds.width,height:bounds.height,pixelsPerMeter:bounds.width*state.cameraScale,u:state.center.u,v:state.center.v,yaw:state.cameraYaw});
    view.y+=bounds.height*state.cameraOffset;
    const {x,y}=project(view,{u:room.u+1.05,v:room.v+1.42,z:0});
    return {x:x+bounds.x,y:y+bounds.y,start:state.eva};
  })()`);
  await tap({x:floor.x,y:floor.y});
  await page.until(`worldCheck().move>0 || Math.hypot(worldCheck().eva.u-(${floor.start.u}),worldCheck().eva.v-(${floor.start.v}))>.08`,'A single touch on free floor stopped moving Eva');
  // Restore the initial framing for the rest of the interaction and image checks.
  const row=label=>page.press(`[...document.querySelectorAll('#content button')].find(e=>e.querySelector('strong')?.textContent===${JSON.stringify(label)})`,label);
  await page.press("document.querySelector('#home-menu')",'Home menu');
  for(const label of ['Комната','Обстановка','Ракурс и масштаб','Исходный вид'])await row(label);
  await page.rpc('Emulation.setTouchEmulationEnabled',{enabled:false});
  console.log('Physical two-finger orbit and zoom cross ±π, persist across reload; lift, dock and one-finger floor routing passed.');
}

let browser,homeSite,chatSite;
try{
  await mkdir(output,{recursive:true});
  homeSite=await site(home);chatSite=await site(chat);
  let devtools=process.env.EVA_DEVTOOLS_URL;
  if(!devtools){
    browser=spawn(process.env.CHROME_BIN||'google-chrome',[
      '--headless','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--disable-background-networking',
      '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
      '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
    ],{stdio:['ignore','ignore','pipe']});
    let failure,diagnostic='';browser.on('error',e=>{failure=e;});
    browser.stderr.on('data',part=>{
      diagnostic=(diagnostic+part.toString()).slice(-4096);
      const address=/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(diagnostic);
      if(address)devtools='http://127.0.0.1:'+address[1];
    });
    for(let i=0;i<375&&!devtools;i++){
      if(failure)throw failure;
      if(browser.exitCode!==null||browser.signalCode)throw Error('Chromium exited during startup: '+(browser.signalCode||browser.exitCode)+'\n'+diagnostic);
      try{const line=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(line){devtools='http://127.0.0.1:'+line;break;}}catch{}
      await wait(120);
    }
    assert(devtools,'Chromium did not open its debugging port\n'+diagnostic);
  }
  const routines=await readFile(path.join(home,'routines.json'),'utf8'),activities=await readFile(path.join(home,'room-activities.json'),'utf8');
  const source=`localStorage.setItem('followSchedule','no');const noop=()=>{};
  addEventListener('load',()=>window.setHomeBattery(78,false),{once:true});
  window.Desk={apps:()=>'[{"key":"example.reader/.Main","name":"Книги"}]',open:key=>window.testOpened=key,
  openRoomChat:()=>window.testOpened='chat',routines:()=>${JSON.stringify(routines)},roomActivities:()=>${JSON.stringify(activities)},
  presenceProfile:()=>'{}',weatherState:()=>'',weatherLabels:()=>'[]',cityWeather:()=>'{}',timeline:()=>'{}',
  worldTake:()=>'{}',worldSnapshot:noop,note:noop,town:noop,finishedActivity:noop,bootEnabled:()=>false,isDefaultHome:()=>true,
  deviceSnapshot:(tab,id)=>setTimeout(()=>window.evaDeviceSnapshot(id,{tab,battery:78,batteryTemp:31,thermal:0,
  memoryTotal:8e9,memoryFree:3e9,diskFree:80e9,diskTotal:256e9,cpuPercent:1.5,running:[{name:'example.reader',packages:['example.reader'],pid:124}],
  services:[{name:'example.CodexService',foreground:true,pid:201}]}),15)};`;
  const replay=process.env.EVA_EGL_REPLAY==='1'?await (await import('./room_egl_capture.mjs')).roomEglReplay(output):null;
  const room=await page(devtools,(replay?.source||'')+'\n'+source);
  try{
    await room.rpc('Page.navigate',{url:homeSite.url});
    const readiness=await room.until('window.worldCheck && worldCheck().paintCount > 0 && worldCheck()', 'Home did not draw a WebGL frame');
    assert(readiness.depth>=16&&readiness.sizeConstant);
    await room.until("document.querySelector('#battery').getClientRects().length && document.querySelector('#battery-level').textContent==='78%'",'Home did not show the Android battery callback');
    await wait(450);await replay?.frame(room,'room');await room.shot('room');
    await verifyRoomTouches(room);
    const row=title=>room.press(`[...document.querySelectorAll('#content button')].find(b=>b.querySelector('strong')?.textContent===${JSON.stringify(title)})`,title);
    await room.press("document.querySelector('#device-monitor')",'Device monitor');
    await room.until("!document.querySelector('#sheet').hidden && document.querySelector('#title').textContent==='Диспетчер' && document.querySelector('#content').textContent.includes('78%')",'Device monitor did not display a reading');
    await room.shot('monitor');
    for(const [tab,value] of [['apps','PID 124'],['services','PID 201']]){
      await room.press(`document.querySelector('[data-tab="${tab}"]')`,tab);
      await room.until(`document.querySelector('#content').textContent.includes(${JSON.stringify(value)})`,'Missing '+tab+' data');
    }
    await room.press("document.querySelector('#close')",'Close sheet');
    await room.press("document.querySelector('#home-menu')",'Home menu');
    await row('Комната');await row('Занятия');await row('Провести стрим');
    await room.until("worldCheck().activity==='computer' && !document.querySelector('#stream-chat').hidden",'Stream failed to start at the computer',70000);
    await room.until("document.querySelector('#stream-chat ol').children.length>=2",'Stream did not receive lines',22000);
    await replay?.frame(room,'stream');await room.shot('stream');
    await room.press("document.querySelector('#expand-stream')",'Expand broadcast');
    await room.until("!document.querySelector('#sheet').hidden && document.querySelector('#sheet[data-page=stream-view] .broadcast-screen')", 'Expanded broadcast did not open');
    await room.shot('broadcast');await room.press("document.querySelector('#close')",'Close sheet');
    await room.until("worldCheck().activity==='computer' && !document.querySelector('#stream-chat').hidden",'Closing the broadcast reset the stream');
    await room.evaluate("document.querySelector('#home-menu').click();document.querySelector('#close').click()");
    assert(await room.evaluate("!document.querySelector('#screen').inert && document.querySelector('#scrim').hidden"));
    assert.deepEqual(room.errors,[]);
    console.log('WebGL depth',readiness.depth,'room, monitor, activity, chat and launcher touch recovery passed.');
  }finally{await room.close();}
  const fallback=await page(devtools,source+`
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};`);
  try{
    await fallback.rpc('Page.navigate',{url:homeSite.url});
    await fallback.until("document.querySelector('#screen')?.dataset.graphics==='fallback'",'Fallback desktop did not initialise');
    await fallback.evaluate("document.querySelector('#fallback-chat').click()");
    assert.equal(await fallback.evaluate('window.testOpened'),'chat');
    await fallback.evaluate("document.querySelector('#all').click()");
    await fallback.until("document.querySelector('.app[aria-label=\"Книги\"]')",'Fallback app drawer failed');
    await fallback.evaluate("document.querySelector('.app[aria-label=\"Книги\"]').click()");
    assert.equal(await fallback.evaluate('window.testOpened'),'example.reader/.Main');
    assert.deepEqual(fallback.errors,[]);
    console.log('Launcher and chat work with WebGL disabled.');
  }finally{await fallback.close();}
  const portrait=await page(devtools,replay?`
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.startsWith('webgl')?null:original.call(this,kind,...args);};`:'');
  try{
    await portrait.rpc('Page.navigate',{url:chatSite.url+'/#synthetic'});
    await portrait.until("typeof message==='function' && document.readyState==='complete'",'Chat did not initialise');
    await portrait.evaluate("message('Сборка готова. Чай тоже.','agent');");
    await portrait.until("document.querySelector('#messages-viewport').hasAttribute('data-chat-fade')",'Chat mask did not initialise');
    await portrait.shot('chat');
    assert(await portrait.evaluate("document.documentElement.scrollWidth<=innerWidth+1"));
    await portrait.until("!!document.querySelector('.avatar-body-live .avatar-idle-body')?.naturalWidth",'The resting portrait did not start breathing');
    await portrait.until("document.querySelector('#avatar-stage').dataset.idleBeat",'The regular chat never left its resting pose',6000);
    await portrait.until("document.querySelector('.avatar-gesture-visible .avatar-full-gesture')?.src.endsWith('/idle-hair.webp')",'The regular chat did not play a complete gesture',22000);
    await portrait.evaluate("document.querySelector('#input').focus()");
    await portrait.rpc('Input.insertText',{text:'Привет'});
    await portrait.until("document.querySelector('#avatar-stage').dataset.idleBeat==='nod' && !document.querySelector('.avatar-gesture-visible')",'Typing did not interrupt the idle gesture');
    await portrait.press("document.querySelector('#header-toggle')",'Chat sidebar');
    await portrait.press("document.querySelector('#chat-tools > summary')",'Tools');
    await portrait.press("document.querySelector('#avatar-preview-open')",'Avatar preview');
    await portrait.until("!!document.querySelector('#avatar-preview-buttons button:last-child')",'Portrait controls did not open');
    await portrait.press("document.querySelector('#avatar-preview-groups [data-group=expressions]')",'Expressions');
    await portrait.until("document.querySelector('.avatar-cel-face')?.dataset.cel==='warm' && document.querySelector('.avatar-cel-face').dataset.frame==='11'",'Painted smile did not reach its final frame');
    assert.equal(await portrait.evaluate("document.querySelector('#avatar-stage').dataset.portraitRenderer"),'cels');
    assert.equal(await portrait.evaluate("document.querySelector('#avatar-preview input[type=range]')!==null"),false);
    await portrait.shot('portrait');
    await portrait.press("document.querySelector('#avatar-preview-groups [data-group=gestures]')",'Gestures');
    const named=label=>"[...document.querySelectorAll('#avatar-preview-buttons button')].find(b=>b.textContent==="+JSON.stringify(label)+")";
    await portrait.press(named('Переводит взгляд'),'Sideways gaze');
    await portrait.until("document.querySelector('.avatar-cel-face')?.dataset.cel==='glance' && document.querySelector('.avatar-cel-face').dataset.frame==='11'",'Gaze did not reach the side');
    await portrait.evaluate(`window.eyeOverlap=false;window.sawBlink=false;
      new MutationObserver(()=>{
        const eyes=document.querySelector('.avatar-cel-lids'),face=document.querySelector('.avatar-cel-face');
        if(!eyes.hidden){window.sawBlink=true;if(!face.hidden&&Number(face.dataset.frame)>0)window.eyeOverlap=true;}
      }).observe(document.querySelector('.avatar-head'),{attributes:true,subtree:true});`);
    await portrait.press(named('Моргание'),'Blink after a sideways gaze');
    await portrait.until('window.sawBlink','The requested blink was lost on the way back to centre');
    assert.equal(await portrait.evaluate('window.eyeOverlap'),false);
    await portrait.press("document.querySelector('#avatar-preview-close')",'Close preview');
    await portrait.rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await portrait.until("!document.querySelector('.avatar-idle-body,.avatar-full-gesture') && !document.querySelector('#avatar-stage').dataset.idleBeat",'Reduced motion did not release the automatic animations');
    await portrait.rpc('Emulation.setEmulatedMedia',{features:[]});
    await portrait.until("!!document.querySelector('.avatar-body-live .avatar-idle-body')?.naturalWidth",'Restoring motion did not restart the portrait');
    assert.deepEqual(portrait.errors,[]);
    console.log('Chat rendering, layout and portrait fade passed.');
  }finally{await portrait.close();}
}finally{
  for(const site of [chatSite,homeSite])if(site){site.server.closeAllConnections();site.server.close();}
  if(browser&&browser.exitCode===null&&!browser.signalCode){
    const stopped=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await Promise.race([stopped,wait(1000)]);
    if(browser.exitCode===null&&!browser.signalCode)browser.kill('SIGKILL');
  }
  await rm(profile,{force:true,recursive:true,maxRetries:4,retryDelay:80});
}
