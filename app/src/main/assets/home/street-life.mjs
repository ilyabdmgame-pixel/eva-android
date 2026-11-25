import {walkPose,walkHeading} from './orientation.mjs';
import {worldPoint,surfaceAt} from './district.mjs';
import {crossing,roads,streetSurface} from './town-plan.mjs';
import {drawCar,drawCat,drawPigeon} from './street-models.mjs';
import {shadowOffset} from './lighting.mjs';
import {inView} from './camera.mjs';

// The car stays on the near lane of the loop. Quarter circles round the four corners.
const main=roads.find(r=>r.axis==='u'&&r.at<0).at;
const quay=roads.find(r=>r.axis==='u'&&r.at>0).at;
const left=roads.find(r=>r.axis==='v'&&r.at===main).at;
const right=roads.find(r=>r.axis==='v'&&r.at===quay).at;
export function vehicleAt(distance,opposite=false){
 const offset=opposite?-.70:.70;
 const west=left+offset,east=right-offset,north=main+offset,south=quay-offset;
 // Both lanes turn about the same centre, separated by their full lane spacing.
 const radius=opposite?1.05+1.40:1.05,straight=east-west-2*radius,arc=Math.PI*radius/2;
 const circuit=4*(straight+arc);
 if(opposite)distance=circuit-(distance%circuit);
 const leg=straight+arc,side=Math.floor(distance/leg)%4,t=distance%leg;
 const start=[[west+radius,north],[east,north+radius],[east-radius,south],[west,south-radius]][side];
 const turn=[[east-radius,north+radius],[east-radius,south-radius],[west+radius,south-radius],[west+radius,north+radius]][side];
 const a=side*Math.PI/2+(t>straight?(t-straight)/radius:0);
 const du=Math.cos(a),dv=Math.sin(a);
 const face=opposite?{du:-du,dv:-dv}:{du,dv};
 return t<=straight?{u:start[0]+du*t,v:start[1]+dv*t,...face}:
   {u:turn[0]+dv*radius,v:turn[1]-du*radius,...face};
}
// A racetrack in metres, with a continuous tangent at all four joins.
function track(d,length,radius){
 const arc=Math.PI*radius,loop=2*(length+arc),s=((d%loop)+loop)%loop;
 if(s<length)return {x:s,y:0,du:1,dv:0};
 if(s<length+arc){const a=(s-length)/radius;return {x:length+radius*Math.sin(a),y:radius*(1-Math.cos(a)),du:Math.cos(a),dv:Math.sin(a)};}
 if(s<2*length+arc)return {x:2*length+arc-s,y:2*radius,du:-1,dv:0};
 const a=(s-2*length-arc)/radius;
 return {x:-radius*Math.sin(a),y:radius*(1+Math.cos(a)),du:-Math.cos(a),dv:-Math.sin(a)};
}
const routes=[
 ['lane',-2.32,.21,2.75,.27],['garden',-1.37,2.93,2.41,.38],
 ['square',-.98,2.54,2.1,.78],['square',-1.04,-3.53,2,.62],
 ['promenade',-1.02,-.58,2.31,.51]
];
export function animalAt(i,seconds){
 const [sector,u,v,length,radius]=routes[i],loop=2*(length+Math.PI*radius);
 const bird=i>=2,period=bird?13.5+i*.45:loop/(i?.40:.48);
 const time=seconds+i*2.13,cycles=Math.floor(time/period),t=time-cycles*period;
 let distance=time*(loop/period),lift=0,spread=0,beat=0;
 if(bird){
   const ground=period*.57,s=Math.max(0,(t-ground)/(period-ground));
   distance=cycles*loop+.165*t+(loop-.165*period)*(s-Math.sin(2*Math.PI*s)/(2*Math.PI));
   lift=(1.75+i*.12)*Math.sin(Math.PI*s)**2;
   spread=Math.min(1,Math.sin(Math.PI*s)*4);
   beat=Math.sin(2*Math.PI*s*15)*(.42+.58*Math.cos(Math.PI*s)**2);
 }
 const local=track(distance,length,radius),at=worldPoint(sector,u+local.x,v+local.y);
 const ground=surfaceAt(at.u,at.v);
 return {...at,z:ground+lift,du:local.du,dv:local.dv,distance,lift,spread,beat,ground};
}
function cast(r,p,length,width,height){
 // Convex hull of the base and top projected onto the ground in the sun direction.
 const [su,sv]=shadowOffset(1),points=[];
 for(const z of [p.z,p.z+height])for(let i=0;i<8;i++){
   const angle=i*Math.PI/4,x=length*Math.cos(angle),y=width*Math.sin(angle);
   points.push([p.u+x*p.du-y*p.dv+su*(z-p.ground),p.v+x*p.dv+y*p.du+sv*(z-p.ground),p.ground+.024]);
 }
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 function chain(seq){const hull=[];for(const pt of seq){
   while(hull.length>=2){const a=hull.at(-2),b=hull.at(-1);if((b[0]-a[0])*(pt[1]-a[1])>(b[1]-a[1])*(pt[0]-a[0]))break;hull.pop();}
   hull.push(pt);
 }hull.pop();return hull;}
 r.castFloor([...chain(points),...chain(points.reverse())]);
}
// Outer lane travels north beside the florist. The stop clears both the zebra and the corner.
const radius=2.45,straight=right-left+1.4-2*radius,leg=straight+Math.PI*radius/2;
const circuit=4*leg,stop=circuit-leg-(2.72-(main-.70+radius));
function curbPose(distance){
 const p=vehicleAt(distance,true),delta=((distance-stop+circuit/2)%circuit+circuit)%circuit-circuit/2;
 const reach=delta<0?2.1:1.6,k=Math.max(0,1-Math.abs(delta)/reach);
 const slope=(delta<0?1:-1)*.32*6*k*(1-k)/reach;
 p.u+=.32*k*k*(3-2*k);
 const size=Math.hypot(p.du+slope,p.dv);p.du=(p.du+slope)/size;p.dv/=size;
 return p;
}
export function streetLife(passengerPath=()=>[{u:9.4,v:2.72},{u:9.65,v:1.13},{u:11.1,v:1.13}]){
 const travel=[0,13];
 const visible=[],catClock=[0,0],catRest=[0,0],speedNow=[1.85,1.65];
 let nextStop=stop,hold=0,guest=null,serial=0;
 const carAt=i=>i?curbPose(travel[i]):vehicleAt(travel[i]);
 function passenger(dt){
   if(!guest)return;
   let budget=1.12*dt;
   while(budget>0&&guest.path.length){
     const p=guest.path[0],x=p.u-guest.u,y=p.v-guest.v,d=Math.hypot(x,y),step=Math.min(d,budget);
     if(d>.001){guest.direction=walkHeading(x,y,guest.direction);guest.u+=step*x/d;guest.v+=step*y/d;guest.stride+=step;}
     budget-=step;if(d<=step)guest.path.shift();
   }
   if(!guest.path.length)guest=null;
 }
 return {
   visible,
   get passenger(){return guest},
   nearTraffic(view){
     return view&&travel.some((dist,i)=>inView(view,carAt(i),2.6,2,view.scale*.20));
   },
   tick(dt,people,wet=false){
     passenger(dt);
     for(let i=0;i<2;i++){
       const speed=i?.40:.48,length=routes[i][3],period=2*(length+Math.PI*routes[i][4])/speed;
       const at=(catClock[i]+i*2.13)%period,target=(i?1.59:2.75)/speed;
       const remain=(target-at+period)%period;
       const covered=remain<1e-6||remain>period-1e-6;
       catClock[i]+=wet?Math.min(dt,covered?0:remain):dt;
       catRest[i]=Math.min(1,Math.max(0,catRest[i]+(wet&&covered?1:-1)*dt*4));
     }
     for(let i=0;i<travel.length;i++){
       if(i&&hold>0){hold=Math.max(0,hold-dt);continue;}
       const remaining=nextStop-travel[i],limit=i?Math.min(1.65,Math.sqrt(2.6*Math.max(.012,remaining))):1.85;
       const speed=Math.min(limit,speedNow[i]+1.3*dt);
       const distance=travel[i]+dt*speed,next=i?curbPose(distance):vehicleAt(distance);
       const yieldTo=people.some(p=>{
         const x=p.u-next.u,y=p.v-next.v,ahead=x*next.du+y*next.dv;
         return ahead>-.36&&ahead<2.10&&Math.abs(x*next.dv-y*next.du)<1.12&&crossing(p.u,p.v)&&streetSurface(p.u,p.v)==='road';
       });
       if(yieldTo){speedNow[i]=0;continue;}
       speedNow[i]=speed;
       if(i&&distance>=nextStop){
         travel[i]=nextStop;nextStop+=circuit;hold=4;speedNow[i]=0;
         const start={u:right+1.78,v:2.72};
         const path=passengerPath(start);
         if(path.length)guest={...start,path,direction:'down-right',stride:0,skin:serial++%2?'nika':'kir'};
       }else travel[i]=distance;
     }
   },
   draw(renderer,view,t,still){
     visible.length=0;
     for(let i=0;i<travel.length;i++){
       const car=carAt(i),id=i?217:218;
       if(!inView(view,car,1.65,1.35,view.scale*.2))continue;
       car.distance=travel[i];car.ground=surfaceAt(car.u,car.v);car.z=car.ground+.003;
       visible.push({id,name:'Городская малолитражка',...car});
       cast(renderer,car,1.22,.55,.84);drawCar(renderer,id,car,Boolean(i));
     }
     if(guest&&inView(view,guest,.6,1.8,0)){
       const pose=walkPose(guest.skin,guest.direction,guest.stride),p={...guest,z:surfaceAt(guest.u,guest.v)};
       renderer.shadow({...p,z:p.z+.028},.21,.15);renderer.sprite(397,pose.key,p,1.66,pose.flip,{...pose,cast:{ground:p.z,inside:false}},true);
       visible.push({id:397,name:'Покупатель',...p});
     }
     for(let i=0;i<routes.length;i++){
       const p=animalAt(i,still?0:i<2?catClock[i]:t*.001),id=219+i,bird=i>=2;
       if(!inView(view,p,.60,3.0,view.scale*.12))continue;
       visible.push({id,name:bird?'Голубь':'Дворовый кот',...p});
       cast(renderer,p,bird?.162:.28,bird?.057+.24*p.spread:.087,bird?.13:.30);
       if(bird)drawPigeon(renderer,id,p,p);
       else drawCat(renderer,id,p,p.distance,i===1,catRest[i]);
     }
   }
 };
}
