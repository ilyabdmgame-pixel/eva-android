import {district,worldPoint} from './district.mjs';
import {buildingEdge} from './buildings.mjs';
import {roomSurface,drawRoomModel} from './room-models.mjs';
import {fixtureFrame,roomMesh,finish as f} from './room-mesh.mjs';
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

export function quiltApproach(bed,actor,walk){
 const {point,width,depth}=fixtureFrame(bed);
 const candidates=[[width+.25,.60*depth],[-.25,.60*depth],[width+.25,.75*depth],
   [-.25,.75*depth],[width*.5,depth+.25]].map(([x,y])=>point(x,y,0))
   .filter(([u,v])=>!walk.blocked({u,v}));
 candidates.sort((a,b)=>Math.hypot(a[0]-actor.u,a[1]-actor.v)-Math.hypot(b[0]-actor.u,b[1]-actor.v));
 const reachable=candidates.find(([u,v])=>Math.hypot(u-actor.u,v-actor.v)<.02||walk.path(actor,{u,v},true).length);
 return reachable?.slice(0,2);
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
 const latch=windowLatch(0);
 return {...fixture,u:room.u+left,v:room.v-roomEdge+.08,w:right-left,d:.07,
   approach:[latch.u-.13,room.v-roomEdge+.50]};
}

// A lever on the fixed mullion remains within reach when the sash is raised.
export function windowLatch(open){
 const {left,right,bottom}=windowFrame,x=(left+2*right)/3;
 const angle=Number(open)*1.14;
 return {u:room.u+x+.069*Math.cos(angle),v:room.v-roomEdge+.211,z:bottom+.263+.069*Math.sin(angle)};
}

export function drawWindowSash(renderer,open){
 const {left,right,bottom,top}=windowFrame,m=roomMesh(renderer,{id:7,u:room.u,v:room.v,w:1,d:1});
 const sash=bottom+(top-bottom)*(.25+.30*Number(open)),x=(left+2*right)/3;
 m.box(left,-roomEdge-.11,sash,right-left,.26,.037,[.83,.69,.52],'oak');
 m.box(x-.021,-roomEdge+.143,bottom+.221,.042,.036,.087,f.brass);
 const latch=windowLatch(open);
 m.rod([x,-roomEdge+.183,bottom+.263],[latch.u-room.u,latch.v-room.v,latch.z],.012,.014,f.brass);
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
   turned:!!parent.turned,back:!!parent.back,approach};
}

export function bedRest(bed,pillow,asleep){
 const frame=fixtureFrame(bed);
 const base=frame.point(frame.width*(asleep?.5:.86),frame.depth*(asleep?.18:.63),0);
 return {u:asleep&&pillow?pillow.u+pillow.w/2:base[0],v:asleep&&pillow?pillow.v+pillow.d/2:base[1],
   height:roomSurface(bed)+(asleep?.10:0)};
}

// Mattress coordinates keep the quilt in register when a saved bed is rotated or moved.
function bodyUnderQuilt(bed,rig){
 if(!rig?.joints||rig.recline<.025)return [];
 const local=fixtureFrame({...bed,z:roomSurface(bed)}).local;
 const segments=[];
 function add(a,b,radius,width){
   const lo=local(a),hi=local(b),dx=hi[0]-lo[0],dy=hi[1]-lo[1];
   segments.push({x:lo[0],y:lo[1],z:lo[2],dx,dy,dz:hi[2]-lo[2],length:dx*dx+dy*dy,radius,width});
 }
 for(const side of ['left','right']){
   const {hip,knee,ankle,shoulder}=rig.joints[side],foot=rig.frames[side+'Foot'];
   add(hip,shoulder,.125,.215);add(hip,knee,.103,.173);add(knee,ankle,.085,.152);
   const shoe=(front,z)=>foot.origin.map((p,i)=>p+front*foot.front[i]+z*foot.up[i]);
   add(shoe(-.055,-.013),shoe(.142,-.040),.071,.128);
 }
 return segments;
}

