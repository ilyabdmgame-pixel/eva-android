import {fixtureFrame} from './room-mesh.mjs';
import {drawRoomModel} from './room-models.mjs';
import {collectMesh,meshThumbnail} from './mesh-preview.mjs';
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

export const originalRoomDecor=[[708,1.42,1.82],[707,2.80,-1.82],[709,-2.07,.98]];
export const studioRoomDecor=[[711,2.49,-3.32],[706,-1.34,-.08],[705,-1.08,1.02],[704,2.88,.51]];

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
 ]),
 item(711,'Платяной шкаф','Мебель',.94,.49,'wardrobe',[],{surfaceHeight:1.77})
];

export function drawFloorDecor(renderer,o){
 const frame=fixtureFrame(o),w=frame.width,d=frame.depth;
 const warp=[.78,.74,.62],teal=[.60,.69,.61],selvedge=[.36,.48,.43];
 function band(x,y,right,back,z,tint,finish){
   const uv=[[x,y],[right,y],[right,back],[x,back]];
   renderer.panel(uv.map(([a,b])=>frame.point(a,b,z)),tint,finish,o.id,uv);
 }
 for(let i=0;i<19;i++){
   const y=(i+.6)*d/20,tail=.008+(i%3)*.003;
   band(0,y,.032+tail,y+.011,.012,warp,'room-linen');
   band(w-.032-tail,y,w,y+.011,.012,warp,'room-linen');
 }
 band(.035,0,w-.035,d,.017,teal,'room-runner');
 for(const side of [0,1]){
   const edge=x=>side?w-x:x;
   for(const [near,far,tint,finish] of [[.042,.060,selvedge,'room-runner'],[.081,.104,warp,'room-linen'],[.126,.134,warp,'room-linen']]){
     const a=edge(near),b=edge(far);
     band(Math.min(a,b),0,Math.max(a,b),d,.019,tint,finish);
   }
 }
}

const furniturePreviews=new Map();
let catalogPixels,catalogLoading;
function warmCatalogTexture(){
 if(!catalogLoading&&typeof Image!=='undefined'){
   const image=new Image();
   catalogLoading=new Promise(resolve=>{
     image.onload=()=>{
       const small=document.createElement('canvas');small.width=small.height=256;
       const context=small.getContext('2d');context.drawImage(image,0,0,256,256);
       catalogPixels=context.getImageData(0,0,256,256);resolve(catalogPixels);
     };
     image.onerror=()=>resolve(null);
   });
   image.src='art/room-indie-atlas.webp';
 }
 return catalogLoading;
}

export function furnishingThumbnail(canvas,model){
 canvas.width=112;canvas.height=86;
 const ctx=canvas.getContext('2d'),key=model.model??model.id;
 const cached=furniturePreviews.get(key);
 if(cached){ctx.drawImage(cached.canvas,0,0);cached.ready?.then(()=>ctx.drawImage(cached.canvas,0,0));return;}
 const o={...model,u:0,v:0,z:0};
 const faces=collectMesh(renderer=>{
   if(o.kind==='floorDecor'){drawFloorDecor(renderer,o);return;}
   if(drawRoomModel(renderer,o))return;
   for(const p of o.parts){
     renderer.box(o.id,{u:p.u,v:p.v,z:p.z},p.a,p.b,p.h,p.tint,p.mat);
   }
 });
 meshThumbnail(canvas,faces,catalogPixels);
 const entry={canvas,ready:null};furniturePreviews.set(key,entry);
 if(!catalogPixels)entry.ready=warmCatalogTexture()?.then(atlas=>{
   if(atlas)meshThumbnail(canvas,faces,atlas);
   entry.ready=null;
 });
}

export function roomDesk(fixture){
 const height=.80;
 const scale=height/fixture.surfaceHeight;
 return {...fixture,art:null,surfaceHeight:height,
   parts:fixture.parts.map(p=>({...p,z:p.z*scale,h:p.h*scale}))};
}

const bezel=[.32,.34,.36],stand=[.49,.46,.41],keycaps=[.55,.54,.51];

