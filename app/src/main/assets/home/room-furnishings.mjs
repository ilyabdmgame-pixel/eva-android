const part=(u,v,z,a,b,h,tint,mat='oak')=>({u,v,z,a,b,h,tint,mat});
const walnut=[.70,.51,.39],linen=[.78,.66,.61],bronze=[.76,.58,.38];
const legs=(w,d,h)=>[.038,w-.094].flatMap(u=>[.039,d-.093].map(v=>part(u,v,0,.056,.054,h,walnut)));
const item=(id,name,category,w,d,kind,parts,extra={})=>
 ({id,name,category,w,d,u:0,v:0,kind,parts,roomMovable:true,...extra});

export const streamChair=item(307,'Кресло у компьютера','Мебель',.48,.48,'streamChair',[
 part(.04,.20,.04,.40,.066,.055,[.36,.39,.44]),
 part(.205,.038,.043,.071,.404,.053,[.36,.39,.44]),
 part(.203,.20,.09,.078,.08,.35,[.37,.38,.41]),
 part(.018,.045,.435,.444,.39,.075,[.48,.40,.52],'cloth'),
 part(.04,.389,.49,.40,.075,.40,[.45,.38,.50],'cloth'),
 part(.07,.388,.81,.34,.08,.071,[.62,.49,.62],'cloth')
],{seatHeight:.51,solid:true});

export const roomFurnishings=[
 item(701,'Прикроватная тумба','Мебель',.47,.37,'storage',[
   ...legs(.47,.37,.13),part(0,0,.125,.47,.37,.37,walnut),part(-.015,-.015,.495,.50,.40,.033,[.84,.67,.54]),
   part(.027,.381,.329,.415,.026,.124,walnut),part(.19,.409,.383,.091,.014,.025,bronze)
 ]),
 item(702,'Низкий комод','Мебель',.92,.41,'storage',[
   ...legs(.92,.41,.12),part(0,0,.118,.92,.41,.60,walnut),part(-.018,-.012,.715,.95,.44,.041,[.80,.67,.50]),
   ...[.17,.347,.524].flatMap(z=>[part(.043,.414,z,.833,.024,.15,[.78,.59,.44]),
     part(.39,.44,z+.066,.14,.018,.024,bronze)])
 ]),
 item(703,'Кресло с подлокотниками','Мебель',.72,.71,'chair',[
   ...legs(.72,.71,.22),part(0,0,.19,.72,.71,.27,linen,'cloth'),part(.083,.16,.452,.56,.49,.07,[.73,.56,.53],'cloth'),
   part(.032,.024,.50,.65,.145,.47,linen,'cloth'),
   ...[.018,.58].map(u=>part(u,.17,.433,.121,.49,.177,linen,'cloth'))
 ],{seatHeight:.522}),
 item(704,'Пуф','Мебель',.48,.47,'chair',[
   ...legs(.48,.47,.12),part(0,0,.113,.48,.47,.26,[.56,.66,.60],'cloth'),
   part(.025,.024,.37,.43,.423,.04,[.67,.76,.65],'cloth')
 ],{seatHeight:.41}),
 item(705,'Журнальный столик','Мебель',.81,.53,'smallTable',[
   ...legs(.81,.53,.39),part(-.021,-.018,.386,.85,.566,.050,[.86,.69,.45]),
   part(.081,.078,.180,.646,.37,.028,walnut)
 ]),
 item(706,'Торшер','Свет',.35,.35,'lamp',[
   part(.02,.02,0,.31,.31,.075,bronze),part(.151,.15,.074,.048,.046,1.12,bronze),
   part(.066,.065,1.19,.219,.22,.24,[.81,.68,.48],'cloth'),
   part(.10,.10,1.43,.15,.15,.033,[.93,.78,.51])
 ],{bulbPart:3,lightHeight:1.31}),
 item(707,'Плетёная корзина','Декор',.41,.40,'decor',[
   part(.026,.015,0,.36,.37,.285,[.73,.60,.45]),part(.001,.008,.279,.41,.385,.040,[.82,.69,.51]),
   part(.105,.07,.31,.22,.24,.047,[.64,.70,.70],'cloth')
 ]),
 item(708,'Зелёный коврик','Декор',1.30,.80,'floorDecor',[],{solid:false}),
 item(709,'Ящик с книгами','Декор',.46,.34,'decor',[
   part(0,0,0,.46,.34,.24,walnut),...[[.07,[.62,.45,.38]],[.17,[.44,.59,.56]],[.28,[.74,.65,.48]]]
    .map(([u,c])=>part(u,.061,.242,.079,.23,.064,c,'cloth'))
 ]),
 item(710,'Высокая этажерка','Мебель',.61,.35,'storage',[
   ...legs(.61,.35,1.40),...[.12,.54,.96,1.38].map(z=>part(0,0,z,.61,.35,.045,walnut)),
   part(.09,.08,.588,.25,.19,.13,[.64,.61,.54],'cloth')
 ])
];

