'use strict';
let groups;
try{groups=JSON.parse(localStorage.getItem('folders'))}catch{}
if(!Array.isArray(groups))groups=[{name:'Работа',keys:[]},{name:'Игры',keys:[]}];
function persistFolders(){localStorage.setItem('folders',JSON.stringify(groups));folderBar()}
let extras={};
try{extras=JSON.parse(localStorage.getItem('folderExtras'))||{}}catch{}
if(!Array.isArray(extras.shortcuts))extras.shortcuts=[];
extras.shortcuts=extras.shortcuts.filter((item,index,list)=>typeof item?.key==='string'&&
 list.findIndex(shortcut=>shortcut?.key===item.key)===index);
function saveDesktop(){localStorage.setItem('folderExtras',JSON.stringify(extras))}
function homeShortcut(key){return extras.shortcuts.find(item=>item.key===key)}
function toggleHomeShortcut(key){
 if(homeShortcut(key))extras.shortcuts=extras.shortcuts.filter(item=>item.key!==key);
 else extras.shortcuts.push({key});
 saveDesktop();folderBar();
}
function folderForApp(key){return groups.find(folder=>folder.keys.includes(key))}
function moveToFolder(key,target){
 for(const folder of groups)folder.keys=folder.keys.filter(item=>item!==key);
 if(target)target.keys.push(key);
 persistFolders();
}
let folderTiles=[],drag=null,columns=1,rows=1,cellWidth=70,cellHeight=70;
function arrangeFolders(){
 const bar=$('folders');
 bar.style.setProperty('--folder-top',Math.ceil(document.querySelector('header').getBoundingClientRect().bottom+8)+'px');
 columns=Math.max(1,Math.floor(bar.clientWidth/66));
 rows=Math.max(1,Math.floor(bar.clientHeight/70));
 cellWidth=bar.clientWidth/columns;cellHeight=Math.max(70,bar.clientHeight/rows);
 const maxRows=Math.max(rows,Math.ceil(folderTiles.length/columns));
 bar.classList.toggle('overflow',maxRows>rows);
 const occupied=new Set();
 for(const tile of folderTiles)tile.slot=null;
 for(const tile of folderTiles){
   const pos=tile.owner.pos;
   if(!Array.isArray(pos)||pos.length!==2||!pos.every(Number.isInteger))continue;
   const slot=Math.max(0,Math.min(maxRows-1,pos[1]))*columns+Math.max(0,Math.min(columns-1,pos[0]));
   if(!occupied.has(slot)){tile.slot=slot;occupied.add(slot);}
 }
 let empty=0;
 for(const tile of folderTiles){
   if(tile.slot===null){while(occupied.has(empty))empty++;tile.slot=empty;occupied.add(empty);}
   const x=(tile.slot%columns+.5)*cellWidth-tile.button.offsetWidth/2,y=Math.floor(tile.slot/columns)*cellHeight;
   tile.button.style.transform='translate('+x+'px,'+y+'px)';
 }
 if(sheet==='folder')positionFolderSheet();
}
function wireFolder(button,owner,options){
 const tile={button,owner},bar=$('folders');
 folderTiles.push(tile);
 let suppress=false,hold=0;
 const clearHold=()=>{clearTimeout(hold);hold=0};
 button.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();}},true);
 button.onpointerdown=e=>{
   if(!e.isPrimary||e.button!==0)return;
   suppress=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY};
   button.setPointerCapture(e.pointerId);
   if(options&&e.pointerType==='touch')hold=setTimeout(()=>{
     suppress=true;drag=null;options();
   },480);
 };
 button.onpointermove=e=>{
   if(!drag||drag.id!==e.pointerId)return;
   if(!suppress&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;
   clearHold();suppress=true;button.classList.add('moving');
   const r=bar.getBoundingClientRect();
   if(bar.classList.contains('overflow')){
     if(e.clientY>r.bottom-28)bar.scrollTop+=12;
     if(e.clientY<r.top+28)bar.scrollTop-=12;
   }
   const x=Math.max(0,Math.min(r.width-button.offsetWidth,e.clientX-r.left-button.offsetWidth/2));
   const y=Math.max(bar.scrollTop,Math.min(bar.scrollTop+r.height-button.offsetHeight,e.clientY-r.top+bar.scrollTop-button.offsetHeight/2));
   button.style.transform='translate('+x+'px,'+y+'px)';
 };
 function finish(e,commit){
   clearHold();
   if(!drag||drag.id!==e.pointerId)return;
   if(suppress&&commit){
     const r=bar.getBoundingClientRect(),maxRows=Math.max(rows,Math.ceil(folderTiles.length/columns));
     const col=Math.max(0,Math.min(columns-1,Math.floor((e.clientX-r.left)/cellWidth)));
     const row=Math.max(0,Math.min(maxRows-1,Math.floor((e.clientY-r.top+bar.scrollTop)/cellHeight)));
     const other=folderTiles.find(o=>o.slot===row*columns+col);
     for(const existing of folderTiles)existing.owner.pos=[existing.slot%columns,Math.floor(existing.slot/columns)];
     if(other)other.owner.pos=[tile.slot%columns,Math.floor(tile.slot/columns)];
     owner.pos=[col,row];
     localStorage.setItem('folders',JSON.stringify(groups));saveDesktop();
   }
   drag=null;button.classList.remove('moving');arrangeFolders();
   setTimeout(()=>{suppress=false;},0);
 }
 button.onpointerup=e=>finish(e,true);button.onpointercancel=e=>finish(e,false);
 if(options)button.oncontextmenu=e=>{e.preventDefault();clearHold();if(!suppress)options()};

}