export function computerLayout(fixture){
 const frame=fixtureFrame(fixture);
 return (x,y,height)=>{
   const [u,v,z]=frame.point(x,y,height);
   return {u,v,z};
 };
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
 const wrist=(localX,localY,side)=>point(localX,localY,
   .071-(tap===side?pressure*.010:0)+(side===1?.092*mouse*(1-mouse):0));
 return {
   left:{point:wrist(x[0],.538,0),reach,bend:tap===0?pressure:0},
   right:{point:wrist(x[1]+(.935-x[1])*mouse,.538+mouse*.008,1),reach,
     bend:tap===1?pressure:0,mouse},
   key:tap<0?null:{column:tap===0?2:5,pressure},
   nod:!reduced&&index===2?.012*Math.sin(Math.PI*phase)**2*Math.sin(5*Math.PI*phase):0
 };
}

const vec=p=>[p.u,p.v,p.z];
const point3=([u,v,z])=>({u,v,z});
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=([u,v,z],[x,y,w])=>[v*w-z*y,z*x-u*w,u*y-v*x];
const unit=a=>scale(a,1/Math.hypot(...a));
const reject=(a,axis)=>sub(a,scale(axis,dot(a,axis)));

export function computerArms(actor,fixture,gesture){
 const front=fixture.turned?'u':'v',across=fixture.turned?'v':'u';
 return [gesture.left,gesture.right].map(({point,reach,bend=0,mouse=0},index)=>{
   const side=index===0?-1:1;
   const shoulder={...actor,[across]:actor[across]+side*.118,[front]:actor[front]-.060,z:actor.z+.405};
   const rest={...shoulder,[front]:shoulder[front]-.16,[across]:shoulder[across]+side*.033,z:actor.z+.175};
   const origin=vec(shoulder);
   const wrist=add(vec(rest),scale(sub(vec(point),vec(rest)),reach));
   const delta=sub(wrist,origin),length=Math.hypot(...delta);
   const forward=fixture.turned?[-1,0,0]:[0,-1,0];
   const axis=length>1e-6?scale(delta,1/length):forward;
   const upper=.279,forearm=.271;
   const distance=Math.max(.035,Math.min(upper+forearm-.007,length));
   const along=(upper**2-forearm**2+distance**2)/(2*distance);
   const pole=fixture.turned?[.12,side*.37,-1]:[side*.37,.12,-1];
   const normal=reject(pole,axis);
   const outside=unit(Math.hypot(...normal)<1e-6?reject(forward,axis):normal);
   const elbow=add(add(origin,scale(axis,along)),scale(outside,Math.sqrt(upper**2-along**2)));
   const hand=point3(distance===length?wrist:add(origin,scale(axis,distance)));
   return {shoulder,elbow:point3(elbow),hand,reach,bend,mouse};
 });
}

