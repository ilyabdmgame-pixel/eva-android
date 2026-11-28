import test from 'node:test';
import assert from 'node:assert/strict';
import {readCharacterMesh,characterSelection} from '../../../app/src/main/assets/home/character-model.mjs';
import {createEvaSkin} from '../../../app/src/main/assets/home/eva-skin.mjs';

function fixture(){
 const data=new ArrayBuffer(16+(3*18+3)*4),view=new DataView(data);
 for(const [i,letter] of [...'EVM1'].entries())view.setUint8(i,letter.charCodeAt(0));
 for(const [i,value] of [3,3,18].entries())view.setUint32(4+i*4,value,true);
 for(let i=0;i<3;i++){
   view.setFloat32(16+(18*i+8)*4,15,true);
   view.setFloat32(16+(18*i+9)*4,4,true);
   view.setFloat32(16+(18*i+16)*4,.5,true);
   view.setUint32(16+(54+i)*4,i,true);
 }
 return data;
}
test('EVM1 preserves two-joint attributes and exact indexed topology',()=>{
 const model=readCharacterMesh(fixture());
 assert.equal(model.stride,18);assert.equal(model.vertices.length,54);
 assert.deepEqual([...model.indices],[0,1,2]);
 assert.equal(model.vertices[18+8],15);assert.equal(model.vertices[18+9],4);assert.equal(model.vertices[18+16],.5);
});
test('invalid byte lengths, topology, weights and out-of-range bone indices fail before GPU upload',()=>{
 for(const [offset,mutate] of [[0,'magic'],[4,'number'],[8,'number'],[12,'number'],[16,'nan'],
   [48,'bone'],[52,'bone'],[80,'weight'],[84,'style'],[232,'index']]){
   const data=fixture(),view=new DataView(data);
   if(mutate==='nan')view.setFloat32(offset,NaN,true);
   else if(['bone','weight','style'].includes(mutate))view.setFloat32(offset,20,true);
   else view.setUint32(offset,199999,true);
   assert.throws(()=>readCharacterMesh(data),/Invalid/);
 }
 assert.throws(()=>readCharacterMesh(fixture().slice(0,-1)));
});
test('selection and reset ignore stale, aborted and failed decodes and can retry',async()=>{
 const loads=[],paints=[],a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
 const store=characterSelection(pair=>paints.push(pair?.mesh??null),(id,signal)=>new Promise((resolve,reject)=>loads.push({id,signal,resolve,reject})));
 const first=store.select(a);await store.select(a);
 loads[0].resolve(['mesh A','atlas A']);await first;
 const stale=store.select(b),last=store.select(c);assert.equal(loads[1].signal.aborted,true);
 loads[1].resolve(['stale','atlas']);await stale;assert.deepEqual(paints,['mesh A']);
 await store.select(a);assert.equal(loads[2].signal.aborted,true);loads[2].resolve(['stale','atlas']);await last;
 assert.deepEqual(paints,['mesh A']);
 const clearing=store.select(c);await store.select('');loads[3].resolve(['settled','atlas']);await clearing;
 assert.deepEqual(paints,['mesh A',null]);
 await store.select('../b');assert.equal(loads.length,4);
 const broken=store.select(c);loads[4].reject(Error('corrupt'));await broken;
 const retry=store.select(c);loads[5].resolve(['mesh C','atlas C']);await retry;
 const late=store.select(a);store.retire();loads[6].resolve(['stale','atlas']);await late;
 assert.deepEqual(paints,['mesh A',null,null,'mesh C']);assert.equal(loads[6].signal.aborted,true);
});
test('stock to personal to stock replaces both indexed buffers, keeps palette, and disables stock face offsets',()=>{
 const uploads=[],freed=[],palette=[],offsets=[],draws=[];
 let next=0;
 const gl={createVertexArray:()=>++next,createBuffer:()=>++next,bindVertexArray(){},bindBuffer(){},
   ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,FLOAT:3,UNSIGNED_SHORT:4,TRIANGLES:5,
   bufferData:(kind,data)=>uploads.push(data),vertexAttribPointer(){},enableVertexAttribArray(){},
   deleteVertexArray:v=>freed.push(v),deleteBuffer:v=>freed.push(v),uniform1i(){},
   uniformMatrix4fv:(key,transpose,value)=>palette.push(value),uniform2f:(key,x,y)=>{if(key==='portrait')offsets.push([x,y]);},
   drawElements:(prim,count,type)=>draws.push([count,type])};
 const actor=createEvaSkin(gl),original=readCharacterMesh(fixture()),custom=readCharacterMesh(fixture());
 const pose={matrices:new Float32Array(16*16),face:2,blink:.3,bedFloor:0}, uniforms={portrait:'portrait'};
 for(const [mesh,isCustom] of [[original,false],[custom,true],[custom,true],[original,false]]){
   actor.submit(mesh,pose,9,isCustom);actor.draw(uniforms);
 }
 assert.equal(uploads.length,6);assert.equal(freed.length,6);assert.equal(palette.length,4);
 assert.deepEqual(offsets,[[.5,.3],[-1,0],[-1,0],[.5,.3]]);
 assert.ok(draws.every(([count,type])=>count===3&&type===gl.UNSIGNED_SHORT));
 actor.retire();actor.retire();assert.equal(freed.length,9);
});
