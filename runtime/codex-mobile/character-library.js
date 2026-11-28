'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {inspect,MAX_BYTES,MAX_VERTICES,MAX_INDICES}=require('./character-format');
const {cleanPng}=require('./personal-profile');
const keys=['chat','pet','room'];
const hex=/^[a-f0-9]{64}$/;
const invalid=(message,status=400)=>Object.assign(new Error(message),{status});
const MAX_BODY=32*1024*1024;
function parts(bytes) {
  if(bytes.length<24||bytes.length>MAX_BODY||bytes.toString('ascii',0,4)!=='EVA2')throw invalid('Некорректный пакет персонажа.');
  let offset=24;
  const out=[];
  for(let i=0;i<5;i++){
    const size=bytes.readUInt32LE(4+i*4);
    if(!size||offset+size>bytes.length)throw invalid('Файл персонажа обрезан.');
    out.push(bytes.subarray(offset,offset+size));offset+=size;
  }
  if(offset!==bytes.length||out[0].length>MAX_BYTES)throw invalid('Некорректный размер модели.');
  return out;
}
function validMesh(b) {
  if(b.length<16||b.toString('ascii',0,4)!=='EVM1')throw invalid('Не удалось прочитать геометрию комнаты.');
  const vertices=b.readUInt32LE(4),indices=b.readUInt32LE(8),stride=b.readUInt32LE(12);
  if(stride!==18||vertices<3||vertices>MAX_VERTICES||!indices||indices%3||indices>MAX_INDICES||16+(vertices*stride+indices)*4!==b.length)throw invalid('Недопустимый размер геометрии комнаты.');
  let offset=16;
  for(let i=0;i<vertices;i++)for(let field=0;field<stride;field++,offset+=4){
    const n=b.readFloatLE(offset);
    if(!Number.isFinite(n)||Math.abs(n)>1e5||([8,9].includes(field)&&(!Number.isInteger(n)||n<0||n>=16))||
       (field===16&&(n<0||n>1))||(field===17&&n!==0))throw invalid('Некорректная вершина или вес кости.');
  }
  for(;offset<b.length;offset+=4)if(b.readUInt32LE(offset)>=vertices)throw invalid('Индекс выходит за пределы модели.');
}
function library(home) {
  const dir=path.join(home,'.config','eva','appearance','models'), slotsFile=path.join(dir,'slots.json');
  function init(){fs.mkdirSync(dir,{recursive:true,mode:0o700});}
  function files(){try{return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()&&hex.test(e.name)).map(e=>e.name);}
    catch(e){if(e.code==='ENOENT')return [];throw e;}}
  function slots(){try{return JSON.parse(fs.readFileSync(slotsFile,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
  function state(){const names={};for(const hash of files())names[hash]=fs.readFileSync(path.join(dir,hash,'name.txt'),'utf8');return {slots:slots(),names};}
  function checkKeys(targets){if(!Array.isArray(targets)||!targets.length||targets.some(k=>!keys.includes(k)))throw invalid('Выбери чат, питомца или рабочий стол.');}
  function assign(targets,hash) {
    checkKeys(targets);
    if(hash!==null&&(!hex.test(hash)||!files().includes(hash)))throw invalid('Такой модели нет.',404);
    const s=slots();for(const k of targets){if(hash)s[k]=hash;else delete s[k];}
    init();const tmp=path.join(dir,'.slots-'+crypto.randomUUID());
    try{fs.writeFileSync(tmp,JSON.stringify(s),{flag:'wx',mode:0o600});fs.renameSync(tmp,slotsFile);}
    finally{fs.rmSync(tmp,{force:true});}
    return state();
  }
  async function put(bytes,targets,name){
    checkKeys(targets);
    const [model,mesh,atlas,poses,poster]=parts(bytes);
    try{inspect(model);validMesh(mesh);}catch(e){throw invalid(e.message);}
    const hash=crypto.createHash('sha256').update(model).digest('hex');
    const destination=path.join(dir,hash);
    if(fs.existsSync(destination))return assign(targets,hash);
    const images=await Promise.all([cleanPng(atlas),cleanPng(poses),cleanPng(poster)]);
    if(images[0].readUInt32BE(16)!==images[0].readUInt32BE(20)||images[0].readUInt32BE(16)>1024||
       images[1].readUInt32BE(16)!==1152||images[1].readUInt32BE(20)!==768||images[2].readUInt32BE(16)!==576||images[2].readUInt32BE(20)!==864)throw invalid('Неподходящий размер текстуры или кадров питомца.');
    if(fs.existsSync(destination))return assign(targets,hash);
    if(files().length>=8)throw invalid('В библиотеке уже восемь моделей. Удали одну из неиспользуемых.');
    init();const tmp=fs.mkdtempSync(path.join(dir,'.import-'));
    try{
      const label=String(name||'Модель').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,90)||'Модель';
      for(const [file,content] of [['model.glb',model],['room.mesh',mesh],['atlas.png',images[0]],['poses.png',images[1]],['portrait.png',images[2]],['name.txt',label]])
        fs.writeFileSync(path.join(tmp,file),content,{flag:'wx',mode:0o600});
      fs.renameSync(tmp,destination);
    }finally{fs.rmSync(tmp,{recursive:true,force:true});}
    return assign(targets,hash);
  }
  function remove(hash){
    if(!hex.test(hash)||!files().includes(hash))throw invalid('Такой модели нет.',404);
    if(Object.values(slots()).includes(hash))throw invalid('Сначала верни стандартный вид там, где включена модель.',409);
    fs.rmSync(path.join(dir,hash),{recursive:true});return state();
  }
  function asset(hash,name){
    if(!hex.test(hash)||!['model.glb','poses.png','portrait.png'].includes(name))throw invalid('Файл не найден.',404);
    return path.join(dir,hash,name);
  }
  return {state,assign,put,remove,asset};
}
async function readLimited(req,max){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>max)throw invalid('Слишком большой файл.',413);chunks.push(chunk);}
  return Buffer.concat(chunks,size);
}
function routes(home,json,serveFile) {
  const store=library(home);
  return async (req,res,u)=>{
    try{
      if(u.pathname==='/character-models'&&req.method==='GET')return json(res,200,store.state());
      if(u.pathname==='/character-models/import'&&req.method==='POST'){
        if(req.headers['content-type']!=='application/octet-stream')throw invalid('Нужен файл модели.',415);
        return json(res,200,await store.put(await readLimited(req,MAX_BODY),(u.searchParams.get('slots')||'').split(','),u.searchParams.get('name')));
      }
      if(u.pathname==='/character-models/slots'&&req.method==='POST'){
        const {targets,hash}=JSON.parse((await readLimited(req,1500)).toString());
        return json(res,200,store.assign(targets,hash));
      }
      const match=/^\/character-models\/([a-f0-9]{64})(?:\/(model\.glb|poses\.png|portrait\.png))?$/.exec(u.pathname);
      if(match&&req.method==='GET'&&match[2])return serveFile(res,store.asset(match[1],match[2]),{
        'Content-Type':match[2]==='model.glb'?'model/gltf-binary':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
      if(match&&req.method==='DELETE'&&!match[2])return json(res,200,store.remove(match[1]));
      return json(res,404,{error:'Модель не найдена.'});
    }catch(e){return json(res,e.status||500,{error:e.status?e.message:'Не удалось прочитать или сохранить модель.'});}
  };
}
module.exports={library,routes};
