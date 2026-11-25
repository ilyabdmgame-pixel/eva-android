#!/usr/bin/env node
'use strict';
// JSON on stdin: {messages:[...], model?:"vendor/model:free"}, or {requests:[{provider,messages,model?}, ...]}.
const {chat}=require('./providers');
const allowed=['gemini','deepseek','openrouter','claude'];
(async()=>{
 let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>600000)throw Error('Контекст слишком большой')}
 const data=JSON.parse(input),parallel=Array.isArray(data.requests),requests=parallel?data.requests:[{...data,provider:process.argv[2]}];
 if(!requests.length||requests.length>4)throw Error('Допускается от одного до четырёх запросов');
 for(const req of requests)if(!allowed.includes(req.provider)||!Array.isArray(req.messages))throw Error('Укажите провайдера и массив messages');
 const run=async req=>{try{return {provider:req.provider,model:req.model||null,...await chat({provider:req.provider,messages:req.messages,model:req.model},AbortSignal.timeout(120000))}}catch(e){return {provider:req.provider,model:req.model||null,error:e.message}}};
 const results=await Promise.all(requests.map(run));
 process.stdout.write(JSON.stringify(parallel?{results}:results[0])+'\n');
 if(results.every(x=>x.error))process.exitCode=1;
})().catch(e=>{process.stderr.write('Ошибка консультации: '+e.message+'\n');process.exitCode=1});
