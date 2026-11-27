'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto'), {spawn}=require('child_process'), readline=require('readline');
const {codexInstructions, createPersonaRpc}=require('./persona');
const runtimeHome=process.env.EVA_RUNTIME_HOME||'/root';
const workshopDir=path.join(__dirname,'../eva-workshop');
const tasks=require('./tasks'), providers=require('./providers'), notes=require('./notes');
const generateStream=require('./stream-dialogue').createStreamGenerator();
const chatBackup=require('./chat-backup').createBackupManager();
const draftsFile=process.env.CODEX_DRAFTS_FILE||path.join(__dirname,'drafts.json');
const token=crypto.randomBytes(24).toString('hex'), clients=new Set(), pending=new Map(), pendingClientRequests=new Map(); let seq=0, ready=false;
const proc=spawn('codex',['app-server','--listen','stdio://','-c','developer_instructions='+JSON.stringify(codexInstructions)],{cwd:runtimeHome,stdio:['pipe','pipe','pipe']});
proc.stderr.on('data',x=>process.stderr.write(x));
function ensureWorkDirectory(){const dir=path.join(runtimeHome,'eva-work'),target=path.join(dir,'AGENTS.md'),defaults=path.join(__dirname,'work-instructions.md');fs.mkdirSync(dir,{recursive:true,mode:0o700});if(!fs.existsSync(target)&&fs.existsSync(defaults)){try{fs.copyFileSync(defaults,target,fs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e}}return dir}
let openingWorkThread;
function openWorkThread(){
 return openingWorkThread??=(async()=>{
  const cwd=ensureWorkDirectory();
  const file=path.join(__dirname,'work-thread.json');
  try{
   const {id}=JSON.parse(fs.readFileSync(file,'utf8'));
   const {thread}=await rpc('thread/read',{threadId:id});
   if(thread?.cwd!==cwd)throw Error('Сохранённый рабочий чат относится к другой папке');
   return id;
  }catch(error){
   if(error.code!=='ENOENT'&&!/thread not loaded|thread not found|no rollout found/i.test(error.message))throw error;
  }
  const {thread}=await rpc('thread/start',{cwd});
  const temporary=file+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify({id:thread.id}),{mode:0o600});
  fs.renameSync(temporary,file);
  return thread.id;
 })().finally(()=>{openingWorkThread=null;});
}
function send(x){if(proc.stdin.writable)proc.stdin.write(JSON.stringify(x)+'\n')}
function requestCodex(method,params){return new Promise((resolve,reject)=>{const id=++seq; pending.set(id,{resolve,reject}); send({id,method,params});setTimeout(()=>{if(pending.delete(id))reject(Error('Время ожидания ответа Codex истекло'))},30000).unref()})}
const rpc=createPersonaRpc(requestCodex);
const accountLimits=require('./rate-limits').createRateLimits(()=>rpc('account/rateLimits/read',{}));
const petWork=require('./pet-work')(kind=>console.log('EVA_PET_WORK '+kind),'/sdcard/Documents/Codex',path.join(__dirname,'pet-work-results.json'));
function emit(x){for(const r of clients)r.write('data: '+JSON.stringify(x)+'\n\n')}
const townChat=require('./town-chat')({rpc,cards:petWork,authenticated:()=>auth.authenticated,root:__dirname,
 questionPending:threadId=>Array.from(pendingClientRequests.values()).some(request=>
  request.method==='item/tool/requestUserInput'&&request.params?.threadId===threadId)});
