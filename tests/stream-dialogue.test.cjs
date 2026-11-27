'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {stat,writeFile}=require('node:fs/promises');
const {createStreamGenerator}=require('../runtime/codex-mobile/stream-dialogue');

test('stream chooses the lowest published rate across available model pages',async()=>{
  let directory,stdinClosed=false;
  const pages=[];
  const lines=Array.from({length:3},(_,i)=>({viewer:'Вопрос '+i,eva:'Ответ '+i}));
  const run=async(program,args,options)=>{
    assert.equal(program,'codex');
    assert.equal(args[args.indexOf('--model')+1],'gpt-6-luna');
    assert(args.includes('model_reasoning_effort="low"'));
    assert(args.includes('service_tier="default"'));
    assert(args.includes('--ephemeral')&&args.includes('--ignore-user-config')&&args.includes('shell_tool'));
    assert.match(args.at(-1),/Неожиданный кухонный спор/);
    assert.match(args.at(-1),/Ты Ева, персональная ИИ-помощница/);
    directory=options.cwd;
    assert(options.timeout<=35000);
    await writeFile(args[args.indexOf('--output-last-message')+1],JSON.stringify({pairs:lines}));
  };
  const generate=createStreamGenerator({
    listModels:async options=>{
      pages.push(options);
      return options.cursor
        ? {data:[{model:'gpt-6-luna',supportedReasoningEfforts:[{reasoningEffort:'low'}]}]}
        : {data:[{model:'gpt-6.2-sol',isDefault:true},{model:'gpt-5.6-luna'}],nextCursor:'page-2'};
    },
    run:(...args)=>Object.assign(run(...args),{child:{stdin:{end(){stdinClosed=true}}}})
  });
  assert.deepEqual(await generate('private message'),[]);
  assert.deepEqual(await generate('kitchen'),lines.map(({viewer,eva})=>[viewer,eva]));
  assert.deepEqual(pages,[{limit:100},{limit:100,cursor:'page-2'}]);
  assert(stdinClosed);
  await assert.rejects(stat(directory),{code:'ENOENT'});
});

test('stream picks the cheapest visible model and recovers from a failed request',async()=>{
  let attempts=0;
  const generate=createStreamGenerator({
    listModels:async()=>({data:[{model:'gpt-6-luna',hidden:true},{model:'gpt-5.6-luna'},{model:'unknown'}]}),
    run:async(program,args)=>{
      assert.equal(args[args.indexOf('--model')+1],'gpt-5.6-luna');
      attempts++;
      throw new Error('unavailable');
    }
  });
  assert.deepEqual(await generate('music'),[]);
  assert.deepEqual(await generate('music'),[]);
  assert.equal(attempts,2);
});

test('stream uses local dialogue when the catalogue has no model with a known rate',async()=>{
  const run=()=>assert.fail('Unpriced models must not start a request');
  const generate=createStreamGenerator({run,listModels:async()=>({data:[{model:'unknown'}]})});
  assert.deepEqual(await generate('pets'),[]);
});