export function drawBedding(renderer,bed,item,folded,recline=0,plumped=false,rig=null){
 const z=roomSurface(bed);
 if(item.kind==='pillow'){
   const m=roomMesh(renderer,{...item,z,turned:!!bed.turned,back:!!bed.back});
   const {width:w,depth:d}=m;
   // A sewn shell with a shallow depression for the head. Its centre and the sleep anchor coincide.
   const cols=10,rows=7;
   const point=(i,j)=>{
     const x=i/cols,y=j/rows,belly=Math.sin(x*Math.PI)**.65*Math.sin(y*Math.PI)**.7;
     const corner=Math.abs(2*y-1)**4;
     return [(.04+.92*x+.043*(1-2*x)*corner)*w,(.035+.93*y+.022*(1-2*y)*Math.abs(2*x-1)**5)*d,
       .017+(plumped?.123:.101)*belly-(plumped?.042:.023)*recline*belly**3];
   };
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
     m.face([point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)],i===0||i===cols-1?f.linen:f.cream,'cloth');
   }
   for(const j of [0,rows])for(let i=0;i<cols;i++){
     const a=point(i,j),b=point(i+1,j);
     m.face([a,b,[b[0],b[1],.005],[a[0],a[1],.005]],f.linen,'cloth',false);
   }
   return;
 }
 const m=roomMesh(renderer,{...bed,z});
 const {width:w,depth:d}=m;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const straightening=rig?.clip==='makeBed';
 const tuck=folded?(straightening?1-smooth(rig.clipSeconds/1.5):Math.max(0,1-recline*2.4)):0;
 // Slide the near edge down the bed first. Eva can sit, turn and lift her legs
 // onto the exposed mattress before drawing the quilt up to her chest.
 const opening=rig?smooth(rig.seating/.86)*(1-smooth((recline-.66)/.31)):0;
 const left=.021+.109*tuck,right=1-left,near=.36+Math.max(.40*tuck,.50*opening),far=.984-.032*tuck;
 const body=bodyUnderQuilt(bed,rig);
 const grips=[];
 if(straightening){
   const {local}=fixtureFrame({...bed,z});
   for(const side of ['left','right']){
     const [x,y,height]=local(rig.joints[side].hand);
     const ax=Math.max(w*left,Math.min(w*right,x)),ay=Math.max(d*near,Math.min(d*far,y));
     grips.push({ax,ay,dx:Math.max(-.14,Math.min(.14,x-ax)),dy:Math.max(-.14,Math.min(.14,y-ay)),
       lift:Math.max(0,Math.min(.24,height-.055))});
   }
 }
 const cols=12,rows=tuck>.999?4:14;
 const surface=(a,b)=>{
   const across=(Math.max(0,1-((a-.51)/.43)**2))**.85;
   const length=Math.max(0,Math.min(1,(b-.28)*6,(.99-b)*7));
   let x=w*a,y=d*b;
   let warmBody=recline*across*length*(.22+.066*Math.exp(-((b-.43)**2)/.028));
   // Round caps over the pelvis, bent knees and the shoes follow the actual joints.
   // The loose material falls away gradually on either side of each contact.
   for(const part of body){
     const dx=x-part.x,dy=y-part.y;
     const t=Math.max(0,Math.min(1,(dx*part.dx+dy*part.dy)/Math.max(.00001,part.length)));
     const distance=Math.hypot(dx-t*part.dx,dy-t*part.dy);
     const edge=Math.min(1,Math.max(0,(part.width+.085-distance)/.126));
     const crown=part.z+t*part.dz+part.radius+.038;
     warmBody=Math.max(warmBody,crown*edge*edge*(3-2*edge)*Math.min(1,recline*1.9));
   }
   if(grips.length){
     let dx=0,dy=0,lift=0,total=0;
     for(const hand of grips){
       const influence=smooth(1-Math.hypot(x-hand.ax,y-hand.ay)/.31);
       dx+=influence*hand.dx;dy+=influence*hand.dy;total+=influence;
       lift=Math.max(lift,hand.lift*influence);
     }
     x+=dx/Math.max(1,total);y+=dy/Math.max(1,total);warmBody+=lift;
   }
   const embroidery=Math.sin(a*38+.62*Math.sin(b*25))*.0037;
   const hem=Math.max(0,(.072-Math.min(a,1-a))/.072);
   return [x,y,.023+.027*tuck+warmBody+embroidery-.039*hem**2];
 };
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const a=left+(right-left)*i/cols,b=left+(right-left)*(i+1)/cols;
   const c=near+(far-near)*j/rows,e=near+(far-near)*(j+1)/rows;
   const band=j===0||j===rows-2;
   const color=band?f.rose:(i+j)%6===0?[.582,.352,.398]:f.burgundy;
   m.face([surface(a,c),surface(b,c),surface(b,e),surface(a,e)],color,'cloth');
   if(!folded&&(i+j)%2===0){
     const width=(b-a)*.048;
     m.face([surface(a+.011,c+.003),surface(a+.011+width,c+.003),surface(b-.009,e-.003),surface(b-.009-width,e-.003)]
       .map(([x,y,z])=>[x,y,z+.0018]),f.rose,null,false);
   }
 }
 // The cloth rolls around the mattress edge before it hangs. Its hem follows the fold seams.
 const hem=(a,b,side,end=false)=>{
   const [x,y,h]=surface(a,b);
   const over=folded?.001:.010;
   const ripples=folded?0:.013*Math.cos(36*b+side*.9);
   const low=tuck>.8?h-.037:Math.min(-.074,h-.112)+ripples;
   return [x+(end?0:side*over),y+(end?over:0),low];
 };
 for(let j=0;j<rows;j++)for(const [a,side] of [[left,-1],[right,1]]){
   const b=near+(far-near)*j/rows,c=near+(far-near)*(j+1)/rows;
   const t=surface(a,b),next=surface(a,c),low=hem(a,b,side),lowNext=hem(a,c,side);
   const round=t.map((n,i)=>i===0?n+side*.007:i===2?n-.017:n);
   const roundNext=next.map((n,i)=>i===0?n+side*.007:i===2?n-.017:n);
   m.face([t,next,roundNext,round],f.burgundy,'cloth',false);
   m.face([round,roundNext,lowNext,low],f.burgundy,'cloth',false);
   m.face([low,lowNext,[lowNext[0],lowNext[1],lowNext[2]+.009],[low[0],low[1],low[2]+.009]],f.rose,'cloth',false);
 }
 for(let i=0;i<cols;i++){
   const a=left+(right-left)*i/cols,b=left+(right-left)*(i+1)/cols;
   const low=hem(a,far,0,true),other=hem(b,far,0,true);
   m.face([surface(a,far),surface(b,far),other,low],f.burgundy,'cloth',false);
   m.face([low,other,[other[0],other[1],other[2]+.010],[low[0],low[1],low[2]+.010]],f.rose,'cloth',false);
 }
}

