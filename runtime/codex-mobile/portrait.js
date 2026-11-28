'use strict';

(function(root){
  const poses = ['warm','joy','laugh','curious','surprised','sly','thinking','skeptical','shy',
    'pout','confident','sad','excited','wink','annoyed','tired','relieved','confused'];
  const aliases = {'warm-soft':'warm','thinking-soft':'thinking','serious':'confident','smile-mid':'warm'};
  const fps=30, lastFace=11;
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const ease=t=>t*t*(3-2*t);
  function faceName(name){const key=Object.hasOwn(aliases,name)?aliases[name]:name;return poses.includes(key)?key:'';}
  function blinkAt(ms){
    if(ms<0||ms>=300)return 0;
    if(ms<97)return Math.round(lastFace*ease(ms/97));
    if(ms<138)return lastFace;
    return Math.round(lastFace*(1-ease((ms-138)/162)));
  }
  const idleBeats = {
    glance: {face:'glance', amount:1, hold:1050},
    nod: {hold:840},
    smile: {face:'warm', amount:.52, hold:1450},
    settle: {hold:1700},
    tilt: {hold:1320}
  };
  const gestureTime=Object.freeze({hair:3200,yawn:3600});
  function nextIdleBeat(bag, previous, random=Math.random){
    if(!bag.length)bag.push(...Object.keys(idleBeats));
    const options=bag.filter(name=>name!==previous);
    const name=options[Math.floor(random()*options.length)];
    bag.splice(bag.indexOf(name),1);
    return name;
  }
  function mount(stage,motion){
    const figure=stage.querySelector('.avatar-figure'), surface=figure.querySelector('.avatar-front-surface');
    const head=surface.querySelector('.avatar-head');
    function layer(className,parent){
      const node=document.createElement('span');node.className=className;node.setAttribute('aria-hidden','true');node.hidden=true;parent.append(node);return node;
    }
    const face=layer('avatar-cel avatar-cel-face',head), lids=layer('avatar-cel avatar-cel-lids',head);
    const waving=layer('avatar-cel-arm',surface), resting=document.createElement('span'), arm=document.createElement('span');
    resting.className='avatar-wave-rest';arm.className='avatar-wave-cels';waving.append(resting,arm);
    const cache = new Map();
    const visible=()=>!stage.hidden&&!document.hidden&&!document.body.classList.contains('eva-pet-chat');
    const activity=()=>['avatar-is-reading','avatar-is-working','avatar-is-searching','avatar-is-music','avatar-idle-scratch','avatar-idle-yawn','avatar-idle-calm'].some(key=>stage.classList.contains(key));
    const body=surface.querySelector('.avatar-body');
    let bodyArt=null;
    function dropBodyArt(){
      if(!bodyArt)return;
      body.classList.remove('avatar-body-live');
      bodyArt.onload=bodyArt.onerror=null;bodyArt.removeAttribute('src');bodyArt.remove();bodyArt=null;
    }
    function syncBodyArt(){
      if(motion.matches||!visible()){dropBodyArt();return;}
      if(!bodyArt&&!activity()){
        bodyArt=new Image();bodyArt.className='avatar-idle-body';bodyArt.alt='';bodyArt.decoding='async';
        bodyArt.onload=syncBodyArt;
        bodyArt.onerror=()=>body.classList.remove('avatar-body-live');
        body.append(bodyArt);bodyArt.src='/avatar/idle-body.webp';
      }
      body.classList.toggle('avatar-body-live',!!bodyArt?.naturalWidth&&!activity());
    }
    function artwork(name){
      let result=cache.get(name);
      if(result){cache.delete(name);cache.set(name,result);return result;}
      const img=new Image();img.src='/avatar/cel-'+name+'.webp';
      result=img.decode().then(()=>img).catch(err=>{if(cache.get(name)===result)cache.delete(name);throw err;});
      cache.set(name,result);
      while(cache.size>4)cache.delete(cache.keys().next().value);
      return result;
    }
    function setFrame(node,key,index,columns,rows){
      if(node.dataset.cel===key&&Number(node.dataset.frame)===index&&!node.hidden)return;
      node.style.backgroundImage=`url("/avatar/cel-${key}.webp")`;
      node.style.backgroundPosition=`${(index%columns)*100/(columns-1)}% ${Math.floor(index/columns)*100/(rows-1)}%`;
      node.dataset.cel=key;node.dataset.frame=String(index);node.hidden=false;
    }
    let requested='', requestedAmount=1, override='', current='', position=0, goal=0, faceAt=0, blinkStarted=null, waveStarted=null;
    let frame=0, lastTick=-Infinity, serial=0, blinkId=0, waveId=0, wavePending=false, stillTimer=null;
    let idleTimer=null, blinkTimer=null, idle='', lastIdle='', lastTyping=-Infinity, doubleBlink=false;
    let gesture='', gestureStill=false, gestureImage=null, gestureTimer=null, nextGestureAt=0, lastGesture='';
    let previewBlinkPending=false;
    const bag=[];
    const autonomous=()=>visible()&&!motion.matches&&!document.body.classList.contains('avatar-preview-active');
    const foregroundPose=()=>activity()||stage.matches('.avatar-speaking,.avatar-listening,.avatar-thinking,.avatar-is-happy,.avatar-is-surprised');
    const canIdle=()=>autonomous()&&!foregroundPose()&&!override&&!wavePending&&waveStarted===null;
    const blinkPose=()=>stage.matches('.avatar-is-reading,.avatar-is-working,.avatar-is-searching');
    const canBlink=()=>visible()&&!motion.matches&&!override&&!requested&&!current&&!gesture&&waveStarted===null&&!wavePending&&(!activity()||blinkPose());
    function clearBlink(){
      ++blinkId;blinkStarted=null;lids.hidden=true;delete stage.dataset.blinkFrame;stage.style.removeProperty('--cel-lid-edge');
    }
    function stopIdle(){
      clearTimeout(idleTimer);idleTimer=null;idle='';delete stage.dataset.idleBeat;
    }
    function finishIdleAfter(delay){
      clearTimeout(idleTimer);
      idleTimer=setTimeout(()=>{
        stopIdle();
        if(canIdle())idleTimer=setTimeout(advanceIdle,1450+Math.random()*2200);
        sync();
      },delay);
    }
    function setIdleBeat(name){
      idle=name;stage.dataset.idleBeat=name;
      finishIdleAfter(idleBeats[name]?.hold??gestureTime[name]+1500);
      sync();
    }
    function advanceIdle(){
      idleTimer=null;
      if(!canIdle()){sync();return;}
      if(blinkStarted!==null){idleTimer=setTimeout(advanceIdle,320);return;}
      if(performance.now()>=nextGestureAt){
        const hour=new Date().getHours();
        lastGesture=lastGesture==='hair'&&(hour>=21||hour<8||Math.random()<.35)?'yawn':'hair';
        nextGestureAt=performance.now()+26000+Math.random()*17000;
        setIdleBeat(lastGesture);
      }else{
        lastIdle=nextIdleBeat(bag,lastIdle);
        setIdleBeat(lastIdle);
      }
    }
    function noticeTyping(){
      const now=performance.now();
      if(!canIdle()||now-lastTyping<8500)return;
      lastTyping=now;
      stopIdle();
      setIdleBeat('nod');
    }
    function dropGestureImage(){
      clearTimeout(gestureTimer);
      figure.classList.remove('avatar-gesture-visible');
      if(gestureImage){
        gestureImage.onload=gestureImage.onerror=null;gestureImage.removeAttribute('src');gestureImage.remove();gestureImage=null;
      }
    }
    function showGesture(name,still=false){
      if(name===gesture&&still===gestureStill)return;
      dropGestureImage();gesture=name;gestureStill=still;delete stage.dataset.gestureFallback;
      if(!name)return;
      clearBlink();
      const image=new Image();gestureImage=image;image.className='avatar-full-gesture';image.alt='';
      image.onload=()=>{
        if(gestureImage!==image)return;
        figure.classList.add('avatar-gesture-visible');
        if(idle===name)finishIdleAfter(gestureTime[name]);
        else if(!still)gestureTimer=setTimeout(dropGestureImage,gestureTime[name]);
      };
      image.onerror=()=>{
        if(gestureImage!==image)return;
        dropGestureImage();stage.dataset.gestureFallback=name;
      };
      const asset=still?(name==='hair'?'scratch':'yawn'):'idle-'+name;
      surface.append(image);image.src='/avatar/'+asset+'.webp';
    }
    function nextBlink(){
      blinkTimer=null;
      if(!autonomous())return;
      const wasDouble=doubleBlink;
      doubleBlink=!wasDouble&&canBlink()&&Math.random()<.12;
      if(canBlink())blink();
      blinkTimer=setTimeout(nextBlink,doubleBlink?375:2400+Math.random()*3200);
    }
    function reset(){
      stopIdle();clearTimeout(blinkTimer);blinkTimer=null;doubleBlink=false;clearBlink();
      dropBodyArt();showGesture('');nextGestureAt=0;previewBlinkPending=false;
      clearTimeout(stillTimer);++serial;++waveId;requested=current=override='';position=goal=0;waveStarted=null;wavePending=false;
      face.hidden=lids.hidden=waving.hidden=true;figure.classList.remove('avatar-waving');
      delete stage.dataset.expression;
      cancelAnimationFrame(frame);frame=0;
    }
    function wake(){if(!frame&&visible())frame=requestAnimationFrame(tick);}
    function tick(now){
      frame=0;if(!visible()){reset();return;}
      if(now-lastTick>=1000/fps-.8){
        lastTick=now;
        if(current){
          const delta=clamp(now-faceAt,0,80);faceAt=now;
          const travel=current==='glance'?(goal>position?165:210):(goal>position?500:340);
          const step=motion.matches?1:delta/travel;
          position+=Math.sign(goal-position)*Math.min(step,Math.abs(goal-position));
          if(position>0){setFrame(face,current,Math.round(ease(position)*lastFace),4,3);stage.dataset.expression=current;}
          if(position===0&&goal===0){
            face.hidden=true;current='';delete stage.dataset.expression;
            if(requested)enter(requested);
            else if(previewBlinkPending){previewBlinkPending=false;blink();}
          }
        }
        if(blinkStarted!==null){
          const elapsed=now-blinkStarted,index=blinkAt(elapsed);
          if(elapsed>=300)clearBlink();
          else{
            stage.dataset.blinkFrame=String(index);stage.style.setProperty('--cel-lid-edge',(23+index/lastFace*8)+'%');
            if(!activity()&&index>0)setFrame(lids,'blink',index,4,3);else lids.hidden=true;
          }
        }
        if(waveStarted!==null){
          const index=motion.matches?12:Math.floor((now-waveStarted)/(1000/fps));
          if(index>=45){cancelWave();sync();}
          else{const cel=waveFrame(index);setFrame(arm,'wave',cel,6,4);waving.hidden=false;figure.classList.add('avatar-waving');}
        }
      }
      if(current&&position!==goal||blinkStarted!==null||waveStarted!==null&&!motion.matches)wake();
    }
    async function enter(name){
      const key=++serial;
      if(!name||!visible())return;
      try{await artwork(name);}catch{return;}
      if(key!==serial||requested!==name||!visible())return;
      current=name;position=0;goal=requestedAmount;faceAt=performance.now();wake();
    }
    function choose(name,amount=1){
      if(requested===name&&requestedAmount===amount)return;
      requested=name;requestedAmount=amount;++serial;
      if(name){clearBlink();previewBlinkPending=false;}
      if(current&&current===name){goal=amount;faceAt=performance.now();wake();}
      else if(current){goal=0;faceAt=performance.now();wake();}
      else if(name)enter(name);
    }
    function sync(){
      if(!visible()){reset();return;}
      syncBodyArt();
      if(canIdle()){
        if(!nextGestureAt)nextGestureAt=performance.now()+6500+Math.random()*3500;
        if(idleTimer===null)idleTimer=setTimeout(advanceIdle,1200+Math.random()*900);
      }else stopIdle();
      const cl=stage.classList;
      const manual=cl.contains('avatar-idle-scratch')?'hair':cl.contains('avatar-idle-yawn')?'yawn':'';
      showGesture(manual||(Object.hasOwn(gestureTime,idle)?idle:''),motion.matches&&!!manual);
      if(autonomous()){
        if(blinkTimer===null)blinkTimer=setTimeout(nextBlink,1500+Math.random()*1400);
      }else{clearTimeout(blinkTimer);blinkTimer=null;doubleBlink=false;}
      if(motion.matches||(!canBlink()&&blinkStarted!==null))clearBlink();
      if(activity()||stage.classList.contains('avatar-speaking')){
        if(wavePending||waveStarted!==null)cancelWave();
        choose('');return;
      }
      const primary=override||(cl.contains('avatar-is-happy')?'warm':cl.contains('avatar-is-surprised')?'surprised':cl.contains('avatar-thinking')?'thinking':cl.contains('avatar-listening')?'curious':cl.contains('avatar-preview-glance')?'glance':'');
      const beat=idleBeats[idle];
      choose(primary||beat?.face||'',primary?1:(beat?.amount??1));
    }
    async function blink(preview=false){
      if(preview&&visible()&&!motion.matches&&current&&!requested&&!override){previewBlinkPending=true;return;}
      if(!canBlink()||blinkStarted!==null)return;
      const id=++blinkId;
      if(!activity()){try{await artwork('blink');}catch{return;}}
      if(id!==blinkId||!canBlink())return;
      blinkStarted=performance.now();wake();
    }
    function cancelWave(){
      clearTimeout(stillTimer);++waveId;waveStarted=null;wavePending=false;waving.hidden=true;figure.classList.remove('avatar-waving');
    }
    async function wave(){
      const id=++waveId;
      if(!visible()||activity()||stage.classList.contains('avatar-speaking'))return;
      wavePending=true;stopIdle();clearBlink();sync();
      try{await artwork('wave');}catch{if(id===waveId){wavePending=false;sync();}return;}
      if(id!==waveId||!wavePending||!visible())return;
      wavePending=false;waveStarted=performance.now();wake();if(motion.matches)stillTimer=setTimeout(()=>{cancelWave();sync();},920);
    }
    function emote(name){override=faceName(name);sync();}
    function clear(){override='';previewBlinkPending=false;clearBlink();cancelWave();sync();}
    stage.classList.add('avatar-drawn');stage.dataset.portraitRenderer='cels';
    new MutationObserver(sync).observe(stage,{attributes:true,attributeFilter:['class','hidden']});
    new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
    motion.addEventListener('change',()=>{if(motion.matches){clearBlink();cancelWave();}sync();wake();});
    document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('portrait-suspended',document.hidden);sync();});
    window.addEventListener('pagehide',reset);window.addEventListener('pageshow',sync);sync();
    return {emote,clear,blink,wave,noticeTyping};
  }
  function waveFrame(step){
    // Ease into the raised hand, two small waves, then release back to the resting sleeve.
    const sequence=[0,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,17,16,15,14,13,12,11,10,10,11,12,13,14,15,16,15,14,13,12,18,19,20,21,22,23,23];
    return sequence[clamp(Math.floor(step),0,sequence.length-1)];
  }

  // Approximate articulation between word boundaries. Timings use relative speech units.
  function speechTrack(text) {
    const cues = [], byOffset = new Map(), groups = ['аяa', 'еэыиei', 'оёo', 'уюuw', 'мбпmbp', 'вфfv'];
    let duration = 0, offset = 0;
    for (const letter of text.toLowerCase()) {
      const pair = groups.findIndex(group => group.includes(letter));
      const rest = /[\s.,!?;:…—–-]/u.test(letter);
      const weight = rest ? (/[.!?…]/u.test(letter) ? 2.8 : /[,;:—–]/u.test(letter) ? 1.6 : .58) : pair < 0 ? .68 : pair >= 4 ? .8 : 1.2;
      const begin = duration;
      duration += weight;
      cues.push({offset, begin, end:duration, shape:rest ? -1 : pair < 0 ? 2 : pair * 2,
        strength:rest ? 0 : pair < 0 ? .35 : pair >= 4 ? .65 : 1});
      byOffset.set(offset,cues[cues.length-1]);
      offset += letter.length;
    }
    return {cues, byOffset, duration};
  }

  function speechCue(track, position) {
    if (!track || position < 0 || position >= track.duration) return null;
    let low = 0, high = track.cues.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (track.cues[mid].end <= position) low = mid + 1;
      else high = mid;
    }
    return track.cues[low] || null;
  }

  const api = {mount,faceName,poses,blinkAt,waveFrame,nextIdleBeat,gestureTime,speechTrack,speechCue};
  root.EvaPortrait = api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
