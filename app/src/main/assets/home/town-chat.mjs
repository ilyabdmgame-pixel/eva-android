export function townChat({note,quip,world,apply}){
 const form=document.getElementById('town-compose'),input=form.querySelector('input'),
 mic=form.querySelector('[data-mic]'),send=form.querySelector('[type=submit]'),
 mark=document.getElementById('town-mark'),bubble=document.getElementById('town-answer'),
 choices=document.getElementById('town-options');
 const labels={working:'Ева работает',done:'Дело готово',question:'Ева ждёт ответа'};
 const post=(op,extra={})=>window.Desk?.town?.(JSON.stringify({op,...extra}));
 let active=!document.hidden,open=false,head=null,covered=false,roomBusy=false,pending=null,showTimer=0,position=null;
 let status='idle',answer=null,choicePoll=null,words=[],page='',timer=0,spoken=false,ack='',lastDraft='';
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
 function close(){if(!open&&!showTimer)return false;clearTimeout(showTimer);showTimer=0;open=false;position=null;input.blur();layout();return true;}
 function tap(){
  if(open||showTimer){close();return;}
  if(!answer)quip();
  showTimer=setTimeout(()=>{showTimer=0;open=true;layout();post('state',{activate:true});},300);
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
   answer={...data.answer};
   const token=sessionStorage.getItem('townActionToken'),match=answer.text.match(/\[town ([a-z0-9-]+) ([0-9]+) ([a-zA-Z]+)\]\s*$/);
   if(token&&match&&match[1]===token){
     sessionStorage.removeItem('townActionToken');answer.text=answer.text.slice(0,match.index).trim();
     const report=apply(Number(match[2]),match[3]);note(report);answer.text||=report;
   }
   document.querySelector('#speech [data-speaker="15"]')?.style.setProperty('display','none');
   choicePoll=window.EvaQuestions?.parse(answer.text)||null;
   if(choicePoll){showChoices();return;}
   if(data.voice&&data.voiceName==='silero-kseniya'){
    spoken=true;post('synthesize',{id:answer.id,text:answer.text,rate:data.rate,accent:data.accent,yo:data.yo});
   }else if(data.voice&&window.Desk?.townSpeak){spoken=true;Desk.townSpeak(answer.id,answer.text);}
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
 form.querySelector('[data-expand]').onclick=()=>post('open');
 mark.onclick=()=>post('open',{indicator:true});
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
 return {tap,anchor,close,get playing(){return !!answer;},get composing(){return open||!!showTimer;},active(value){
  if(active===value)return;active=value;
  if(!value){clearTimeout(pollTimer);clearTimeout(timer);clearTimeout(showTimer);showTimer=0;page='';answer=null;spoken=false;pending=null;mic.classList.remove('listening');controls();}
  else poll();
  layout();
 }};
}