readline.createInterface({input:proc.stdout}).on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}if(m.id!=null&&!m.method){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Object.assign(new Error(m.error.message),{rpcCode:m.error.code})):p.resolve(m.result)}return} if(m.method){petWork.event(m);townChat.event(m);}if(m.id!=null&&m.method){const request={type:'request',id:m.id,method:m.method,params:m.params};pendingClientRequests.set(String(m.id),request);emit(request);return}if(m.method){authEvent(m.method,m.params||{});emit({type:'event',method:m.method,params:m.params});if(m.method==='turn/completed'){for(const [id,request] of pendingClientRequests){if(request.params?.threadId===m.params?.threadId&&request.params?.turnId===m.params?.turn?.id)pendingClientRequests.delete(id)}chatBackup.schedule()}}});
proc.on('error',()=>{ready=false;for(const p of pending.values())p.reject(Error('Codex недоступен'));pending.clear();});
proc.stdin.on('error',()=>{});
proc.on('exit',()=>{ready=false;emit({type:'error',message:'Codex остановился. Откройте Eva заново.'})});
(async()=>{await rpc('initialize',{clientInfo:{name:'codex_mobile_local',title:'Codex Mobile Local',version:'1.0.0'},capabilities:{experimentalApi:true}});send({method:'initialized',params:{}});ready=true;await checkAccount();workshop.start()})().catch(e=>console.error(e.message));
// Authentication belongs to the server, survives WebView/Activity recreation.
let auth={authenticated:false,pending:false,code:'',url:'',error:''}, loginId=null, accountCheckPromise=null, accountChecked=false;
function authView(){return {...auth,ready,checked:accountChecked}}
async function checkAccount(){if(!ready)return;if(accountCheckPromise)return accountCheckPromise;accountCheckPromise=(async()=>{try{const r=await rpc('account/read',{refreshToken:false});auth.authenticated=!!r.account;accountChecked=true;if(auth.authenticated){auth.pending=false;auth.code='';auth.url='';auth.error='';loginId=null}emit({type:'auth',...authView()})}catch(e){auth.error='Не удалось проверить аккаунт: '+e.message;accountChecked=true;emit({type:'auth',...authView()})}})();try{await accountCheckPromise}finally{accountCheckPromise=null}}
async function startLogin(){if(!ready)throw Error('Codex ещё запускается');if(auth.pending||auth.authenticated)return authView();auth.pending=true;auth.error='';auth.code='';auth.url='';loginId=null;try{const r=await rpc('account/login/start',{type:'chatgptDeviceCode'});const u=new URL(r.verificationUrl);if(u.protocol!=='https:'||u.hostname!=='auth.openai.com'||!r.loginId||!r.userCode)throw Error('Неполный ответ сервера входа');loginId=r.loginId;auth.code=r.userCode;auth.url=r.verificationUrl;emit({type:'auth',...authView()});return authView()}catch(e){auth.pending=false;auth.error=e.message;throw e}}
function authEvent(method,p){if(method==='account/login/completed'&&auth.pending&&loginId&&p.loginId===loginId){auth.pending=false;auth.code='';auth.url='';auth.error=p.success?'':String(p.error||'Вход не завершён');loginId=null;checkAccount()}else if(method==='account/updated'){accountLimits.clear();checkAccount()}}
setInterval(()=>{if(auth.pending)checkAccount()},5000).unref();
const phoneRequests=new Map();

