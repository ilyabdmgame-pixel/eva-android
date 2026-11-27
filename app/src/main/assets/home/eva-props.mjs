// Portable props are drawn in the same metric space as Eva and the furniture.
// A grip follows the palm solved by IK. Flat objects have a separate support;
// sweeping a hand never drags the desk, the cutting board or the sketchpad.
import {add,sub,mul,cross,unit,place} from './eva-rig.mjs';
const TAU=2*Math.PI,clamp=x=>Math.max(0,Math.min(1,x));
const wood=[.61,.398,.232],brass=[.80,.63,.36],enamel=[.30,.59,.57],linen=[.807,.71,.63];
const cream=[.96,.88,.70],dark=[.225,.229,.264],metal=[.77,.80,.80],paper=[.96,.918,.841];
const berry=[.64,.29,.37],leaf=[.46,.64,.37],water=[.57,.79,.85];
const mix=(a,b,t)=>add(a,mul(sub(b,a),t));
const color=(t,k)=>t.map(v=>v*k);
const UP=[0,0,1];
function artist(renderer,id){
 const tri=(a,b,c,tint)=>renderer.triangle([a,b,c],tint,id);
 const quad=(a,b,c,d,tint)=>{tri(a,b,c,tint);tri(a,c,d,tint);};
 function tube(from,to,a,b,tint,sides=8){
   const axis=unit(sub(to,from));
   const r=unit(cross(axis,Math.abs(axis[2])>.85?[0,1,0]:UP)),f=cross(axis,r);
   let firstA,firstB,lastA,lastB;
   for(let i=0;i<=sides;i++){
     const angle=i*TAU/sides,n=add(mul(r,Math.cos(angle)),mul(f,Math.sin(angle)));
     const p=add(from,mul(n,a)),q=add(to,mul(n,b));
     if(i){
       const lit=.84+.17*Math.max(0,n[0]*-.32+n[1]*.48+n[2]*.82);
       quad(lastA,p,q,lastB,color(tint,lit));
       if(i>1){tri(firstA,p,lastA,tint);tri(firstB,lastB,q,tint);}
     }else {firstA=p;firstB=q;}
     lastA=p;lastB=q;
   }
 }
 function box(center,right,front,up,width,depth,height,tint){
   const point=(x,y,z)=>add(center,add(mul(right,x*width),add(mul(front,y*depth),mul(up,z*height))));
   const p=[point(-.5,-.5,0),point(.5,-.5,0),point(.5,.5,0),point(-.5,.5,0),
     point(-.5,-.5,1),point(.5,-.5,1),point(.5,.5,1),point(-.5,.5,1)];
   for(const [a,b,c,d,k] of [[0,1,5,4,.82],[1,2,6,5,.91],[2,3,7,6,.86],[3,0,4,7,.77],
     [4,5,6,7,1],[0,3,2,1,.74]])quad(p[a],p[b],p[c],p[d],color(tint,k));
 }
 return {tri,quad,tube,box};
}
const portable=new Set(['cook','chop','kettle','tea','wash','sweep','mop','wipeDesk','dust',
 'fluff','fold','water','write','sketch','read','tv']);
