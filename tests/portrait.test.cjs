const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const portrait = require('../runtime/codex-mobile/portrait.js');
const icons = require('../runtime/codex-mobile/ui-icons.js');

const base = path.join(__dirname, '../runtime/codex-mobile');

test('every front-facing expression has twelve painted cels on the same registered canvas',()=>{
  assert.equal(portrait.poses.length,18);
  for(const name of [...portrait.poses,'blink','glance','wave']){
    const buf=fs.readFileSync(path.join(base,'avatar',`cel-${name}.webp`));
    assert.equal(buf.toString('ascii',12,16),'VP8X');
    assert.ok(buf[20]&0x10);
    assert.equal(1+buf.readUIntLE(24,3),name==='wave'?246*6:400*4);
    assert.equal(1+buf.readUIntLE(27,3),name==='wave'?812*4:284*3);
  }
  for(const [input,expected] of [['warm-soft','warm'],['thinking-soft','thinking'],['serious','confident'],['unknown','']])assert.equal(portrait.faceName(input),expected);
  const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
  assert.deepEqual([...new Set([...html.matchAll(/<img\b[^>]*?\ssrc="(\/avatar\/[^"]+)"/g)].map(m=>m[1]))],['/avatar/idle.png']);
  assert.doesNotMatch(html,/preview-yaw|ракурсы/i);
});

test('the blink closes before it opens and every wave cel is used in sequence',()=>{
  const down=Array.from({length:98},(_,i)=>portrait.blinkAt(i));
  const up=Array.from({length:163},(_,i)=>portrait.blinkAt(i+138));
  assert.deepEqual([...new Set(down)],[0,1,2,3,4,5,6,7,8,9,10,11]);
  assert.deepEqual([...new Set(up)],[11,10,9,8,7,6,5,4,3,2,1,0]);
  const wave=Array.from({length:45},(_,i)=>portrait.waveFrame(i));
  assert.equal(new Set(wave).size,24);assert.equal(wave[0],0);assert.equal(wave.at(-1),23);
});

test('regular chat varies its resting gestures before repeating one',()=>{
  const bag=[];
  const beats=[];
  for(const sample of [0,.2,.9,.3,.7,0,.1,.2,.5,.95]){
    beats.push(portrait.nextIdleBeat(bag,beats.at(-1),()=>sample));
  }
  assert.equal(new Set(beats.slice(0,5)).size,5);
  assert.equal(new Set(beats.slice(5)).size,5);
  assert.notEqual(beats[4],beats[5]);
});

test('the breathing, hair and yawn movies contain timed frames and retain transparency',()=>{
  for(const name of ['body','hair','yawn']){
    const file=fs.readFileSync(path.join(base,'avatar','idle-'+name+'.webp'));
    assert.equal(file.toString('ascii',8,12),'WEBP');
    let duration=0,frames=0,flags=0,loops=null;
    for(let p=12;p+8<=file.length;){
      const tag=file.toString('ascii',p,p+4),size=file.readUInt32LE(p+4),start=p+8;
      assert.ok(start+size<=file.length);
      if(tag==='VP8X')flags=file[start];
      if(tag==='ANIM')loops=file.readUInt16LE(start+4);
      if(tag==='ANMF'){frames++;duration+=file.readUIntLE(start+12,3);}
      p=start+size+(size%2);
    }
    assert.equal(flags&0x12,0x12,name);
    assert.ok(frames>=40,name);
    if(name==='body'){assert.equal(loops,0);assert.ok(duration>=4000&&duration<=10000);}
    else {assert.equal(loops,1);assert.equal(duration,name==='hair'?3200:3600);}
  }
});

test('six drawn speech shapes have six steps of articulation and rest during pauses', () => {
  const {speechTrack,speechCue} = portrait;
  const line = speechTrack('АэОюМф.');
  assert.deepEqual(line.cues.map(c=>c.shape),[0,2,4,6,8,10,-1]);
  for (const cue of line.cues) {
    assert.equal(speechCue(line,cue.begin),cue);
    assert.equal(speechCue(line,(cue.begin+cue.end)/2),cue);
  }
  assert.equal(speechCue(line,line.duration),null);
  assert.equal(speechCue(speechTrack(''),0),null);
  const offsets=speechTrack('🎮 Май').cues.map(c=>c.offset);
  assert.deepEqual(offsets,[0,2,3,4,5]); // Native word-boundary offsets use UTF-16.
  const atlas=fs.readFileSync(path.join(base,'avatar','visemes.webp'));
  assert.equal(atlas.toString('ascii',12,16),'VP8 ');
  assert.equal(atlas.readUInt16LE(26)&0x3fff,6*263);
  assert.equal(atlas.readUInt16LE(28)&0x3fff,6*117);
  assert.ok(atlas.length<260_000);
});

test('the packaged chat and home use known accessible line icons', () => {
  for (const file of [path.join(base,'index.html'),path.join(__dirname,'../app/src/main/assets/home/index.html')]) {
    const html=fs.readFileSync(file,'utf8');
    for (const match of html.matchAll(/data-eva-icon="([\w-]+)"/g)) assert.match(icons.html(match[1]),/aria-hidden="true"/);
  }
  assert.equal(icons.html('__proto__'), '');
});


test('Android word boundaries reach only the active utterance and stop at cancellation', () => {
  const vm = require('node:vm');
  const calls = [], boundaries = [];
  const window = {NativeVoice:{speak(...args){calls.push(args)},stopSpeech(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(base,'native-voice.js'),'utf8'),{window});
  const u = new window.__NativeUtterance('Я рядом.');
  u.onboundary = e=>boundaries.push([e.name,e.charIndex,e.charLength]);
  window.__nativeSpeechSynth.speak(u);
  const id=calls[0][3];
  window.__nativeSpeechRange('old',0,1);
  window.__nativeSpeechRange(id,2,7);
  window.__nativeSpeechSynth.cancel();
  window.__nativeSpeechRange(id,0,1);
  assert.deepEqual(boundaries,[['word',2,5]]);
});