const openWorkshopThread = require('./workshop-thread').createWorkshopOpener(rpc,workshopDir);
const workshop=require('../eva-workshop/service').create(rpc);
const allowed=new Set(['thread/list','thread/start','thread/resume','thread/read','thread/delete','turn/start','turn/steer','turn/interrupt','model/list']);
// Mobile history uses messages and turn state. Tool transcripts can dwarf the conversation.
function mobileThreadView(result){
 const thread=result?.thread;
 if(!thread||!Array.isArray(thread.turns))return result;
 return {thread:{id:thread.id,turns:thread.turns.map(turn=>({
  id:turn.id,status:turn.status,items:(turn.items||[]).filter(item=>
   item.type==='userMessage'||item.type==='agentMessage')
 }))}};
}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}
function read(req,max){return new Promise((resolve,reject)=>{let n=0,parts=[];req.on('data',c=>{n+=c.length;if(n>max){reject(Error('Файл слишком большой'));req.destroy()}else parts.push(c)});req.on('end',()=>resolve(Buffer.concat(parts)));req.on('error',reject)})}
function serveFile(res,file,headers){
 const stream=fs.createReadStream(file);
 res.once('close',()=>stream.destroy());
 stream.once('error',err=>{
  if(res.destroyed)return;
  if(res.headersSent){res.destroy();return}
  const status=['EACCES','EPERM'].includes(err.code)?403:err.code==='ENOENT'?404:500;
  json(res,status,{error:'Файл недоступен для чтения'});
 });
 stream.once('open',()=>{
  if(res.destroyed){stream.destroy();return}
  res.writeHead(200,headers);
  stream.pipe(res);
 });
}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1'); const host=req.headers.host;if(host!==`127.0.0.1:${server.address()?.port}`)return json(res,403,{error:'Неверный адрес'});if(req.method==='GET'&&u.pathname==='/'){return serveFile(res,path.join(__dirname,'index.html'),{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:",'X-Frame-Options':'DENY'})}if(req.method==='GET'&&['/app.js','/style.css','/sw.js','/native-voice.js','/question-options.js','/avatar-activity.js','/account.js'].includes(u.pathname)){return serveFile(res,path.join(__dirname,u.pathname),{'Content-Type':u.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store'})}
if(req.method==='GET'&&['/avatar/idle.png','/avatar/curious-v1.png','/avatar/smile-mid.png','/avatar/thinking-soft.png','/avatar/warm-soft.png','/avatar/laugh-v1.png','/avatar/talking.png','/avatar/blink.png','/avatar/blink-talking.png','/avatar/blink-thinking.png','/avatar/blink-reading.png','/avatar/blink-search.png','/avatar/blink-work.png','/avatar/happy.png','/avatar/thinking.png','/avatar/reading.png','/avatar/glance.png','/avatar/search.png','/avatar/work.png','/avatar/work-writing.png','/avatar/reading-page.png','/avatar/yawn.png','/avatar/yawn-mid.png','/avatar/scratch.png','/avatar/scratch-mid.png','/avatar/headphones.png','/avatar/surprised.png','/avatar/calm.png','/avatar/joy.png','/avatar/wink.png','/avatar/excited.png','/avatar/sly.png','/avatar/shy.png','/avatar/pout.png','/avatar/serious.png','/avatar/sad.png'].includes(u.pathname)){const img=path.join(__dirname,u.pathname);if(!fs.existsSync(img))return json(res,404,{error:'Кадр не найден'});return serveFile(res,img,{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})}

