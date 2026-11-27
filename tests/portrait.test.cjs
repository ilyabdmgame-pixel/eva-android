const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const portrait = require('../runtime/codex-mobile/portrait.js');
const icons = require('../runtime/codex-mobile/ui-icons.js');

const base = path.join(__dirname, '../runtime/codex-mobile');

function viewAt(yaw, pitch) {
  const position = 2 * Math.abs(yaw);
  const inner = yaw < 0 ? 2 : 6;
  const from = position < 1 ? 0 : inner;
  const to = position < 1 ? inner : inner + 2;
  const t = position < 1 ? position : position-1;
  return portrait.landmarks.map(p => [
    p[from] * (1-t) + p[to] * t + 325 * .0025 * p[10] * Math.sin(Math.PI * position) * Math.sign(yaw),
    p[from+1] * (1-t) + p[to+1] * t + 578 * .003 * p[10] * pitch
  ]);
}

test('every painted projection and in-between keeps the entire face mesh facing forward', () => {
  assert.equal(portrait.interleavedVertices().length, portrait.landmarks.length*11);
  assert.ok(portrait.triangles.length >= 120*3);
  for (let step = -30; step <= 30; step++) {
    for (const pitch of [-1, 0, 1]) {
      const points = viewAt(step / 30, pitch);
      let sum = 0;
      for (let t = 0; t < portrait.triangles.length; t += 3) {
        const [a,b,c] = Array.from(portrait.triangles.subarray(t,t+3), i => points[i]);
        const area = (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
        assert.ok(area > 1, `Triangle ${t/3} folded at ${step}/30, pitch ${pitch}`);
        sum += area;
      }
      assert.ok(Math.abs(sum / 2 - 325*578) < .01, 'the transparent canvas still has complete coverage');
    }
  }
});

test('side paintings contain two registered RGBA drawings each and eager startup only reads the base art', () => {
  for (const side of ['left','right']) {
    const buf = fs.readFileSync(path.join(base,'avatar',`turn-${side}.webp`));
    assert.equal(buf.toString('ascii',12,16), 'VP8X');
    assert.ok(buf[20] & 0x10, 'transparent canvas');
    assert.equal(1 + buf.readUIntLE(24,3), 1300);
    assert.equal(1 + buf.readUIntLE(27,3), 1155);
  }
  const bridges = fs.readFileSync(path.join(base,'avatar','turn-between.webp'));
  assert.equal(1 + bridges.readUIntLE(24,3),1120);
  assert.equal(1 + bridges.readUIntLE(27,3),1992);
  const html = fs.readFileSync(path.join(base,'index.html'),'utf8');
  const src = [...html.matchAll(/<img\b[^>]*?\ssrc="(\/avatar\/[^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual([...new Set(src)],['/avatar/idle.png']);
  assert.ok(!portrait.usesFrontArt(['avatar-listening','avatar-blinking']));
  for (const state of ['avatar-speaking','avatar-is-reading','avatar-expression-frame-01-active']) assert.ok(portrait.usesFrontArt([state]));
});

test('articulation uses six drawn visemes with mid/full variants and rests during pauses', () => {
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
  assert.ok(atlas.length < 150_000);
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
