// The monitor plays a small platformer. Simulation coordinates are pixels of its 128 × 64 display.
const W=128,H=64,step=1/60,heroWidth=6,heroHeight=10,gravity=140;
const palettes=[
  ['#24324e','#485371','#987386','#f1b780','#5c6679','#486376','#394855','#ba977c'],
  ['#202b49','#344971','#776591','#e7b0a7','#4c5875','#435675','#303e59','#a591b1'],
  ['#273c49','#406477','#899a9b','#f6d39b','#546f74','#506561','#344e50','#b3ae86']
];
const ink='#252436',lamp='#ffe190';
const runner=[
  '  aaa   ',' abbbba ',' abbsga ','  assa  ','  pppp  ',
  ' apsspa ','  pppp  ','  bbbb  ','  baab  ','  a  a  '
];
const colors={a:ink,b:'#754755',s:'#ffb68c',g:'#ffc862',p:'#a885e1'};
const digits=['75557','26227','71747','71717','55711','74717','74757','71111','75757','75717'];
const wrap=(n,d)=>(n%d+d)%d;

function makeCourse(stage) {
  const roofs=[];
  let left=0;
  for(let i=0;i<10;i++){
    const shape=i+stage*3;
    const hazard=i%3===2&&i<9;
    const width=i===0?57:i===9?54:(hazard?53:31)+wrap(shape*11,21);
    const top=i===0?49:45+wrap(shape*5,9);
    const roof={left,right:left+width,top,coinX:left+width*.5,coinY:top-6,taken:false};
    if(hazard)roof.beetle={home:left+width*.58,gone:false};
    roofs.push(roof);
    left=roof.right+8+wrap(shape*7,9);
  }
  return roofs;
}

function startStage(s,stage) {
  s.stage=stage;
  s.roofs=makeCourse(stage);
  s.x=8;s.y=s.roofs[0].top;s.vy=0;s.ground=0;s.checkpoint=0;
  s.camera=0;s.pause=0;s.flash=0;s.mode='play';s.outcome=null;
}

const beetleX=(beetle,t)=>beetle.home+4*Math.sin(t*2.3+beetle.home);
function resetRunner(s){
  if(s.hearts===0){s.hearts=3;s.attempt++;startStage(s,s.stage);return;}
  const roof=s.roofs[s.checkpoint];
  s.x=roof.left+3;s.y=roof.top;s.vy=0;s.ground=s.checkpoint;
  s.camera=Math.max(0,s.x-29);s.flash=1;s.mode='play';
}
function damage(s){
  s.hearts--;s.pause=.57;s.mode='fall';s.outcome='miss';
}
function pilot(s,speed){
  const roof=s.roofs[s.ground];
  if(!roof)return false;
  const beetle=roof.beetle;
  if(beetle&&!beetle.gone){
    const ahead=beetleX(beetle,s.time)-s.x;
    if(ahead>0&&ahead<speed*.48)return true;
  }
  return s.ground<s.roofs.length-1&&roof.right-s.x<=6.5;
}
function tick(s,input){
  s.time+=step;
  if(s.pause>0){
    s.pause=Math.max(0,s.pause-step);
    if(s.mode==='fall'){s.y+=s.vy*step;s.vy+=gravity*step;}
    if(!s.pause){
      if(s.mode==='finish'){s.hearts=Math.min(3,s.hearts+1);startStage(s,s.stage+1);}
      else resetRunner(s);
    }
    return;
  }
  s.flash=Math.max(0,s.flash-step);
  const speed=27+Math.min(5,s.stage);
  if(s.ground>=0&&(input===undefined?pilot(s,speed):input.jump)){
    s.vy=-66;s.ground=-1;
  }
  const priorY=s.y;
  s.x+=speed*step;
  if(s.ground>=0&&s.x>s.roofs[s.ground].right+1)s.ground=-1;
  if(s.ground<0){
    s.vy+=gravity*step;s.y+=s.vy*step;
    if(s.vy>=0){
      const landed=s.roofs.findIndex(r=>s.x>=r.left-1&&s.x<=r.right+1&&priorY<=r.top&&s.y>=r.top);
      if(landed>=0){s.ground=landed;s.y=s.roofs[landed].top;s.vy=0;if(landed%3===0)s.checkpoint=landed;}
    }
  }
  for(const r of s.roofs){
    if(Math.abs(s.x-r.coinX)<6&&Math.abs(s.y-heroHeight*.55-r.coinY)<7&&!r.taken){
      r.taken=true;s.score++;s.outcome='lantern';
    }
    if(!r.beetle||r.beetle.gone||s.flash>0||Math.abs(s.x-beetleX(r.beetle,s.time))>heroWidth)continue;
    if(s.y<r.top-9||s.y-heroHeight>r.top)continue;
    if(s.vy>0&&priorY<r.top-5){
      r.beetle.gone=true;s.vy=-44;s.ground=-1;s.score+=2;s.outcome='bounce';
    }else{damage(s);return;}
  }
  if(s.y>H+14){damage(s);return;}
  s.camera=Math.max(0,s.x-29);
  if(s.x>s.roofs.at(-1).right-12){s.mode='finish';s.pause=1.2;s.outcome='flag';}
}