if((req.headers['x-codex-token']||u.searchParams.get('token'))!==token)return json(res,403,{error:'Нет доступа'});if(req.headers.origin&&req.headers.origin!==`http://${host}`)return json(res,403,{error:'Неверный источник'});
if(req.method==='GET'&&u.pathname==='/chat-image'){const supplied=u.searchParams.get('path')||'';const roots=['/sdcard/Documents/Codex','/root/.codex/generated_images'].filter(p=>fs.existsSync(p)).map(p=>fs.realpathSync(p));let file;try{file=fs.realpathSync(require("./screenshot-path").resolveScreenshot(supplied))}catch{return json(res,404,{error:'Изображение не найдено'})}if(!roots.some(root=>file.startsWith(root+path.sep)))return json(res,403,{error:'Изображение вне доступных папок'});const ext=path.extname(file).toLowerCase(),types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};if(!Object.hasOwn(types,ext)||!fs.statSync(file).isFile())return json(res,400,{error:'Формат изображения не поддерживается'});return serveFile(res,file,{'Content-Type':types[ext],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'})}
if(req.method==='POST'&&u.pathname==='/chat-image/save'){const o=JSON.parse((await read(req,16384)).toString());try{return json(res,200,{name:require('./image-download').saveImage(o.path)})}catch(e){return json(res,400,{error:'Не удалось сохранить изображение: '+e.message})}}
if(req.method==='GET'&&u.pathname==='/backup/status')return json(res,200,chatBackup.status());
if(req.method==='POST'&&u.pathname==='/backup/unlock'){const o=JSON.parse((await read(req,4096)).toString());await chatBackup.unlock(o.password);try{await chatBackup.backupSessions()}catch(e){return json(res,500,{error:'Пароль принят, но копирование не удалось: '+e.message})}return json(res,200,chatBackup.status())}
if(req.method==='POST'&&u.pathname==='/backup/local'){const body=await read(req,8*1024*1024);await chatBackup.backupLocal(body.toString('utf8'));return json(res,200,chatBackup.status())}
if(req.method==='POST'&&u.pathname==='/backup/recover')return json(res,200,await chatBackup.recoverAll());
if(req.method==='POST'&&u.pathname==='/backup/lock')return json(res,200,chatBackup.lock());
if(req.method==='POST'&&u.pathname==='/workshop/open')return json(res,200,{id:await openWorkshopThread()});
if(req.method==='POST'&&u.pathname==='/workshop/link'){const o=JSON.parse((await read(req,4096)).toString());if(typeof o.threadId!=='string'||!o.threadId)return json(res,400,{error:'Не указан чат'});const x=await rpc('thread/read',{threadId:o.threadId});if(x.thread?.cwd!==workshopDir)return json(res,400,{error:'Это не чат мастерской'});const file=path.join(workshopDir,'thread.json');try{const old=JSON.parse(fs.readFileSync(file,'utf8'));if(old.id!==o.threadId)return json(res,409,{error:'Уже привязан другой чат мастерской'})}catch(e){if(e.code!=='ENOENT')throw e;fs.writeFileSync(file,JSON.stringify({id:o.threadId})+'\n',{mode:0o600,flag:'wx'})}const settingsFile=path.join(workshopDir,'settings.json');let settings={};try{settings=JSON.parse(fs.readFileSync(settingsFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}if(settings.restorePending===true){settings.enabled=true;delete settings.restorePending;const tmp=settingsFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(settings)+'\n',{mode:0o600});fs.renameSync(tmp,settingsFile)}return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname==='/workshop/status')return json(res,200,workshop.status());
if(req.method==='GET'&&u.pathname==='/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);for(const request of pendingClientRequests.values())res.write('data: '+JSON.stringify(request)+'\n\n');req.on('close',()=>clients.delete(res));return}
if(req.method==='POST'&&u.pathname==='/phone/execute'){const o=JSON.parse((await read(req,4096)).toString());if(!['battery','contacts','call','torch','vibrate','volume','clipboard','cameras','open-app','photo','accessibility-settings','accessibility-status','screen','screenshot','click','open-url'].includes(o.action)||!Array.isArray(o.args)||o.args.some(x=>typeof x!=='string'||x.length>200))return json(res,400,{error:'Неверная команда телефона'});if(!clients.size)return json(res,503,{error:'Откройте приложение Ева на телефоне'});const id=crypto.randomBytes(16).toString('hex');const result=await new Promise(resolve=>{const timer=setTimeout(()=>{phoneRequests.delete(id);resolve({error:'Приложение Ева не ответило. Откройте его и проверьте разрешения.'})},60000);phoneRequests.set(id,{resolve,timer});emit({type:'phone',id,action:o.action,args:o.args})});if(['photo','screenshot'].includes(o.action)&&!result.error){const raw=result.result;if(typeof raw!=='string'||raw.length>4000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))return json(res,500,{error:'Некорректные данные снимка'});const data=Buffer.from(raw,'base64');if(data.length<100||data[0]!==255||data[1]!==216)return json(res,500,{error:'Снимок не получен'});const screenshot=o.action==='screenshot';const dir=screenshot?require('./screenshot-path').directory:'/sdcard/Documents/Codex';fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,(screenshot?'Экран-':'Фото-')+Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.jpg');fs.writeFileSync(file,data,{flag:'wx'});return json(res,200,{result:file})}return json(res,result.error?503:200,result)}
if(req.method==='POST'&&u.pathname==='/phone/result'){const o=JSON.parse((await read(req,4500000)).toString());const pendingPhone=phoneRequests.get(o.id);if(!pendingPhone)return json(res,404,{error:'Запрос устарел'});phoneRequests.delete(o.id);clearTimeout(pendingPhone.timer);pendingPhone.resolve(o.error?{error:String(o.error)}:{result:o.result});return json(res,200,{ok:true})}
if(req.method==='POST'&&u.pathname==='/commands/execute'){const o=JSON.parse((await read(req,24000)).toString());return json(res,200,await require('./commands').execute(o.text));}
if(req.method==='GET'&&u.pathname==='/models/capabilities')return json(res,200,{freeModelOverride:true,roomIdentity:true});
if(req.method==='GET'&&u.pathname==='/models/catalog')return json(res,200,{models:await providers.catalog(u.searchParams.get('provider'))});
if(req.method==='GET'&&u.pathname==='/models')return json(res,200,{providers:providers.info()});
if(req.method==='POST'&&u.pathname==='/models/save'){const o=JSON.parse((await read(req,8192)).toString());return json(res,200,{providers:providers.save(o.provider,o.model,o.key,o.remove)});}
if(req.method==='POST'&&u.pathname==='/models/image'){const o=JSON.parse((await read(req,16384)).toString());const c=new AbortController();res.on('close',()=>{if(!res.writableEnded)c.abort()});const timer=setTimeout(()=>c.abort(),180000);try{return json(res,200,await providers.image(o,c.signal))}finally{clearTimeout(timer)}}
if(req.method==='POST'&&u.pathname==='/models/chat'){const o=JSON.parse((await read(req,600000)).toString());const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort()});const timeout=setTimeout(()=>controller.abort(),120000);try{return json(res,200,await providers.chat(o,controller.signal))}finally{clearTimeout(timeout)}}
if(req.method==='GET'&&u.pathname==='/voice-settings'){let settings={};try{settings=JSON.parse(fs.readFileSync(path.join(__dirname,'voice-settings.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}return json(res,200,{settings,sileroAvailable})}
if(req.method==='POST'&&u.pathname==='/voice-settings'){const o=JSON.parse((await read(req,4096)).toString()),settings={};for(const k of ['voiceName','voicePitch','voiceRate','voiceOutput','silero-accent','silero-yo','eva-codex-access','eva-codex-model','eva-auto-model','eva-main-effort'])if(typeof o[k]==='string'&&o[k].length<=256)settings[k]=o[k];const file=path.join(__dirname,'voice-settings.json'),tmp=file+'.'+crypto.randomBytes(8).toString('hex');try{fs.writeFileSync(tmp,JSON.stringify(settings),{mode:0o600,flag:'wx'});fs.renameSync(tmp,file)}finally{try{fs.unlinkSync(tmp)}catch{}}if(settings.voiceName==='silero-kseniya')setTimeout(warmSelectedVoice,100).unref();return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname==='/limits'){if(!ready)return json(res,503,{error:'Codex ещё запускается'});return json(res,200,await accountLimits.refresh())}
if(req.method==='GET'&&u.pathname==='/account'){await checkAccount();return json(res,200,authView())}
if(req.method==='POST'&&u.pathname==='/account/login')return json(res,200,await startLogin());
if(req.method==='POST'&&u.pathname==='/account/cancel'){if(loginId)await rpc('account/login/cancel',{loginId});loginId=null;auth.pending=false;auth.code='';auth.url='';return json(res,200,authView())}
if(req.method==='POST'&&u.pathname==='/town'){
 const request=JSON.parse((await read(req,48000)).toString());
 const result=await townChat.run(request);
 if(request.op==='state')result.week=ready&&auth.authenticated?accountLimits.week():null;
 return json(res,200,result);
}
if(req.method==='POST'&&u.pathname==='/stream-dialogue'){
 const {id,topic}=JSON.parse((await read(req,1024)).toString());
 if(typeof id!=='string'||!/^[a-z0-9-]{1,50}$/.test(id)||typeof topic!=='string')return json(res,400,{});
 if(!ready||!auth.authenticated)return json(res,200,{id,pairs:[]});
 const controller=new AbortController();
 res.once('close',()=>{if(!res.writableEnded)controller.abort()});
 const pairs=await generateStream(topic,controller.signal);
 return json(res,200,{id,pairs});
}
if(req.method==='GET'&&u.pathname==='/pet-work')return json(res,200,{cards:petWork.list()});
if(req.method==='POST'&&u.pathname==='/pet-work/read'){const o=JSON.parse((await read(req,2048)).toString());petWork.read(o.thread,o.turn,o.request);return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname==='/status')return json(res,200,{ready,authenticated:auth.authenticated});
if(req.method==='POST'&&u.pathname==='/ui/open-thread'){
 if(!clients.size)return json(res,503,{error:'Откройте интерфейс Евы'});
 const threadId=await openWorkThread();
 emit({type:'open-thread',threadId});
 return json(res,200,{accepted:true});
}
if(req.method==='POST'&&u.pathname==='/upload'){const name=path.basename(decodeURIComponent(req.headers['x-file-name']||'file')).replace(/[\x00-\x1f/\\]/g,'_').slice(0,150)||'file';const dir='/sdcard/Documents/Codex';fs.mkdirSync(dir,{recursive:true});const dest=path.join(dir,Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'-'+name);fs.writeFileSync(dest,await read(req,25*1024*1024),{flag:'wx'});return json(res,200,{path:dest})}
if(req.method==='GET'&&u.pathname==='/notes')return json(res,200,{notes:notes.list()});
if(req.method==='POST'&&u.pathname==='/notes/save'){const o=JSON.parse((await read(req,200000)).toString());return json(res,200,{note:notes.put(o)})}
if(req.method==='POST'&&u.pathname==='/notes/delete'){const o=JSON.parse((await read(req,8192)).toString());notes.remove(o.id);return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname==='/tasks')return json(res,200,{tasks:tasks.list()});
if(req.method==='POST'&&u.pathname==='/tasks'){const o=JSON.parse((await read(req,16384)).toString());return json(res,200,{task:tasks.create(o)})}
if(req.method==='POST'&&u.pathname==='/tasks/update'){const o=JSON.parse((await read(req,16384)).toString());return json(res,200,{task:tasks.change(o.id,o.done)})}
if(req.method==='POST'&&u.pathname==='/tasks/delete'){const o=JSON.parse((await read(req,16384)).toString());tasks.remove(o.id);return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname==='/voice-ack'){const name=u.searchParams.get('name');if(!['yes','here','listen'].includes(name))return json(res,400,{error:'Неизвестный отклик'});const file=path.join(__dirname,'voices','ack',name+'.wav');if(!fs.existsSync(file))return json(res,404,{error:'Отклик недоступен'});return serveFile(res,file,{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})}
if(req.method==='POST'&&u.pathname==='/speech-silero'){if(!sileroAvailable)return json(res,503,{error:'Silero не установлен'});const o=JSON.parse((await read(req,65536)).toString());if(o.voice!=='silero-kseniya'||typeof o.text!=='string'||!o.text.trim()||o.text.length>12000)return json(res,400,{error:'Неверный голос или текст'});const audio=await require('./silero-worker').synth(o.text,{accent:o.accent!==false,yo:o.yo!==false});if(res.destroyed)return;res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(audio)}

if(req.method==='GET'&&u.pathname==='/drafts'){let data=[];try{data=JSON.parse(fs.readFileSync(draftsFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}if(!Array.isArray(data))throw Error('Ошибка файла черновиков');return json(res,200,{drafts:data})}
if(req.method==='POST'&&['/drafts/save','/drafts/delete'].includes(u.pathname)){const o=JSON.parse((await read(req,131072)).toString()),file=draftsFile;let drafts=[];try{drafts=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}if(!Array.isArray(drafts))throw Error('Ошибка файла черновиков');if(typeof o.id!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(o.id))return json(res,400,{error:'Неверный идентификатор'});drafts=drafts.filter(x=>x.id!==o.id);if(u.pathname==='/drafts/save'){if(typeof o.txt!=='string'||o.txt.length>30000||!Array.isArray(o.files)||o.files.length>20||o.files.some(f=>!f||typeof f.name!=='string'||typeof f.path!=='string'||typeof f.image!=='boolean'))return json(res,400,{error:'Неверный черновик'});if(drafts.length>=100)return json(res,400,{error:'Слишком много черновиков'});drafts.push({id:o.id,txt:o.txt,files:o.files,threadId:typeof o.threadId==='string'?o.threadId:null,createdAt:new Date().toISOString()})}const tmp=file+'.'+crypto.randomBytes(8).toString('hex');try{fs.writeFileSync(tmp,JSON.stringify(drafts),{mode:0o600,flag:'wx'});fs.renameSync(tmp,file)}finally{try{fs.unlinkSync(tmp)}catch{}}return json(res,200,{ok:true})}
if(req.method==='POST'&&u.pathname==='/rpc'){
 const o=JSON.parse((await read(req,1024*1024)).toString());
 if(!allowed.has(o.method))return json(res,403,{error:'Недоступная команда'});
 const steer=o.method==='turn/steer';
 if((steer||o.method==='turn/start')&&!auth.authenticated)
  return json(res,401,{error:'Сначала войдите в аккаунт Codex'});
 const params=o.params||{};
 if(typeof params!=='object'||Array.isArray(params))return json(res,400,{error:'Неверные параметры'});
 if(o.method==='thread/resume'&&(params.path||params.history))return json(res,400,{error:'Укажите идентификатор чата'});
 if(o.method==='turn/start')params.serviceTierForTurn='default';
 try{
  const result=await rpc(o.method,params);
  return json(res,200,{result:o.chatView===true&&o.method==='thread/resume'?mobileThreadView(result):result});
 }catch(error){
  // Only an explicit rejection from Codex can safely enter the next-turn queue.
  if(steer&&error.rpcCode===-32600){
   if(error.message==='no active turn to steer')
    return json(res,409,{error:'Текущий ответ закончился',code:'turnEnded'});
   if(/^expected active turn id `[^`]+` but found `[^`]+`$/.test(error.message))
    return json(res,409,{error:'Текущий ответ сменился',code:'turnChanged'});
  }
  throw error;
 }
}
if(req.method==='POST'&&u.pathname==='/answer'){const o=JSON.parse((await read(req,1024*1024)).toString());if(!pendingClientRequests.has(String(o.id)))return json(res,409,{error:'Этот запрос уже обработан или недоступен'});if(o.error)send({id:o.id,error:o.error});else send({id:o.id,result:o.result});pendingClientRequests.delete(String(o.id));petWork.answered(o.id);return json(res,200,{ok:true})}json(res,404,{error:'Не найдено'})}catch(e){if(!res.headersSent)json(res,500,{error:e.message})}});
// Stable port preserves this installation's WebView settings across restarts.
const portFile=path.join(__dirname,'server-port.json');let savedPort=0;try{savedPort=JSON.parse(fs.readFileSync(portFile,'utf8')).port;if(!Number.isInteger(savedPort)||savedPort<1024||savedPort>65535)savedPort=0}catch{}
server.once('error',e=>{if(e.code==='EADDRINUSE'&&savedPort){savedPort=0;server.listen(0,'127.0.0.1')}else{console.error('Eva HTTP: '+e.code);proc.kill();process.exit(1)}});
const sileroAvailable=['silero-env/bin/python','voices/silero/v5_6_ru.pt'].every(name=>fs.existsSync(path.join(__dirname,name)));
let sileroWarmStarted=false;
function warmSelectedVoice(){let selected;try{selected=JSON.parse(fs.readFileSync(path.join(__dirname,'voice-settings.json'),'utf8')).voiceName}catch{return}if(!sileroAvailable||selected!=='silero-kseniya'||sileroWarmStarted)return;sileroWarmStarted=true;require('./silero-worker').synth('Я тут.',{accent:false,yo:true}).catch(e=>{sileroWarmStarted=false;console.warn('Предзагрузка голоса:',e.message)})}
server.on('listening',()=>{setTimeout(warmSelectedVoice,1000).unref();const port=server.address().port;fs.writeFileSync(portFile,JSON.stringify({port}),{mode:0o600});const url=`http://127.0.0.1:${port}/#${token}`;fs.writeFileSync(path.join(__dirname,'current-url'),url,{mode:0o600});console.log('EVA_READY '+url)});
server.listen(savedPort,'127.0.0.1');
process.on('SIGTERM',()=>{try{require('./silero-worker').stop('Сервер остановлен')}catch{}proc.kill();server.close();process.exit()});process.on('SIGINT',()=>{try{require('./silero-worker').stop('Сервер остановлен')}catch{}proc.kill();server.close();process.exit()});
