#!/usr/bin/env node
'use strict';
// JSON on stdin: {"prompt":"...", "model":"...:free"}.
const {image}=require('./providers');
(async()=>{let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>16000)throw Error('Слишком длинный запрос')};const args=JSON.parse(input);const result=await image(args,AbortSignal.timeout(180000));console.log(JSON.stringify(result))})().catch(e=>{console.error('Ошибка генерации: '+e.message);process.exitCode=1});
