import {evaClipFrame,evaClips} from './eva-clips.mjs';

const TAU=2*Math.PI;
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const mix=(v,w,a)=>v+(w-v)*a;
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul=(a,n)=>[a[0]*n,a[1]*n,a[2]*n];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=(v,fallback=[0,0,1])=>{const n=Math.hypot(...v);return n<1e-7?fallback:mul(v,1/n);};
const vMix=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
const xyz=p=>[p.u,p.v,p.z??0];
export const uvz=p=>({u:p[0],v:p[1],z:p[2]});
const UP=[0,0,1];
const compass=['down-right','down','down-left','left','up-left','up','up-right','right'];
const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const yawFor=facing=>Math.max(0,compass.indexOf(facing))*Math.PI/4;
const sin=Math.sin,cos=Math.cos;
const vecLength=v=>Math.hypot(...v);
export const proportions={arm:.273,forearm:.263,thigh:.402,shin:.384,neutralHip:.827,ankle:.064};

export const bones=['pelvis','chest','head','hair','leftThigh','leftShin','leftFoot',
 'rightThigh','rightShin','rightFoot','leftUpper','leftLower','leftHand','rightUpper','rightLower','rightHand'];
export const boneIndex=Object.fromEntries(bones.map((name,i)=>[name,i]));
function frame(origin,right,front,up){return {origin,right,front,up};}
export function place(frame,x=0,y=0,z=0){
 const {origin:o,right:r,front:f,up:u}=frame;
 return [o[0]+r[0]*x+f[0]*y+u[0]*z,o[1]+r[1]*x+f[1]*y+u[1]*z,o[2]+r[2]*x+f[2]*y+u[2]*z];
}
function relative(frame,point){
 const d=sub(point,frame.origin);
 return [dot(d,frame.right),dot(d,frame.front),dot(d,frame.up)];
}
function rotate(frame0,pitch=0,yaw=0,roll=0,origin=frame0.origin){
 const x=add(mul(frame0.right,cos(yaw)),mul(frame0.front,-sin(yaw)));
 const f=add(mul(frame0.front,cos(yaw)),mul(frame0.right,sin(yaw)));
 const y=add(mul(f,cos(pitch)),mul(frame0.up,-sin(pitch)));
 const z=add(mul(frame0.up,cos(pitch)),mul(f,sin(pitch)));
 return frame(origin,add(mul(x,cos(roll)),mul(z,-sin(roll))),y,add(mul(z,cos(roll)),mul(x,sin(roll))));
}
function boneFrame(a,b,right){
 const up=unit(sub(b,a));
 let x=sub(right,mul(up,dot(right,up)));
 if(vecLength(x)<.04){const axis=Math.abs(up[2])<.8?UP:[0,1,0]; x=cross(axis,up);}
 x=unit(x);
 return frame(a,x,unit(cross(up,x)),up);
}
function pack(frames){
 const matrices=new Float32Array(bones.length*16);
 bones.forEach((name,index)=>{
   const {right,front,up,origin}=frames[name];
   matrices.set([...right,0,...front,0,...up,0,...origin,1],index*16);
 });
 return matrices;
}
function twoBone(start,target,pole,upper,lower,barrier){
 const direction=unit(sub(target,start),[0,0,-1]);
 const distance=clamp(vecLength(sub(target,start)),Math.abs(upper-lower)+.002,upper+lower-.001);
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
 let perpendicular=sub(pole,mul(direction,dot(direction,pole)));
 if(vecLength(perpendicular)<.01){
   const axis=Math.abs(direction[2])>.85?[0,1,0]:UP;
   perpendicular=sub(axis,mul(direction,dot(direction,axis)));
 }
 const middle=add(start,mul(direction,along)),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
 let bend=unit(perpendicular);
 if(barrier&&radius>.001){
   // Choose the nearest bend around the shoulder/wrist axis whose sleeve clears the door.
   const outward=sub(barrier.normal,mul(direction,dot(direction,barrier.normal)));
   const length=vecLength(outward);
   if(length>.001){
     const axis=mul(outward,1/length),current=dot(bend,axis);
     const safe=clamp((.113-dot(sub(middle,barrier.origin),barrier.normal))/(length*radius),-1,1);
     if(current<safe){
       const tangent=unit(sub(bend,mul(axis,current)),unit(cross(direction,axis)));
       bend=add(mul(axis,safe),mul(tangent,Math.sqrt(1-safe*safe)));
     }
   }
 }
 return {joint:add(middle,mul(bend,radius)),
   end:add(start,mul(direction,distance))};
}

