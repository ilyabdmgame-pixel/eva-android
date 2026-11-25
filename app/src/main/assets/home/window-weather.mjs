const WIDTH=384,HEIGHT=168;
const wet=new Set(['rain','storm','snow','wind']);
export const windowWeatherMoves=(climate,reduced)=>!reduced&&wet.has(climate.weather);
const random=(i,salt)=>Math.abs((Math.sin(i*127.1+salt*311.7)*43758.5453)%1);

export function windowWeather(onReady){
 const scenery=document.createElement('canvas'),image=document.createElement('canvas');
 for(const canvas of [scenery,image]){canvas.width=WIDTH;canvas.height=HEIGHT;}
 const base=scenery.getContext('2d'),ctx=image.getContext('2d');
 let lastKey='',lastFrame=-1;
 const hills=new Image();
 hills.onload=()=>{lastKey='';onReady();};
 hills.src='art/room-window-hills.jpg';
 function landscape({daylight,weather,season}){
   base.fillStyle='#87a2a7';base.fillRect(0,0,WIDTH,HEIGHT);
   if(hills.complete&&hills.naturalWidth){
     const winter=season==='winter';
     if(winter)base.filter='saturate(0.42) brightness(1.18)';
     else if(season==='autumn')base.filter='sepia(0.20) saturate(0.92)';
     base.drawImage(hills,0,0,WIDTH,HEIGHT);
     base.filter='none';
   }
   const clouds={cloudy:'#bec7cb59',rain:'#566e8b60',storm:'#34435e92',snow:'#d8e4ed66',fog:'#dae3e157'};
   if(clouds[weather]){
     base.fillStyle=clouds[weather];base.fillRect(0,0,WIDTH,HEIGHT);
   }
   if(daylight<1){
     base.fillStyle='rgba(10,24,45,'+(.77*(1-daylight))+')';
     base.fillRect(0,0,WIDTH,HEIGHT);
   }
   if(weather==='fog'){
     const mist=base.createLinearGradient(0,42,0,HEIGHT);
     mist.addColorStop(0,'#e1e6e500');mist.addColorStop(.62,'#e4e7dfb3');mist.addColorStop(1,'#e1e6e556');
     base.fillStyle=mist;base.fillRect(0,42,WIDTH,HEIGHT-42);
   }
 }
 return function draw(t,climate,reduced){
   const key=[climate.weather,climate.season,Math.round(climate.daylight*20)].join('/');
   const animated=windowWeatherMoves(climate,reduced);
   const frame=animated?Math.floor(t/72):0;
   if(key===lastKey&&frame===lastFrame)return null;
   if(key!==lastKey){landscape(climate);lastKey=key;}
   lastFrame=frame;
   ctx.drawImage(scenery,0,0);
   const {weather}=climate,snow=weather==='snow',wind=weather==='wind',storm=weather==='storm';
   if(wet.has(weather)){
     const clock=frame*.072,count=snow?52:wind?18:storm?76:52;
     ctx.strokeStyle=wind?'#efcfad94':storm?'#b9dafea6':'#daedfb9c';
     ctx.fillStyle='#f7faffd9';ctx.lineWidth=storm?1.15:.9;ctx.beginPath();
     for(let i=0;i<count;i++){
       const y=(random(i,10)*HEIGHT+clock*(wind?12:snow?16+i%6:70+i%25))%(HEIGHT+18)-9;
       const dx=clock*(wind?34:storm?-39:snow?0:-16);
       const x=((random(i,12)*WIDTH+dx+Math.sin(clock+i)*3)%WIDTH+WIDTH)%WIDTH;
       if(snow){const r=.75+random(i,13)*1.2;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,2*Math.PI);}
       else{ctx.moveTo(x,y);ctx.lineTo(x+(wind?14:-5),y+(wind?1:storm?16:11));}
     }
     if(snow)ctx.fill();else ctx.stroke();
     if(storm&&animated&&frame%97===48){
       ctx.fillStyle='#ddeaff46';ctx.fillRect(0,0,WIDTH,HEIGHT);
     }
   }
   return image;
 };
}
