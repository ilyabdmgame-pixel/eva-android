'use strict';
const fs=require('fs'),path=require('path');
module.exports=function townChat({rpc,cards,authenticated,root,questionPending=()=>false}){
 const file=path.join(root,'town-chat.json');
 let data={};try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const running=new Map(),messages=new Map();
 let creating=null,resumed=false,sending=false,navigate=null,voiceMode=false;
 const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file)};
 async function room(){
   if(!creating)creating=(async()=>{
     if(!data.thread){const r=await rpc('thread/start',{cwd:'/root'});data.thread=r.thread.id;save();resumed=true;}
     else if(!resumed){
       try{await rpc('thread/resume',{threadId:data.thread});resumed=true;}
       catch(e){
         if(!/no rollout found|list_turns is not supported yet/i.test(e.message))throw e;
         let missing=false;
         try{
           const r=await rpc('thread/read',{threadId:data.thread,includeTurns:true});
           const t=r.thread;
           if(!t||t.id!==data.thread||t.status?.type!=='idle'||t.preview||!Array.isArray(t.turns)||t.turns.length)throw e;
           missing=true;
         }catch(readError){
           if(/no rollout found/i.test(e.message)&&/thread not loaded/i.test(readError.message))missing=true;
           else throw readError;
         }
         if(!missing)throw e;
         // Preserve the old identifier so a missing rollout can still be recovered later.
         const previousThread=data.thread;
         const fresh=await rpc('thread/start',{cwd:'/root'});
         data.previousThreads=Array.isArray(data.previousThreads)?data.previousThreads:[];
         if(!data.previousThreads.includes(previousThread))data.previousThreads.push(previousThread);
         data.thread=fresh.thread.id;save();resumed=true;
       }
     }
     return data.thread;
   })().finally(()=>{creating=null});
   return creating;
 }
 function event(m){
   const p=m.params||{},thread=p.threadId||p.thread_id,turn=p.turnId||p.turn_id||p.turn?.id;
   if(!thread||!turn)return;
   if(m.method==='turn/started'){
     running.set(thread,turn);
     if(thread===data.thread&&data.question){delete data.question;save();}
   }
   if(thread===data.thread&&m.method==='item/completed'&&p.item?.type==='agentMessage'&&p.item.phase!=='commentary')
     messages.set(turn,String(p.item.text||'').slice(0,64000));
   if(m.method==='turn/completed'){
     if(running.get(thread)===turn)running.delete(thread);
     if(thread===data.thread){
       data.answer={id:turn,text:messages.get(turn)||(p.turn?.status==='completed'?'Дело закончено. Подробности в чате.':p.turn?.error?.message||'Задача остановилась.')};
       const final=data.answer.text.trim();
       if(p.turn?.status==='completed'&&(/```eva-poll\s/.test(final)||final.endsWith('?')))data.question=turn;
       messages.delete(turn);save();
     }
   }
 }
 function card(){const list=cards.list();return list.find(c=>c.waiting)||list[0]}
 function settingsForChat(){try{return JSON.parse(fs.readFileSync(path.join(root,'voice-settings.json'),'utf8'))}catch{return {}}}
 function state(){
   const c=card(),settings=settingsForChat();
   return {status:c?.waiting||data.question||questionPending(data.thread)?'question':sending||running.size?'working':data.answer||c?'done':'idle',
     answer:data.answer||null,voiceName:settings.voiceName||'',rate:Number(settings.voiceRate)||1,accent:settings['silero-accent']!=='0',yo:settings['silero-yo']!=='0',voice:voiceMode||settings.voiceOutput==='1',roomBusy:sending||running.has(data.thread)};
 }
 async function run(o){
   switch(o.op){
    case 'state':return state();
    case 'send':{
     if(!authenticated())throw Error('Открой Еву и войди в аккаунт Codex.');
     if(typeof o.text!=='string'||!o.text.trim()||o.text.length>8000)throw Error('Нужно сообщение длиной до 8000 знаков.');
     if(typeof o.id!=='string'||! /^[a-z0-9-]{8,80}$/i.test(o.id))throw Error('Некорректная отправка.');
     if(data.lastSend===o.id)return state();
     if(sending||running.has(data.thread))throw Error('Ева ещё отвечает в этом чате.');
     sending=true;
     try{const id=await room(),s=settingsForChat(),full=s['eva-codex-access']==='full';
       const options={approvalPolicy:full?'never':'on-request',sandboxPolicy:{type:full?'dangerFullAccess':'readOnly'}};
       if(s['eva-codex-model'])options.model=s['eva-codex-model'];
       if(['minimal','low','medium','high','xhigh'].includes(s['eva-main-effort']))options.effort=s['eva-main-effort'];
       const params={...options,threadId:id,input:[{type:'text',text:o.text.trim()}],serviceTierForTurn:'default'};
       let r;
       try{r=await rpc('turn/start',params)}
       catch(e){
         if(!/thread not loaded/i.test(e.message))throw e;
         resumed=false;
         const retryId=await room();
         params.threadId=retryId;
         r=await rpc('turn/start',params);
       }
       if(data.answer?.id!==r.turn.id)running.set(params.threadId,r.turn.id);data.lastSend=o.id;save();
     }finally{sending=false}
     return state();
    }
    case 'read':if(data.answer?.id===o.id){cards.read(data.thread,o.id,null);delete data.answer;save()}return state();
    case 'open':{const c=o.indicator&&card();
     const id=c?.waiting?c.thread:o.indicator&&data.question?data.thread:o.indicator&&running.size?[...running.keys()].at(-1):o.indicator&&!data.answer&&c?c.thread:await room();
     navigate={id,card:c?.thread===id?c:null,answer:id===data.thread?data.answer?.id:null};return {open:true};}
    case 'destination':return {id:navigate?.id||null};
    case 'opened':if(navigate&&navigate.id===o.id){const c=navigate.card;if(c&&!c.waiting)cards.read(c.thread,c.turn,null);if(data.answer&&navigate.answer===data.answer.id){cards.read(data.thread,data.answer.id,null);delete data.answer;save()}navigate=null}return {};
    case 'voice':voiceMode=o.enabled===true;return {};
    default:throw Error('Неизвестное действие');
   }
 }
 return {run,event};
};
