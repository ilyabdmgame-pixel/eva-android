import {district,worldPoint} from './district.mjs';
import {buildingEdge} from './buildings.mjs';
import {furnitureSurface} from './occlusion.mjs';
import {turnFixture} from './prop-finish.mjs';
import {approach} from './contact.mjs';
import {streamChair} from './room-furnishings.mjs';

export const room=district('home');
export const roomEdge=buildingEdge;
export const roomCenter=worldPoint('home',-.31,.44);
export const roomScale=.1176;
export const roomOffset=.108;
export const expandedRoom=1.24;

export function roomView(extra){
 return {centre:{u:roomCenter.u+extra/2,v:roomCenter.v+extra/2},
   scale:roomScale*(2*roomEdge)/(2*roomEdge+extra)};
}

const windowFrame={left:-1.19,right:2.13,bottom:1.22,top:2.68};
export const attachedFurniture=new Map([[1,[5,6,27,streamChair.id]],[3,[10,11]],[21,[22,23]],[25,[26]]]);
export const furnitureOwners=new Map([...attachedFurniture].flatMap(([parent,children])=>children.map(id=>[id,parent])));

export function roomApproach(item,fixtures,actor,blocked){
 const owner=fixtures.find(fixture=>fixture.id===furnitureOwners.get(item.id));
 return approach(item.kind==='streamChair'?item:owner||item,actor,blocked);
}

export function roomFurniture(models){
 const layout=new Map(models.filter(item=>item.sector===room.key).map(item=>[item.id,item]));
 const desk=layout.get(1),monitor=layout.get(27);
 layout.set(streamChair.id,{...streamChair,u:monitor.u+.595-streamChair.w/2,v:desk.v+desk.d+.11,sector:room.key});
 layout.set(81,models.find(item=>item.id===81));
 for(const [id,u,v,turned] of [[2,1.72,-.53],[3,-3.26,-.62],[21,-3.30,1.86,true],[24,2.18,-2.44],
                               [25,-1.65,-2.93],[81,-.56,.04],[300,-.97,2.59],[301,-2.02,2.59],
                               [302,.18,2.59],[303,-3.30,-2.20],[304,-3.35,-3.25],[305,-3.43,-1.26]]){
   const before=layout.get(id);
   const after={...(turned?turnFixture(before):before),...worldPoint(room.key,u,v),sector:room.key,approach:null};
   layout.set(id,after);
   for(const child of attachedFurniture.get(id)||[]){
     layout.set(child,attachedPosition(layout.get(child),before,after));
   }
 }
 return layout;
}

export function inRoom(u,v,margin=0,extra=0){
 const edge=roomEdge-margin,du=u-room.u,dv=v-room.v;
 return du>-edge&&du<edge+extra&&dv>-edge&&dv<edge+extra;
}

export function fitsRoom(u,v,width,depth,extra=0){
 return inRoom(u,v,.16,extra)&&inRoom(u+width,v+depth,.16,extra);
}

export function roomWindowFixture(fixture){
 const {left,right}=windowFrame;
 return {...fixture,u:room.u+left,v:room.v-roomEdge+.08,w:right-left,d:.07,
   approach:[room.u+.82,room.v-2.10]};
}

export function attachedPosition(fixture,before,parent){
 const offsetU=fixture.u-before.u,offsetV=fixture.v-before.v;
 let u=parent.turned?offsetV:offsetU,v=parent.turned?offsetU:offsetV;
 if(parent.back){
   u=parent.w-u-(parent.turned?fixture.d:fixture.w);
   v=parent.d-v-(parent.turned?fixture.w:fixture.d);
 }
 const approach=fixture.approach&&[
   parent.u+(parent.turned?fixture.approach[1]-before.v:fixture.approach[0]-before.u),
   parent.v+(parent.turned?fixture.approach[0]-before.u:fixture.approach[1]-before.v)
 ];
 if(parent.back&&approach){
   approach[0]=2*parent.u+parent.w-approach[0];
   approach[1]=2*parent.v+parent.d-approach[1];
 }
 return {...fixture,u:parent.u+u,v:parent.v+v,
   w:parent.turned?fixture.d:fixture.w,d:parent.turned?fixture.w:fixture.d,
   artFlip:Boolean(fixture.artFlip)!==Boolean(parent.turned),
   ...(fixture.kind==='computer'?{turned:!!parent.turned}:{}),approach};
}

export function bedRest(bed,pillow,asleep){
 const top=furnitureSurface(bed.art,[bed.w,bed.d],bed.artFlip);
 const height=top?.height??bed.surfaceHeight??.53;
 const rest={
   u:bed.u+bed.w*(asleep?(bed.turned?.18:.5):(bed.turned?.63:.86)),
   v:bed.v+bed.d*(asleep?(bed.turned?.5:.18):(bed.turned?.86:.63))
 };
 if(asleep&&pillow){
   rest.u=pillow.u+pillow.w/2;rest.v=pillow.v+pillow.d/2;
 }
 return {...rest,height:height+(asleep ? .10 : 0)};
}