function drawGame(ctx,s){
  const p=palettes[s.stage%palettes.length];
  const rect=(color,x,y,w,h)=>{
    ctx.fillStyle=color;ctx.fillRect(Math.floor(x),Math.floor(y),w,h);
  };
  function digit(value,x,y){
    for(const c of String(value)){
      const rows=digits[Number(c)];
      for(let row=0;row<5;row++){
        const bits=Number(rows[row]);
        for(let bit=0;bit<3;bit++)if(bits&(4>>bit))rect('#fff0c3',x+bit,y+row,1,1);
      }
      x+=4;
    }
  }
  rect(p[0],0,0,W,H);rect(p[1],0,15,W,18);rect(p[2],0,33,W,20);
  rect(p[3],92,11,12,14);rect(p[3],90,14,16,8);
  for(let i=0;i<14;i++){
    const sx=wrap(i*21-s.camera*.07,137)-5,sy=7+wrap(i*41,28);
    rect(i%3?p[2]:'#e7d5b8',sx,sy,i%3?5:1,1);
  }
  for(let layer=0;layer<2;layer++){
    const tile=layer?17:12,offset=s.camera*(layer?.42:.19);
    for(let i=Math.floor(offset/tile)-1;i<=(offset+W)/tile;i++){
      const x=i*tile-offset,y=(layer?34:26)+wrap(i*7+layer*5,12);
      rect(p[layer?6:4],x,y,tile-1,H-y);
      rect(p[layer?5:4],x+2,y-3,5,4);
      if(layer){
        rect(p[7],x+3,y+4,2,2);rect(p[5],x+8,y+9,3,2);
      }
    }
  }
  const t=s.time;
  for(const [i,r] of s.roofs.entries()){
    const x=r.left-s.camera,w=r.right-r.left,y=r.top;
    if(x>W||x+w<0)continue;
    rect('#334959',x,y,w,H-y+1);rect('#497171',x,y+3,w,3);
    rect('#e4b98e',x,y,w,1);rect('#a58e7d',x,y+1,w,2);
    for(let a=4;a<w-3;a+=10){
      rect('#273745',x+a,y+8,6,7);
      rect((a+i)%3?'#b79072':'#698383',x+a+1,y+9,2,4);
    }
    if(i%3===1){rect('#394653',x+5,y-5,4,5);rect('#8b837b',x+4,y-6,6,2);}
    if(!r.taken){
      const cx=r.coinX-s.camera,cy=r.coinY+Math.sin(t*4+i)*.8;
      rect('#af7156',cx-2,cy-2,4,5);rect(lamp,cx-1,cy-3,2,5);
      if((i+Math.floor(t*3))%4===0)rect('#fff8da',cx+3,cy-3,1,1);
    }
    if(r.beetle&&!r.beetle.gone){
      const bx=beetleX(r.beetle,t)-s.camera;
      rect(ink,bx-4,y-4,8,3);rect('#ce7084',bx-3,y-5,6,3);rect(lamp,bx-3,y-3,1,1);
      rect(ink,bx-2,y-1,1,1);rect(ink,bx+1,y-1,1,1);
    }
    if(i===s.roofs.length-1){
      rect('#ebc99a',x+w-15,y-17,1,17);
      rect('#f08e85',x+w-14,y-17,8,4);rect('#c66f77',x+w-12,y-13,4,1);
    }
  }
  if(s.flash<=0||Math.floor(t*12)%2){
    const x=Math.round(s.x-s.camera)-4,y=Math.round(s.y)-heroHeight;
    const stride=s.ground>=0?(Math.floor(t*9)%2?1:-1):0;
    for(let row=0;row<runner.length;row++)for(let col=0;col<runner[row].length;col++){
      const c=colors[runner[row][col]];
      if(c)rect(c,x+col+(row>=8?(col<4?stride:-stride):0),y+row,1,1);
    }
    rect('#d6a0a0',x-1,y+4,3,1);
  }
  rect('#263344',0,0,38,8);
  for(let h=0;h<3;h++){
    const c=h<s.hearts?'#f0908c':'#617281',x=2+h*7;
    rect(c,x,2,2,2);rect(c,x+3,2,2,2);rect(c,x+1,3,3,2);rect(c,x+2,5,1,1);
  }
  rect(lamp,24,2,2,4);digit(s.score%100,28,1);
  if(s.mode==='finish'){rect('#354651',49,7,30,9);rect('#a5cfad',52,11,2,2);digit(s.stage+1,62,9);}
}

export function createStreamGame(){
  const state={};
  let accrued=0;
  function reset(){
    Object.assign(state,{score:0,time:0,attempt:1,hearts:3});
    startStage(state,0);accrued=0;
  }
  reset();
  return {state,reset,
    advance(seconds,input){
      if(!Number.isFinite(seconds)||seconds<=0)return;
      // A hidden WebView may skip minutes. Resume at the board the viewer last saw.
      accrued+=Math.min(seconds,.25);
      const count=Math.floor(accrued/step+1e-8);
      accrued=Math.max(0,accrued-count*step);
      for(let i=0;i<count;i++)tick(state,input);
    },
    draw(ctx){drawGame(ctx,state);}
  };
}
