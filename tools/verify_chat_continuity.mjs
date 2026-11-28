// Check painted pixels from Chromium's compositor, not just a CSS visibility flag.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function facePixels(page) {
  const area = await page.evaluate(`(()=>{const r=document.querySelector('.avatar-figure').getBoundingClientRect();
    return {x:r.x+r.width*.315,y:r.y+r.height*.233,width:r.width*.37,height:r.height*.131};})()`);
  const capture = await page.rpc('Page.captureScreenshot',{
    format:'jpeg',quality:84,captureBeyondViewport:false,fromSurface:process.env.EVA_SCREENSHOT_VIEW!=='1'
  });
  return page.evaluate(`(async()=>{
    const bitmap=await createImageBitmap(await (await fetch("data:image/jpeg;base64,${capture.data}")).blob());
    const canvas=document.createElement('canvas');canvas.width=70;canvas.height=52;
    const ctx=canvas.getContext('2d'),a=${JSON.stringify(area)},sx=bitmap.width/innerWidth,sy=bitmap.height/innerHeight;
    ctx.drawImage(bitmap,a.x*sx,a.y*sy,a.width*sx,a.height*sy,0,0,70,52);bitmap.close();
    const d=ctx.getImageData(0,0,70,52).data;let skin=0,black=0,teal=0;
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];
      if(r>140&&r-g>10&&g-b>3)skin++;
      if(Math.max(r,g,b)<16)black++;if(g>r+14 && g>b-12 && g>53)teal++;
    }
    return {skin:skin/(70*52),black:black/(70*52),teal:teal/(70*52)};
  })()`);
}
export async function verifyChatContinuity(page,site) {
  await page.rpc('Network.enable');
  await page.rpc('Network.setCacheDisabled',{cacheDisabled:true});
  const readings = [];
  async function test(label) {
    if(process.env.EVA_UI_NO_CAPTURE==='1')return;
    const sample=await facePixels(page);readings.push([label,sample.skin,sample.black]);
    assert(sample.skin>.22 && sample.black<.22,`${label} lost the painted face: ${JSON.stringify(sample)}`);
  }
  for (const scheme of ['dark','light']) {
    const idle = site.hold('/avatar/idle.png'), body = site.hold('/avatar/idle-body.webp');
    try {
      await page.rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:scheme}]});
      await page.rpc('Page.navigate',{url:site.url+'/?continuity='+scheme+'#synthetic'});
      await page.rpc('Page.bringToFront');
      await page.until(`location.search==='?continuity=${scheme}' && typeof chatPortrait==='object' && window.EvaPortrait.stockEnabled()`,'Chat did not initialise before the large pictures loaded');
      await test(scheme+' cold');
      if(scheme==='dark')await page.shot('chat-cold');
      idle();body();
      await page.until("document.querySelector('.avatar-paint').hasAttribute('data-base-ready') && document.querySelector('.avatar-body-live')",'Idle artwork never became ready');
      await test(scheme+' idle');
      const gesture=site.hold('/avatar/idle-hair.webp');
      try{
        await page.evaluate("document.querySelector('#avatar-stage').classList.add('avatar-idle-scratch')");
        await test(scheme+' pending gesture');
      }finally{gesture();}
      await page.until("!!document.querySelector('.avatar-gesture-visible .avatar-full-gesture')",'Gesture never became visible');
      await test(scheme+' hair');
      if(scheme==='dark'){
        await new Promise(resolve=>setTimeout(resolve,1390));
        await test('hair midpoint');await page.shot('chat-gesture');
        await page.until("!document.querySelector('.avatar-gesture-visible')",'The complete hair gesture did not return to idle');
        await test('hair complete');
        await page.evaluate("const c=document.querySelector('#avatar-stage').classList;c.remove('avatar-idle-scratch');c.add('avatar-idle-yawn')");
        await page.until("document.querySelector('.avatar-gesture-visible .avatar-full-gesture')?.src.endsWith('idle-yawn.webp')",'Yawn did not start');
        await new Promise(resolve=>setTimeout(resolve,1660));
        await test('yawn midpoint');
        await page.until("!document.querySelector('.avatar-gesture-visible')",'The complete yawn did not return to idle');
        await test('yawn complete');
      }
      await page.evaluate("document.querySelector('#avatar-stage').classList.remove('avatar-idle-scratch','avatar-idle-yawn');chatPortrait.emote('surprised')");
      await page.until("document.querySelector('.avatar-cel-face').dataset.frame==='11'",'The expression did not finish');
      await test(scheme+' expression');
      await page.rpc('Emulation.setFocusEmulationEnabled',{enabled:false});
      await page.rpc('Page.setWebLifecycleState',{state:'frozen'});
      await page.rpc('Page.setWebLifecycleState',{state:'active'});
      await page.rpc('Page.bringToFront');
      await page.rpc('Emulation.setFocusEmulationEnabled',{enabled:true});
      await page.until("!document.hidden && document.querySelector('.avatar-body-live')",'Foreground portrait did not resume');
      await test(scheme+' resume');
      await page.rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await page.until("!document.querySelector('.avatar-idle-body,.avatar-full-gesture')",'The motion layer survived reduced motion');
      await test(scheme+' reduced');
    }finally{idle();body();}
  }
  await page.rpc('Network.setCacheDisabled',{cacheDisabled:false});
  await page.rpc('Emulation.setEmulatedMedia',{features:[]});
  console.log('Composited portrait continuity at cold load, delayed gesture, emotion, resume and reduced motion:',JSON.stringify(readings));
}

