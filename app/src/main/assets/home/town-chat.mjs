export function townChat({note,quip,world,apply,usage}){
 const form=document.getElementById('town-compose'),input=form.querySelector('input'),
 mic=form.querySelector('[data-mic]'),send=form.querySelector('[type=submit]'),
 mark=document.getElementById('town-mark'),bubble=document.getElementById('town-answer'),
 choices=document.getElementById('town-options');
 const labels={working:'Ева работает',done:'Дело готово',question:'Ева ждёт ответа'};
 const post=(op,extra={})=>window.Desk?.town?.(JSON.stringify({op,...extra}));
 let active=!document.hidden,open=false,head=null,covered=false,roomBusy=false,pending=null,position=null;
 let status='idle',answer=null,choicePoll=null,words=[],page='',timer=0,spoken=false,ack='',lastDraft='';
 let voiceOptions={rate:1,pitch:.7},phrase=null;
 input.value=sessionStorage.getItem('townDraft')||'';
 function controls(){send.disabled=!input.value.trim()||!!pending||roomBusy;input.readOnly=!!pending;}
 function draft(){sessionStorage.setItem('townDraft',input.value);controls();}
 function anchor(point,sheet){
  head=point;covered=!!sheet;
  const visible=active&&point&&!covered;
  mark.hidden=!visible||!labels[status];form.hidden=!visible||!open;
  bubble.hidden=!visible||!page||spoken;
  choices.hidden=!visible||!choicePoll||!!pending;
  if(!visible||mark.hidden&&form.hidden&&bubble.hidden&&choices.hidden)return;
  const vp=window.visualViewport,w=vp?.width||innerWidth,h=vp?.height||innerHeight,
   top=vp?.offsetTop||0,left=vp?.offsetLeft||0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function place(el,x,y){
   if(el.hidden)return;
   const l=clamp(x-el.offsetWidth/2,left+6,left+w-el.offsetWidth-6),
    t=clamp(y,top+6,top+h-el.offsetHeight-6);
   const v='translate('+Math.round(l)+'px,'+Math.round(t)+'px)';
   if(el.style.transform!==v)el.style.transform=v;
  }
  place(mark,point.x,point.y-mark.offsetHeight-4);
  place(bubble,point.x,point.y-bubble.offsetHeight-(mark.hidden?12:33));
  place(choices,point.x,point.y-choices.offsetHeight-(mark.hidden?12:33));
  const below=(point.feetY??point.y+76)+10;
  const above=point.y-form.offsetHeight-(bubble.hidden?36:bubble.offsetHeight+40);
  if(!form.hidden){
   position??={x:point.x,y:below+form.offsetHeight<=top+h-8?below:above,height:h};
   const keyboard=document.activeElement===input&&h<position.height-76;
   place(form,position.x,keyboard?top+h-form.offsetHeight-8:position.y);
  }
 }
 const layout=()=>anchor(head,covered);
 function close(){if(!open)return false;open=false;position=null;input.blur();layout();return true;}
 function tap(){
  if(open){close();return;}
  if(!answer)quip();
  open=true;layout();post('state',{activate:true});
  if(!form.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches)form.animate?.([
   {opacity:.58,translate:'0 6px'},{opacity:1,translate:'0 0'}
  ],{duration:170,easing:'cubic-bezier(.2,.8,.3,1)'});
 }
 function playVoice(id,text,volume,options){
  if(options.voiceName==='silero-kseniya')post('synthesize',{...options,id,text,volume});
  else window.Desk?.townSpeak?.(id,text,options.rate,options.pitch,volume);
 }
 function stopPhrase(){
  if(!phrase)return;
  window.Desk?.stopRoomVoice?.(phrase.id);phrase=null;
 }
 function speakPhrase(text,volume){
  if(!active||answer||volume<=0)return;
  stopPhrase();
  phrase={id:'room-'+crypto.randomUUID(),text,volume};
  playVoice(phrase.id,text,volume,voiceOptions);
 }
 function finish(){
  const id=answer?.id;if(!id)return;
  document.querySelector('#speech [data-speaker="15"]')?.style.removeProperty('display');clearTimeout(timer);page='';answer=null;choicePoll=null;choices.replaceChildren();spoken=false;ack=id;layout();post('read',{id});
 }
 function step(){
  if(!active||!answer||covered){timer=setTimeout(step,350);return;}
  if(!words.length){finish();return;}
  const next=words[0],candidate=page?page+' '+next:next;
  bubble.textContent=candidate;bubble.hidden=false;
  if(page&&bubble.scrollHeight>bubble.clientHeight+1){
   bubble.textContent=page;
   timer=setTimeout(()=>{page='';step();},1100);return;
  }
  page=candidate;words.shift();layout();timer=setTimeout(step,words.length?135:1700);
 }
 function text(){
  spoken=false;page='';
  // Split unusually long unbroken tokens so a URL can fill successive pages.
  words=(answer.text.match(/\S+/gu)||[]).flatMap(w=>Array.from(w).length>45?w.match(/.{1,22}/gu):[w]);
  step();
 }
 function showChoices(){
  const title=document.createElement('strong');title.textContent=choicePoll.question;choices.replaceChildren(title);
  for(const value of choicePoll.options){
   const option=document.createElement('button');option.type='button';option.textContent=value;
   option.onclick=()=>{
    const response='Вопрос: '+choicePoll.question+' Ответ: '+value;
    input.value=[input.value.trim(),response].filter(Boolean).join(' ').slice(0,8000);
    open=true;draft();finish();
   };
   choices.append(option);
  }
  layout();
 }
 function update(data){
  if('week' in data)usage?.(data.week);
  if(data.op==='state'&&!data.error){
   const {voiceName,rate=1,pitch=.7,accent,yo}=data;
   voiceOptions={voiceName,rate,pitch,accent,yo};
  }
  if(phrase?.id&&data.id===phrase.id){
   if(data.op==='voiceError'&&voiceOptions.voiceName==='silero-kseniya'&&!phrase.fallback){
    phrase.fallback=true;
    window.Desk?.townSpeak?.(phrase.id,phrase.text,voiceOptions.rate,voiceOptions.pitch,phrase.volume);
   }else phrase=null;
   return;
  }
  if(data.op==='mic'){
   mic.classList.toggle('listening',data.status==='listening');mic.setAttribute('aria-pressed',String(data.status==='listening'));
   if(data.text){input.value=(input.value+' '+data.text).trim().slice(0,8000);draft();}
  }
  if(data.op==='send'){
   if(!data.error){input.value='';sessionStorage.removeItem('townDraft');lastDraft='';if(choicePoll)finish();}
   pending=null;
  }
  if(data.error){
   if(data.op!=='state')note(data.error);
   controls();return;
  }
  if(data.op==='spoken'&&answer?.id===data.id){finish();return;}
  if(data.op==='voiceError'&&answer?.id===data.id&&spoken){note('Озвучка недоступна. Показываю ответ.');text();return;}
  if(!data.status||data.op==='mic')return;
  roomBusy=!!data.roomBusy;status=data.status;mark.dataset.status=status;
  mark.textContent=status==='question'?'!':'?';mark.setAttribute('aria-label',labels[status]||'');
  controls();layout();
  if(active&&data.answer&&!answer){
   if(ack===data.answer.id){post('read',{id:ack});return;}
   stopPhrase();answer={...data.answer};
   const token=sessionStorage.getItem('townActionToken'),match=answer.text.match(/\[town ([a-z0-9-]+) ([0-9]+) ([a-zA-Z]+)\]\s*$/);
   if(token&&match&&match[1]===token){
     sessionStorage.removeItem('townActionToken');answer.text=answer.text.slice(0,match.index).trim();
     const report=apply(Number(match[2]),match[3]);note(report);answer.text||=report;
   }
   document.querySelector('#speech [data-speaker="15"]')?.style.setProperty('display','none');
   choicePoll=window.EvaQuestions?.parse(answer.text)||null;
   if(choicePoll){showChoices();return;}
   if(data.voice&&window.Desk?.townSpeak){spoken=true;playVoice(answer.id,answer.text,1,voiceOptions);}
   else text();
  }
 }
 form.onsubmit=e=>{
  e.preventDefault();if(send.disabled)return;
  const message=input.value.trim();
  if(lastDraft!==message){form.dataset.request=crypto.randomUUID();lastDraft=message;}
  pending=form.dataset.request;controls();
  const token=pending,scene=world();
  const context='\n\n[Комната Евы, игровой снимок] '+JSON.stringify(scene)+'\nЕсли выбираешь одно игровое действие, добавь в самом конце [town '+token+' ID USE] из nearby. Действие выполнится при получении ответа в комнате.';
  if(message.length+context.length<=8000){sessionStorage.setItem('townActionToken',token);post('send',{id:pending,text:message+context});}
  else{sessionStorage.removeItem('townActionToken');post('send',{id:pending,text:message});}
 };
 input.oninput=draft;
 mic.onclick=()=>window.Desk?.townMic?.();
 function openChat(indicator){close();window.Desk?.openRoomChat?.(indicator);}
 form.querySelector('[data-expand]').onclick=()=>openChat(false);
 mark.onclick=()=>openChat(true);
 // The canvas resolves actor hits after pointerup. Other launcher surfaces can
 // dismiss on click without cancelling a drag or stealing touches inside the form.
 document.addEventListener('click',event=>{
  if(!event.target.closest('#town-compose,#town-mark,#town-options,#scene'))close();
 },true);
 window.closeTown=close;window.townEvent=update;
 window.visualViewport?.addEventListener('resize',layout);
 window.visualViewport?.addEventListener('scroll',layout);
 controls();
 let pollTimer=0;
 function poll(){
  clearTimeout(pollTimer);
  if(!active||document.hidden)return;
  post('state');
  pollTimer=setTimeout(poll,roomBusy||pending?2200:5500);
 }
 poll();
 return {tap,anchor,close,speakPhrase,stopPhrase,refresh:()=>post('state',{activate:true}),get playing(){return !!answer;},get composing(){return open;},active(value){
  if(active===value)return;active=value;
  if(!value){clearTimeout(pollTimer);clearTimeout(timer);phrase=null;page='';answer=null;spoken=false;pending=null;mic.classList.remove('listening');controls();}
  else poll();
  layout();
 }};
}
