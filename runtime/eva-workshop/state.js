'use strict';
// Local run reservations. A stale active reservation intentionally blocks new runs.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function withState(dir,mutate){
 fs.mkdirSync(dir,{recursive:true,mode:0o700});const lock=path.join(dir,'lock');
 try{fs.mkdirSync(lock,{mode:0o700})}catch(e){if(e.code==='EEXIST')throw Error('Учёт занят или нуждается в восстановлении');throw e}
 const file=path.join(dir,'state.json');let temp=null;
 try{
  let state;try{state=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw Error('Не удалось прочитать учёт запусков');state={version:1,day:null,starts:0,running:null}}
  if(state.version!==1||!Number.isInteger(state.starts)||state.starts<0||!(state.day===null||typeof state.day==='string'))throw Error('Некорректный учёт запусков');
  const result=mutate(state);
  temp=path.join(dir,'.state-'+crypto.randomBytes(8).toString('hex'));const fd=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(state)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(temp,file);temp=null;return result;
 }finally{if(temp)try{fs.unlinkSync(temp)}catch{}fs.rmdirSync(lock)}
}
function syncWeek(dir,week,now=Date.now()){return withState(dir,s=>{if(s.running)throw Error("Предыдущий запуск ещё активен или требует проверки");if(!s.week)s.week={resetAt:week.resetsAt,spent:10,unknown:true};else if(s.week.resetAt!==week.resetsAt){if(s.week.resetAt*1000>now||week.resetsAt*1000<=now)throw Error("Недостоверная смена недельного окна");s.week={resetAt:week.resetsAt,spent:0}}return s.week})}
function reserve(dir,day,maxRuns,check){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isInteger(maxRuns)||maxRuns<1||maxRuns>2)throw Error('Неверные параметры запуска');return withState(dir,state=>{if(state.running)throw Error('Предыдущий запуск ещё активен или требует проверки');if(state.day!==day){state.day=day;state.starts=0}if(state.starts>=maxRuns)throw Error('Дневной предел запусков исчерпан');if(!check||!state.week||state.week.resetAt!==check.weekResetAt||state.week.spent!==check.spentBefore)throw Error('Недельный учёт изменился');const id=crypto.randomUUID();state.starts++;state.running={id,startedAt:new Date().toISOString(),baseline:check.baseline,weekResetAt:check.weekResetAt};return {id,starts:state.starts}})}
function finish(dir,id,status,week){if(typeof id!=='string'||!['completed','stopped','failed'].includes(status))throw Error('Неверный результат');return withState(dir,state=>{if(!state.running||state.running.id!==id)throw Error('Запуск не совпадает');if(!week||!state.week||week.resetsAt!==state.running.weekResetAt||state.week.resetAt!==week.resetsAt||!Number.isInteger(week.usedPercent)||week.usedPercent<state.running.baseline)throw Error('Нельзя надёжно определить недельный расход');state.week.spent+=week.usedPercent-state.running.baseline;state.last={id,status,finishedAt:new Date().toISOString()};state.running=null;return state.last})}
function grantFreshBudget(dir,week,now=Date.now()){
 return withState(dir,state=>{
  if(state.running)throw Error('Мастерская уже работает');
  if(!state.week?.unknown||state.week.resetAt!==week.resetsAt||week.resetsAt*1000<=now)throw Error('Нет неизвестного расхода в текущем недельном окне');
  state.week={resetAt:week.resetsAt,spent:0};
  return state.week;
 });
}
module.exports={syncWeek,reserve,finish,grantFreshBudget};