export function drawComputerArms(renderer,actor,fixture,gesture,id=0){
 const sides=8;
 function tube(centers,axes,sideAxis,radii,colors){
   const rings=centers.map((center,i)=>{
     const axis=axes[i];
     const across=unit(reject(sideAxis,axis));
     const top=cross(across,axis);
     return Array.from({length:sides},(_,n)=>{
       const angle=n*2*Math.PI/sides;
       return add(center,add(scale(across,Math.cos(angle)*radii[i][0]),scale(top,Math.sin(angle)*radii[i][1])));
     });
   });
   for(let i=0;i<rings.length-1;i++)for(let side=0;side<sides;side++){
     const next=(side+1)%sides;
     const shade=.77+.23*Math.max(0,Math.sin((side+.5)*2*Math.PI/sides));
     renderer.panel([rings[i][side],rings[i][next],rings[i+1][next],rings[i+1][side]],
       scale(colors[i],shade),null,id);
   }
 }
 const sleeve=[.33,.29,.32],cuff=[.27,.25,.29];
 const palm=[.75,.55,.47],tips=[.67,.49,.42];
 for(const {shoulder,elbow,hand,reach,bend,mouse} of computerArms(actor,fixture,gesture)){
   const a=vec(shoulder),b=vec(elbow),c=vec(hand);
   const upper=unit(sub(b,a)),forearm=unit(sub(c,b));
   const joint=unit(add(upper,forearm));
   const beforeElbow=sub(b,scale(upper,.045));
   const afterElbow=add(b,scale(forearm,.045));
   const cuffAt=sub(c,scale(forearm,.019));
   const elbowNormal=unit(cross(upper,forearm));
   tube([a,beforeElbow,b,afterElbow,cuffAt,c],
     [upper,upper,joint,forearm,forearm,forearm],elbowNormal,
     [[.053,.049],[.043,.042],[.041,.040],[.039,.036],[.032,.029],[.026,.024]],
     [sleeve,sleeve,sleeve,sleeve,cuff]);
   const pitch=-.27-.06*mouse-.10*bend;
   const fingerAxis=unit(fixture.turned?[-1,.04,pitch]:[.04,-1,pitch]);
   const relaxed=unit(add(scale(forearm,1-reach),scale(fingerAxis,reach)));
   const palmAxis=fixture.turned?[0,1,0]:[1,0,0];
   tube([c,add(c,scale(relaxed,.038)),add(c,scale(relaxed,.069)),add(c,scale(relaxed,.079))],
     [forearm,relaxed,relaxed,relaxed],palmAxis,
     [[.024,.019],[.030,.018],[.015,.009],[0,0]],[palm,palm,tips]);
 }
}
export function drawComputer(renderer,o,powered,streaming,seconds=0,gesture=null,pass='all'){
 const point=computerLayout(o);
 const box=(x,y,z,w,d,h,t,mat=t===stand?'room-steel':'room-graphite')=>{
   const a=point(x,y,z),b=point(x+w,y+d,z);
   renderer.box(o.id,{u:Math.min(a.u,b.u),v:Math.min(a.v,b.v),z:a.z},Math.abs(b.u-a.u),Math.abs(b.v-a.v),h,t,mat);
 };
 const screen=(x,z,w,h,t,mat)=>{
   const verts=[[x,z],[x+w,z],[x+w,z+h],[x,z+h]].map(([a,b])=>point(a,.177,b)).map(p=>[p.u,p.v,p.z]);
   renderer.panel(verts,t,mat,o.id);
 };
 if(pass!=='display'){
   // Rigid parts are cached with the desk. The two animated caps belong to the display pass.
   box(.025,.045,0,.17,.265,.341,bezel);
   box(.052,.309,.071,.11,.008,.21,[.41,.42,.42]);
   for(let i=0;i<5;i++)box(.054,.319,.100+i*.022,.104,.003,.005,[.30,.32,.35]);
   box(.428,.074,.001,.34,.187,.030,stand);
   box(.564,.097,.030,.062,.053,.143,stand);
   box(.291,.075,.15,.61,.10,.30,bezel);
   box(.545,.120,.45,.102,.068,.049,bezel);
   box(.955,.25,0,.093,.102,.025,stand);
   box(.988,.282,.025,.027,.034,.126,stand);
   box(.974,.27,.137,.058,.058,.075,bezel);
   box(.404,.419,0,.45,.145,.027,bezel);
   for(let row=0;row<3;row++)for(let column=0;column<8;column++){
     if(row!==1||column!==2&&column!==5)box(.432+column*.052,.434+row*.041,.028,.035,.027,.011,keycaps);
   }
   box(.905,.448,.005,.066,.100,.040,bezel);
 }
 if(pass==='hardware')return;
 box(.08,.320,.277,.030,.007,.023,powered?[.34,.70,.60]:stand,powered?'glow':undefined);
 box(.584,.183,.467,.028,.008,.019,streaming?[.92,.29,.31]:[.47,.48,.48],streaming?'glow':undefined);
 screen(.323,.186,.547,.235,powered?[.185,.32,.37]:[.18,.20,.22],powered?'glow':undefined);
 if(streaming){
   const display=[[.330,.414],[.749,.414],[.749,.193],[.330,.193]]
     .map(([x,z])=>point(x,.180,z)).map(p=>[p.u,p.v,p.z]);
   renderer.streamPanel(display,o.id,seconds);
   screen(.773,.382,.073,.018,[.94,.29,.34],'glow');
   for(let row=0;row<5;row++){
     const length=.039+((Math.floor(seconds*2)+row*3)%4)*.011;
     screen(.765,.35-row*.029,length,.008,row%2?[.57,.78,.73]:[.74,.68,.50],'glow');
   }
 }else if(powered){
   screen(.35,.383,.077,.009,[.57,.78,.77],'glow');
   for(let row=0;row<4;row++){
     const length=.28+row%2*.055;
     screen(.377,.341-row*.036,length,.008,row%2?[.47,.69,.66]:[.71,.70,.49],'glow');
   }
 }
 for(const column of [2,5]){
   const press=gesture?.key?.column===column?gesture.key.pressure:0;
   box(.432+column*.052,.475,.028,.035,.027,.011-.005*press,press>.7?[.69,.67,.55]:keycaps);
 }
}
