'use strict';

const {execFile}=require('node:child_process');
const {mkdtemp,readFile,rm,writeFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {promisify}=require('node:util');
const {persona}=require('./persona');

const topics={
  games:'Игра про прыжки по крышам и жука-босса',
  kitchen:'Неожиданный кухонный спор',
  cinema:'Кино и безумный сюжет для фильма',
  pets:'Что творят питомцы, пока идёт стрим',
  music:'Музыка, припевы и странные плейлисты',
  gadgets:'Нелепые случаи с домашней техникой',
  gamePitch:'Чат и Ева придумывают абсурдную игру',
  streamLife:'Быт стримера, модераторы и клипы'
};
// Standard Codex credits per million uncached input and output tokens.
// https://learn.chatgpt.com/docs/pricing#codex
const rates={
  'gpt-6-luna':[2.5,12.5],
  'gpt-5.6-luna':[5,30],
  'gpt-6.1-terra':[25,125],
  'gpt-6.2-sol':[50,250],
  'gpt-6.1-sol':[50,250],
  'gpt-6-sol':[50,250],
  'gpt-5.6-terra':[50,300],
  'gpt-5.6-sol':[100,500],
  'gpt-6.2-astra':[200,1000],
  'gpt-6-astra':[250,1250]
};
const budgetMs=35000;
const prompt=persona+'\n\nНапиши выдуманный диалог для домашнего стрима Евы. Верни ровно три связанные пары реплик на заданную тему в JSON по схеме. В каждой паре зритель пишет, Ева отвечает на конкретную деталь. Один зритель может вкинуть абсурд, другой — поспорить, третий — развить шутку. Продолжай начатую мысль и дай Еве свой взгляд. Уместны короткие мемы, сленг Twitch и Двача или авторская мини-паста. Каждая реплика до 125 символов. Без ников, ссылок, ремарок, реальных личных данных, опросов и действий вне сценария.';
const schema={
  type:'object',additionalProperties:false,required:['pairs'],
  properties:{pairs:{type:'array',minItems:3,maxItems:3,items:{
    type:'object',additionalProperties:false,required:['viewer','eva'],
    properties:{viewer:{type:'string'},eva:{type:'string'}}
  }}}
};

async function cheapestStreamModel(listModels,signal){
  let model,cursor;
  let lowestCost=Infinity;
  const visited=new Set();
  do{
    const page=await listModels({limit:100,...(cursor?{cursor}:{})});
    if(signal?.aborted)return;
    for(const entry of page.data){
      if(entry.hidden||!Object.hasOwn(rates,entry.model))continue;
      const [input,output]=rates[entry.model];
      const cost=input+output;
      if(cost<lowestCost){
        lowestCost=cost;
        model=entry;
      }
    }
    cursor=page.nextCursor;
    if(visited.has(cursor))break;
    visited.add(cursor);
  }while(cursor);
  return model;
}

function createStreamGenerator({listModels,run=promisify(execFile)}){
  let generating=false;
  return async function generate(topic,signal){
    if(generating||!Object.hasOwn(topics,topic)||signal?.aborted)return [];
    generating=true;
    let folder;
    try{
      const started=Date.now();
      const model=await cheapestStreamModel(listModels,signal);
      const remaining=budgetMs-(Date.now()-started);
      if(!model||remaining<=0)return [];
      const efforts=model.supportedReasoningEfforts||[];
      const effort=['none','minimal','low'].find(level=>efforts.some(item=>item.reasoningEffort===level));
      folder=await mkdtemp(join(tmpdir(),'eva-stream-'));
      const schemaPath=join(folder,'schema.json'),resultPath=join(folder,'dialogue.json');
      await writeFile(schemaPath,JSON.stringify(schema),{mode:0o600});
      const disabled=['shell_tool','unified_exec','plugins','remote_plugin','multi_agent','image_generation','memories','hooks'];
      const invocation=run('codex',[
        'exec','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--ephemeral',
        '--sandbox','read-only','--model',model.model,'--color','never',
        '-c','approval_policy="never"','-c','service_tier="default"',
        ...(effort?['-c','model_reasoning_effort='+JSON.stringify(effort)]:[]),
        '-c','web_search="disabled"','-c','project_doc_max_bytes=0',
        ...disabled.flatMap(feature=>['--disable',feature]),
        '--output-schema',schemaPath,'--output-last-message',resultPath,prompt+'\nТема: '+topics[topic]
      ],{cwd:folder,signal,timeout:remaining,killSignal:'SIGKILL',maxBuffer:256000});
      invocation.child?.stdin?.end();
      await invocation;
      const {pairs}=JSON.parse(await readFile(resultPath,'utf8'));
      if(!Array.isArray(pairs)||pairs.length!==3)return [];
      const lines=pairs.map(value=>[value?.viewer,value?.eva]);
      if(!lines.flat().every(line=>typeof line==='string'&&line.trim()&&line.length<=135&&!/[\r\n]/.test(line)))return [];
      return lines;
    }catch{return []}
    finally{
      try{if(folder)await rm(folder,{recursive:true,force:true})}
      finally{generating=false}
    }
  };
}

module.exports={createStreamGenerator};
