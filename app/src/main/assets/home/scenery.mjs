import {wallShadow} from './lighting.mjs';
import {regionAt} from './district.mjs';
import {floorHeight} from './places.mjs';
import {seasons} from './weather.mjs';

import {SIZE,roads,streetCells,carriage} from './town-plan.mjs';
import {buildings, buildingEdge, postOffice, drawRoof, drawBuilding} from './buildings.mjs';
import {shorelineRails,railSpans} from './neighborhood.mjs';
import {project} from './camera.mjs';

const half=SIZE/2;
function drawStreets(renderer,plot,climate){
 const panel=(x,y,w,d,z,tint,mat)=>renderer.panel([[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],tint,mat,0);
 for(const cell of streetCells(plot)){
   const {x,y,x1,y1,kind,ramp}=cell,w=x1-x,d=y1-y;
   if(kind==='road')panel(x,y,w,d,.023,climate.wet?[.68,.76,.81]:[.81,.86,.91],'asphalt');
   else renderer.box(0,{u:x,v:y,z:.016},w,d,ramp?.014:kind==='kerb'?.073:.066,
     kind==='kerb'?[.87,.86,.79]:[1,.95,.87],kind==='kerb'?'stone':'cobbles');
 }
 for(const road of roads){
   const horiz=road.axis==='u';
   for(const c of road.cross)for(let i=-1.44;i<1.55;i+=.46){
     const u=horiz?c-.74:road.at+i,v=horiz?road.at+i:c-.74;
     if(regionAt(u+.09,v+.09)?.key===plot.key)
       panel(u,v,horiz?1.48:.18,horiz?.18:1.48,.035,[.87,.84,.75]);
   }
   for(let a=road.from+1;a<road.to-1;a+=3.1){
     if(road.cross.some(c=>Math.abs(c-a)<1.8)||roads.some(o=>o.axis!==road.axis&&Math.abs(o.at-a)<3.1))continue;
     const u=horiz?a:road.at-.025,v=horiz?road.at-.025:a;
     if(regionAt(u,v)?.key===plot.key)panel(u,v,horiz?.92:.05,horiz?.05:.92,.034,[.76,.68,.53]);
   }
 }
}
function coast({box}){
 const strips=[[-half,-4,0,'cobbles'],[-4,-3.66,.18,'wood'],[-3.66,-3.32,.36,'wood'],[-3.32,-.94,.54,'wood'],[-.94,-.72,.36,'wood'],[-.72,-.50,.18,'wood'],[-.5,1.5,0,'sand'],[1.5,2,0,'sand'],[2,half,-.045,'water']];
 for(const [v,end,z,mat] of strips)box(0,{u:-half,v,z:-.16},SIZE,end-v,z+.16,mat==='water'?[.82,.94,.98]:mat==='wood'?[.89,.83,.77]:[.94,.92,.82],mat);
}

function waterFoam({foam},plot){
 for(let row=0;row<4;row++)for(let j=0;j<SIZE*4;j++){
   const u=j*.25-half,next=u+.25,base=2.07+row*.51;
   const width=x=>.037+.010*Math.sin(x*1.1+row);
   const tint=[.48+row*.047,.69+row*.015,.75+row*.014],z=-.035+row*.001;
   const a=[plot.u+u,plot.v+base,z],b=[plot.u+next,plot.v+base,z];
   foam([a,b,[b[0],b[1]+width(next),z],[a[0],a[1]+width(u),z]],tint,row);
 }
}

export function waveOnScreen(view,plot){
 const left=project(view,{u:plot.u-half,v:plot.v+half});
 const right=project(view,{u:plot.u+half,v:plot.v+1.85});
 const top=project(view,{u:plot.u-half,v:plot.v+1.85});
 const bottom=project(view,{u:plot.u+half,v:plot.v+half});
 return right.x>0&&left.x<view.width&&bottom.y>0&&top.y<view.height;
}
function avenueLink({box},theme,climate,renderer,plot){
 const lawn=['garden','park','headland'].includes(theme);
 const board=['pier','promenade'].includes(theme);
 const pathWidth=theme==='square'?1.55:1.03;
 const grass=seasons[climate.season].ground;
 // Terrain rectangles meet at path and shoreline boundaries without internal box faces.
 const xs=[-half,-pathWidth,pathWidth,half],ys=[-half,-pathWidth,pathWidth,...(theme==='pier'?[2.9]:[]),half];
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
   const u=xs[i-1],v=ys[j-1],way=i===2||j===2,water=theme==='pier'&&v>=2.9;
   const plank=board&&!water,road=way||!lawn,snow=climate.snow&&!water&&(!road||!way);
   const tint=water?[.80,.90,.95]:snow?[.92,.98,1]:plank?[.91,.83,.72]:road?(climate.wet?[.72,.84,.90]:[.96,.95,.89]):grass;
   const z=water?-.052:0;
   renderer.panel([[u,v],[xs[i],v],[xs[i],ys[j]],[u,ys[j]]].map(([x,y])=>[plot.u+x,plot.v+y,z]),tint,
      water?'water':snow?'frost':plank?'wood':road?'cobbles':'grass-field',0);
 }
 const rail=shorelineRails[theme];
 if(rail!==undefined){
   for(const [left,right] of railSpans){
     for(let i=0;i<4;i++){
       const u=left+(right-left-.073)*i/3;
       box(251,{u,v:rail,z:0},.073,.073,.92,[.62,.60,.53],'wood');
     }
     for(const z of [.32,.79])box(251,{u:left+.04,v:rail+.018,z},right-left-.08,.047,.062,[.80,.73,.57],'wood');
   }
 }
 if(theme==='square'){
   for(const u of [-2.7,2.52])for(let v=-2.7;v<2.7;v+=.52)
     box(0,{u,v,z:.009},.20,.49,.026,[.70,.56,.45],'brick');
 }
 if(theme==='lane'){
   const {u,v,w,d,entry}=postOffice;
   box(0,{u:u+.10,v:v+.10,z:.005},w-.20,d-.20,.018,[.92,.84,.74],'oak');
   wallShadow(renderer,plot.u+u,plot.v+v,w,d,2.45);
   renderer.structure(()=>{
   const front=v+d-.12,left=entry-.52,right=entry+.52;
   box(251,{u,v},w,.14,2.36,[.70,.72,.65],'brick');
   for(const x of [u,u+w-.14])box(251,{u:x,v:v+.14},.14,d-.26,2.36,[.78,.72,.64],'plaster');
   box(251,{u,v:front},left-u,.12,2.36,[.78,.72,.64],'plaster');
   box(251,{u:right,v:front},u+w-right,.12,2.36,[.78,.72,.64],'plaster');
   box(251,{u:left,v:front,z:2.14},1.04,.12,.22,[.68,.57,.45],'oak');
   drawRoof(renderer,plot,{u:u+w/2,v:v+d/2,w:w/2+.16,d:d/2+.17,z:2.45,rise:.56,hip:.45,colour:[.61,.66,.70]});
   for(const x of [u+.22,right+.13])box(251,{u:x,v:v+d+.01,z:1.14},.64,.035,.76,[.58,.69,.69],'glaze');
   });
   for(const u of [-3.42,3.1])for(const v of [-2.8,-1.75,1.4,2.6]){
     box(0,{u,v,z:0},.18,.71,.25,[.77,.65,.56],'brick');
   }
 }
}
export function drawSurroundings({panel},bounds,climate){
 const border=14,step=SIZE/2;
 const land=climate.snow?[.77,.88,.95]:seasons[climate.season].ground.map(x=>x*.83);
 const water=[.78,.88,.95];
 for(let u=bounds.u0-border;u<bounds.u1+border;u+=step){
   for(let v=bounds.v0-border;v<bounds.v1+border;v+=step){
     // The shore carries on beyond the end of the pier and headland.
     const x=u+step/2,y=v+step/2;
     const underPlot=Boolean(regionAt(x,y));
     const sea=x>=SIZE/2&&y>=SIZE+2+.7*Math.max(0,x-SIZE);
     const grain=1+.055*Math.sin(.57*u+.23*v)+.035*Math.cos(.49*v-.41*u);
     const tint=(sea?water:land).map(c=>c*grain);
     const z=underPlot?-.42:sea?-.125:-.085;
     panel([[u,v,z],[u+step,v,z],[u+step,v+step,z],[u,v+step,z]],tint,sea?'water':climate.snow?'frost':'grass-field',0);
   }
 }
}
export function drawScenery(renderer,plot,climate,windowOpen){
 const theme=plot.theme;
 const box=(id,position,w,d,h,shade,material)=>renderer.box(id,{...position,u:position.u+plot.u,v:position.v+plot.v},w,d,h,shade,material);
 drawStreets(renderer,plot,climate);
 if(theme==='beach'){
   coast({box});
   waterFoam(renderer,plot);
   if(climate.snow)for(let u=-4;u<4;u++)if(u%2===0)
     box(0,{u:u+.1,v:-.38,z:.001},.63,.34,.013,[.95,.98,1],'frost');
   return;
 }
 if(plot.outside){avenueLink({box},theme,climate,renderer,plot);return}
 function paving(u0,v0,u1,v1,tint,mat){
   renderer.panel([[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>[plot.u+u,plot.v+v,0]),
     tint.map(x=>x*(climate.wet?.90:1)),mat,0);
 }
 const pavingTint=climate.snow?[.94,.97,1]:[.98,.94,.86];
 const pavingStone=climate.snow?'frost':'cobbles';
 if(buildings[theme]){
   const e=buildingEdge;
   box(0,{u:-e,v:-e,z:-.027},2*e,2*e,.047,buildings[theme].floor,buildings[theme].tile);
   const house=buildings[theme],grass=seasons[climate.season].ground;
   const bed=climate.snow?'frost':'grass-field',border=.52;
   // Courtyards have planted corners, a paved apron and paths aligned with real entrances.
   function yard(u0,v0,u1,v1){paving(u0,v0,u1,v1,climate.snow?pavingTint:grass,bed);}
   yard(-half,-half,half,-e);yard(-half,e,half,half);yard(-half,-e,-e,e);yard(e,-e,half,e);
   function path(x,y,w,d){box(0,{u:x,v:y,z:.001},w,d,.010,pavingTint,pavingStone);}
   path(-e-border,-e-border,2*(e+border),border);path(-e-border,e,2*(e+border),border);
   path(-e-border,-e,border,2*e);path(e,-e,border,2*e);
   house.sides.forEach((holes,side)=>{
     for(const door of holes.filter(h=>h.kind==='door')){
       const a=door.at-door.width/2,start=side<2?-half:e+border,length=half-e-border;
       if(side===0||side===3)path(a,start,door.width,length);
       else path(start,a,length,door.width);
     }
   });
   renderer.structure(()=>drawBuilding(renderer,plot,climate,windowOpen));
 }else paving(-half,-half,half,half,pavingTint,pavingStone);
}
