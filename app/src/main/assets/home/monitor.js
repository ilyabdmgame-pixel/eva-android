'use strict';
{
 const tabs={phone:'Телефон',apps:'Приложения',services:'Службы'};
 const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
 const timeFormat=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'});
 const thermal=['Норма','Лёгкий нагрев','Умеренный нагрев','Сильный нагрев','Критический','Аварийный','Отключение'];
 let current='phone',request=0,timer=0,body,refresh,tabBar;
 const open=()=>sheet==='device-monitor'&&!document.hidden;
 const appFor=pkg=>apps.find(app=>app.key.startsWith(pkg+'/'));
 const gigabytes=value=>number.format(value/1073741824)+' ГБ';
 function setTab(tab){
  current=tab;
  for(const button of tabBar.children)button.setAttribute('aria-pressed',String(button.dataset.tab===tab));
  body.replaceChildren(node('p','Считываю данные Android…','sub'));
  poll();
 }
 function stop(){clearTimeout(timer);request++;if(refresh)refresh.disabled=false;}
 function poll(){
  clearTimeout(timer);
  if(!open())return;
  const id=++request;
  refresh.disabled=true;
  window.Desk?.deviceSnapshot?.(current,id);
  timer=setTimeout(()=>{
   if(id===request&&open()){
    body.replaceChildren(node('p','Android ещё не вернул данные.','sub'));
    refresh.disabled=false;
   }
  },4200);
 }
 function metric(out,name,value,detail){
  const card=node('div',null,'device-metric');
  card.append(node('span',name),node('strong',value));
  if(detail)card.append(node('small',detail));
  out.append(card);
 }
 function displayPhone(data){
  const grid=node('div',null,'device-metrics'),value=(key,unit='')=>Number.isFinite(data[key])?number.format(data[key])+unit:'—';
  const use=(used,total)=>Number.isFinite(used)&&total?gigabytes(total-used)+' / '+gigabytes(total):'—';
  metric(grid,'Заряд',value('battery','%'));
  metric(grid,'Батарея',value('batteryTemp',' °C'),'Температура аккумулятора');
  metric(grid,'Нагрев системы',thermal[data.thermal]||'—','Статус Android');
  metric(grid,'ЦП Евы',value('cpuPercent','%'),'100% = одно ядро');
  metric(grid,'Оперативная память',use(data.memoryFree,data.memoryTotal),'Занято');
  metric(grid,'Хранилище',use(data.diskFree,data.diskTotal),'Занято');
  if(Number.isFinite(data.uptime)){
   const min=Math.floor(data.uptime/60000);
   metric(grid,'После перезагрузки',Math.floor(min/60)+' ч '+min%60+' мин');
  }
  body.replaceChildren(grid);
 }
 function entry(out,title,detail,app){
  const row=app?btn(null,'device-entry',()=>launchApp(app)):node('div',null,'device-entry');
  if(app)row.append(icon(app));
  const names=node('div',null);
  names.append(node('strong',title),node('small',detail));row.append(names);
  out.append(row);
 }
 function displayApps(data){
  body.replaceChildren();
  const processes=menuSection(body,'Процессы, видимые Еве');
  for(const process of data.running||[]){
   const app=(process.packages||[]).map(appFor).find(Boolean);
   entry(processes,app?.name||process.name,(app?process.name+' · ':'')+'PID '+process.pid,app);
  }
  if(processes.childElementCount===1)processes.append(node('p','Android не вернул процессы.','sub'));
  const recent=menuSection(body,'Использованы за последний час');
  if(!data.usageAccess){
   recent.append(label('Доступ к истории использования','Открыть настройки Android','↗',()=>Desk.deviceSettings('usage')));
  }else{
   for(const item of data.recent||[]){
    const app=appFor(item.package);
    entry(recent,app?.name||item.package,timeFormat.format(new Date(item.lastUsed)),app);
   }
   if(recent.childElementCount===1)recent.append(node('p','За последний час список пуст.','sub'));
  }
  body.append(btn('Настройки приложений','back-link',()=>Desk.deviceSettings('apps')));
 }
 function displayServices(data){
  body.replaceChildren(node('p','Запущенные службы Евы, доступные через Android.','sub'));
  const names={CodexService:'Среда Codex',TownService:'Чат комнаты',LifeService:'Распорядок комнаты',
   EvaAccessibility:'Управление экраном',EvaVoiceService:'Голосовой помощник'};
  for(const item of data.services||[]){
   const name=item.name.split('.').at(-1);
   entry(body,names[name]||name,(item.foreground?'На переднем плане · ':'')+'PID '+item.pid);
  }
  if(body.childElementCount===1)body.append(node('p','Активных служб в списке нет.','sub'));
 }
 window.evaDeviceSnapshot=(id,data)=>{
  if(id!==request||!open())return;
  clearTimeout(timer);refresh.disabled=false;
  if(data.error)body.replaceChildren(node('p',data.error,'sub'));
  else if(current==='phone')displayPhone(data);
  else if(current==='apps')displayApps(data);
  else displayServices(data);
  if(current==='phone')timer=setTimeout(poll,3000);
 };
 window.evaMonitorChanged=()=>{if(!open())stop()};
 document.addEventListener('visibilitychange',()=>{if(open())poll();else stop()});
 $('device-monitor')?.addEventListener('click',()=>{
  const out=showSheet('device-monitor','Диспетчер');
  tabBar=node('div',null,'device-tabs');
  for(const [key,title] of Object.entries(tabs)){
   const button=btn(title,'',()=>setTab(key));button.dataset.tab=key;
   tabBar.append(button);
  }
  refresh=btn('Обновить','device-refresh',poll);
  body=node('div',null,'device-results');
  out.append(tabBar,refresh,body);setTab('phone');
 });
}
