'use strict';

(() => {
  const stage = document.querySelector('#avatar-stage');
  if (!stage) return;
  const host = document.createElement('div');
  host.id = 'character-model-view';
  host.setAttribute('aria-hidden', 'true');
  stage.append(host);

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = '', failed = '', current = null, pending = null, clock = 0, tick = 0, lastPaint = -Infinity;
  const visible = () => !document.hidden && !stage.hidden && !document.body.classList.contains('eva-pet-chat');
  const headers = () => ({'x-codex-token': location.hash.slice(1)});
  function announce(active) {
    if (document.body.classList.contains('eva-model-portrait') === active) return;
    document.body.classList.toggle('eva-model-portrait', active);
    document.dispatchEvent(new CustomEvent('eva-model-portrait', {detail:{active}}));
  }
  async function asset(id, file, signal) {
    const response = await fetch('/character-models/' + id + '/' + file, {headers:headers(), signal});
    if (!response.ok) throw Error('Character art returned ' + response.status);
    return response;
  }
  function halt() {
    cancelAnimationFrame(tick); tick = 0; clock = 0; lastPaint = -Infinity;
  }
  function render(now) {
    tick = 0;
    if (!current || !visible()) return;
    if (now-lastPaint >= 1000/30-.7) {
      const delta = clock && !motion.matches ? Math.min((now-clock)/1000,.08) : 0;
      current.draw(delta); clock = lastPaint = now;
    }
    if (current.animated && !motion.matches) tick = requestAnimationFrame(render);
  }
  function refresh() {
    halt();
    if (!visible()) { pending?.abort(); pending=null;return; }
    if (current) render(performance.now());
    if (selected && selected!==failed && !pending && current?.id !== selected) prepare(selected);
  }
  function remove() {
    halt(); announce(false);
    const previous=current;current=null;previous?.dispose();
    host.replaceChildren(); delete host.dataset.kind;
  }
  function size() {
    return {width:Math.max(1,stage.clientWidth), height:Math.max(1,stage.clientHeight)};
  }
  async function makeScene(id, signal) {
    // Skip the multi-megabyte model download altogether on Canvas-only WebViews.
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});
    if (!gl) throw Error('No WebGL2');
    let actor, renderer, mixer;
    function dispose() {
      mixer?.stopAllAction(); if (mixer && actor) mixer.uncacheRoot(actor.scene);
      actor?.dispose(); renderer?.dispose(); gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    try {
      const {openActor} = await import('/character-art.js');
      const response = await asset(id,'model.glb',signal);
      actor = await openActor(await response.arrayBuffer());
      signal.throwIfAborted();
      const {THREE,scene:model,animations} = actor;
      renderer = new THREE.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true});
      renderer.setClearColor(0,0); renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28,1,.03,15);
      camera.position.set(0,1.08,2.82); camera.lookAt(0,1.08,0);
      scene.add(new THREE.HemisphereLight(0xfff6ef,0x9298ac,1.65));
      const key = new THREE.DirectionalLight(0xffeadb,1.65);
      key.position.set(2,3.5,3.5); scene.add(key, model);
      const idle = animations.find(clip=>/idle|breath|neutral|standing/i.test(clip.name))
        || animations.find(clip=>!/(?:attack|death|jump|fall|walk|run|fight|talk|speak)/i.test(clip.name));
      const talk = animations.find(clip=>/talk|speak|speech/i.test(clip.name)) || idle;
      if (idle || talk) mixer = new THREE.AnimationMixer(model);
      let action = null, width = 0, height = 0;
      const result = {
        id, canvas, kind:'webgl', animated:!!mixer, dispose,
        draw(delta) {
          const dims = size();
          if (width !== dims.width || height !== dims.height) {
            ({width,height} = dims);
            camera.aspect = width/height;
            camera.updateProjectionMatrix(); renderer.setSize(width,height,false);
          }
          const clip = motion.matches ? idle : stage.classList.contains('avatar-speaking') ? talk : idle;
          const next = clip && mixer.clipAction(clip);
          if (next !== action) {
            if (action && next && !motion.matches) next.reset().play().crossFadeFrom(action,.22,false);
            else { action?.stop(); next?.reset().play(); }
            action = next;
          }
          mixer?.update(delta); renderer.render(scene,camera);
        },
      };
      canvas.addEventListener('webglcontextlost',event=>{
        if (current !== result) return;
        event.preventDefault(); remove();
        if (selected === id && visible() && !pending) prepare(id,true);
      },{once:true});
      return result;
    } catch (error) { dispose(); throw error; }
  }
  async function makeSprite(id, signal) {
    let fullPortrait=true,file;
    try{file=await asset(id,'portrait.png',signal);}
    catch(error){
      if(signal.aborted)throw error;
      fullPortrait=false;file=await asset(id,'poses.png',signal);
    }
    const image = await createImageBitmap(await file.blob());
    if (image.width !== (fullPortrait?576:1152) || image.height !== (fullPortrait?864:768)) {
      image.close(); throw Error('Invalid character portrait dimensions');
    }
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) { image.close(); throw Error('No 2D canvas'); }
    let paintedWidth=0,paintedHeight=0;
    return {
      id, canvas, kind:fullPortrait?'portrait':'sprite', animated:false, dispose(){image.close();},
      draw() {
        const {width,height} = size(), ratio = Math.min(devicePixelRatio||1,2);
        const w=Math.round(width*ratio),h=Math.round(height*ratio);
        if(paintedWidth===w&&paintedHeight===h)return;
        paintedWidth=canvas.width=w;paintedHeight=canvas.height=h;
        ctx.imageSmoothingQuality='high';
        if(fullPortrait){
          const zoom=Math.min(w/image.width,h/image.height),dw=image.width*zoom,dh=image.height*zoom;
          ctx.drawImage(image,(w-dw)/2,(h-dh)*.12,dw,dh);
        }else{
          const zoom=h/133;
          ctx.drawImage(image,0,0,144,192,(w-144*zoom)/2,h*.025,144*zoom,192*zoom);
        }
      },
    };
  }
  async function prepare(id, spriteOnly=false) {
    const request = new AbortController(); pending = request;
    let next;
    try {
      if (!spriteOnly) {
        try { next = await makeScene(id,request.signal); }
        catch (error) { if (request.signal.aborted) throw error; }
      }
      if (!next) next = await makeSprite(id,request.signal);
      if (pending !== request || request.signal.aborted || selected !== id || !visible()) { next.dispose(); return; }
      next.draw(0); // Warm the actual canvas before hiding either painted portrait.
      const previous = current; current = next;
      host.replaceChildren(next.canvas); host.dataset.kind = next.kind;
      announce(true); previous?.dispose(); pending = null; refresh();
    } catch {
      if (next && current !== next) next.dispose();
      if (pending === request) { pending = null; failed=id;remove(); }
    }
  }
  document.addEventListener('eva-character-models', event => {
    const value = event.detail?.slots?.chat;
    const id = typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : '';
    if (selected === id && (current || pending || !id)) return;
    selected = id;failed='';pending?.abort(); pending = null;
    if (!id) remove(); else refresh();
  });
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('pagehide',()=>{pending?.abort();pending=null;halt();});
  window.addEventListener('pageshow',refresh);
  motion.addEventListener('change',refresh);
  new ResizeObserver(refresh).observe(stage);
  let previousVisible=visible(),previousSpeaking=stage.classList.contains('avatar-speaking');
  function stateChanged() {
    const shown=visible(),speaking=stage.classList.contains('avatar-speaking');
    if(shown===previousVisible&&speaking===previousSpeaking)return;
    previousVisible=shown;previousSpeaking=speaking;refresh();
  }
  new MutationObserver(stateChanged).observe(stage,{attributes:true,attributeFilter:['hidden','class']});
  new MutationObserver(stateChanged).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
