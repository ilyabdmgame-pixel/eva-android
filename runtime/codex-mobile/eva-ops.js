#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const phoneTools={
  phone:['phone.js','battery cameras photo contacts call torch vibrate volume clipboard accessibility-status accessibility-settings screen screenshot click open-app open-url'],
  adb:['android-control.js','status connect screenshot screen tap swipe key text apps foreground home-role memory thermal services'],
  intent:['phone-actions.js','app url search maps settings timer dial'],
  music:['music-control.js','next previous play pause'],
  notes:['notes.js','list add update delete'],
  tasks:['tasks.js','list add done undo delete']
};
const operations={
  ...Object.fromEntries(Object.entries(phoneTools).map(([name,[,actions]])=>[name,actions.split(' ')])),
  server:['list','uptime','disk','memory','services','status','logs','restart'],
  github:['status','diff','log','branches','fetch','pull','push','checks'],
  project:['check','build','audit','install-check','install']
};
const descriptions={
 phone:'Действия Android через приложение Ева',adb:'Отладка сопряжённого телефона',
 intent:'Системные экраны и намерения Android',music:'Медиасессия Android',
 notes:'Личные заметки',tasks:'Задачи',server:'Рабочие серверы из локальных профилей',
 github:'Git и проверки сборки',project:'Проверка исходников, сборка и обновление'
};
const names=(s,actions)=>typeof s==='string'&&actions.includes(s);
const simpleName=/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,125}$/;
const argCount=(args,n)=>{if(args.length!==n)throw Error('Неверное количество аргументов. Запусти eva-ops.js help.');};
function readConfig(){
  const file=process.env.EVA_OPS_CONFIG||path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config'),'eva','operations.json');
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return {};throw Error('Не удалось прочитать локальный профиль операций.');}
}
function command(bin,args,options={}){return {bin,args,...options};}
function repoDirectory(config){
  if(config.repository)return path.resolve(config.repository);
  const checkout=path.resolve(__dirname,'../..');
  return fs.existsSync(path.join(checkout,'settings.gradle'))?checkout:process.cwd();
}
function gitCommand(config,args){
  return command(config.git||'git',args,{cwd:repoDirectory(config),env:config.gitExecPath?{GIT_EXEC_PATH:config.gitExecPath}:{}});
}
function buildPlan(config,group,action,params){
  if(!Object.hasOwn(operations,group)||!names(action,operations[group]))throw Error('Такой операции нет. Запусти eva-ops.js list.');
  if(Object.hasOwn(phoneTools,group)){
    return command(process.execPath,[path.join(config.phoneRuntime||__dirname,phoneTools[group][0]),action,...params]);
  }
  if(group==='server'){
    const profiles=config.servers||{};
    if(action==='list'){
      if(!params.length)return {output:Object.keys(profiles).sort().join('\n')||'Рабочие серверы ещё не настроены.'};
      argCount(params,1);
      if(!Object.hasOwn(profiles,params[0]))throw Error('Неизвестный локальный профиль сервера.');
      return {output:Object.keys(profiles[params[0]].services||{}).sort().join('\n')||'В профиле нет служб.'};
    }
    const [alias,service]=params,usesUnit=['status','logs','restart'].includes(action);
    argCount(params,usesUnit?2:1);
    if(!simpleName.test(alias)||!Object.hasOwn(profiles,alias))throw Error('Неизвестный локальный профиль сервера.');
    const profile=profiles[alias];
    const remote={uptime:['uptime'],disk:['df','-hP','/'],memory:['free','-h'],
      services:['systemctl','list-units','--type=service','--state=running','--no-pager','--no-legend']};
    if(usesUnit){
      if(!Object.hasOwn(profile.services||{},service)||!simpleName.test(profile.services[service]))throw Error('Служба отсутствует в профиле сервера.');
      const unit=profile.services[service];
      remote[action]=action==='logs'?['journalctl','--no-pager','-n','60','-u',unit]:
        action==='status'?['systemctl','show',unit,'--property=Id,LoadState,ActiveState,SubState']:
        ['systemctl','restart',unit];
    }
    if(profile.transport){
      if(!path.isAbsolute(profile.transport))throw Error('Локальный SSH-сценарий должен иметь абсолютный путь.');
      return command(profile.transport,remote[action]);
    }
    if(!simpleName.test(profile.host||''))throw Error('Укажи SSH Host из локального конфига.');
    return command(config.ssh||'ssh',['-o','BatchMode=yes','-o','ConnectTimeout=12','--',profile.host,...remote[action]]);
  }
  if(group==='github'){
    argCount(params,0);
    if(action==='checks')return {checks:true};
    const verbs={status:['status','--short','--branch'],diff:['diff','--stat','HEAD'],log:['log','-12','--oneline','--decorate'],
      branches:['branch','--all'],fetch:['fetch','origin'],pull:['pull','--ff-only'],push:['push','origin','HEAD']};
    return gitCommand(config,verbs[action]);
  }
  const cwd=repoDirectory(config);
  if(action==='check'||action==='build'){
    argCount(params,0);
    if(action==='check')return command('bash',['tools/check.sh'],{cwd,env:config.javaHome?{JAVA_HOME:config.javaHome}:{}});
    if(config.buildProfile)return command(config.python||'python3',['tools/build_offline.py','--profile',config.buildProfile],{cwd});
    return command(config.gradle||'gradle',[':app:assembleDebug'],{cwd});
  }
  argCount(params,1);
  const apk=path.resolve(params[0]);
  const installArgs=action==='audit'?['tools/audit_apk.py',apk]:['tools/install_apk.py',apk];
  if(action==='install-check')installArgs.push('--check');
  if(action!=='audit'&&config.applicationId)installArgs.push('--package',config.applicationId);
  if(action!=='audit'){
    for(const tool of ['adb','aapt','apksigner'])if(config.installTools?.[tool])installArgs.push('--'+tool,config.installTools[tool]);
  }
  return command(config.python||'python3',installArgs,{cwd});
}
function execute(plan,capture=false){
  const result=spawnSync(plan.bin,plan.args,{cwd:plan.cwd,env:{...process.env,...plan.env},
    stdio:capture?['ignore','pipe','pipe']:'inherit',encoding:'utf8',timeout:20*60*1000});
  if(result.error)throw Error(result.error.code==='ENOENT'?'Инструмент не найден: '+plan.bin:result.error.message);
  if(result.status!==0){
    const error=Error(capture?'Не удалось прочитать сведения Git.':'Команда завершилась с ошибкой.');
    error.exitCode=result.status||1;throw error;
  }
  return (result.stdout||'').trim();
}
function remoteSlug(remote){
  const match=remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?$/i);
  if(!match)throw Error('Для проверки CI укажи githubRepository в локальном профиле.');
  return match[1];
}
async function checks(config){
  const slug=config.githubRepository||remoteSlug(execute(gitCommand(config,['remote','get-url','origin']),true));
  if(!/^[\w.-]+\/[\w.-]+$/.test(slug)||slug.split('/').some(s=>s==='.'||s==='..'))throw Error('Некорректный владелец или имя репозитория.');
  const sha=execute(gitCommand(config,['rev-parse','HEAD']),true);
  const headers={Accept:'application/vnd.github+json','User-Agent':'Eva-Android'};
  if(process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
  const response=await fetch('https://api.github.com/repos/'+slug+'/commits/'+sha+'/check-runs',{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('GitHub вернул HTTP '+response.status);
  const data=await response.json();
  return JSON.stringify({commit:sha,checks:data.check_runs.map(r=>({name:r.name,status:r.status,conclusion:r.conclusion,url:r.html_url}))},null,2);
}
function help(){
  return ['node eva-ops.js <группа> <операция> [аргументы]',''].concat(Object.entries(operations).map(([key,verbs])=>
    key+' — '+descriptions[key]+'\n  '+verbs.join(' · ')),['',
    'server list [профиль] · server status|logs|restart <профиль> <служба>','server uptime|disk|memory|services <профиль>',
    'project audit|install-check|install <APK>','phone photo front|back · adb key back|home|recent|enter',
    'Список в JSON: list --json. Аргументы с пробелами передавай одной строкой.']).join('\n');
}
async function main(argv){
  if(!argv.length||['list','help','--help'].includes(argv[0])){
    console.log(argv.includes('--json')?JSON.stringify(operations,null,2):help());return;
  }
  const config=readConfig(),[group,action,...params]=argv,plan=buildPlan(config,group,action,params);
  if(plan.checks)console.log(await checks(config));
  else if(plan.output!==undefined)console.log(plan.output);
  else execute(plan);
}
module.exports={buildPlan,remoteSlug,operations};
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=e.exitCode||1;});
