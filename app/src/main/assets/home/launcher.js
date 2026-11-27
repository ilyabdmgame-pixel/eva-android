'use strict';
const $=id=>document.getElementById(id);
let apps=[],sheet='',drawerSection='all',pinMode=false;
function node(tag,value,cls){const e=document.createElement(tag);if(value!==null)e.textContent=value;if(cls)e.className=cls;return e}
function btn(text,cls,fn){const e=node('button',text,cls);e.type='button';e.onclick=fn;return e}
const menuIcons = {
 '☾':'moon','⌂':'home','♫':'volume','◷':'clock','↻':'restart','↗':'open','▱':'folder',
 '−':'remove','＋':'add','✥':'move','◇':'item','▤':'monitor','☁':'cloud','›':'next',
 '×':'close','↶':'rotateLeft','↷':'rotateRight','▥':'grid','◎':'compass','◉':'compass',
 '□':'expand','⊞':'grid','✧':'activity','✦':'activity','◈':'model','☷':'menu'
};
function label(text,detail,icon,fn){
 const b=btn(null,'row',fn),tag=node('span',null,'tag');
 tag.setAttribute('aria-hidden','true');
 const key=menuIcons[icon];
 if(key)tag.innerHTML=EvaIcons.html(key);else tag.textContent=icon;
 const body=node('span',null);
 body.append(node('strong',text));
 if(detail)body.append(node('small',detail));
 b.append(tag,body);
 return b;
}
let sheetOpener,folderAnchor;
function showSheet(id,title){
 window.closeTown?.();
 if(!sheet){sheetOpener=document.activeElement;$('screen').inert=true}
 sheet=id;
 $('sheet').dataset.page=id;
 $('sheet-options').hidden=true;
 $('sheet-options').onclick=null;
 $('scrim').hidden=$('sheet').hidden=false;
 $('title').textContent=title;
 $('content').scrollTop=0;
 $('content').replaceChildren();
 if(!$('sheet').contains(document.activeElement))$('close').focus({preventScroll:true});
 window.evaMonitorChanged?.();
 window.homeSheetChanged?.();
 return $('content');
}
window.closeSheet=()=>{
 const wasOpen=Boolean(sheet);
 sheet='';pinMode=false;
 $('sheet').hidden=$('scrim').hidden=true;$('screen').inert=false;
 const focus=(sheetOpener?.isConnected&&sheetOpener!==document.body?sheetOpener:folderButton(folderAnchor))||$('all');
 focus?.focus({preventScroll:true});
 sheetOpener=folderAnchor=null;
 window.evaMonitorChanged?.();
 window.homeSheetChanged?.();
 return wasOpen;
};
$('close').onclick=$('scrim').onclick=closeSheet;
function repairHomeSheet(returning=false){
 if(returning){closeSheet();return;}
 const open=Boolean(sheet)&&!$('sheet').hidden&&!$('scrim').hidden;
 if(!open&&sheet){closeSheet();return}
 $('screen').inert=open;
 if(!open)$('sheet').hidden=$('scrim').hidden=true;
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)repairHomeSheet()});
window.setHomeBattery=(level,charging)=>{
 const battery=$('battery');
 if(!Number.isInteger(level)||level<0||level>100){battery.hidden=true;return}
 battery.hidden=false;
 battery.style.setProperty('--charge',level+'%');
 battery.toggleAttribute('data-charging',charging);
 battery.setAttribute('aria-label','Заряд '+level+' процентов'+(charging?', идёт зарядка':''));
 $('battery-level').textContent=level+'%';
};
$('sheet').addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();closeSheet();return}
 if(event.key!=='Tab')return;
 const focusable=[...$('sheet').querySelectorAll('button:not([disabled]),input:not([disabled]),summary')]
  .filter(el=>el.getClientRects().length>0);
 const next=event.shiftKey?focusable.at(-1):focusable[0];
 const edge=event.shiftKey?focusable[0]:focusable.at(-1);
 if(next&&(document.activeElement===edge||!$('sheet').contains(document.activeElement))){
  event.preventDefault();next.focus();
 }
});
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
function launchApp(app){
 closeSheet();
 Desk.open(app.key);
}
function appTile(app,activate){
 const tile=btn(null,'app',activate);
 tile.append(icon(app),node('span',app.name));
 tile.setAttribute('aria-label',app.name);
 return tile;
}
function appCard(app,back,showOptionsButton=true){
 const card=node('div',null,'app-card');
 const tile=appTile(app,()=>launchApp(app));
 let hold=0,press=null;
 const stopHold=()=>{clearTimeout(hold);hold=0;press=null};
 const showOptions=()=>{stopHold();if(tile.isConnected)appActions(app,back)};
 tile.onpointerdown=event=>{
  if(event.isPrimary&&event.pointerType==='touch'){
   press={x:event.clientX,y:event.clientY};
   hold=setTimeout(showOptions,480);
  }
 };
 tile.onpointermove=event=>{
  if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>8)stopHold();
 };
 tile.onpointerup=tile.onpointercancel=tile.onpointerleave=stopHold;
 tile.oncontextmenu=event=>{event.preventDefault();showOptions()};
 tile.onkeydown=event=>{
  if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){
   event.preventDefault();showOptions();
  }
 };
 card.append(tile);
 if(showOptionsButton){
  const options=btn(null,'app-options',showOptions);
  options.innerHTML=EvaIcons.html('more');
  options.setAttribute('aria-label','Действия · '+app.name);
  card.append(options);
 }
 return card;
}
function appActions(app,back){
 const out=showSheet('app-actions',app.name);
 const pinned=homeShortcut(app.key)!=null;
 out.append(label('Открыть приложение','','↗',()=>launchApp(app)));
 out.append(label(pinned?'Убрать с рабочего стола':'На рабочий стол',
  pinned?'Убрать только значок':'Добавить отдельный значок','⌂',()=>{
   toggleHomeShortcut(app.key);
   if(pinned&&back)back();else closeSheet();
  }));
 const folder=folderForApp(app.key);
 const destinations=groups.filter(group=>group!==folder);
 if(folder||destinations.length){
  const section=menuSection(out,'Папки');
  if(folder)section.append(label('Убрать из папки',folder.name,'−',()=>{
   moveToFolder(app.key,null);back?.();
  }));
  for(const group of destinations)section.append(label(group.name,'Переместить в папку','▱',()=>{
   moveToFolder(app.key,group);back?.();
  }));
 }
 if(back)out.append(btn('Назад','back-link',back));
}
function menuSection(out,title){
 const section=node('section',null,'menu-section');
 section.append(node('h2',title));out.append(section);return section;
}
window.refreshApps=()=>{
 try{
  const next=JSON.parse(Desk.apps());
  if(!Array.isArray(next)||JSON.stringify(next)===JSON.stringify(apps)&&$('folders').childElementCount)return;
  apps=next;dock();folderBar();
  if(sheet==='apps')drawer($('app-search')?.value||'');
 }catch{}
};
function drawer(query=''){
 const out=showSheet('apps',pinMode?'Значки в доке':'Приложения');
 if(pinMode)out.append(node('p','До четырёх значков. Касание добавляет или снимает значок.','sub'));
 const search=node('input',null);
 search.id='app-search';search.type='search';search.value=query;
 search.placeholder='Найти приложение';search.setAttribute('aria-label','Найти приложение');
 const grid=node('div',null,'apps'),foot=node('div',null,'foot');
 if(!pinMode){
  const sections=node('div',null,'app-sections');
  sections.setAttribute('aria-label','Раздел приложений');
  for(const [id,title] of [['all','Все'],['loose','Вне папок']]){
   const tab=btn(title,'',()=>{drawerSection=id;drawer(search.value)});
   tab.setAttribute('aria-pressed',String(drawerSection===id));
   sections.append(tab);
  }
  out.append(sections);
 }
 out.append(search,grid,foot);
 function render(){
  const assigned=pinMode||drawerSection==='all'?null:new Set(groups.flatMap(group=>group.keys));
  const saved=pins(),q=search.value.trim().toLocaleLowerCase('ru');
  const shown=apps.filter(app=>!assigned?.has(app.key)&&(app.name+' '+app.key).toLocaleLowerCase('ru').includes(q));
  grid.replaceChildren();
  for(const app of shown){
   if(!pinMode){grid.append(appCard(app,()=>drawer(search.value)));continue}
   const selected=saved.includes(app.key);
   const tile=appTile(app,()=>{
    const keys=pins(),index=keys.indexOf(app.key);
    if(index>=0)keys.splice(index,1);
    else if(keys.length<4)keys.push(app.key);
    else{limit.textContent='Сначала сними один значок';return}
    limit.textContent='';localStorage.setItem('pins',JSON.stringify(keys));dock();render();
   });
   tile.setAttribute('aria-pressed',String(selected));
   grid.append(tile);
  }
  if(!grid.childElementCount)grid.append(node('p',q?'Ничего не найдено':'Здесь пока нет приложений','sub'));
 }
 const limit=node('p','','sub');limit.setAttribute('role','status');
 if(pinMode)out.insertBefore(limit,grid);
 search.oninput=render;render();
 foot.append(btn(pinMode?'Готово':'Настроить док','',()=>{pinMode=!pinMode;drawer(search.value)}));
 if(!pinMode)foot.append(
  btn('Недавние','',()=>{closeSheet();Desk.openRecentApps?.()}),
  btn('Настройки рабочего стола','',phoneTheme));
}
$('all').onclick=()=>{drawerSection='all';drawer()};
window.refreshApps();

function phoneTheme(){
 const out=showSheet('theme','Настройки «Дома»');
 const desktop=menuSection(out,'Рабочий стол');
 const isDefault=Desk.isDefaultHome?.();
 desktop.append(label(isDefault?'Главный экран Android':'Назначить главным экраном',
  isDefault?'Выбран «Дом Евы»':'Подтвердить выбор в Android','⌂',()=>Desk.chooseHome()));
 const screen=menuSection(out,'Оформление');
 const preview=node('img',null,'lock-preview');preview.src='/art/eva-lock.jpg';preview.alt='Вечерняя набережная';
 screen.append(preview,label('Обои экрана блокировки','Применить иллюстрацию','☾',()=>Desk.lockWallpaper()));
 const room=menuSection(out,'Комната');
 room.append(label('Звуки комнаты','Громкость, шаги и окружение','♫',()=>window.openHomeSound()));
 const boot=Desk.bootEnabled();
 const toggle=label('Расписание после перезагрузки',boot?'Включено':'Выключено','↻',()=>{
   Desk.setBootEnabled(!boot);phoneTheme();
 });
 toggle.setAttribute('aria-pressed',String(boot));room.append(toggle);
 out.append(btn('К приложениям','back-link',()=>drawer()));
}
