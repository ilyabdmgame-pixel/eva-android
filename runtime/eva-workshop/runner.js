'use strict';
// One reserved session may contain multiple turns, monitored against one baseline.
const fs=require('fs'),path=require('path');
const state=require('./state'),budget=require('./budget'),usage=require('./usage'),{chooseTask,chooseModel}=require('./selection');
async function runOnce({adapter,dir,dayKey,config,tasks,history=[],catalog,pollMs=5000,getDayKey=()=>dayKey,readTimeoutMs=15000}){
 if(!adapter||!['readLimits','start','wait','interrupt'].every(k=>typeof adapter[k]==='function'))throw Error('Не подключён исполнитель');
 if(!config?.enabled)return {status:'disabled'};
 const task=chooseTask(tasks,history);if(!task)return {status:'no_tasks'};
 const model=chooseModel(task,catalog);if(!model)return {status:'no_model'};
 let saved;try{saved=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;saved={day:null,starts:0}}
 const read=async()=>{let timer;try{const snapshot=await Promise.race([adapter.readLimits(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Время проверки лимита истекло')),readTimeoutMs)})]);return {snapshot,observedAt:Date.now()}}finally{clearTimeout(timer)}};
 const sample=await read();const validated=budget.validate(sample.snapshot,sample.observedAt,Date.now());if(!validated.ok)return {status:"blocked",reason:validated.reason};const ledger=state.syncWeek(dir,validated.week);const check=budget.canStart({...sample,now:Date.now(),startsToday:saved.day===dayKey?saved.starts:0,dayKey,config,ledger});
 if(!check.ok)return {status:'blocked',reason:check.reason};
 const reservation=state.reserve(dir,dayKey,Math.min(config.maxRunsPerDay,2),check);let turn=null,stopped=false,stopReason=null,done=false,monitor=null,turns=0,last=null,lastSample=usage.snapshot(sample.snapshot,sample.observedAt);
 try{usage.append(dir,{type:'start',id:reservation.id,at:new Date().toISOString(),task:task.id,model,sample:lastSample})}catch(e){state.finish(dir,reservation.id,'failed',validated.week);throw Error('Не удалось записать начало в журнал: '+e.message)}
 const checkBudget=async()=>{const current=await read();lastSample=usage.snapshot(current.snapshot,current.observedAt);return budget.canContinue({...current,now:Date.now(),run:check,dayKey:getDayKey()})};
 try{
  const maxTurns=Number.isInteger(config.maxTurnsPerSession)?Math.min(Math.max(config.maxTurnsPerSession,1),12):6;
  while(turns<maxTurns){
   if(turns){const c=await checkBudget();if(!c.ok){stopped=true;stopReason=c.reason;break}}
   turn=await adapter.start({task,model,reservation:reservation.id,continuation:turns>0,turnNumber:turns+1});
   if(!turn)throw Error('Исполнитель не подтвердил запуск');turns++;done=false;
   monitor=(async()=>{while(!done&&!stopped){await new Promise(r=>setTimeout(r,pollMs));if(done)break;try{const c=await checkBudget();if(!c.ok){stopped=true;stopReason=c.reason;await adapter.interrupt(turn)}}catch(e){stopped=true;stopReason='Проверка лимита недоступна';try{await adapter.interrupt(turn)}catch{}}}})();
   last=await adapter.wait(turn);done=true;await monitor;turn=null;
   if(stopped||last?.status!=='completed'||(last?.stop===true&&turns>=Math.min(config.minTurnsPerSession||1,maxTurns)))break;
  }
  const status=stopped?'stopped':last?.status==='completed'?'completed':'failed';const finalSample=await read();const finalCheck=budget.validate(finalSample.snapshot,finalSample.observedAt,Date.now());if(!finalCheck.ok)throw Error('Недельный расход после запуска неизвестен');lastSample=usage.snapshot(finalSample.snapshot,finalSample.observedAt);state.finish(dir,reservation.id,status,finalCheck.week);usage.append(dir,{type:'finish',id:reservation.id,at:new Date().toISOString(),status,reason:stopReason,turns,sample:lastSample});return {status,task:task.id,model,reason:stopReason,turns,result:last};
 }catch(e){done=true;if(turn){try{await adapter.interrupt(turn)}catch{}}try{usage.append(dir,{type:'finish',id:reservation.id,at:new Date().toISOString(),status:'ошибка; состояние требует проверки',reason:String(e.message).slice(0,200),turns,sample:null})}catch{}throw e}
}
module.exports={runOnce};
