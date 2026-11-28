'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs');
const os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process'),vm=require('node:vm');
const runtime=path.resolve(__dirname,'../runtime/codex-mobile');
const {cleanPng,makeProfile}=require(path.join(runtime,'personal-profile'));

function chunk(type,bytes) {
  const frame=Buffer.alloc(12+bytes.length);
  frame.writeUInt32BE(bytes.length); frame.write(type,4);bytes.copy(frame,8);
  frame.writeUInt32BE(zlib.crc32(frame.subarray(4,-4)),frame.length-4);
  return frame;
}
function png(width,height,pixels) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('tEXt',Buffer.from('camera\0private-fixture')),
    chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}

test('private portrait is decoded, stripped, atomic and reversible independently of character',async t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'eva-profile-test-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const profile=makeProfile(home);
  assert.deepEqual(profile.state(),{style:'',portraitVersion:''});
  profile.setStyle('  Отвечай кратко.  ');
  const supplied=png(2,1,Buffer.from([0,200,30,20,255,80,20,50,90]));
  const version=await profile.savePortrait(supplied);
  const saved=fs.readFileSync(profile.imagePath);
  assert(!saved.includes('private-fixture'));assert.deepEqual(saved,await cleanPng(saved));
  assert.equal(makeProfile(home).state().portraitVersion,version);
  assert.equal(makeProfile(home).style(),'Отвечай кратко.');
  await assert.rejects(profile.savePortrait(png(1601,1,Buffer.alloc(5))),/размеры/);
  await assert.rejects(profile.savePortrait(png(2,1,Buffer.alloc(10))),/декодировать/);
  await assert.rejects(profile.savePortrait(png(2,1,Buffer.from([6,1,2,3,4,5,6,7,8]))),/строки/);
  await assert.rejects(profile.savePortrait(supplied.subarray(0,37)),/PNG/);
  assert.throws(()=>profile.setStyle('я'.repeat(4001)),/4000/);
  assert.equal(profile.version(),version);
  assert.equal(fs.statSync(profile.imagePath).mode&0o077,0);
  profile.resetPortrait();assert.equal(profile.state().style,'Отвечай кратко.');
  profile.setStyle('');assert.deepEqual(profile.state(),{style:'',portraitVersion:''});
});

test('new and resumed turns and external characters reread private style; the stream stays public',t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'eva-personality-test-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  execFileSync(process.execPath,['-e',`
    const a=require('node:assert/strict'), {profile}=require('./personal-profile');
    const p=require('./persona'),calls=[];
    const rpc=p.createPersonaRpc(async(m,params)=>{calls.push(params);return {thread:{id:'t'},model:'m'};});
    (async()=>{
      profile.setStyle('ПРИМЕР-ЛИЧНОГО-ТОНА-1');
      await rpc('thread/start');a.match(calls.at(-1).developerInstructions,/ТОНА-1/);
      profile.setStyle('ПРИМЕР-ЛИЧНОГО-ТОНА-2');
      await rpc('thread/resume',{threadId:'t'});a.match(calls.at(-1).developerInstructions,/ТОНА-2/);
      await rpc('turn/start',{threadId:'t',spoken:true});
      const voice=calls.at(-1).collaborationMode.settings.developer_instructions;
      a.match(voice,/ТОНА-2/);a.match(voice,/будут слушать/);a.doesNotMatch(voice,/ТОНА-1/);
      a.match(p.forCharacter('Ева'),/ТОНА-2/);a.match(p.forCharacter('Луна'),/ТОНА-2/);
      let invoked=false;
      const gen=require('./stream-dialogue').createStreamGenerator({
        listModels:async()=>({data:[{model:'gpt-6-luna'}]}),
        run:async(_,args)=>{invoked=true;a.doesNotMatch(JSON.stringify(args),/ПРИМЕР-ЛИЧНОГО/);throw Error('end');}});
      await gen('music');a.equal(invoked,true);
      profile.setStyle('');await rpc('turn/start',{threadId:'t'});
      a.equal(calls.at(-1).collaborationMode.settings.developer_instructions,p.codexInstructions);
    })().catch(e=>{console.error(e);process.exitCode=1;})`],{cwd:runtime,env:{...process.env,EVA_RUNTIME_HOME:home}});
});

test('Android voice bridge enumerates available engine voices, forwards the selected ID and refreshes',()=>{
  const calls=[];
  const voice={name:'Test voice',voiceURI:'android-tts:fixture',lang:'ru-RU',localService:true};
  const window={NativeVoice:{voices:()=>JSON.stringify([voice]),speakVoice:(...a)=>calls.push(a),stopSpeech(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(runtime,'native-voice.js'),'utf8'),{window});
  const synth=window.__nativeSpeechSynth;
  assert.equal(synth.getVoices()[0].voiceURI,voice.voiceURI);
  let events=0;const listener=()=>events++;synth.addEventListener('voiceschanged',listener);
  window.__nativeVoicesChanged();synth.removeEventListener('voiceschanged',listener);window.__nativeVoicesChanged();assert.equal(events,1);
  const utterance=new window.__NativeUtterance('Тест голоса.');utterance.voice=voice;synth.speak(utterance);
  assert.equal(calls[0][4],voice.voiceURI);
  delete utterance.voice;synth.speak(utterance);assert.equal(calls[1][4],'');
});
