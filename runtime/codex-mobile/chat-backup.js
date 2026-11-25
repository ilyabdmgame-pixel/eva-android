'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const {pipeline}=require('stream/promises');
const MAGIC=Buffer.from('EVACHAT1'), CHECK=Buffer.from('Eva encrypted chat backup verification v1');
function createBackupManager({directory='/sdcard/Documents/Codex/Ева-резерв-чаты',sessionsDir='/root/.codex/sessions'}={}){
 let key=null,busy=false,queued=false,lastError='',lastSuccess=null,timer=null,localQueue=Promise.resolve();
 const derive=(pass,salt)=>new Promise((resolve,reject)=>crypto.scrypt(pass,salt,32,(e,k)=>e?reject(e):resolve(k)));
 const atomic=(file,data)=>{const tmp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,data,{mode:0o600,flag:'wx'});fs.renameSync(tmp,file)}finally{try{fs.unlinkSync(tmp)}catch{}}};
 async function unlock(pass){if(typeof pass!=='string'||pass.length<10||pass.length>1024)throw Error('Пароль должен содержать от 10 до 1024 символов');fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'проверка-пароля.json');let next;
  if(fs.existsSync(file)){try{const v=JSON.parse(fs.readFileSync(file,'utf8'));if(v.version!==1||typeof v.salt!=='string')throw Error();next=await derive(pass,Buffer.from(v.salt,'base64'));const decipher=crypto.createDecipheriv('aes-256-gcm',next,Buffer.from(v.iv,'base64'));decipher.setAuthTag(Buffer.from(v.tag,'base64'));const plain=Buffer.concat([decipher.update(Buffer.from(v.data,'base64')),decipher.final()]);if(!crypto.timingSafeEqual(plain,CHECK))throw Error()}catch{if(next)next.fill(0);throw Error('Неверный пароль или повреждён файл проверки')}}
  else{const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);next=await derive(pass,salt);const cipher=crypto.createCipheriv('aes-256-gcm',next,iv),data=Buffer.concat([cipher.update(CHECK),cipher.final()]);const payload=JSON.stringify({version:1,salt:salt.toString('base64'),iv:iv.toString('base64'),data:data.toString('base64'),tag:cipher.getAuthTag().toString('base64')});try{fs.writeFileSync(file,payload,{mode:0o600,flag:'wx'})}catch(e){next.fill(0);throw e}}
  if(key)key.fill(0);key=next;snapshots.clear();lastError='';return status()}
 function lock(){if(key)key.fill(0);key=null;clearTimeout(timer);return status()}
 function status(){return {unlocked:!!key,busy,lastError,lastSuccess,configured:fs.existsSync(path.join(directory,'проверка-пароля.json'))}}
 function list(dir,out=[]){if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())list(f,out);else if(e.isFile()&&/^rollout-.*\.jsonl$/.test(e.name))out.push(f)}return out}
 function lastComplete(file,size){const fd=fs.openSync(file,'r');try{let pos=size;const buf=Buffer.alloc(65536);while(pos>0){const n=Math.min(pos,buf.length);pos-=n;fs.readSync(fd,buf,0,n,pos);const i=buf.lastIndexOf(10,n-1);if(i>=0)return pos+i+1}return 0}finally{fs.closeSync(fd)}}
 async function encryptStream(input,dest){if(!key)throw Error('Сначала разблокируйте резервные копии');const current=Buffer.from(key),iv=crypto.randomBytes(12),tmp=dest+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';let ok=false;try{fs.writeFileSync(tmp,Buffer.concat([MAGIC,iv]),{mode:0o600,flag:'wx'});const cipher=crypto.createCipheriv('aes-256-gcm',current,iv);await pipeline(input,zlib.createGzip({level:3}),cipher,fs.createWriteStream(tmp,{flags:'a'}));fs.appendFileSync(tmp,cipher.getAuthTag());const fd=fs.openSync(tmp,'r');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}if(fs.existsSync(dest)){const previous=dest.replace(/\.gcm$/,'.prev.gcm');fs.renameSync(dest,previous)}fs.renameSync(tmp,dest);ok=true}finally{current.fill(0);if(!ok)try{fs.unlinkSync(tmp)}catch{}}}
 // Cache only successfully encrypted snapshots for this unlocked session.
 const snapshots=new Map();
 async function backupSessions(){
  if(!key)return;
  if(busy){queued=true;return}
  busy=true;
  lastError='';
  try{
   for(const file of list(sessionsDir)){
    if(!key)break;
    const stat=fs.statSync(file,{bigint:true});
    const stamp=[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(':');
    const name=path.basename(file).replace(/\.jsonl$/,'.jsonl.gz.gcm');
    const dest=path.join(directory,name);
    if(snapshots.get(file)===stamp&&fs.existsSync(dest))continue;
    const end=lastComplete(file,Number(stat.size));
    if(!end)continue;
    await encryptStream(fs.createReadStream(file,{start:0,end:end-1}),dest);
    snapshots.set(file,stamp);
   }
   lastSuccess=new Date().toISOString();
  }catch(e){
   lastError=String(e.message||e);
   throw e;
  }finally{
   busy=false;
   if(queued&&key){queued=false;schedule()}
  }
 }
 function schedule(){if(!key)return;clearTimeout(timer);timer=setTimeout(()=>backupSessions().catch(e=>console.error('Резерв чатов:',e.message)),2000);timer.unref?.()}
 async function backupLocal(data){if(!key)throw Error('Сначала разблокируйте резервные копии');if(typeof data!=='string'||Buffer.byteLength(data)>8*1024*1024)throw Error('История внешних моделей слишком велика');JSON.parse(data);const work=localQueue.catch(()=>{}).then(async()=>{const {Readable}=require('stream');await encryptStream(Readable.from([Buffer.from(data)]),path.join(directory,'внешние-чаты.json.gz.gcm'));lastSuccess=new Date().toISOString();lastError=''});localQueue=work;return work}
 async function decryptFile(src,dest){if(!key)throw Error('Сначала разблокируйте резервные копии');const fd=fs.openSync(src,'r');let iv,tag,size;try{size=fs.fstatSync(fd).size;if(size<36)throw Error('Файл слишком мал');const head=Buffer.alloc(20);fs.readSync(fd,head,0,20,0);if(!head.subarray(0,8).equals(MAGIC))throw Error('Неверный формат');iv=head.subarray(8);tag=Buffer.alloc(16);fs.readSync(fd,tag,0,16,size-16)}finally{fs.closeSync(fd)}const current=Buffer.from(key),tmp=dest+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{const d=crypto.createDecipheriv('aes-256-gcm',current,iv);d.setAuthTag(tag);await pipeline(fs.createReadStream(src,{start:20,end:size-17}),d,zlib.createGunzip(),fs.createWriteStream(tmp,{flags:'wx',mode:0o600}));fs.copyFileSync(tmp,dest,fs.constants.COPYFILE_EXCL);fs.unlinkSync(tmp)}finally{current.fill(0);try{fs.unlinkSync(tmp)}catch{}}}
 async function recoverAll(){if(!key)throw Error('Сначала разблокируйте резервные копии');const files=fs.readdirSync(directory).filter(n=>/\.gz(?:\.prev)?\.gcm$/.test(n));if(!files.length)throw Error('Зашифрованных копий пока нет');const dest=path.join('/root/.codex/eva-chat-recovery','restored-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(dest,{recursive:true,mode:0o700});fs.chmodSync(dest,0o700);let count=0;for(const n of files){const previous=n.endsWith('.prev.gcm');let out=n.replace(/\.gz(?:\.prev)?\.gcm$/,'');if(previous)out+='.previous';await decryptFile(path.join(directory,n),path.join(dest,out));count++}return {count,path:dest}}
 return {unlock,lock,status,backupSessions,backupLocal,schedule,decryptFile,recoverAll};
}
module.exports={createBackupManager};