export async function verifyChatModels(page,site) {
  const good='5'.repeat(64),broken='4'.repeat(64);
  const url=id=>'/character-models/'+id+'/';
  const select=id=>page.evaluate('document.dispatchEvent(new CustomEvent("eva-character-models",{detail:{slots:{chat:'+JSON.stringify(id)+'}}}))');
  const sprite=await page.evaluate(`(()=>{
    const c=document.createElement('canvas');c.width=576;c.height=864;const ctx=c.getContext('2d');
    ctx.fillStyle='#2ec969';ctx.fillRect(45,70,486,725);return c.toDataURL('image/png').split(',')[1];
  })()`);
  site.modelFixture.set(url(good)+'portrait.png',{type:'image/png',bytes:Buffer.from(sprite,'base64')});
  site.modelFixture.set(url(good)+'model.glb',{type:'model/gltf-binary',bytes:await readFile(new URL('../docs/examples/room-robot.glb',import.meta.url))});
  // Register a real document render; a separate 2D context just for testing mustn't displace the imported model's own context.
  const hasWebGL=await page.evaluate(`(()=>{const gl=document.createElement('canvas').getContext('webgl2');
    if(gl)gl.getExtension('WEBGL_lose_context')?.loseContext();return !!gl;})()`);
  async function green() {
    const value=await page.evaluate(`(()=>{const c=document.querySelector('#character-model-view canvas'),w=c.width,h=c.height;
      const bitmap=document.createElement('canvas');bitmap.width=8;bitmap.height=8;
      const out=bitmap.getContext('2d');out.drawImage(c,w*.44,h*.25,w*.12,h*.12,0,0,8,8);
      return [...out.getImageData(3,3,1,1).data];})()`);
    assert(value[1]>value[0]+30 && value[1]>value[2]+20 && value[3]>150,'Imported surface is empty: '+value);
  }
  const release=site.hold(url(good)+(hasWebGL?'model.glb':'portrait.png'));
  try{
    await select(good);
    assert.equal(await page.evaluate("document.body.classList.contains('eva-model-portrait')"),false);
  }finally{release();}
  await page.until("document.body.classList.contains('eva-model-portrait') && !window.EvaPortrait.stockEnabled()",'The imported portrait did not replace the default');
  const kind=await page.evaluate("document.querySelector('#character-model-view').dataset.kind");
  assert.equal(kind,hasWebGL?'webgl':'portrait');
  if(kind==='webgl'){
    // Read within the render task, before WebGL invalidates a non-preserved backbuffer.
    await page.evaluate("document.querySelector('#avatar-stage').classList.add('avatar-speaking')");
    if(process.env.EVA_UI_NO_CAPTURE!=='1'){const img=await facePixels(page);assert(img.teal>.04,'The packaged room robot did not appear in the chat: '+JSON.stringify(img));}
    await page.shot('chat-model');
  }else {await green();await page.shot('chat-model-fallback');}
  await select(broken);
  await page.until("!document.body.classList.contains('eva-model-portrait') && !document.querySelector('#character-model-view canvas')",'An invalid import obscured the prior painted portrait');
  await select('');
  await page.evaluate("document.querySelector('#avatar-stage').classList.remove('avatar-speaking')");
  if(process.env.EVA_UI_NO_CAPTURE!=='1'){const restored=await facePixels(page);assert(restored.skin>.22,'The painted portrait failed to return');}
  console.log('Imported chat model used '+kind+'; queued, failed and cleared assignments retained the painted fallback.');
}
