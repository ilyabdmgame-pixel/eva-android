'use strict';
const {execFile}=require('child_process'),{promisify}=require('util'),fs=require('fs');
const exec=promisify(execFile),ROOT=__dirname+'/';
const action=(script,...args)=>({script,args});
function parse(text){
 if(typeof text!=='string'||text.length>5000)return null;
 let t=text.trim().replace(/^(?:привет[,!]?\s+)?ева[\s,:!—-]+/iu,'').replace(/^пожалуйста[, ]+/iu,'').replace(/[, ]+пожалуйста[.!]?$/iu,'').replace(/[.!?]+$/u,'').trim();
 const low=t.toLocaleLowerCase('ru');let m;
 const fixed={
 'переключи песню':['music-control.js','next'],'следующая песня':['music-control.js','next'],'следующий трек':['music-control.js','next'],'переключи трек':['music-control.js','next'],'предыдущая песня':['music-control.js','previous'],'предыдущий трек':['music-control.js','previous'],'включи музыку':['music-control.js','play'],'продолжи музыку':['music-control.js','play'],'останови музыку':['music-control.js','pause'],'поставь музыку на паузу':['music-control.js','pause'],
 'включи запись аудио':['record-audio.py'],'начни запись на диктофон':['record-audio.py'],'сделай фото':['phone.js','photo','back'],'сделай селфи':['phone.js','photo','front'],'сделай скриншот':['android-control.js','screenshot'],'покажи экран':['phone.js','screen'],'прочитай экран':['phone.js','screen'],'покажи камеры':['phone.js','cameras'],'покажи буфер обмена':['phone.js','clipboard'],
 'какой заряд':['phone.js','battery'],'сколько заряда':['phone.js','battery'],'покажи заряд':['phone.js','battery'],'покажи громкость':['phone.js','volume'],'включи вибрацию':['phone.js','vibrate','150'],
 'покажи заметки':['notes.js','list'],'покажи задачи':['tasks.js','list'],'покажи мои заметки':['notes.js','list'],'покажи мои задачи':['tasks.js','list']};
 if(fixed[low])return action(...fixed[low]);
 if(/^(?:включи|пожалуйста включи|проверь|сделай|дай)(?: мне)? вибрац(?:ию|ия)(?: на телефоне)?$/iu.test(t))return action('phone.js','vibrate','150');
 if((m=/^(включи|выключи) (?:мне )?(?:фонарик|вспышку)(?: на телефоне)?$/iu.exec(t)))return action('phone.js','torch',m[1].toLowerCase()==='включи'?'on':'off');
 if((m=/^позвони (.+)$/iu.exec(t)))return {call:m[1].trim()};
 if((m=/^открой (?:приложение )?(.+)$/iu.exec(t))){const name=m[1].toLowerCase();const settings={'настройки':'main','настройки звука':'sound','настройки экрана':'display','настройки bluetooth':'bluetooth','настройки wi-fi':'wifi','специальные возможности':'accessibility'};if(settings[name])return action('phone-actions.js','settings',settings[name]);if(/^https?:\/\//i.test(m[1]))return action('phone.js','open-url',m[1]);return {app:m[1]};}
 if((m=/^(?:поставь|установи) таймер на (\d+) (секунд(?:у|ы)?|минут(?:у|ы)?|час(?:а|ов)?)$/iu.exec(t))){const n=+m[1]*(m[2].startsWith('минут')?60:m[2].startsWith('час')?3600:1);return n>0&&n<=86400?action('phone-actions.js','timer',String(n)):{error:'Таймер должен быть от 1 секунды до 24 часов.'};}
 if((m=/^найди в (?:интернете|браузере) (.+)$/iu.exec(t)))return action('phone-actions.js','search',m[1]);
 if((m=/^(?:найди|покажи) на карте (.+)$/iu.exec(t)))return action('phone-actions.js','maps',m[1]);
 if((m=/^найди контакт (.+)$/iu.exec(t)))return action('phone.js','contacts',m[1]);
 if((m=/^запиши в заметки[: ]+(.+)$/iu.exec(t)))return action('notes.js','add',m[1].slice(0,80),m[1]);
 if((m=/^добавь задачу[: ]+(.+)$/iu.exec(t)))return action('tasks.js','add',m[1]);
 if((m=/^поставь громкость (музыки|звонка|будильника|уведомлений) на (\d+)$/iu.exec(t)))return action('phone.js','volume',{'музыки':'music','звонка':'ring','будильника':'alarm','уведомлений':'notification'}[m[1].toLowerCase()],m[2]);
 return null;
}
const allowed=new Set(['phone.js','phone-actions.js','music-control.js','record-audio.py','android-control.js','notes.js','tasks.js']);
async function run(a){if(!allowed.has(a.script))throw Error('Неизвестный сценарий');try{return (await exec(a.script.endsWith('.py')?'/usr/bin/python3':process.execPath,[ROOT+a.script,...a.args],{timeout:150000,maxBuffer:4*1024*1024})).stdout.trim();}catch(e){throw Error(String(e.stderr||e.message).slice(0,1000));}}
function formatResult(a,result){
 if(result.startsWith('/sdcard/'))return '[Снимок]('+result+')';
 if(a.script==='phone.js'&&a.args[0]==='battery'){try{const data=JSON.parse(result);if(Number.isFinite(data.percentage)&&data.percentage>=0&&data.percentage<=100)return 'Заряд '+data.percentage+'%'+(data.charging?' — телефон заряжается.':'.')}catch{}}
 if(a.script==='phone.js'&&a.args[0]==='open-app'&&result.includes('передан Android'))return 'Попросила Android открыть приложение.';
 if(a.script==='phone.js'&&a.args[0]==='torch'&&result.includes('передана Android'))return 'Команду фонарику передала. Надеюсь, он сегодня в настроении.';
 if(a.script==='music-control.js'){try{const data=JSON.parse(result);if(data.confirmed&&data.action==='play')return 'Музыка играет'+(data.current?.description?' — '+data.current.description.replace(/, null$/,''):'')+'.';if(data.confirmed&&data.action==='pause')return 'Музыка на паузе.';if(data.confirmed&&['next','previous'].includes(data.action))return 'Переключила'+(data.current?.description?' — '+data.current.description.replace(/, null$/,''):'')+'.';return 'Команду музыке отправила, но результат подтвердить не удалось.'}catch{}}
 return result||'Готово.';
}
async function execute(text,runner=run){let a=parse(text);if(!a)return {handled:false};if(a.error)return {handled:true,text:a.error};
 if(a.call){const name=a.call;if(/^\+?[0-9][0-9 ()-]{2,30}$/.test(name))a=action('phone.js','call',name);else{const matches=JSON.parse(await runner(action('phone.js','contacts',name)));if(!Array.isArray(matches)||matches.length!==1||!matches[0].number)return {handled:true,text:'Не найден единственный контакт. Уточни имя или продиктуй номер; звонок не выполнялся.'};a=action('phone.js','call',matches[0].number);}}
 if(a.app){let apps={};try{apps=JSON.parse(fs.readFileSync(ROOT+'command-apps.json','utf8'))}catch{}const name=a.app.toLowerCase();const pkg=apps[name]||(/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(a.app)?a.app:null);if(!pkg)return {handled:true,text:'Название приложения пока не привязано. Укажи точное имя пакета или добавим приложение в список команд.'};a=action('phone.js','open-app',pkg);}
 const result=await runner(a);return {handled:true,text:formatResult(a,result)};}
module.exports={parse,execute};