// The sole is stationary in world space during stance, including when frame
// rate changes. Gait phase comes from distance travelled on the navigation path.
function stepAt(phase,stride){
 const p=((phase%1)+1)%1,stance=.53;
 if(p<stance)return {y:stride*(stance/2-p),z:0,pitch:0};
 const q=(p-stance)/(1-stance),s=smooth(q);
 const y=stride*(stance*(s-.5)-(1-stance)*q*(1-q)*(1-2*q));
 return {y,z:.125*sin(Math.PI*q)**2,pitch:.21*sin(TAU*q)*sin(Math.PI*q)**2};
}
function lateralStep(step,side){
 if(!step)return [0,0,0];
 const q=step.ratio*4-(side===step.lead?0:1);
 const first=clamp(q),second=clamp(q-2);
 const fraction=(smooth(first)+smooth(second))*.5;
 const offset=mul(step.vector,fraction-step.ratio);
 offset[2]=.071*(sin(Math.PI*first)**2+sin(Math.PI*second)**2);
 return offset;
}
function seatState(input){
 const seat=input.seat,s=input.seatSample;
 if(!seat||!s)return {amount:0,recline:0,height:.48,depth:.34,bedAngle:0};
 const recline=s.recline??0,bed=input.support;
 const onBed=s.pose==='sleep';
 const bedAngle=(bed?.turned?0:Math.PI/2)+(bed?.back?Math.PI:0);
 const isSofa=bed?.kind==='bench'||bed?.kind==='chair'||bed?.kind==='sofa';
 const depth=isSofa?Math.min(.43,Math.max(.31,((bed.turned?bed.w:bed.d)??.64)*.48+.02)):.34;
 return {amount:onBed?1:(s.poseAmount??s.amount??0),recline,height:seat.sleep?seat.edge.height:seat.height,depth,bedAngle};
}
function reachSurface(input,base){
 const {u,v,z}=input.workTop||input.at;
 const fixture=input.workArea;
 if(input.station){
   const goal=relative(base,input.station);
   return [clamp(goal[0],-.22,.22),clamp(goal[1]-.09,.13,.38),goal[2]];
 }
 const pad=.045;
 const nearest=(a,lo,length)=>length<=pad*2?lo+length/2:clamp(a,lo+pad,lo+length-pad);
 const center=fixture?
   [nearest(base.origin[0]+base.front[0]*.22,fixture.u,fixture.w),
    nearest(base.origin[1]+base.front[1]*.22,fixture.v,fixture.d),z]:[u,v,z];
 const target=relative(base,center);
 return [clamp(target[0],-.09,.09),clamp(target[1],.13,.335),target[2]];
}

function motor(input,base,posture){
 const {amount,recline}=posture;
 const name=Object.hasOwn(evaClips,input.clip)?input.clip:'idle';
 const t=input.clipSeconds??input.time/1000;
 const cycle=name==='walk'?(input.walkDistance??0)/1.14*evaClips.walk.count/30:t;
 const c=evaClipFrame(name,cycle,input.reduced);
 const neutral=evaClipFrame(amount>.5?'sit':'idle',t,input.reduced);
 let influence=input.strength??1;
 if(name==='walk')influence=input.walkWeight??1;
 if(c.space==='recline')influence=recline;
 if(['read','tv','rest','computer'].includes(name))influence*=amount;
 let surface;
 if(c.space==='surface')surface=reachSurface(input,base);
 const hand=(v,rest)=>{
   const target=surface?add(surface,v):v;
   return vMix(rest,target,influence);
 };
 const gesture=input.desk;
 const right=hand(c.right,neutral.right),left=hand(c.left,neutral.left);
 if(input.grip){
   const goal=relative(base,input.grip.point);
   const wrist=input.grip.side==='left'?left:right;
   wrist.splice(0,3,...vMix(wrist,goal,input.grip.weight));
 }
 // The keyboard includes asymmetric mouse travel in world coordinates. Select
 // the physically corresponding hand even when a saved desk has rotated.
 if(gesture){
   const wrists=[gesture.left,gesture.right].map(g=>({...g,local:relative(base,xyz(g.point))})).sort((a,b)=>a.local[0]-b.local[0]);
   for(const [v,g] of [[left,wrists[0]],[right,wrists[1]]]){
     const target=vMix(v,g.local,g.reach*amount);
     v.splice(0,3,...target);
   }
 }
 return {right,left,lean:mix(neutral.lean,c.lean,influence),look:mix(neutral.look,c.look,influence),
   tilt:mix(neutral.tilt,c.tilt,influence),weight:c.weight*influence,index:c.index,space:c.space};
}
function blendPose(a,b,t){
 return {right:vMix(a.right,b.right,t),left:vMix(a.left,b.left,t),lean:mix(a.lean,b.lean,t),
   look:mix(a.look,b.look,t),tilt:mix(a.tilt,b.tilt,t),weight:mix(a.weight,b.weight,t),index:b.index,space:b.space};
}
function locomotion(input){
 const w=input.reduced?0:clamp(input.walkWeight??0);
 const cycle=(input.walkDistance??0)/1.14;
 return {w,cycle,bounce:w*.013*(1-cos(cycle*TAU*2))*.5,shift:w*.018*sin(TAU*cycle)};
}

