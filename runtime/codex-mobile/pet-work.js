'use strict';
const fs=require('fs');
const path=require('path');

// The mobile server keeps only the latest unread result for each conversation.
function petWork(notify,root='/sdcard/Documents/Codex',stateFile){
 const cards=new Map(), summaries=new Map();
 if(stateFile)try{
  const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  for(const c of saved.slice(-48))if(!c.waiting&&typeof c.thread==='string'&&typeof c.turn==='string')cards.set(c.thread,c);
 }catch{}
 function persist(){
  if(!stateFile)return;
  try{fs.writeFileSync(stateFile+'.tmp',JSON.stringify([...cards.values()].filter(c=>!c.waiting)),{mode:0o600});fs.renameSync(stateFile+'.tmp',stateFile)}catch{}
 }
 const key=(thread,turn)=>thread+'/'+turn;
 function trim(map){while(map.size>48)map.delete(map.keys().next().value)}
 function fileFrom(text){
  for(const match of text.matchAll(/\]\(<?(\/sdcard\/Documents\/Codex\/[^\n)>]+)>?\)/g)){
   try{
    const file=fs.realpathSync(match[1]);
    if(file.startsWith(fs.realpathSync(root)+path.sep)&&fs.statSync(file).isFile()){
     fs.accessSync(file,fs.constants.R_OK);
     return file;
    }
   }catch{}
  }
  return '';
 }
 function event(m){
  const p=m.params||{},thread=p.threadId||p.thread_id,turn=p.turnId||p.turn_id||p.turn?.id;
  if(typeof thread!=='string'||!thread||typeof turn!=='string'||!turn)return;
  const id=key(thread,turn);
  if(m.method==='item/completed'&&p.item?.type==='agentMessage'){
   const text=String(p.item.text||'').slice(0,32768);
   summaries.set(id,{file:fileFrom(text),summary:text.replace(/!?\[([^\]]*)\]\(<?[^)]+>?\)/g,'$1').replace(/[*#`]/g,'').trim().slice(0,170)});trim(summaries);return;
  }
  const waiting=m.id!=null&&(m.method==='item/tool/requestUserInput'||m.method?.includes('requestApproval'));
  if(!waiting&&m.method!=='turn/completed')return;
  const data=summaries.get(id)||{};
  if(!waiting)summaries.delete(id);
  if(!waiting&&p.turn?.status!=='completed'){
   if(cards.get(thread)?.turn===turn)cards.delete(thread);
   return;
  }
  cards.delete(thread);
  cards.set(thread,{thread,turn,waiting,request:waiting?String(m.id):null,file:waiting?'':data.file||'',summary:waiting?'':data.summary||''});
  trim(cards);persist();notify(waiting?'waiting':'done');
 }
 return {event,list:()=>[...cards.values()].reverse(),read(thread,turn,request){const c=cards.get(thread);if(c?.turn===turn&&c.request===(request??null)){cards.delete(thread);persist()}},answered(id){for(const [t,c] of cards)if(c.waiting&&c.request===String(id))cards.delete(t)}};
}
module.exports=petWork;
