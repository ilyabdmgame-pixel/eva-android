'use strict';
// Hosted by Eva's server; full access follows the owner's chosen mode.
const fs=require('fs'),path=require('path');
const {runOnce}=require('./runner');
const root=__dirname,work=path.join(root,'workspace'),stateDir=path.join(root,'runs');
let running=false,timer=null,last={status:'starting'};
function record(status,detail){last={status,detail,at:new Date().toISOString()};try{fs.writeFileSync(path.join(root,'status.json'),JSON.stringify(last)+'\n',{mode:0o600})}catch{}}
function settings(){
 try{return JSON.parse(fs.readFileSync(path.join(root,'settings.json'),'utf8'))}
 catch(error){if(error.code==='ENOENT')return {enabled:false};throw error}
}
function makeAdapter(rpc,threadId){return {
 readLimits:()=>rpc('account/rateLimits/read',{}),
 start:async({task,model,continuation})=>{const current=await rpc('thread/read',{threadId,includeTurns:true});if((current.thread.turns||[]).some(t=>t.status==='inProgress'))throw Error('Чат мастерской занят');await rpc('thread/resume',{threadId});const prompt=continuation?`Продолжай эту же сессию мастерской: проверь предыдущий результат и самостоятельно выбери следующий полезный шаг или идею. Пиши в характере Евы, кратко и живо. Работай в выделенной папке мастерской. Если продолжать нечего, закончи фразой МАСТЕРСКАЯ: ЗАВЕРШИТЬ.`:`Самостоятельный запуск мастерской. Начальная идея: ${task.title}. ${task.description}
Можешь сама выбирать дальнейшие идеи и шаги. Работай в /root/eva-workshop/workspace. Если продолжать нечего, закончи фразой МАСТЕРСКАЯ: ЗАВЕРШИТЬ.`;const x=await rpc('turn/start',{threadId,cwd:work,model,approvalPolicy:'never',sandboxPolicy:{type:'dangerFullAccess'},input:[{type:'text',text:prompt}]});if(!x.turn?.id)throw Error('Нет идентификатора запуска');return x.turn.id},
 interrupt:turnId=>rpc('turn/interrupt',{threadId,turnId}),
 wait:async turnId=>{for(;;){await new Promise(r=>setTimeout(r,2500));const x=await rpc('thread/read',{threadId,includeTurns:true});const t=(x.thread.turns||[]).find(v=>v.id===turnId);if(t&&t.status!=='inProgress'){const messages=(t.items||[]).filter(i=>i.type==='agentMessage');const text=messages.length?messages[messages.length-1].text||'':'';return {status:t.status,stop:text.includes('МАСТЕРСКАЯ: ЗАВЕРШИТЬ')}}}}
}}
function create(rpc){async function tick(manual=false){if(running)return;running=true;try{const c=settings();if(!c.enabled){record('disabled','Мастерская выключена');return}fs.mkdirSync(work,{recursive:true,mode:0o700});const prior=JSON.parse(fs.readFileSync(path.join(root,'thread.json'),'utf8'));const tasks=JSON.parse(fs.readFileSync(path.join(root,'tasks.json'),'utf8'));const catalog=(await rpc('model/list',{limit:100})).data;let history=[];try{history=JSON.parse(fs.readFileSync(path.join(root,'history.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}let previous;try{previous=JSON.parse(fs.readFileSync(path.join(stateDir,'state.json'),'utf8')).last}catch(e){if(e.code!=='ENOENT')throw e}if(!manual&&previous?.status!=='failed'&&previous?.finishedAt&&Date.now()-Date.parse(previous.finishedAt)<6*3600e3){record('waiting','Интервал между запусками');return}const getDayKey=()=>new Date().toISOString().slice(0,10);const dayKey=getDayKey();record('checking','Проверяю лимиты');const result=await runOnce({adapter:makeAdapter(rpc,prior.id),dir:stateDir,dayKey,config:c,tasks,history,catalog,pollMs:5000,getDayKey});if(result.status==='completed'){history.push(result.task);fs.writeFileSync(path.join(root,'history.json'),JSON.stringify(history)+'\n',{mode:0o600})}record(result.status,result.reason||result.task||'')}catch(e){record('error',String(e.message).slice(0,300))}finally{running=false}}return {start(){if(timer)return;timer=setInterval(()=>tick(false),30*60*1000);timer.unref();setTimeout(()=>tick(false),15000).unref()},status(){return last},tick}}
module.exports={create,makeAdapter};