export function drawRoom(renderer,open,extra=0,walls={u:true,v:true},includeSash=true){
 const e=roomEdge,end=e+extra,{left,right,bottom,top}=windowFrame;
 const plaster=[.965,.91,.79],wood=[.83,.69,.52],trim=[.631,.454,.339];
 const box=(id,u,v,z,w,d,h,tint,mat)=>renderer.box(id,{u:room.u+u,v:room.v+v,z},w,d,h,tint,mat);
 const panel=(points,key)=>renderer.artPanel(points.map(([u,v,z])=>[room.u+u,room.v+v,z]),key);
 const span=2*e+extra;
 box(0,-e,-e,-.228,span,span,.183,[.446,.326,.275],'oak');
 box(0,-e-.006,-e-.006,-.064,span+.012,span+.012,.049,[.74,.526,.354],'oak');
 box(0,-e,-e,-.022,span,span,.022,[1.04,.97,.83],'oak');
 const back=(id,a,b,z,h,tint,mat='room-plaster',d=.20)=>box(id,a,-e-.11,z,b-a,d,h,tint,mat);
 if(walls.v){
   back(251,-e,left,0,2.97,plaster);back(251,right,end,0,2.97,plaster);
   back(251,left,right,0,bottom,plaster);back(251,left,right,top,2.97-top,plaster);
   back(251,-e,end,.014,.178,wood,'oak',.261);
   back(251,-e,end,.188,.026,trim,'oak',.244);
   back(251,-e,end,2.898,.092,wood,'oak',.257);
   back(7,left-.09,right+.09,bottom-.09,.09,wood,'oak',.40);
   back(7,left-.06,right+.06,top-.04,.09,trim,'oak',.29);
   for(const x of [left,(2*left+right)/3,(left+2*right)/3,right])back(7,x-.024,x+.024,bottom,top-bottom,trim,'oak',.28);
   if(includeSash)drawWindowSash(renderer,open);
   back(251,2.34,3.35,1.68,.047,wood,'oak',.45);
   for(const x of [2.44,3.21])box(251,x,-e+.14,1.55,.038,.141,.135,trim,'oak');
   for(const [x,w,h,c] of [[2.43,.062,.26,f.rose],[2.51,.073,.215,f.mint],[2.60,.060,.273,f.edge],[2.68,.068,.227,f.blue]]){
     box(251,x,-e+.05,1.727,w,.159,h,c);
     box(251,x+.010,-e+.210,1.756,w-.020,.005,.009,f.cream);
   }
   drawRoomModel(renderer,{id:251,model:87,kind:'plant',u:room.u+2.94,v:room.v-e+.023,z:1.728,w:.217,d:.223});
   // Each curtain has two shaped edges and actual folds, so both profiles read in an oblique view.
   for(const [x,sign] of [[left-.28,1],[right+.28,-1]]){
     const cloth=roomMesh(renderer,{id:7,u:room.u+x,v:room.v-e+.16,w:.45,d:.22});
     const section=(k,level)=>{
       const gathered=level===1?.12:level===0?.49:.30;
       return [sign*k/9*gathered,.058+.041*Math.cos(k*Math.PI)+.023*Math.sin(level),[1.054,1.56,2.788][level]+(level===0?.042*Math.cos(k*.85):0)];
     };
     for(let level=0;level<2;level++)for(let k=0;k<9;k++)
       cloth.face([section(k,level),section(k+1,level),section(k+1,level+1),section(k,level+1)],k%2?f.rose:[.653,.410,.466],'cloth',false);
     const band=section(4,1);
     cloth.rod([band[0]-.045,band[1]+.034,1.553],[band[0]+.045,band[1]+.034,1.553],.012,.012,f.brass);
   }
   const rod=roomMesh(renderer,{id:7,...room,w:1,d:1});
   rod.rod([left-.35,-e+.178,2.79],[right+.35,-e+.178,2.79],.021,.021,f.brass);
 }
 if(walls.u){
   box(251,-e-.14,-e-.105,0,.20,span+.105,2.97,[.842,.902,.808],'room-plaster');
   box(251,-e-.14,-e,.015,.252,span,.175,wood,'oak');
   box(251,-e-.14,-e,.185,.242,span,.027,trim,'oak');
   box(251,-e-.14,-e,2.9,.251,span,.086,wood,'oak');
   // Narrow, wall-mounted picture ledge above the bed. All of its depth is outside the walking surface.
   box(251,-e+.057,-.76,1.78,.251,1.78,.044,wood,'oak');
   for(const v of [-.59,.78])box(251,-e+.070,v,1.68,.16,.043,.107,trim,'oak');
   for(const [v,w,h,art] of [[-.635,.71,.52,'town-landscape'],[.171,.48,.63,'seaside-print']]){
     const x=-e+.156,z=1.823;
     box(251,x-.030,v-.032,z,.035,w+.064,h+.06,trim,'oak');
     panel([[x+.008,v+w,z+h],[x+.008,v,z+h],[x+.008,v,z+.025],[x+.008,v+w,z+.025]],art);
   }
   drawRoomModel(renderer,{id:251,model:87,kind:'plant',u:room.u-e+.07,v:room.v+.729,z:1.824,w:.199,d:.209});
 }
 if(!walls.u){
   const x=end-.068;
   box(251,x,-e-.10,0,.18,span+.18,2.97,[.855,.865,.785],'room-plaster');
   box(251,x-.05,-e,.015,.083,span,.177,wood,'oak');
   box(251,x-.05,-e,2.90,.083,span,.084,wood,'oak');
   // From the far side of the room the entry and a key hook come into view.
   const y=.17,doorWidth=1.09;
   box(251,x-.044,y,0,.031,doorWidth,2.11,[.607,.448,.362],'room-oak');
   for(const v of [y-.061,y+doorWidth])box(251,x-.079,v,0,.071,.062,2.177,trim,'room-oak');
   box(251,x-.079,y-.061,2.113,.071,doorWidth+.123,.064,trim,'room-oak');
   for(const z of [.17,1.04]){
     box(251,x-.053,y+.106,z,.014,doorWidth-.212,.742,wood,'room-oak');
     box(251,x-.062,y+.137,z+.035,.012,doorWidth-.274,.666,trim,'room-oak');
   }
   box(251,x-.106,y+.174,.96,.055,.156,.033,f.brass);
   box(251,x-.034,y+1.37,1.245,.041,.312,.084,trim,'room-oak');
   for(let i=0;i<3;i++)box(251,x-.068,y+1.409+i*.099,1.228,.043,.021,.048,f.brass);
 }
 if(!walls.v){
   const y=end-.068;
   box(251,-e-.10,y,0,span+.18,.18,2.97,[.947,.889,.805],'room-plaster');
   box(251,-e,y-.05,.015,span,.083,.177,wood,'oak');
   box(251,-e,y-.05,2.90,span,.083,.084,wood,'oak');
   for(let row=0;row<3;row++)for(let i=0;i<11;i++)
     box(251,-2.23+i*.305,y-.017,.885+row*.145,.298,.014,.138,(i+row)%4?f.porcelain:f.linen,'room-weave');
   box(251,-2.23,y-.242,1.62,1.96,.236,.042,wood,'room-oak');
   const shelf=roomMesh(renderer,{id:251,...room,w:1,d:1});
   for(const [x,color] of [[-2.029,f.mint],[-1.78,f.edge],[-1.54,f.burgundy]]){
     shelf.vessel(x,y-.112,[[1.665,.057],[1.799,.062],[1.824,.051]],color,12);
     shelf.vessel(x,y-.112,[[1.824,.054],[1.844,.055]],f.brass,12);
   }
   drawRoomModel(renderer,{id:251,model:87,kind:'plant',u:room.u-.69,v:room.v+y-.215,z:1.662,w:.19,d:.17});
 }
 panel([[-.92,-.10,.014],[1.55,-.10,.014],[1.55,2.39,.014],[-.92,2.39,.014]],'attic-rug');
 for(const vertical of [false,true]){
   if(vertical?!walls.u:!walls.v)continue;
   const floor=(a,b)=>vertical?[room.u+b,room.v+a,.026]:[room.u+a,room.v+b,.026];
   renderer.shadeBand([floor(-e,-e+.08),floor(end,-e+.08),floor(end,-e+.46),floor(-e,-e+.46)],true);
 }
}
export function drawRoomWindow(renderer,image,visible=true){
 const {left,right,bottom,top}=windowFrame,v=room.v-roomEdge-.006;
 renderer.windowPanel([[room.u+left,v,top],[room.u+right,v,top],
   [room.u+right,v,bottom],[room.u+left,v,bottom]],7,image,visible);
}
