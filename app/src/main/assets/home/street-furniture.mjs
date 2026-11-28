import {rainStand} from './rain-life.mjs';
import {plots} from './town-plan.mjs';
import {shadowOffset} from './lighting.mjs';
// Local coordinates leave the road, kerb ramps, house entrances and shore paths open.
const steel=[.39,.44,.43],dark=[.24,.28,.29],cream=[.86,.80,.67];
const part=(u,v,z,a,b,h,tint,mat)=>({u,v,z,a,b,h,tint,mat});
function container(id,u,v,tint){
 const w=1.13,d=.72;
 const parts=[part(.04,.04,.16,w-.08,d-.08,.76,tint,'glaze'),
   part(0,0,.89,w,d,.07,dark),part(-.015,-.012,.96,w+.03,d+.025,.05,tint)];
 for(const x of [.12,.92]){
   for(const y of [.10,.51])parts.push(part(x,y,.002,.12,.10,.158,dark));
   parts.push(part(x,.683,.29,.045,.025,.46,tint));
 }
 parts.push(part(.37,.688,.59,.38,.018,.20,cream),part(.47,.709,.65,.18,.007,.033,tint));
 return {id,streetMesh:true,name:'Контейнер для вторсырья',u,v,w,d,kind:'bin',parts,visualHeight:1.01};
}
function board(id,u,v,alongV,poster,name,remark){
 const w=2.10,d=.20,h=1.36,bottom=1.03,parts=[];
 function add(x,y,z,a,b,h,tint,mat){parts.push(alongV?part(y,x,z,b,a,h,tint,mat):part(x,y,z,a,b,h,tint,mat));}
 for(const x of [.17,1.78]){
   add(x,0,0,.18,d,.135,steel,'stone');add(x+.045,.046,.135,.09,.11,bottom,steel);
 }
 add(0,.044,bottom,w,.115,h,dark,'oak');add(-.04,.007,bottom+h,w+.08,d,.06,steel);
 return {id,streetMesh:true,name,u,v,w:alongV?d:w,d:alongV?w:d,kind:'notice',parts,visualHeight:bottom+h+.06,poster,alongV,remark};
}
function rack(id,u,v){
 const parts=[];
 for(const x of [.03,.45,.87]){
   for(const y of [.02,.53])parts.push(part(x,y,0,.053,.055,.64,steel));
   parts.push(part(x,.02,.64,.053,.565,.052,[.60,.61,.55]));
 }
 return {id,streetMesh:true,name:'Велопарковка',u,v,w:.97,d:.62,kind:'notice',parts,visualHeight:.70,remark:'Три места. Мой воображаемый велик опять занял два.'};
}
function lockers(id,u,v){
 const parts=[part(0,0,0,1.12,.53,.12,dark,'stone'),part(.025,.02,.12,1.07,.49,1.32,dark)];
 for(let x=0;x<3;x++)for(let row=0;row<3;row++){
   const a=.041+x*.353,z=.14+row*.43;
   parts.push(part(a,.507,z,.331,.014,.402,row===2?[.66,.69,.64]:[.60,.67,.63]),part(a+.025,.523,z+.26,.044,.012,.078,steel));
 }
 parts.push(part(0,0,1.44,1.12,.54,.046,steel));
 return {id,streetMesh:true,name:'Почтомат',u,v,w:1.12,d:.54,kind:'notice',parts,visualHeight:1.49,remark:'Ячейка закрыта. А кот всё равно проверил, нельзя ли получить коробку отдельно.'};
}
const green=[.34,.49,.41],blue=[.34,.49,.56];
export const streetFurniture={
 lane:[container(40,-1.58,3.15,green),lockers(41,-2.4,-.78)],
 square:[board(42,3,-4.2,true,'seaside-print','Афиша ночной электрички','Ночная электричка идёт до моря. Даже у моего побега есть расписание.')],
 market:[container(43,2.55,-3.73,green),board(44,-3.93,1.87,true,'town-flowers','Афиша цветочного рынка','В субботу меняют рассаду. Как думаешь, кактус на пельмени выменяю?')],
 school:[rack(45,1.65,4.15)],
 shop:[container(46,4,-3,blue)],
 cafe:[board(47,-4.2,1.8,true,'town-menu','Меню на улице','Кофе с собой. Булка тоже с собой. Стол пришлось оставить.')],
 promenade:[board(48,1.12,-3.82,false,'seaside-print','Афиша у набережной','На афише поезд летит вдоль моря. Вот бы окно у самого берега.')],
 beach:[container(49,2.64,-2.58,blue)],park:[rack(50,-.32,3.54)],
 courtyard:[container(51,4,1.2,green)],terrace:[rack(52,-5,-2.4)],
 street:[board(53,1.39,-3.71,false,'town-landscape','Районная доска','Выставка городских зарисовок. Узнала площадь. Художник даже трещину на плитке поймал.')],
 pier:[container(54,3.27,-2.72,green)],garden:[container(55,2.84,-3.40,green)]
};
for(const key of Object.keys(plots)){
 const stands=rainStand(key);if(stands.length)(streetFurniture[key]=streetFurniture[key]??[]).push(...stands);
}
export function drawNotice(r,o,z){
 const point=(x,h)=>o.alongV?[o.u+.162,o.v+x,z+h]:[o.u+x,o.v+.162,z+h];
 const aspect=r.artAspect(o.poster);if(!aspect)return;
 const width=Math.min(1.966,1.226*aspect),height=width/aspect;
 const l=1.05-width/2,right=l+width,b=1.708-height/2,t=b+height;
 const pts=o.alongV?[point(right,t),point(l,t),point(l,b),point(right,b)]:
   [point(l,t),point(right,t),point(right,b),point(l,b)];
 r.artPanel(pts,o.poster,o.id);
}

export function castFurniture(r,o,ground){
 const [sx,sy]=shadowOffset(1),z=ground+.024;
 for(const p of o.parts){
   const x=o.u+p.u+p.z*sx,y=o.v+p.v+p.z*sy,dx=p.h*sx,dy=p.h*sy;
   r.castFloor([[x,y+p.b,z],[x+dx,y+p.b+dy,z],[x+dx,y+dy,z],[x+p.a+dx,y+dy,z],[x+p.a,y,z],[x+p.a,y+p.b,z]]);
 }
}
