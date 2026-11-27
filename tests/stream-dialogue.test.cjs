'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {stat,writeFile}=require('node:fs/promises');
const {createStreamGenerator}=require('../runtime/codex-mobile/stream-dialogue');

test('Luna generates one isolated dialogue using only an allowlisted topic and a temporary directory',async()=>{
  let directory,stdinClosed=false;
  const lines=Array.from({length:3},(_,i)=>({viewer:'Вопрос '+i,eva:'Ответ '+i}));
  const run=async(program,args,options)=>{
    assert.equal(program,'codex');
    assert.equal(args[args.indexOf('--model')+1],'gpt-6-luna');
    assert(args.includes('--ephemeral')&&args.includes('--ignore-user-config')&&args.includes('shell_tool'));
    assert.match(args.at(-1),/Неожиданный кухонный спор/);
    directory=options.cwd;
    assert(options.timeout<=35000);
    await writeFile(args[args.indexOf('--output-last-message')+1],JSON.stringify({pairs:lines}));
  };
  const generate=createStreamGenerator({run:(...args)=>Object.assign(run(...args),{
    child:{stdin:{end(){stdinClosed=true}}}
  })});
  assert.deepEqual(await generate('private message'),[]);
  assert.deepEqual(await generate('kitchen'),lines.map(({viewer,eva})=>[viewer,eva]));
  assert(stdinClosed);
  await assert.rejects(stat(directory),{code:'ENOENT'});
});

test('Luna failure leaves no partial dialogue and allows a later attempt',async()=>{
  let attempts=0;
  const generate=createStreamGenerator({run:async()=>{attempts++;throw new Error('unavailable')}});
  assert.deepEqual(await generate('music'),[]);
  assert.deepEqual(await generate('music'),[]);
  assert.equal(attempts,2);
});