export function drawFloorDecor(renderer,o){
 const point=(x,y,z)=>[o.u+o.w*x,o.v+o.d*y,z];
 const z=.019;
 const quad=(a,b,c,d,t,layer=0)=>renderer.panel(
   [point(a,b,z+layer),point(c,b,z+layer),point(c,d,z+layer),point(a,d,z+layer)],t,null,o.id);
 quad(0,0,1,1,[.41,.52,.46]);
 quad(.075,.11,.925,.89,[.72,.76,.60],.001);
 quad(.15,.19,.85,.81,[.51,.64,.54],.002);
 for(let i=1;i<5;i++)quad(i/5-.013,.23,i/5+.013,.77,[.63,.71,.57],.003);
}

export function furnishingThumbnail(canvas,model){
 canvas.width=112;canvas.height=86;
 const c=canvas.getContext('2d');
 const coordinates=([u,v,z])=>[u-v,(u+v-2*z)*.58];
 const modelParts=model.kind==='floorDecor'
   ?[part(0,0,0,model.w,model.d,.025,[.48,.64,.52]),part(.12,.12,.027,model.w-.24,model.d-.24,.004,[.68,.74,.59])]
   :model.parts;
 const faces=[];
 for(const p of modelParts){
   const {u,v,z,a,b,h,tint}=p;
   const corners=[[u,v,z],[u+a,v,z],[u+a,v+b,z],[u,v+b,z],
     [u,v,z+h],[u+a,v,z+h],[u+a,v+b,z+h],[u,v+b,z+h]];
   for(const [indexes,shade] of [[[2,3,7,6],.71],[[1,2,6,5],.83],[[4,5,6,7],1.08]]){
     faces.push({points:indexes.map(i=>coordinates(corners[i])),
       depth:indexes.reduce((sum,i)=>sum+corners[i].reduce((a,b)=>a+b,0),0),
       tint:tint.map(x=>Math.min(255,Math.round(x*255*shade)))});
   }
 }
 const points=faces.flatMap(face=>face.points);
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const scale=Math.min(92/(right-left),70/(bottom-top));
 faces.sort((a,b)=>a.depth-b.depth);
 for(const face of faces){
   c.beginPath();
   for(const [i,[x,y]] of face.points.entries()){
     c[i?'lineTo':'moveTo'](56+(x-(left+right)/2)*scale,43+(y-(top+bottom)/2)*scale);
   }
   c.closePath();
   c.fillStyle='rgb('+face.tint.join(',')+')';c.fill();
   c.strokeStyle='#47372e42';c.lineWidth=.8;c.stroke();
 }
}

export function roomDesk(fixture){
 const height=.80;
 const scale=height/fixture.surfaceHeight;
 return {...fixture,art:null,surfaceHeight:height,
   parts:fixture.parts.map(p=>({...p,z:p.z*scale,h:p.h*scale}))};
}

const bezel=[.32,.34,.36],stand=[.49,.46,.41],keycaps=[.55,.54,.51];

export function computerLayout(fixture){
 const {u,v,z}=fixture;
 return (x,y,height)=>fixture.turned?{u:u+y,v:v+x,z:z+height}:{u:u+x,v:v+y,z:z+height};
}

export function computerGesture(fixture,sample,reduced=false){
 const point=computerLayout(fixture);
 const smooth=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
 const {index,phase}=sample;
 const typing=index===1&&!reduced;
 const keyPhase=phase*13;
 const tap=typing?Math.floor(keyPhase)%2:-1;
 const pressure=typing?Math.sin(Math.PI*(keyPhase%1))**2:0;
 const mouse=index===2?smooth(phase/.23)*(1-smooth((phase-.83)/.17)):
   index===3?smooth(phase/.24):0;
 const reach=index===0?smooth(phase):index===3?1-smooth((phase-.24)/.76):1;
 const x=[2,5].map(column=>.45+column*.052);
 const wrist=(localX,localY,side)=>point(localX,localY,.058-(tap===side?pressure*.014:0));
 return {
   left:{point:wrist(x[0],.49,0),reach:reach*(1-.28*mouse)},
   right:{point:wrist(x[1]+(.935-x[1])*mouse,.49+mouse*.002,1),reach},
   key:tap<0?null:{column:tap===0?2:5,pressure},
   nod:!reduced&&index===2?.012*Math.sin(Math.PI*phase)**2*Math.sin(5*Math.PI*phase):0
 };
}