function folderBar(){
 drag=null;folderTiles=[];
 const bar=$('folders');bar.replaceChildren();
 groups.forEach((group,i)=>{
  const b=btn(null,'folder',event=>{
   folderScreen(i);
   sheetOpener=event.currentTarget;
  });const tile=node('span',null,'tile');
  b.setAttribute('aria-haspopup','dialog');
  const members=group.keys.map(key=>apps.find(a=>a.key===key)).filter(Boolean);
  if(!members.length)tile.append(node('i',null,'art-icon folder-art'));else members.slice(0,4).forEach(a=>tile.append(icon(a)));
  b.append(tile,node('span',group.name));bar.append(b);wireFolder(b,group);
 });
 for(const shortcut of extras.shortcuts){
  const app=apps.find(entry=>entry.key===shortcut.key);
  if(!app)continue;
  const button=btn(null,'folder desktop-app',()=>launchApp(app));
  button.append(icon(app),node('span',app.name));
  button.setAttribute('aria-label',app.name);
  const options=()=>appActions(app,closeSheet);
  button.onkeydown=event=>{
   if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){
    event.preventDefault();options();
   }
  };
  bar.append(button);wireFolder(button,shortcut,options);
 }
 const loose=btn(null,'folder',()=>{
  drawerSection='loose';drawer();
 });
 const tile=node('span',null,'tile');tile.append(node('i',null,'art-icon grid-art'));
 loose.append(tile,node('span','Вне папок'));bar.append(loose);wireFolder(loose,extras.inbox=extras.inbox??{});
 const add=btn(null,'newfolder',()=>nameFolder(-1));add.append(node('i',null,'art-icon add-art'));add.setAttribute('aria-label','Новая папка');bar.append(add);wireFolder(add,extras.add=extras.add??{});
 arrangeFolders();
}
function nameFolder(i){
 const create=i<0,out=showSheet('folder-name',create?'Новая папка':'Название папки');
 const input=node('input',null);input.type='search';input.maxLength=28;input.placeholder='Название';input.value=create?'':groups[i].name;
 function save(){const name=input.value.trim();if(!name)return;const index=create?groups.length:i;if(create)groups.push({name,keys:[]});else groups[i].name=name;persistFolders();folderScreen(index,create)}
 input.onkeydown=e=>{if(e.key==='Enter')save()};out.append(input,btn('Сохранить','pill',save));input.focus();
}
function folderScreen(i,edit=false){
 if(edit){editFolder(i);return}
 const group=groups[i];
 folderAnchor=group;
 const out=showSheet('folder',group.name);
 const options=$('sheet-options');
 options.hidden=false;options.onclick=()=>folderMenu(i);
 const members=apps.filter(app=>group.keys.includes(app.key));
 if(!members.length)out.append(btn('Добавить приложения','back-link',()=>editFolder(i)));
 else{
  const grid=node('div',null,'apps');
  for(const app of members)grid.append(appCard(app,()=>folderScreen(i),false));
  out.append(grid);
 }
 positionFolderSheet();
}
function folderButton(group){return folderTiles.find(tile=>tile.owner===group)?.button}
function positionFolderSheet(){
 const panel=$('sheet');
 const anchor=folderButton(folderAnchor)?.getBoundingClientRect();
 if(!anchor)return;
 const margin=12,gap=8,{clientWidth:width,clientHeight:height}=document.documentElement;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 panel.style.removeProperty('--folder-limit');
 const {offsetWidth:panelWidth,offsetHeight:panelHeight}=panel;
 const after=clamp(anchor.bottom+gap,margin,height-margin);
 const before=clamp(anchor.top-gap,margin,height-margin);
 const below=height-margin-after,above=before-margin;
 const openBelow=panelHeight<=below||below>=above;
 panel.style.setProperty('--folder-limit',Math.max(1,openBelow?below:above)+'px');
 const left=clamp(anchor.left+(anchor.width-panelWidth)/2,margin,width-panelWidth-margin);
 panel.style.setProperty('--folder-x',left+'px');
 panel.style.setProperty('--folder-y',(openBelow?after:before-panel.offsetHeight)+'px');
}
function folderMenu(i){
 const group=groups[i],out=showSheet('folder-options',group.name);
 out.append(btn('Изменить состав','row',()=>editFolder(i)),btn('Переименовать','row',()=>nameFolder(i)));
 const members=apps.filter(app=>group.keys.includes(app.key));
 if(members.length)out.append(btn('Действия с приложением','row',()=>{
  const list=showSheet('folder-apps','Действия с приложением');
  for(const app of members)list.append(btn(app.name,'row',()=>appActions(app,()=>folderScreen(i))));
  list.append(btn('Назад','back-link',()=>folderMenu(i)));
 }));
 if(!group.keys.length)out.append(btn('Удалить пустую папку','row',()=>{groups.splice(i,1);persistFolders();closeSheet()}));
 out.append(btn('Назад','back-link',()=>folderScreen(i)));
}
function editFolder(i){
 const group=groups[i],out=showSheet('folder-edit',group.name);
 const search=node('input',null);search.type='search';search.placeholder='Найти приложение';
 search.setAttribute('aria-label','Найти приложение');
 const grid=node('div',null,'apps');
 function render(){
  grid.replaceChildren();
  const q=search.value.trim().toLocaleLowerCase('ru');
  for(const app of apps){
   if(!(app.name+' '+app.key).toLocaleLowerCase('ru').includes(q))continue;
   const selected=group.keys.includes(app.key);
   const tile=appTile(app,()=>{moveToFolder(app.key,selected?null:group);render()});
   tile.setAttribute('aria-pressed',String(selected));grid.append(tile);
  }
  if(!grid.childElementCount)grid.append(node('p','Ничего не нашлось','sub'));
 }
 search.oninput=render;
 out.append(btn('Готово','back-link',()=>folderScreen(i)),search,grid);
 render();
}

function resizeFolders(){if(!drag&&folderTiles.length)arrangeFolders()}
new ResizeObserver(resizeFolders).observe(document.querySelector('header'));
window.addEventListener('resize',resizeFolders);
