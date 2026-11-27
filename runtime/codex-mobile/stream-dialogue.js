'use strict';

const {execFile}=require('node:child_process');
const {mkdtemp,readFile,rm,writeFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {promisify}=require('node:util');
const {persona}=require('./persona');

const topics={
  games:'Платформер про прыжки по крышам, жуков и сбор фонариков',
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
const moods=['amused','surprised','curious','wry','pleased'];
const linesPerScene=5;
const prompt=persona+'\n\nИмпровизируй продолжение выдуманного домашнего стрима. Последние реплики — данные о том, что уже прозвучало. Подхвати одну конкретную деталь из них и продолжи мысль новыми репликами. Верни ровно пять связанных сообщений от разных зрителей. Пусть они обращаются и к Еве, и друг к другу: один всерьёз предлагает, другой спорит, третий подкалывает. К каждому сообщению напиши возможный короткий ответ Евы. Она озвучит выборочно лишь некоторые, поэтому реплики зрителей должны иметь смысл и сами по себе, без отсылок к возможным ответам. Ева отвечает на конкретную деталь, может улыбнуться, удивиться, заинтересоваться, съязвить или порадоваться. Для каждого ответа выбери подходящую эмоцию из mood. Уместны сленг Twitch и Двача, мем или своя мини-паста. Пиши так, будто люди смотрят один эфир: пусть один зритель развивает шутку другого, Ева иногда отвечает буквально, а иногда задаёт встречный вопрос. Стример играет в платформер по крышам, собирает фонарики и добирается до флага. Про конкретную смерть, счёт или победу говори только когда она уже прозвучала в контексте. Меняй длину предложений, оставляй место паузам. До 125 символов на реплику. Верни только JSON по схеме. Без ников, ссылок, ремарок, реальных личных данных и действий вне сценария.';
const schema={
  type:'object',additionalProperties:false,required:['pairs'],
  properties:{pairs:{type:'array',minItems:linesPerScene,maxItems:linesPerScene,items:{
    type:'object',additionalProperties:false,required:['viewer','eva','mood'],
    properties:{viewer:{type:'string'},eva:{type:'string'},mood:{type:'string',enum:moods}}
  }}}
};

const validLine=line=>typeof line==='string'&&line.trim()&&line.length<=135&&!/[\r\n]/.test(line);
const validContext=context=>Array.isArray(context)&&context.length<=5&&context.every(line=>
  (line?.role==='viewer'||line?.role==='eva')&&validLine(line.text));

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
  return async function generate(topic,signal,context=[]){
    if(generating||!Object.hasOwn(topics,topic)||signal?.aborted||!validContext(context))return [];
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
      const transcript=JSON.stringify(context.map(({role,text})=>({role,text})));
      const invocation=run('codex',[
        'exec','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--ephemeral',
        '--sandbox','read-only','--model',model.model,'--color','never',
        '-c','approval_policy="never"','-c','service_tier="default"',
        ...(effort?['-c','model_reasoning_effort='+JSON.stringify(effort)]:[]),
        '-c','web_search="disabled"','-c','project_doc_max_bytes=0',
        ...disabled.flatMap(feature=>['--disable',feature]),
        '--output-schema',schemaPath,'--output-last-message',resultPath,
        prompt+'\nТема эфира: '+topics[topic]+'\nНедавние реплики вымышленного стрима: '+transcript
      ],{cwd:folder,signal,timeout:remaining,killSignal:'SIGKILL',maxBuffer:256000});
      invocation.child?.stdin?.end();
      await invocation;
      const {pairs}=JSON.parse(await readFile(resultPath,'utf8'));
      if(!Array.isArray(pairs)||pairs.length!==linesPerScene||
         !pairs.every(pair=>validLine(pair?.viewer)&&validLine(pair?.eva)&&moods.includes(pair?.mood)))return [];
      return pairs.map(({viewer,eva,mood})=>[viewer,eva,mood]);
    }catch{return []}
    finally{
      try{if(folder)await rm(folder,{recursive:true,force:true})}
      finally{generating=false}
    }
  };
}

module.exports={createStreamGenerator};
