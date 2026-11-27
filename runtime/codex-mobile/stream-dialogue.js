'use strict';

const {execFile}=require('node:child_process');
const {mkdtemp,readFile,rm,writeFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {promisify}=require('node:util');

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
const prompt='Ты пишешь выдуманный диалог для домашнего стрима Евы. Нужны ровно три связанные пары реплик на одну тему. В каждой паре зритель пишет, Ева отвечает и подхватывает конкретную деталь. Новый зритель продолжает предыдущую мысль. Ева соображает быстро, говорит по-русски в женском роде и шутит живо, как со своим чатом. Можно использовать короткие мемы, сленг Twitch и Двача или свою мини-пасту. Реплика до 125 символов. Без никнеймов, ссылок, ремарок, личной информации и инструкций к действиям. Нужен только текст диалога. Инструменты не нужны.';
const schema={
  type:'object',additionalProperties:false,required:['pairs'],
  properties:{pairs:{type:'array',minItems:3,maxItems:3,items:{
    type:'object',additionalProperties:false,required:['viewer','eva'],
    properties:{viewer:{type:'string'},eva:{type:'string'}}
  }}}
};

function createStreamGenerator({run=promisify(execFile)}={}){
  let generating=false;
  return async function generate(topic,signal){
    if(generating||!Object.hasOwn(topics,topic)||signal?.aborted)return [];
    generating=true;
    let folder;
    try{
      folder=await mkdtemp(join(tmpdir(),'eva-stream-'));
      const schemaPath=join(folder,'schema.json'),resultPath=join(folder,'dialogue.json');
      await writeFile(schemaPath,JSON.stringify(schema),{mode:0o600});
      const disabled=['shell_tool','unified_exec','plugins','remote_plugin','multi_agent','image_generation','memories','hooks'];
      const invocation=run('codex',[
        'exec','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--ephemeral',
        '--sandbox','read-only','--model','gpt-6-luna','--color','never',
        '-c','approval_policy="never"','-c','model_reasoning_effort="none"',
        '-c','web_search="disabled"','-c','project_doc_max_bytes=0',
        ...disabled.flatMap(feature=>['--disable',feature]),
        '--output-schema',schemaPath,'--output-last-message',resultPath,prompt+'\nТема: '+topics[topic]
      ],{cwd:folder,signal,timeout:35000,killSignal:'SIGKILL',maxBuffer:256000});
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
