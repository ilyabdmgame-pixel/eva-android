const viewers=[
  ['бампыч','#edc29e'],
  ['чайный_мод','#8fddca'],
  ['пробел.exe','#cbbcf5'],
  ['кот_с_мышью','#f0aebb'],
  ['анон_с_крыши','#9accef'],
  ['клиппер','#e2d28e'],
  ['жук_в_бане','#b9da9c'],
  ['пиксель_слева','#e9b9ec']
];
const recentLimit=4;
const gap=8;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function streamChatPosition(anchor,size,screen,obstacles){
  const {x,y}=anchor,{w,h}=size;
  if(w+2*gap>screen.w||h+2*gap>screen.h||x<0||x>screen.w||y<0||y>screen.h)return null;
  const left=x-w-gap,right=x+gap,above=y-h-gap,below=y+gap;
  const candidates=[
    [left,above],[right,above],[x-w/2,above],
    [left,y-h/2],[right,y-h/2],
    [left,below],[right,below],[x-w/2,below]
  ];
  for(const [column,row] of candidates){
    const box={x:clamp(column,gap,screen.w-w-gap),y:clamp(row,gap,screen.h-h-gap),w,h};
    if(box.x<=x&&box.x+w>=x&&box.y<=y&&box.y+h>=y)continue;
    if(!obstacles.some(obstacle=>overlap(box,obstacle)))return box;
  }
  return null;
}

export function createStreamChat(panel,canvas,protectedElements){
  const log=panel.querySelector('ol'),empty=panel.querySelector('.stream-chat-empty');
  const document=panel.ownerDocument;
  let lastCheck=-Infinity,followLatest=true;

  function add(cue){
    followLatest=panel.hidden||log.scrollHeight-log.scrollTop-log.clientHeight<=8;
    const [name,color]=viewers[Math.floor(cue.id/2)%viewers.length];
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
    log.replaceChildren();
    empty.hidden=false;
    followLatest=true;
  }

  function layout(anchor,time){
    if(!anchor){hide();return}
    if(time-lastCheck<150)return;
    lastCheck=time;
    if(panel.hidden)panel.hidden=false;
    const viewport=canvas.getBoundingClientRect(),obstacles=[];
    for(const element of protectedElements()){
      const box=element.getBoundingClientRect();
      if(box.width&&box.height)obstacles.push({
        x:box.left-viewport.left-gap,y:box.top-viewport.top-gap,w:box.width+2*gap,h:box.height+2*gap
      });
    }
    const position=streamChatPosition(anchor,{w:panel.offsetWidth,h:panel.offsetHeight},
      {w:viewport.width,h:viewport.height},obstacles);
    if(!position){panel.hidden=true;return}
    const transform=`translate(${position.x}px, ${position.y}px)`;
    if(panel.style.transform!==transform)panel.style.transform=transform;
    if(followLatest){log.scrollTop=log.scrollHeight;followLatest=false}
  }

  return {add,clear,hide,layout};
}
