const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveScreenshot}=require('../runtime/codex-mobile/screenshot-path');
test('old portrait links resolve to their matching master or packaged WebP, and private files keep their original path',()=>{
  const old='/root/.codex/generated_images/eva-builtin-20261116/speech/01-a-mid.png',next=old.replace('.png','.webp');
  assert.equal(resolveScreenshot(old,p=>p===next),next);
  assert.equal(resolveScreenshot(old,()=>true),old);
  for(const own of ['/sdcard/Documents/Codex/my-art.png','/root/.codex/generated_images/session/old.png'])
    assert.equal(resolveScreenshot(own,p=>p.endsWith('webp')),own);
});
