const viewers=[
  ['бампыч','#edc29e'],
  ['чайный_мод','#8fddca'],
  ['пробел.exe','#cbbcf5'],
  ['кот_с_мышью','#f0aebb'],
  ['анон_с_крыши','#9accef'],
  ['клиппер','#e2d28e'],
  ['жук_в_бане','#b9da9c'],
  ['пиксель_слева','#e9b9ec'],
  ['фантомный_чай','#f0c992'],
  ['пельмешек','#d8ae97'],
  ['крышный_инспектор','#a7c4ed'],
  ['пропуск_в_депо','#b6d09d'],
  ['пледовый_фронт','#c7ade8'],
  ['ctrl_кот','#dfbcca'],
  ['дед_на_бубне','#bdcbbb'],
  ['сосед_сверху','#9bd6ce'],
  ['рыжий_рендер','#edb692'],
  ['анон_в_тапках','#c8bce1']
];
const recentLimit=24;
const gap=8;
const maxLogHeight=128;
const minLogHeight=32;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function streamChatPosition(anchor,size,screen,obstacles,figure,previous){
  const {w,h,minHeight=h}=size;
  const rightEdge=screen.w-w-gap,bottomEdge=screen.h-gap;
  if(rightEdge<gap||bottomEdge-gap<minHeight)return null;
  const x=clamp(anchor.x,gap,screen.w-gap),y=clamp(anchor.y,gap,bottomEdge);
  const occupied=[...obstacles];
  if(figure)occupied.push(figure);
  if(x===anchor.x&&y===anchor.y)occupied.push({x:x-1,y:y-1,w:2,h:2});
  const left=Math.min(x,figure?.x??x)-w-gap;
  const right=Math.max(x,figure?figure.x+figure.w:x)+gap;
  const above=y-h-gap,below=y+gap;
  const candidates=[
    ...(previous?[[previous.x,previous.y]]:[]),
    [left,below],[right,below],[x-w/2,below],
    [left,above],[right,above],[x-w/2,above],
    [left,y-h/2],[right,y-h/2]
  ];
  if(h<=bottomEdge-gap){
    for(const [column,row] of candidates){
      const box={x:clamp(column,gap,rightEdge),y:clamp(row,gap,bottomEdge-h),w,h};
      if(!occupied.some(obstacle=>overlap(box,obstacle)))return box;
    }
  }

  // Try the free space between controls. In a tight layout the log can scroll
  // inside a shorter panel instead of making the whole chat disappear.
  const columns=new Set([gap,rightEdge,...candidates.map(([column])=>clamp(column,gap,rightEdge))]);
  for(const box of occupied){
    columns.add(clamp(box.x-w,gap,rightEdge));
    columns.add(clamp(box.x+box.w,gap,rightEdge));
  }
  occupied.sort((a,b)=>a.y-b.y);
  let best=null,bestDistance=Infinity;
  for(const column of columns){
    let top=gap;
    const consider=end=>{
      const height=Math.floor(Math.min(h,end-top));
      if(height<minHeight||height<(best?.h??0))return;
      const row=clamp((previous?.y??y-height/2),top,end-height);
      const distance=Math.hypot(column-(previous?.x??x-w/2),row-(previous?.y??y-height/2));
      if(height===best?.h&&distance>=bestDistance)return;
      best={x:column,y:row,w,h:height};bestDistance=distance;
    };
    for(const box of occupied){
      if(box.x>=column+w||box.x+box.w<=column||box.y+box.h<=top)continue;
      consider(Math.min(box.y,bottomEdge));
      top=Math.max(top,box.y+box.h);
      if(top>=bottomEdge)break;
    }
    consider(bottomEdge);
  }
  return best;
}

export function createStreamChat(panel,canvas,protectedElements){
  const log=panel.querySelector('ol'),empty=panel.querySelector('.stream-chat-empty');
  const document=panel.ownerDocument;
  let lastCheck=-Infinity,followLatest=true,position=null,logLimit='';

  function add(cue){
    followLatest=panel.hidden||log.scrollHeight-log.scrollTop-log.clientHeight<=8;
    const [name,color]=viewers[cue.author%viewers.length];
    const message=document.createElement('li'),author=document.createElement('b');
    author.textContent=name;
    author.style.color=color;
    message.append(author,document.createTextNode(' '+cue.text));
    log.append(message);
    if(log.children.length>recentLimit)log.firstElementChild.remove();
    empty.hidden=true;
    lastCheck=-Infinity;
  }

  function hide(){
    if(!panel.hidden)panel.hidden=true;
    lastCheck=-Infinity;
  }

  function clear(){
    hide();
    position=null;
    log.replaceChildren();
    empty.hidden=false;
    followLatest=true;
  }

  function layout(anchor,time,figure){
    if(!anchor){hide();return null}
    if(time-lastCheck<150)return panel.hidden?null:position;
    lastCheck=time;
    if(panel.hidden)panel.hidden=false;
    const viewport=canvas.getBoundingClientRect(),obstacles=[];
    for(const element of protectedElements()){
      const box=element.getBoundingClientRect();
      if(box.width&&box.height)obstacles.push({
        x:box.left-viewport.left-gap,y:box.top-viewport.top-gap,w:box.width+2*gap,h:box.height+2*gap
      });
    }
    const chromeHeight=panel.offsetHeight-log.offsetHeight;
    const logHeight=Math.min(log.scrollHeight,maxLogHeight,Math.floor(viewport.height*.24));
    const size={w:panel.offsetWidth,h:chromeHeight+logHeight,minHeight:chromeHeight+Math.min(logHeight,minLogHeight)};
    position=streamChatPosition(anchor,size,{w:viewport.width,h:viewport.height},obstacles,figure,position);
    if(!position){panel.hidden=true;return null}
    const nextLimit=Math.max(0,position.h-chromeHeight)+'px';
    if(logLimit!==nextLimit){
      followLatest ||= log.scrollHeight-log.scrollTop-log.clientHeight<=8;
      panel.style.setProperty('--stream-log-height',nextLimit);
      logLimit=nextLimit;
    }
    const transform=`translate(${position.x}px, ${position.y}px)`;
    if(panel.style.transform!==transform)panel.style.transform=transform;
    if(followLatest){log.scrollTop=log.scrollHeight;followLatest=false}
    return position;
  }

  return {add,clear,hide,layout};
}