export function drawBedding(renderer,bed,item,folded){
 const surface=furnitureSurface(bed.art,[bed.w,bed.d],bed.artFlip)?.height??bed.surfaceHeight??.53;
 if(item.kind==='pillow'){
   const centre={u:item.u+item.w/2,v:item.v+item.d/2,z:surface+.027};
   renderer.sprite(item.id,'bed-pillow',centre,.43,!!item.artFlip,
     {anchor:[.5,.58],bedPlane:surface+.051,restAmount:1});
   return;
 }
 const near=folded?.75:.38,far=.935,left=folded?.18:.052,right=folded?.82:.948;
 const point=(across,length,z)=>{
   const [x,y]=bed.turned?[length,across]:[across,length];
   return [bed.u+bed.w*x,bed.v+bed.d*y,z];
 };
 const z=surface+(folded?.038:.016),rows=folded?3:8,columns=6;
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
   const a=left+(right-left)*i/columns,b=left+(right-left)*(i+1)/columns;
   const c=near+(far-near)*j/rows,d=near+(far-near)*(j+1)/rows;
   const light=(i%2+j%2)*.095;
   renderer.panel([point(a,c,z),point(b,c,z),point(b,d,z),point(a,d,z)],
     [.48+light,.23+light*.82,.30+light*.83],null,item.id);
 }
 renderer.panel([point(left,far,z),point(right,far,z),point(right,far,z-.043),point(left,far,z-.043)],
   [.38,.18,.23],null,item.id);
}

export function drawRoom(renderer,open,extra=0){
 const e=roomEdge,end=e+extra,{left,right,bottom,top}=windowFrame;
 const plaster=[.97,.86,.78],wood=[.81,.67,.56],trim=[.60,.44,.35];
 const box=(id,u,v,z,w,d,h,tint,mat)=>renderer.box(id,{u:room.u+u,v:room.v+v,z},w,d,h,tint,mat);
 const panel=(points,key)=>renderer.artPanel(points.map(([u,v,z])=>[room.u+u,room.v+v,z]),key);
 box(0,-e,-e,-.15,2*e+extra,2*e+extra,.15,[1.04,.90,.77],'oak');
 box(251,-e-.14,-e-.11,0,.20,2*e+.11+extra,2.97,[.86,.85,.76],'plaster');
 const back=(id,a,b,z,h,tint,mat='plaster',d=.20)=>box(id,a,-e-.11,z,b-a,d,h,tint,mat);
 back(251,-e,left,0,2.97,plaster);
 back(251,right,end,0,2.97,plaster);
 back(251,left,right,0,bottom,plaster);
 back(251,left,right,top,2.97-top,plaster);
 back(251,-e,end,.015,.105,wood,'oak',.25);
 box(251,-e-.14,-e,.015,.25,2*e+extra,.105,wood,'oak');
 back(251,-e,end,2.92,.05,wood,'oak',.25);
 box(251,-e-.14,-e,2.92,.25,2*e+extra,.05,wood,'oak');
 back(7,left-.09,right+.09,bottom-.09,.09,wood,'oak',.40);
 back(7,left-.06,right+.06,top-.04,.09,trim,'oak',.29);
 for(const x of [left,(2*left+right)/3,(left+2*right)/3,right]){
   back(7,x-.027,x+.027,bottom,top-bottom,trim,'oak',.28);
 }
 const sash=bottom+(top-bottom)*(open?.55:.25);
 back(7,left,right,sash,.045,wood,'oak',.25);
 // A short shelf above the desk and fabric below the window.
 back(251,2.35,3.18,1.68,.055,wood,'oak',.42);
 for(const [x,w,h,tint] of [
   [2.41,.083,.24,[.73,.49,.45]],[2.51,.065,.20,[.53,.67,.62]],[2.59,.091,.27,[.76,.68,.49]],
   [2.84,.22,.13,[.46,.63,.64]]
 ])box(251,x,-e+.06,1.735,w,.17,h,tint,'oak');
 for(const x of [left-.19,right+.13]){
   for(let i=0;i<3;i++)box(251,x+i*.042,-e+.11+(i%2)*.023,1.13,.045,.055,1.64,
     i%2?[.61,.51,.61]:[.72,.59,.68],'cloth');
 }
 panel([[-.92,-.10,.014],[1.55,-.10,.014],[1.55,2.39,.014],[-.92,2.39,.014]],'attic-rug');
 for(const vertical of [false,true]){
   const floor=(a,b)=>vertical?[room.u+b,room.v+a,.024]:[room.u+a,room.v+b,.024];
   renderer.shadeBand([floor(-e,-e+.08),floor(end,-e+.08),floor(end,-e+.48),floor(-e,-e+.48)],true);
 }
}

export function drawRoomWindow(renderer,image){
 const {left,right,bottom,top}=windowFrame,v=room.v-roomEdge-.006;
 renderer.windowPanel([[room.u+left,v,top],[room.u+right,v,top],
   [room.u+right,v,bottom],[room.u+left,v,bottom]],7,image);
}
