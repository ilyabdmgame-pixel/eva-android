'use strict';

function windows(data,now){
 const bucket=data.rateLimitsByLimitId?.codex??data.rateLimits;
 const available=[bucket?.primary,bucket?.secondary].filter(Boolean);
 function find(minutes){
  const window=available.find(entry=>entry.windowDurationMins===minutes);
  if(!window||!Number.isInteger(window.usedPercent)||window.usedPercent<0||window.usedPercent>100||
    !Number.isInteger(window.resetsAt)||window.resetsAt*1000<=now)return null;
  return {remaining:100-window.usedPercent,resetsAt:window.resetsAt};
 }
 return {fiveHour:find(300),week:find(10080),observedAt:now};
}

function createRateLimits(read,now=Date.now){
 let last=null,pending=null,nextRefresh=0;
 function refresh(){
  if(pending)return pending;
  const request=Promise.resolve().then(read).then(data=>{
   const result=windows(data,now());
   if(pending===request){
    last=result;
    nextRefresh=Math.min(now()+60000,result.week?result.week.resetsAt*1000:Infinity);
   }
   return result;
  }).catch(error=>{
   if(pending===request)nextRefresh=now()+60000;
   throw error;
  }).finally(()=>{
   if(pending===request)pending=null;
  });
  pending=request;
  return request;
 }
 return {
  refresh,
  week(){
   if(now()>=nextRefresh)refresh().catch(()=>{});
   return last?.week?.resetsAt*1000>now()?last.week:null;
  },
  clear(){last=null;pending=null;nextRefresh=0;}
 };
}
module.exports={createRateLimits,windows};