function evaluate(input,previous){
 const p=seatState(input),g=locomotion(input),t=input.reduced?0:input.time/1000;
 const tick=Math.floor(t*30)/30,breath=input.reduced?0:sin(tick*TAU/4.15);
 const delta=previous?clamp((input.time-previous.time)/1000,0,1):1;
 const targetYaw=yawFor(input.facing??'down-right');
 const yaw=previous&&!input.reduced?previous.yaw+angleDelta(previous.yaw,targetYaw)*(1-Math.exp(-delta*14)):targetYaw;
 const bedYaw=yaw+angleDelta(yaw,p.bedAngle)*smooth(p.recline);
 const right=[-sin(bedYaw),cos(bedYaw),0],forward=[cos(bedYaw),sin(bedYaw),0];
 const floor=input.at.z??0;
 const seatedHip=p.height+mix(.098,.138,p.recline);
 let baseZ=floor+mix(proportions.neutralHip,seatedHip,p.amount)+g.bounce;
 const leftShift=lateralStep(input.stepAside,'left'),rightShift=lateralStep(input.stepAside,'right');
 if(g.w>0||input.stepAside){
   for(const [offset,shift] of [[0,leftShift],[.5,rightShift]]){
     const foot=stepAt(g.cycle+offset,1.14);
     const horizontal=Math.hypot(.025+foot.y*g.w+dot(shift,forward),.034+Math.abs(dot(shift,right)));
     const legLength=proportions.shin+proportions.thigh-.003;
     const clearance=Math.sqrt(Math.max(0,legLength*legLength-horizontal*horizontal));
     baseZ=Math.min(baseZ,floor+proportions.ankle+foot.z*g.w+shift[2]+clearance-.012);
   }
 }
 const at=[input.at.u,input.at.v,baseZ];
 if(p.recline){
   // seatSample ends on the pillow; its last point locates the head, not the pelvis.
   const f=[cos(p.bedAngle),sin(p.bedAngle),0],offset=.623*p.recline;
   at[0]+=f[0]*offset;at[1]+=f[1]*offset;
 }
 const base=frame(at,right,forward,UP),raw=motor(input,base,p);
 let transition=previous?.transition;
 if(previous&&previous.clip!==input.clip)transition={from:previous.motor,at:input.time};
 const blend=transition&&!input.reduced?smooth((input.time-transition.at)/385):1;
 const motorNow=blend<1?blendPose(transition.from,raw,blend):raw;
 if(blend>=1)transition=null;
 const sway=(motorNow.weight+g.shift)*(1-p.recline);
 const root=add(at,mul(right,sway));
 const pitch=(motorNow.lean+sin(Math.PI*p.amount)*.19)*(1-p.recline)-p.recline*1.47;
 const roll=(input.clip==='nap'?-.17:-.018)*p.recline+g.shift*.57;
 const pelvis=rotate(base,pitch*(.18+.82*p.recline),0,roll,root);
 const chest=rotate(base,pitch+breath*.008*(1-Math.min(1,g.w)),g.w*.052*sin(g.cycle*TAU),
   roll+sway*.22,place(pelvis,0,0,.077));
 const neck=place(chest,0,.003,.402);
 const expression=input.expression??{};
 const head=rotate(chest,-motorNow.lean*.37+motorNow.tilt+(expression.y??0)*1.3,
   motorNow.look+(expression.x??0)*2,roll*.15,neck);
 const hair=rotate(chest,p.recline*.045+(1-p.recline)*(-.06-.045*g.w*cos(g.cycle*TAU)),
   motorNow.look*.28,roll*.20+g.w*.055*sin(g.cycle*TAU),neck);
 const frames={pelvis,chest,head,hair},joints={};
 const raised=sin(Math.PI*p.recline);
 const sensor=rotate(base,0,0,0,root);
 for(const [side,s] of [['left',-1],['right',1]]){
   const hip=place(pelvis,s*.084,0,.005);
   const gait=stepAt(g.cycle+(s===1?.5:0),1.14);
   const idleX=s*(.089+.008*p.amount);
   const legForward=mix(.025+gait.y*g.w,p.depth,p.amount);
   let ankle=place(base,idleX,legForward,0);
   ankle[2]=floor+proportions.ankle+gait.z*g.w*(1-p.amount);
   if(input.stepAside)ankle=add(ankle,s<0?leftShift:rightShift);
   if(p.recline){
     const onBed=place(base,s*.09+(input.clip==='nap'?.065:0),.735-(input.clip==='nap'?.080:0),0);
     onBed[2]=floor+p.height+.104;
     ankle=vMix(ankle,onBed,p.recline);
     // The ankles cross the side rail above its top, then settle on the quilt.
     ankle[2]+=raised*(.34+.035*s);
   }
   const kneePole=add(mul(forward,1-.77*p.recline),mul(UP,p.recline));
   const leg=twoBone(hip,ankle,add(kneePole,mul(right,s*.055)),proportions.thigh,proportions.shin);
   frames[side+'Thigh']=boneFrame(hip,leg.joint,right);
   frames[side+'Shin']=boneFrame(leg.joint,leg.end,right);
   frames[side+'Foot']=rotate(base,gait.pitch*g.w-.68*p.recline,0,0,leg.end);

   const shoulder=place(chest,s*.164,.003,.342);
   let target=place(motorNow.space==='recline'?chest:sensor,...motorNow[side]);
   if(input.grip?.side===side)target=sub(target,mul(right,sway*input.grip.weight*blend));
   if(motorNow.space==='recline'){
     // In bed the arms settle on the body, in its reclining coordinate frame.
     const onLap=place(sensor,s*.115,.22,.065);
     target=vMix(onLap,target,p.recline);
   }
   if(input.barrier){
     const n=input.barrier.normal,gap=dot(sub(target,input.barrier.origin),n);
     if(gap<.075)target=add(target,mul(n,.075-gap));
   }
   const pole=add(add(mul(chest.right,s*.72),mul(chest.front,-.44)),mul(chest.up,-.68));
   const arm=twoBone(shoulder,target,pole,proportions.arm,proportions.forearm,input.barrier);
   frames[side+'Upper']=boneFrame(shoulder,arm.joint,chest.right);
   frames[side+'Lower']=boneFrame(arm.joint,arm.end,chest.right);
   const reach=unit(sub(arm.end,arm.joint));
   // The palm follows the forearm at rest, and lies flatter over a desk.
   let fingers=input.desk?unit(vMix(reach,add(forward,[0,0,-.22]),.82*input.desk.right.reach)):reach;
   if(input.barrier){
     const n=input.barrier.normal,gap=dot(sub(arm.end,input.barrier.origin),n);
     const into=Math.min(0,dot(fingers,n)),nearDoor=smooth((.185-gap)/.105);
     fingers=unit(sub(fingers,mul(n,into*nearDoor)),[0,0,-1]);
   }
   frames[side+'Hand']=boneFrame(arm.end,add(arm.end,fingers),chest.right);
   joints[side]={hip,knee:leg.joint,ankle:leg.end,shoulder,elbow:arm.joint,hand:arm.end};
 }
 const blinkTime=(tick+1.17)%4.8;
 const blink=input.clip==='sleep'||input.clip==='nap'?smooth((p.recline-.55)/.35):
   input.reduced?0:smooth(1-Math.abs(blinkTime-2.5)/.083);
 const face=input.mood==='pleased'||input.mood==='wry'?2:input.mood==='curious'||input.mood==='surprised'?3:0;
 return {time:input.time,yaw,clip:input.clip,clipSeconds:input.clipSeconds??t,motor:motorNow,transition,frames,matrices:pack(frames),joints,
   pelvis:root,base,floor,work:input.workTop?place(base,...reachSurface(input,base)):null,station:input.station,
   head:place(head,0,0,.337),face,blink,bedFloor:p.recline>.55?floor+p.height+.012:-100,
   seating:p.amount,recline:p.recline,frame:motorNow.index};
}

export function evaRig(input){return evaluate(input,null);}

// Only this instance carries transition history. Snap after visibility gaps so
// returning to the launcher never replays the previous visit's pose.
export function createEvaAnimator(){
 let previous=null;
 return input=>{
   if(previous&&(input.time-previous.time>1200||input.time<previous.time))previous=null;
   const state=evaluate(input,previous);
   previous=state;
   return state;
 };
}
