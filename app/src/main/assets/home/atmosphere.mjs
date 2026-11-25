const color={
  rain:'#bde2f3',storm:'#bdd2f0',snow:'#eff6fb',wind:'#c8a478',pollen:'#f1d59c'
};
const particleColor={
  spring:'#f1d9ae',summer:'#e7e0a6',autumn:'#ce9657',winter:'#eaf2ff'
};

export function atmosphere(canvas,reduced){
  const ctx=canvas.getContext('2d');
  let width=0,height=0,mode='',old='',changed=0,particles=[],previous=0,exterior=0;
  const rand=i=>(Math.sin((i+1)*127.113)*43758.5453)%1;
  const noise=i=>Math.abs(rand(i));
  function resize(){
    const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio,1);
    if(w===width&&h===height)return;
    width=w;height=h;canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
    ctx.setTransform(d,0,0,d,0,0);
    particles=Array.from({length:86},(_,i)=>({x:noise(i)*w,y:noise(i+100)*h,a:noise(i+300),b:noise(i+800)}));
  }
  function veil(t,strength,night,kind){
    if(kind==='fog'){
      const band=ctx.createLinearGradient(0,0,0,height);
      band.addColorStop(0,'#c5d3d619');band.addColorStop(.48,'#cbd4d91a');band.addColorStop(.77,'#a5bed94d');band.addColorStop(1,'#b5c8d285');
      ctx.globalAlpha=strength*(.82+.1*Math.sin(t*.0005));ctx.fillStyle=band;ctx.fillRect(0,0,width,height);return;
    }
    if(kind==='storm'){
      const pulse=(t%16800);
      if(!reduced&&pulse<350){
        ctx.globalAlpha=strength*Math.max(0,1-pulse/350)*.13;ctx.fillStyle='#c7d9ff';ctx.fillRect(0,0,width,height);
      }
    }
    if((kind==='cloudy'||kind==='rain'||kind==='storm')&&strength>.1){
      ctx.globalAlpha=strength*(.12+night*.03);ctx.fillStyle='#607c9e';ctx.fillRect(0,0,width,height);
    }
  }
  function effects(kind,t,delta,strength,season){
    if(!kind||strength<=.015)return;
    const falling=kind==='rain'||kind==='storm';
    const count=kind==='rain'?62:kind==='storm'?80:kind==='snow'?72:kind==='wind'?31:18;
    if(!falling&&!['snow','wind','pollen'].includes(kind))return;
    ctx.strokeStyle=color[kind]||particleColor[season];
    ctx.fillStyle=kind==='wind'||kind==='pollen'?particleColor[season]:color[kind];
    ctx.lineWidth=.85;
    for(let i=0;i<count;i++){
      const p=particles[i],speed=falling?280+p.a*350:kind==='snow'?15+p.a*40:7+p.a*27;
      const drift=kind==='storm'?140:kind==='rain'?62:kind==='wind'?46:9;
      if(!reduced){
        p.x-=delta*(drift+Math.sin(t*.002+p.b*30)*13);
        p.y+=delta*speed;
        if(p.y>height+5){p.y=-8;p.x=noise(i+Math.floor(t))*(width+12);}
        if(p.x< -16)p.x=width+13;
      }
      ctx.globalAlpha=strength*(falling?.12+p.b*.38:.23+p.b*.62)*(reduced?.52:1);
      if(falling){
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-(kind==='storm'?6:3),p.y+8+p.a*13);ctx.stroke();

      }else if(kind==='wind'){
        ctx.beginPath();ctx.ellipse(p.x,p.y,1.8+p.a*2,.95,Math.sin(t*.002+i)*1.2,0,Math.PI*2);ctx.fill();
      }else{
        ctx.beginPath();ctx.arc(p.x,p.y,.65+p.a*(kind==='snow'?1.75:.9),0,Math.PI*2);ctx.fill();
      }
    }
  }
  function draw(t,climate,outside){
    if(!ctx)return;
    resize();
    if(!width||!height)return;
    const delta=Math.min(.13,Math.max(0,(t-previous)/1000));previous=t;
    exterior+=(outside?1-exterior:-exterior)*Math.min(1,delta*5);
    const weather=climate.weather;
    const next=weather==='clear'&&climate.season!=='winter'?'pollen':weather;
    if(next!==mode){old=mode||next;mode=next;changed=t;}
    const blend=Math.min(1,(t-changed)/750);
    ctx.clearRect(0,0,width,height);
    if(exterior<.018)return;
    // A very low, warm wash from the camera side at dawn and dusk.
    const twilight=Math.max(0,1-Math.abs(climate.daylight-.52)*3.2);
    if(twilight>.02&&mode!=='fog'){
      const light=ctx.createLinearGradient(0,height,width*.66,height*.28);
      light.addColorStop(0,'#ffbf81');light.addColorStop(1,'#ffbf8100');
      ctx.globalAlpha=exterior*twilight*.085;ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
    }
    if(blend<1)veil(t,exterior*(1-blend),1-climate.daylight,old);
    veil(t,exterior*blend,1-climate.daylight,mode);
    effects(mode,t,delta,exterior*blend,climate.season);
    ctx.globalAlpha=1;
  }
  return {
    draw,
    fading:outside=>Boolean(ctx)&&(outside?exterior<.98:exterior>.018),
    clear(){if(ctx)ctx.clearRect(0,0,width,height);previous=0;exterior=0;}
  };
}
