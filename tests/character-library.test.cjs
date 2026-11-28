'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),z=require('node:zlib');
const {library}=require('../runtime/codex-mobile/character-library'),{inspect}=require('../runtime/codex-mobile/character-format');
const sample=fs.readFileSync(path.join(__dirname,'../docs/examples/room-robot.glb'));
function png(w,h){
  function chunk(type,data){
    const body=Buffer.concat([Buffer.from(type),data]),header=Buffer.alloc(4),crc=Buffer.alloc(4);
    header.writeUInt32BE(data.length);crc.writeUInt32BE(z.crc32(body));return Buffer.concat([header,body,crc]);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',z.deflateSync(Buffer.alloc(h*(w*4+1)))),chunk('IEND',Buffer.alloc(0))]);
}
function packet(){
  const mesh=Buffer.alloc(16+3*18*4+3*4);mesh.write('EVM1');mesh.writeUInt32LE(3,4);mesh.writeUInt32LE(3,8);mesh.writeUInt32LE(18,12);
  [0,1,2].forEach((n,i)=>mesh.writeUInt32LE(n,mesh.length-12+i*4));
  const header=Buffer.alloc(24);header.write('EVA2');
  const body=[sample,mesh,png(4,4),png(1152,768),png(576,864)];body.forEach((b,i)=>header.writeUInt32LE(b.length,4+i*4));
  return Buffer.concat([header,...body]);
}
test('GLB library preserves independent surfaces across a restart and a failed replacement',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'eva-model-library-'));
  try {
    const store=library(home),bytes=packet();
    const result=await store.put(bytes,['chat','pet','room'],'robot.glb'),hash=result.slots.room;
    assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(fs.statSync(store.asset(hash,'portrait.png')).isFile(),true);
    const broken=Buffer.from(bytes);broken[24]=0;
    await assert.rejects(store.put(broken,['room'],'other.glb'));
    assert.deepEqual(library(home).state(),result);
    assert.throws(()=>store.remove(hash));assert.throws(()=>store.assign(['other'],null));
    const after=store.assign(['chat'],null);assert.deepEqual(after.slots,{pet:hash,room:hash});
    assert.equal(store.assign(['chat'],hash).slots.chat,hash);
    store.assign(['pet','room','chat'],null);assert.deepEqual(store.remove(hash),{slots:{},names:{}});
  }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('GLB example is self-contained and truncation fails before decoding',()=>{
  assert.equal(inspect(sample).animations[0].name,'Idle');assert.throws(()=>inspect(sample.subarray(0,-1)));
});
