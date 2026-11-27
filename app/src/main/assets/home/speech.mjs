const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function bubblePosition(head,size,screen,obstacles){
  const {x,y}=head,{w,h}=size;
  if(x<8||x>screen.w-8||y<0||y>screen.h-8)return null;
  const ideal=y-h-13;
  const left=clamp(x-w/2,8,screen.w-w-8);
  const shifts=[left,clamp(x-w*.22,8,screen.w-w-8),clamp(x-w*.78,8,screen.w-w-8)];
  for(const rise of [0,18,35,52]){
    const top=ideal-rise;
    if(top<8)continue;
    for(const l of shifts){
      const box={x:l,y:top,w,h};
      if(obstacles.some(b=>overlap(box,b)))continue;
      return {...box,tail:clamp(x-l,9,w-9),length:Math.min(24,10+rise)};
    }
  }
  return null;
}

export function createSpeech(layer,status,protectedElements){
  const lines=new Map();
  let noteUntil=0,serial=0,measuredAt=-Infinity,screen,protectedRects;
  function say(speaker,text,time){
    let line=lines.get(speaker);
    if(!line){
      const el=document.createElement('div');
      el.className='speech-balloon';
      el.dataset.speaker=String(speaker);
      el.setAttribute('aria-live','polite');
      el.setAttribute('aria-atomic','true');
      layer.append(el);
      line={el};lines.set(speaker,line);
    }
    line.el.textContent=text;
    line.size=null;
    line.until=time+Math.min(6700,Math.max(3600,1600+text.length*48));
    line.order=++serial;
  }
  function report(text,time){
    status.textContent=text;
    status.hidden=false;
    noteUntil=time+3900;
  }
  function clear(){
    for(const {el} of lines.values())el.remove();
    lines.clear();
  }
  function tick(time){
    let changed=false;
    for(const [speaker,line] of lines){
      if(time>=line.until){line.el.remove();lines.delete(speaker);changed=true;}
    }
    if(noteUntil&&time>=noteUntil){status.hidden=true;noteUntil=0;}
    return changed;
  }
  function layout(heads,canvas){
    if(!lines.size||layer.hidden)return;
    const t=performance.now();
    if(t-measuredAt>140){
      const viewport=canvas.getBoundingClientRect();
      if(screen?.w!==viewport.width||screen?.h!==viewport.height)for(const line of lines.values())line.size=null;
      screen={w:viewport.width,h:viewport.height};protectedRects=[];measuredAt=t;
      for(const el of protectedElements()){
        const r=el.getBoundingClientRect();
        if(r.width&&r.height)protectedRects.push({x:r.left-viewport.left-5,y:r.top-viewport.top-5,w:r.width+10,h:r.height+10});
      }
    }
    const rects=[...protectedRects];
    for(const line of lines.values())line.size??={w:line.el.offsetWidth,h:line.el.offsetHeight};
    for(const [speaker,line] of [...lines].sort((a,b)=>b[1].order-a[1].order)){
      const head=heads.get(speaker);
      const placement=head&&bubblePosition(head,line.size,screen,rects);
      if(!placement){line.el.style.visibility='hidden';continue}
      line.el.style.visibility='visible';
      line.el.style.setProperty('--bubble-x',placement.x+'px');
      line.el.style.setProperty('--bubble-y',placement.y+'px');
      line.el.style.setProperty('--tail-x',placement.tail+'px');
      line.el.style.setProperty('--tail-height',placement.length+'px');
      rects.push(placement);
    }
  }
  return {say,report,clear,tick,layout,until:speaker=>lines.get(speaker)?.until||0,get waiting(){return lines.size>0||noteUntil>0}};
}
