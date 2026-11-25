'use strict';
const $=id=>document.getElementById(id);
let apps=[],sheet='',pinMode=false;
function node(tag,value,cls){const e=document.createElement(tag);if(value!==null)e.textContent=value;if(cls)e.className=cls;return e}
function btn(text,cls,fn){const e=node('button',text,cls);e.type='button';e.onclick=fn;return e}
function label(text,detail,icon,fn){
 const b=btn(null,'row',fn);const art={'☾':'wall-art','⌂':'grid-art','♫':'speaker-art','◷':'journal-art'}[icon];
 const tag=node('span',art?null:icon,'tag');if(art)tag.append(node('i',null,'art-icon '+art));b.append(tag);const body=node('span',null);body.append(node('strong',text),node('small',detail));b.append(body);return b;
}
function showSheet(id,title){window.closeTown?.();sheet=id;$('scrim').hidden=false;$('sheet').hidden=false;$('title').textContent=title;$('content').replaceChildren();return $('content')}
window.closeSheet=()=>{sheet='';pinMode=false;$('sheet').hidden=true;$('scrim').hidden=true;document.activeElement?.blur()};
$('close').onclick=$('scrim').onclick=closeSheet;
function icon(app){const i=node('img',null);i.alt='';i.loading='lazy';i.src='/icon?id='+encodeURIComponent(app.key);return i}
function pins(){
 const raw=localStorage.getItem('pins');if(raw!==null){try{return JSON.parse(raw).filter(k=>apps.some(a=>a.key===k)).slice(0,4)}catch{}}
 const selected=[];
 for(const re of [/dialer|contacts.*dial/i,/messaging|mms|telegram/i,/camera/i,/chrome|browser/i]){
  const a=apps.find(x=>re.test(x.key)&&!selected.includes(x.key));if(a)selected.push(a.key);
 }
 for(const a of apps)if(selected.length<4&&!selected.includes(a.key))selected.push(a.key);
 return selected;
}
function dock(){
 const dest=$('favorites');dest.replaceChildren();
 for(const k of pins()){const a=apps.find(x=>x.key===k);if(!a)continue;const b=btn(null,'fav',()=>Desk.open(k));b.setAttribute('aria-label',a.name);b.append(icon(a));dest.append(b)}
}
window.refreshApps=()=>{try{apps=JSON.parse(Desk.apps());dock();folderBar();if(sheet==='apps')drawer()}catch{}};
function drawer(){
 const out=showSheet('apps',pinMode?'Значки в доке':'Приложения');
 if(pinMode)out.append(node('p','Выбери до четырёх приложений. Повторное касание снимет значок.','sub'));
 const search=node('input',null);search.type='search';search.placeholder='Найти приложение';search.setAttribute('aria-label','Найти приложение');
 const grid=node('div',null,'apps'),foot=node('div',null,'foot');out.append(search,grid,foot);
 const render=()=>{const saved=pins(),q=search.value.toLocaleLowerCase('ru');grid.replaceChildren();for(const a of apps.filter(x=>(x.name+' '+x.key).toLocaleLowerCase('ru').includes(q))){
   const b=btn(null,'app',()=>{if(!pinMode){Desk.open(a.key);return}const ks=pins(),i=ks.indexOf(a.key);if(i>=0)ks.splice(i,1);else if(ks.length<4)ks.push(a.key);else{search.placeholder='Сначала сними один значок';return}localStorage.setItem('pins',JSON.stringify(ks));dock();render()});
   b.append(icon(a),node('span',(pinMode&&saved.includes(a.key)?'✓ ':'')+a.name));b.setAttribute('aria-label',a.name);grid.append(b);
 }if(!grid.childElementCount)grid.append(node('p','Ничего не найдено','sub'))};
 search.oninput=render;render();
 foot.append(btn(pinMode?'Готово':'Настроить док','',()=>{pinMode=!pinMode;drawer()}),btn('Голос Евы','',()=>Desk.eva()),btn('Тема телефона','',phoneTheme));
}
$('all').onclick=drawer;
window.refreshApps();

function phoneTheme(){
 const out=showSheet('theme','Тема телефона');
 const preview=node('img',null,'lock-preview');preview.src='/art/eva-lock.jpg';preview.alt='Вечерняя набережная. Ева сидит рядом с рыжим котом.';
 out.append(preview,label('Обои экрана блокировки','Применить эту иллюстрацию','☾',()=>Desk.lockWallpaper()));
 out.append(label('Рабочий стол','Выбрать «Дом Евы» в настройках Android','⌂',()=>Desk.chooseHome()));
 const boot=Desk.bootEnabled();
 const toggle=label('Жизнь Евы после перезагрузки',boot?'Автозапуск включён':'Автозапуск выключен','↻',()=>{
   Desk.setBootEnabled(!boot);phoneTheme();
 });
 toggle.setAttribute('aria-pressed',String(boot));out.append(toggle);
 const weather=label('Звуки города','Громкость, шаги и окружение','♫',()=>window.openHomeSound());
 out.append(weather);
}