export function drawEvaProps(renderer,id,rig,key,seconds){
 if(!portable.has(key))return false;
 const pen=artist(renderer,id),r=rig.base.right,f=rig.base.front;
 const right=rig.joints.right.hand,left=rig.joints.left.hand;
 const palm=mix(left,right,.5),work=rig.work??place(rig.base,0,.29,0);
 const at=(p,x,y,z)=>add(p,add(mul(r,x),add(mul(f,y),[0,0,z])));
 const box=(p,w,d,h,t)=>pen.box(p,r,f,UP,w,d,h,t);
 const shaft=(a,b,w,t)=>pen.tube(a,b,w,w*.90,t,7);
 const t=seconds;
 if(key==='sweep'||key==='mop'){
   const axis=unit(sub(left,right)),floorZ=rig.floor;
   const tip=add(left,mul(axis,(floorZ+.037-left[2])/Math.min(-.15,axis[2])));
   tip[2]=floorZ+.037;
   shaft(add(right,mul(axis,-.115)),tip,.014,wood);
   if(key==='sweep'){
     const tipMid=at(tip,0,0,.047);
     box(tipMid,.245,.06,.036,wood);
     for(let i=0;i<8;i++)pen.tube(at(tipMid,(i-3.5)*.025,0,0),
       at(tip,(i-3.5)*.033,.013,-.025),.014,.019,i%2?brass:[.69,.53,.32],6);
   }else{
     box(at(tip,0,0,-.021),.32,.105,.041,enamel);
     for(let i=0;i<9;i++)shaft(at(tip,(i-4)*.034,.031,-.015),at(tip,(i-4)*.037,.094,-.022),.011,linen);
   }
 }else if(key==='tea'||key==='kettle'||key==='water'){
   const kettle=key==='kettle',can=key==='water';
   const tilt=can||kettle?clamp(.32+(right[2]-left[2])*4):.12;
   const axis=unit(add(UP,mul(r,-tilt*.52)));
   const cup=at(right,can?-.081:kettle?-.084:-.048,.018,-.038);
   const radius=can?.085:kettle?.075:.054,top=add(cup,mul(axis,can?.142:kettle?.135:.086));
   pen.tube(cup,add(cup,mul(axis,.017)),radius*.73,radius,enamel,12);
   pen.tube(add(cup,mul(axis,.017)),top,radius,radius*.96,enamel,14);
   const rim=add(top,mul(axis,.003));
   pen.tube(top,rim,radius*.97,radius*.96,cream,14);
   pen.tube(rim,add(rim,mul(axis,.0015)),radius*.81,radius*.81,kettle||can?dark:[.42,.236,.115],14);
   // The grip is an open loop with room between its side and the vessel.
   const a=at(cup,radius*.77,0,.027),b=at(cup,radius*1.41,0,.042),c=at(cup,radius*1.45,0,.085);
   shaft(a,b,.010,enamel);shaft(b,c,.010,enamel);shaft(c,at(cup,radius*.82,0,.092),.010,enamel);
   if(kettle||can){
     const spout=at(cup,-radius*(can?2.1:1.6),.045,.098);
     pen.tube(at(cup,-radius*.7,.015,.044),spout,.023,can?.037:.017,enamel);
     if(can&&tilt>.57)for(let i=0;i<4;i++){
       const phase=(t*1.8+i/4)%1;
       const droplet=at(spout,-.115*phase,.035*phase,-.25*phase*phase);
       pen.tube(droplet,at(droplet,0,0,-.023),.004,.005,water,4);
     }
   }
 }else if(key==='read'){
   const width=.245,depth=.162,tilt=unit(add(mul(f,.55),mul(UP,.835)));
   const normal=unit(add(mul(f,-.835),mul(UP,.55)));
   const c=at(left,.115,.018,-.018);
   const p=(x,y,rise=0)=>add(c,add(mul(r,x),add(mul(tilt,y),mul(normal,rise))));
   for(const s of [-1,1]){
     pen.quad(p(0,-depth/2),p(s*width/2,-depth/2,.019),p(s*width/2,depth/2,.019),p(0,depth/2),berry);
     pen.quad(p(s*.005,-depth*.46,.003),p(s*width*.47,-depth*.46,.023),
       p(s*width*.47,depth*.46,.023),p(s*.005,depth*.46,.003),paper);
     for(let i=0;i<4;i++)shaft(p(s*.022,(i-1.6)*.028,.010),
       p(s*width*(i===3?.32:.405),(i-1.6)*.028,.025),.0017,[.49,.44,.41]);
   }
   const q=(t%4.75)/4.75;
   if(q>.43&&q<.72){
     const phase=(q-.43)/.29,x=Math.cos(phase*Math.PI)*width*.43,z=Math.sin(phase*Math.PI)*.101;
     pen.quad(p(0,-.070,.007),p(x,-.070,z+.019),p(x,.070,z+.019),p(0,.070,.007),paper);
   }
 }else if(key==='cook'||key==='chop'){
   const center=key==='cook'&&rig.station?add(rig.station,[0,0,.002]):at(work,0,.105,.019);
   if(key==='cook'){
     pen.tube(center,at(center,0,0,.037),.109,.134,dark,16);
     const handle=at(left,0,.012,-.012);
     shaft(at(center,-.081,0,.028),handle,.017,wood);
     for(const [x,y,tint] of [[-.032,.024,brass],[.035,0,leaf],[.002,-.038,berry]])
       pen.tube(at(center,x,y,.040),at(center,x,y,.051),.023,.027,tint,8);
     const end=at(right,-.028,.028,-.078);
     shaft(at(right,0,0,.022),end,.009,wood);
     pen.tube(end,at(end,-.010,.016,-.008),.017,.022,brass);
   }else{
     box(center,.30,.21,.021,wood);
     for(let i=0;i<5;i++)pen.tube(at(center,-.085+i*.034,.032,.025),
       at(center,-.085+i*.034,.032,.047),.019,.019,i%2?leaf:[.91,.56,.24],8);
     const grip=at(right,-.008,.016,-.018);
     shaft(at(grip,.044,-.014,.010),grip,.012,wood);
     const tip=at(grip,-.099,.062,-.024);
     pen.quad(grip,tip,at(tip,0,0,.025),at(grip,0,0,.032),metal);
   }
 }else if(key==='wash'){
   const base=at(left,.012,.018,-.012),axis=unit(add(mul(f,.67),mul(UP,.74)));
   pen.tube(base,add(base,mul(axis,.024)),.051,.105,cream,15);
   pen.tube(add(base,mul(axis,.024)),add(base,mul(axis,.026)),.089,.090,paper,15);
   box(at(right,0,.01,-.015),.077,.052,.026,[.77,.67,.34]);
 }else if(key==='wipeDesk'){
   const c=at(right,0,.018,-.022);
   box(c,.132,.092,.012,enamel);
   shaft(at(c,-.061,.030,.015),at(c,.049,.034,.015),.004,linen);
 }else if(key==='dust'){
   const tip=at(right,.018,.18,.08);
   shaft(at(right,0,-.028,-.01),tip,.012,wood);
   for(let i=0;i<7;i++){
     const angle=TAU*i/7;
     pen.tube(at(tip,.019*Math.cos(angle),-.025,.02*Math.sin(angle)),
       at(tip,.045*Math.cos(angle),.09,.046*Math.sin(angle)),.026,.014,linen,7);
   }
 }else if(key==='fluff'||key==='fold'){
   const w=clamp(Math.hypot(...sub(right,left)))*.92,d=key==='fluff'?.183:.167;
   const crosswise=unit(sub(right,left),r);
   const front=unit(cross(UP,crosswise),f),axis=unit(cross(crosswise,front),UP);
   const p=add(palm,mul(axis,-.037)),h=key==='fluff'?.082:.047;
   pen.box(p,crosswise,front,axis,Math.max(.13,w),d,h,key==='fluff'?linen:berry);
   if(key==='fluff'){
     pen.box(add(p,mul(axis,h)),crosswise,front,axis,Math.max(.11,w-.035),d-.026,.013,linen);
   }else{
     pen.box(add(p,mul(axis,h)),crosswise,front,axis,Math.max(.11,w-.018),d-.043,.012,cream);
   }
 }else if(key==='write'||key==='sketch'){
   const pad=at(work,0,.11,.009);
   box(pad,.251,.194,.011,berry);box(at(pad,0,0,.011),.241,.184,.006,paper);
   const tip=at(right,-.02,.023,-.048);
   shaft(tip,at(right,.037,-.037,.034),.0065,key==='write'?dark:brass);
   for(let i=0;i<3;i++)shaft(at(pad,-.087,.049-.030*i,.020),
     at(pad,.035+(i%2)*.036,.049-.030*i+(key==='sketch'?.025*i:0),.020),.0023,dark);
 }else if(key==='tv'){
   box(at(right,0,.025,-.015),.044,.106,.021,dark);
   box(at(right,.010,.062,.009),.010,.011,.004,berry);
 }
 return true;
}
