'use strict';
(()=>{
 const panel=document.createElement('section');panel.className='eva-account';panel.hidden=true;
 const title=document.createElement('strong');title.textContent='Вход в Codex';const head=document.createElement('div');head.className='tasks-head';const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Закрыть аккаунт');close.textContent='✕';head.append(title,close);
 const text=document.createElement('p'),code=document.createElement('p');code.className='eva-login-code';
 const login=document.createElement('button');login.textContent='Получить код';
 const open=document.createElement('a');open.textContent='Открыть страницу входа';open.rel='noopener noreferrer';
 const check=document.createElement('button');check.textContent='Проверить вход';
 const cancel=document.createElement('button');cancel.textContent='Отменить попытку';
 panel.append(head,text,code,login,open,check,cancel);document.body.append(panel);
 const menu=document.createElement('button');menu.type='button';menu.id='account-open';menu.title='Аккаунт и доступ к файлам';menu.setAttribute('aria-label','Аккаунт и доступ к файлам');menu.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4 3.2-6 7-6s6.5 2 7 6"/></svg><span class="top-label">Аккаунт</span>';document.getElementById('top-panel').append(menu);
 const files=document.createElement('button');files.textContent='Разрешить доступ к файлам телефона';panel.append(files);
 files.onclick=()=>{if(window.EvaApp)window.EvaApp.filePermission()};
 let userOpen=false,working=false;close.onclick=()=>{userOpen=false;panel.hidden=true};
 async function call(path,post=false){const r=await fetch(path,{method:post?'POST':'GET',headers:{'x-codex-token':location.hash.slice(1)}});const data=await r.json();if(!r.ok)throw Error(data.error||'Ошибка соединения');return data}
 function render(s){panel.hidden=!userOpen&&(localStorage.getItem('mira-model')!=='codex'||!s.ready||!s.checked||s.authenticated);title.textContent=s.authenticated?'Codex подключён':'Вход в Codex';text.textContent=s.error||(s.authenticated?'Вход сохранён в Eva.':s.pending?'Подтвердите код на сайте. Eva дождётся результата.':'Войдите в аккаунт, чтобы продолжить.');code.textContent=s.code||'';login.hidden=s.authenticated||s.pending;login.disabled=!s.ready||working;open.hidden=!s.url;if(s.url)open.href=s.url;cancel.hidden=!s.pending;files.hidden=!window.EvaApp||window.EvaApp.hasFilePermission();}
 async function refresh(){try{render(await call('/account'))}catch(e){text.textContent=e.message}}
 menu.onclick=()=>{userOpen=!userOpen;refresh()};
 login.onclick=async()=>{if(working)return;working=true;login.disabled=true;try{render(await call('/account/login',true))}catch(e){text.textContent=e.message}finally{working=false;login.disabled=false}};
 cancel.onclick=async()=>{try{render(await call('/account/cancel',true))}catch(e){text.textContent=e.message}};
 window.addEventListener('eva-provider-changed',()=>{userOpen=false;refresh()});check.onclick=refresh;window.addEventListener('focus',refresh);setInterval(()=>{if(!panel.hidden)refresh()},5000);refresh();
})();

(()=>{const panel=document.getElementById('voice-settings');if(!panel||!window.EvaApp)return;const button=document.createElement('button');button.type='button';button.textContent='Настройки голоса Android';button.onclick=()=>window.EvaApp.voiceSettings();document.getElementById('voice-preview').after(button);})();

(()=>{const panel=document.getElementById('voice-settings'),before=document.getElementById('voice-preview');if(!panel||!before)return;for(const [key,label] of [['silero-accent','Silero: расставлять ударения'],['silero-yo','Silero: восстанавливать букву ё']]){const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';row.append(input,document.createTextNode(' '+label));before.before(row);document.getElementById('voice-settings-open').addEventListener('click',()=>{input.checked=localStorage.getItem(key)!=='0'});input.onchange=()=>{localStorage.setItem(key,input.checked?'1':'0');if(typeof saveVoiceSettings==='function')saveVoiceSettings()};}})();
