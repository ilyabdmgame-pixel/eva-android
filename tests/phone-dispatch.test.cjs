const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {tmpdir}=require('node:os');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('a phone action reaches a single native window and a disconnected receiver is removed', {timeout:16000}, async t=>{
  const folder=await fs.mkdtemp(path.join(tmpdir(),'eva-phone-delivery-'));
  const copied=path.join(folder,'runtime'),dir=path.join(copied,'codex-mobile');
  await fs.mkdir(dir,{recursive:true});
  const source=path.resolve(__dirname,'../runtime');
  for(const name of ['codex-mobile','eva-workshop']){
    for(const entry of await fs.readdir(path.join(source,name),{withFileTypes:true})){
      if(!entry.isFile()||!entry.name.match(/\.(?:js|md)$/))continue;
      await fs.mkdir(path.join(copied,name),{recursive:true});
      await fs.copyFile(path.join(source,name,entry.name),path.join(copied,name,entry.name));
    }
  }
  const code="#!/usr/bin/env node\nrequire('node:readline').createInterface({input:process.stdin}).on('line',raw=>{const m=JSON.parse(raw);if(m.id)console.log(JSON.stringify({id:m.id,result:m.method==='account/read'?{account:null}:{}}));});";
  await fs.writeFile(path.join(folder,'codex'),code,{mode:0o700});
  const child=spawn(process.execPath,[path.join(dir,'server.js')],{cwd:folder,stdio:'ignore',
    env:{...process.env,PATH:folder+path.delimiter+process.env.PATH,HOME:folder,CODEX_HOME:path.join(folder,'auth'),EVA_RUNTIME_HOME:folder}});
  const clients=[];
  t.after(async()=>{
    for(const client of clients)client.abort.abort();
    const exit=child.exitCode===null?new Promise(resolve=>child.once('exit',resolve)):Promise.resolve();
    child.kill();await exit;await fs.rm(folder,{recursive:true,force:true});
  });
  const deadline=Date.now()+8000;
  let url;
  while(Date.now()<deadline&&!url){
    try{url=new URL(await fs.readFile(path.join(dir,'current-url'),'utf8'));}catch{await delay(30);}
  }
  assert(url,'isolated test server did not start');
  const headers={'x-codex-token':url.hash.slice(1),'Content-Type':'application/json'};
  const post=(route,body)=>fetch(new URL(route,url),{method:'POST',headers,body:JSON.stringify(body)});
  async function connect(native){
    const abort=new AbortController();
    const res=await fetch(new URL('/events?phone='+(native?'1':'0'),url),{headers,signal:abort.signal});
    const reader=res.body.pipeThrough(new TextDecoderStream()).getReader(),arr=[];
    clients.push({abort,arr});
    (async()=>{let pending='';
      try{for(;;){const {value,done}=await reader.read();if(done)break;pending+=value;
        let end;while((end=pending.indexOf('\n\n'))!==-1){
          const e=pending.slice(0,end);pending=pending.slice(end+2);
          if(e.startsWith('data: ')){const data=JSON.parse(e.slice(6));if(data.type==='phone')arr.push(data);}
        }
      }}catch(e){if(!abort.signal.aborted)throw e;}
    })();
    return clients.at(-1);
  }
  async function sendAndReply(client){
    const index=client.arr.length,response=post('/phone/execute',{action:'battery',args:[]});
    for(let i=0;i<100&&client.arr.length===index;i++)await delay(20);
    const received=client.arr[index];assert(received);
    assert.equal(received.action,'battery');
    const ack=await post('/phone/result',{id:received.id,result:'synthetic'});assert.equal(ack.status,200);
    assert.equal((await (await response).json()).result,'synthetic');
  }
  const ordinary=await connect(false);
  assert.equal((await post('/phone/execute',{action:'battery',args:[]})).status,503);
  const first=await connect(true),second=await connect(true);
  await sendAndReply(second);
  assert.equal(first.arr.length,0);assert.equal(ordinary.arr.length,0);
  const unconfirmed=post('/phone/execute',{action:'battery',args:[]});
  for(let i=0;i<100&&second.arr.length<2;i++)await delay(20);
  assert.equal(second.arr.length,2);
  second.abort.abort();
  const lost=await unconfirmed;assert.equal(lost.status,503);assert.match((await lost.json()).error,/неизвестен/);
  assert.equal(first.arr.length,0);
  await sendAndReply(first);
  assert.equal(ordinary.arr.length,0);
});