export function computerArms(actor,fixture,gesture){
 const deskFront=fixture.turned?'u':'v',across=fixture.turned?'v':'u';
 return [gesture.left,gesture.right].map(({point,reach},index)=>{
   const side=index===0?-1:1;
   const shoulder={...actor,[across]:actor[across]+side*.118,[deskFront]:actor[deskFront]-.035,z:actor.z+.38};
   const rest={...shoulder,[deskFront]:shoulder[deskFront]-.18,z:actor.z+.135};
   const hand=Object.fromEntries(['u','v','z'].map(key=>[key,rest[key]+(point[key]-rest[key])*reach]));
   const elbow={u:(shoulder.u+hand.u)/2,v:(shoulder.v+hand.v)/2,z:(shoulder.z+hand.z)/2-.087};
   elbow[across]+=side*.038;
   return {shoulder,elbow,hand,reach};
 });
}

export function drawComputerArms(renderer,actor,fixture,gesture){
 const vertex=(point,width,z=0)=>[point.u+width,point.v-width,point.z+z];
 const strip=(a,b,from,to,tint,z=0)=>renderer.panel([
   vertex(a,-from,z),vertex(a,from,z),vertex(b,to,z),vertex(b,-to,z)
 ],tint,null,0);
 for(const {shoulder,elbow,hand,reach} of computerArms(actor,fixture,gesture)){
   if(reach<.10)continue;
   strip(shoulder,elbow,.041,.039,[.29,.26,.29]);
   strip(elbow,hand,.039,.025,[.34,.31,.34]);
   strip(shoulder,elbow,.019,.015,[.38,.34,.36],.01);
   strip(elbow,hand,.021,.012,[.42,.37,.39],.01);
   const finger={...hand,[fixture.turned?'u':'v']:hand[fixture.turned?'u':'v']-.041,z:hand.z-.011};
   strip(hand,finger,.025,.016,[.71,.51,.42],.002);
 }
}

export function drawComputer(renderer,o,powered,streaming,seconds=0,gesture=null){
 const point=computerLayout(o);
 const box=(x,y,z,w,d,h,t,mat)=>renderer.box(o.id,point(x,y,z),o.turned?d:w,o.turned?w:d,h,t,mat);
 const screen=(x,z,w,h,t,mat)=>{
   const verts=[[x,z],[x+w,z],[x+w,z+h],[x,z+h]].map(([a,b])=>point(a,.177,b)).map(p=>[p.u,p.v,p.z]);
   renderer.panel(verts,t,mat,o.id);
 };
 // Tower, monitor and peripherals all share the desk's local axes.
 box(.025,.045,0,.17,.265,.341,bezel);
 box(.052,.309,.071,.11,.008,.21,[.41,.42,.42]);
 box(.08,.320,.277,.030,.007,.023,powered?[.34,.70,.60]:stand,powered?'glow':undefined);
 box(.428,.074,.001,.34,.187,.030,stand);
 box(.564,.097,.030,.062,.053,.143,stand);
 box(.291,.075,.15,.61,.10,.30,bezel);
 box(.545,.120,.45,.102,.068,.049,bezel);
 box(.584,.183,.467,.028,.008,.019,streaming?[.92,.29,.31]:[.47,.48,.48],streaming?'glow':undefined);
 box(.955,.25,0,.093,.102,.025,stand);
 box(.988,.282,.025,.027,.034,.126,stand);
 box(.974,.27,.137,.058,.058,.075,bezel);
 screen(.323,.186,.547,.235,powered?[.185,.32,.37]:[.18,.20,.22],powered?'glow':undefined);
 if(streaming){
   screen(.349,.364,.061,.025,[.98,.28,.32],'glow');
   screen(.348,.222,.278,.118,[.30,.54,.56],'glow');
   screen(.433,.272,.075,.049,[.76,.51,.48],'glow');
   screen(.406,.229,.13,.038,[.49,.36,.57],'glow');
   for(let row=0;row<5;row++){
     const length=.075+((Math.floor(seconds*2)+row*3)%4)*.024;
     screen(.655,.34-row*.028,length,.009,row%2?[.57,.78,.73]:[.74,.68,.50],'glow');
   }
 }else if(powered){
   screen(.35,.383,.077,.009,[.57,.78,.77],'glow');
   for(let row=0;row<4;row++){
     const length=.28+row%2*.055;
     screen(.377,.341-row*.036,length,.008,row%2?[.47,.69,.66]:[.71,.70,.49],'glow');
   }
 }
 box(.404,.419,0,.45,.145,.027,bezel);
 for(let row=0;row<3;row++)for(let column=0;column<8;column++){
   const press=gesture?.key?.column===column&&row===1?gesture.key.pressure:0;
   box(.432+column*.052,.434+row*.041,.028,.035,.027,.011-.005*press,
     press>.7?[.69,.67,.55]:keycaps);
 }
 box(.905,.448,.005,.066,.100,.040,bezel);
}
