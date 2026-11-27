import {actionBeat} from './eva-motion.mjs';
import {fridgeVisit,fridgeHandle,fridgeDoorPlane,kitchenWorkPoint} from './room-appliances.mjs';
import {windowLatch} from './room.mjs';
import {useProgress} from './household.mjs';
const TAU=2*Math.PI;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const at=(p,u=0,v=0,z=0)=>({u:p.u+u,v:p.v+v,z:p.z+z});

export function activityContacts(key,fixture,sample,origin,windowIsOpen,clear){
 const seconds=sample?.seconds??0;
 const windowOpen=windowIsOpen?1:key==='air'?ease((seconds-.65)/.85):0;
 const contact={at:origin,windowOpen,station:kitchenWorkPoint(fixture)};
 if(key==='air'){
   const latch=windowLatch(windowOpen);
   contact.grip={point:[latch.u,latch.v,latch.z],side:'right',weight:ease(Math.min(seconds/.62,(2.05-seconds)/.48))};
 }else if(key==='fridge'){
   const p=sample.progress,stage=useProgress('fridge',0,p);
   Object.assign(contact,fridgeVisit(fixture,origin,stage,clear));
   contact.barrier=fridgeDoorPlane(fixture,stage);
   const weight=ease(Math.min(p/.10,(1-p)/.05,Math.max((.48-p)/.11,(p-.53)/.12)));
   contact.grip={point:fridgeHandle(fixture,stage),side:fixture.turned?'left':'right',weight};
 }
 return contact;
}

export function activityDuration(activity,reduced){
 const duration=activity.beats.reduce((sum,beat)=>sum+beat[1],0);
 return reduced?Math.min(1800,duration):duration;
}

export function activityPlan(activity,random=Math.random()){
 const [first,last]=activity.loop;
 const duration=activityDuration(activity,false);
 const start=activity.beats.slice(0,first).reduce((sum,beat)=>sum+beat[1],0);
 const cycle=activity.beats.slice(first,last+1).reduce((sum,beat)=>sum+beat[1],0);
 const min=Math.max(0,Math.ceil((180000-duration)/cycle));
 const max=Math.max(min,Math.floor((300000-duration)/cycle));
 const repeats=Math.min(max,min+Math.floor(clamp(random)*(max-min+1)));
 const extra=cycle*repeats;
 return {start,cycle,end:start+cycle+extra,duration:duration+extra,extra};
}

export function activitySample(activity,elapsed,reduced,plan=null){
 const duration=plan?plan.duration-plan.extra:activityDuration(activity,false);
 const ms=plan&&elapsed>=plan.start?
   (elapsed<plan.end?plan.start+(elapsed-plan.start)%plan.cycle:elapsed-plan.extra):elapsed;
 const time=reduced?duration*.53:Math.max(0,Math.min(duration,ms));
 let passed=0;
 for(const [index,[motion,ms,from,to,strokes]] of activity.beats.entries()){
   if(time>passed+ms&&index<activity.beats.length-1){passed+=ms;continue;}
   const phase=clamp((time-passed)/ms);
   const swing=strokes?Math.sin(TAU*strokes*phase):0;
   const cycle=strokes?(1-Math.cos(TAU*strokes*phase))/2:ease(phase);
   const amount=actionBeat(activity.beats,index,time-passed,mix(from,to,cycle));
   return {motion,amount,index,phase,swing,progress:time/duration,seconds:(plan&&!reduced?elapsed:time)/1000};
 }
}

export function nextActivity(program,cursor,available){
 for(let attempt=0;attempt<program.length;attempt++){
   const index=(cursor+attempt)%program.length;
   if(available(program[index]))return {key:program[index],next:(index+1)%program.length};
 }
 return null;
}

export function scheduledPeriod(entries,at){
 const hour=new Date(at).getHours();
 return entries.findLast(row=>row[0]<=hour)??entries.at(-1);
}

export function activityLine(activity,count){
 return activity.lines[(Number.isInteger(count)&&count>=0?count:0)%activity.lines.length];
}

const cloth=[.68,.46,.39],wood=[.67,.48,.29],paper=[.95,.84,.63];
const water=[.48,.70,.76],dust=[.70,.64,.49],steam=[.82,.85,.81];
const ink=[.37,.36,.36],green=[.55,.69,.45],blue=[.42,.58,.63];
const point=p=>[p.u,p.v,p.z];

function block(renderer,center,w,d,h,tint){
 renderer.box(0,at(center,-w/2,-d/2),w,d,h,tint);
}
function line(renderer,a,b,width,tint){
 const x=width*.5;
 const ends=[at(a,-x,x),at(a,x,-x),at(b,x,-x),at(b,-x,x)].map(point);
 renderer.triangle([ends[0],ends[1],ends[2]],tint);
 renderer.triangle([ends[0],ends[2],ends[3]],tint);
}
function motes(renderer,origin,t,count,tint,make){
 for(let i=0;i<count;i++){
   const q=(t*(.45+i*.08)+i/count)%1;
   const p=make(origin,q,i),size=.027+.017*(1-q);
   block(renderer,p,size,size,size,tint);
 }
}
function vapour(ctx,origin,spacing=.18){
 motes(ctx.r,origin,ctx.s.seconds,5,steam,(p,q,i)=>at(p,Math.sin(i*2+q*3)*spacing*q,0,q*.56));
}
function book(ctx,origin,writing=false){
 const {r,s}=ctx,turn=ease(Math.sin(Math.PI*clamp((s.progress-.54)/.26)));
 block(r,origin,.35,.23,.024,cloth);
 for(const side of [-1,1]){
   const p=at(origin,side*.086,0,.025);
   block(r,p,.16,.19,.016,paper);
   for(let n=0;n<3;n++){
     const y=.052-n*.043;
     line(r,at(p,-.051,y,.018),at(p,.048-(n%2)*.022,y,.018),.012,ink);
   }
 }
 if(turn>0&&!writing){
   const a=at(origin,0,-.10,.044),b=at(origin,0,.10,.044);
   const c=at(origin,.15*(1-2*turn),.10,.05+turn*(1-turn)*.47);
   const d=at(c,0,-.20);
   r.triangle([point(a),point(b),point(c)],paper);
   r.triangle([point(a),point(c),point(d)],paper);
 }
}
function dustPuff(ctx,origin,color=dust){
 motes(ctx.r,origin,ctx.s.seconds,5,color,(p,q,i)=>
   at(p,(i%3-1)*q*.28,Math.sin(i+q*4)*q*.17,.07+q*.28));
}
function floorTool(ctx,mop){
 const {r,s,hand,floor,across}=ctx;
 const tip=at(across(floor,s.swing*.39),.10,-.08,.028);
 line(r,hand,tip,.047,wood);
 block(r,tip,mop?.22:.20,mop?.17:.09,.043,mop?blue:oakBrush);
 if(mop){
   for(let i=0;i<3;i++){
     const a=at(across(floor,(i-1)*.22+s.swing*.07),.05,0,.023);
     line(r,a,at(a,.19,-.14),.036,[.47,.64,.64]);
   }
 }else if(s.index===1)dustPuff(ctx,tip);
}
const oakBrush=[.71,.54,.33];

export const activityEffects={
 stretch({r,s,actor,across}){
   if(s.index!==1&&s.index!==2)return;
   for(const side of [-1,1]){
     const a=at(across(actor,side*.30),0,0,1.43+s.amount*.10);
     line(r,a,at(across(a,side*.13),0,0,.14),.025,steam);
   }
 },
 air({r,s,top,across}){
   if(s.index<1)return;
   for(let i=0;i<3;i++){
     const q=(s.seconds*.7+i/3)%1,a=at(across(top,i*.14-.16),q*.38,.16*q,.02+q*.26);
     line(r,a,at(a,.14,.05,.06),.022,steam);
   }
 },
 makeBed({r,s,top}){
   if(s.index===0)return;
   const p=at(top,0,-.16+s.progress*.28,.05+s.amount*.11);
   block(r,p,.55,.30+s.progress*.26,.024,cloth);
   line(r,at(p,-.24,-.12,.029),at(p,.23,-.12,.029),.031,paper);
 },
 cook(ctx){
   const {r,s,top}=ctx,p=at(top,0,.04,.033);
   block(r,p,.25,.23,.037,[.27,.27,.24]);
   line(r,at(p,.10,0,.03),at(p,.33,.04,.054),.048,ink);
   const flip=s.index===2?Math.abs(s.swing)*.14:0;
   block(r,at(p,0,0,.05+flip),.125,.12,.038,[.95,.71,.37]);
   if(s.index>0)vapour(ctx,at(p,0,0,.07),.11);
 },
 chop({r,s,top}){
   const board=at(top,-.06,.09,.018);
   block(r,board,.36,.25,.025,wood);
   for(let i=0;i<5;i++){
     const cut=ease((s.progress-i*.075)*7);
     block(r,at(board,-.12+i*.055,cut*.08,.028),.050,.051,.039,i%2?green:[.89,.60,.31]);
   }
   const blade=at(board,s.swing*.08,-.035,.044+(1-s.amount)*.13);
   line(r,blade,at(blade,.13,-.018,.043),.048,steam);
   line(r,at(blade,.12,0,.041),at(blade,.20,0,.053),.037,wood);
 },
 kettle(ctx){
   if(ctx.s.progress>.21)vapour(ctx,at(ctx.top,.07,.02,.09));
   if(ctx.s.progress>.79){
     const a=at(ctx.top,.19,0,.24);
     line(ctx.r,a,at(a,.13,.026,.11),.025,paper);
   }
 },
 tea(ctx){
   const {r,s,hand,top}=ctx;
   const cup=s.motion==='idle'?at(top,0,0,-.12):at(hand,0,0,-.073);
   r.sprite(0,'home-mug',cup,.19,ctx.mirrored,{anchor:[.81,.92]});
   vapour(ctx,at(cup,0,0,.11),.08);
 },
 wash(ctx){
   const {r,s,top}=ctx;
   const cup=at(top,s.swing*.10,.04,.045);
   r.sprite(0,'mug',cup,.17,false);
   motes(r,at(top,.03,0,.24),s.seconds,6,water,(p,q,i)=>at(p,(i%3-1)*q*.061,.03*q,-q*.22));
   if(s.index===1)dustPuff(ctx,at(cup,0,0,.12),steam);
 },
 fridge(ctx){
   if(ctx.s.index!==0&&ctx.s.index!==3)dustPuff(ctx,at(ctx.top,0,.11,-.59),[.66,.78,.82]);
 },
 sweep(ctx){floorTool(ctx,false);},
 mop(ctx){floorTool(ctx,true);},
 wipeDesk({r,s,top,across}){
   const p=at(across(top,.38*s.swing),0,.05,.022);
   block(r,p,.23,.13,.026,blue);
   line(r,at(p,-.10,.03,.027),at(p,.10,.03,.027),.024,steam);
 },
 dust(ctx){
   const end=at(ctx.across(ctx.top,ctx.s.swing*.30),.03,.14-(ctx.s.index===2?.51:0));
   line(ctx.r,ctx.hand,end,.037,wood);
   block(ctx.r,end,.18,.10,.066,dust);
   if(ctx.s.index>0)dustPuff(ctx,end);
 },
 fluff({r,s,hand}){
   const puff=Math.abs(s.swing);
   r.sprite(0,'bed-pillow',at(hand,0,0,-.105),.27+puff*.045,false,{anchor:[.67,1]});
 },
 fold({r,s,hand}){
   const width=.48-.22*ease((s.progress-.24)*2.1);
   block(r,at(hand,0,0,-.03),width,.24,.065,cloth);
   line(r,at(hand,-width*.36,.10,.037),at(hand,width*.36,.10,.037),.023,paper);
 },
 water({r,s,hand,top}){
   const can=at(hand,0,0,.03);
   block(r,can,.15,.14,.105,blue);
   const spout=at(can,.12,-.07,.077),end=at(top,0,0,-.28);
   line(r,can,spout,.055,blue);
   if(s.index===2){
     for(let i=0;i<4;i++){
       const q=(s.seconds*1.65+i/4)%1;
       const p={u:mix(spout.u,end.u,q),v:mix(spout.v,end.v,q),z:mix(spout.z,end.z,q)+Math.sin(q*Math.PI)*.12};
       block(r,p,.030,.030,.050,water);
     }
   }
 },
 write(ctx){
   const {r,s,top}=ctx,p=at(top,0,.04,.036);
   book(ctx,p,true);
   const pencil=at(p,s.swing*.094,.03-s.progress*.13,.055);
   line(r,pencil,at(pencil,.08,-.04,.11),.022,wood);
 },
 sketch({r,s,top,hand}){
   const p=s.index===2?at(hand,0,0,.13):at(top,-.12,.045,.04);
   block(r,p,.29,.25,.023,paper);
   const a=at(p,-.11,-.09,.025),b=at(p,-.045,.01,.025),c=at(p,.03,-.029,.025),d=at(p,.11,.072,.025);
   line(r,a,b,.024,ink);
   if(s.progress>.30)line(r,b,c,.024,ink);
   if(s.progress>.50)line(r,c,d,.024,green);
 },
 read(ctx){
   const p=ctx.otherHand?{u:(ctx.hand.u+ctx.otherHand.u)/2,v:(ctx.hand.v+ctx.otherHand.v)/2,
     z:(ctx.hand.z+ctx.otherHand.z)/2}:ctx.hand;
   book(ctx,at(p,0,0,-.037));
 },
 vinyl({r,s,top,actor,across}){
   for(let i=0;i<6;i++){
     const a=i*TAU/6+s.seconds*5;
     const p=at(top,Math.cos(a)*.09,Math.sin(a)*.09,.019);
     block(r,p,.022,.022,.020,i===0?paper:ink);
   }
   if(s.index>1){
     const p=at(across(actor,.37),0,0,1.1+Math.sin(s.seconds*4)*.10);
     line(r,p,at(p,0,0,.13),.027,paper);
     block(r,p,.045,.045,.032,paper);
   }
 },
 tv({r,s,hand,top}){
   if(s.index===1)block(r,at(hand,0,0,.035),.10,.060,.035,ink);
   if(s.index>0){
     const tints=[[.44,.65,.75],[.76,.59,.53],[.71,.73,.55]];
     const c=tints[Math.floor(s.seconds*2.2)%tints.length],p=at(top,0,.07,-.06);
     block(r,p,.118,.060,.060,c);
   }
 },
 rest({r,s,actor,across}){
   if(s.index===1&&s.progress>.35&&s.progress<.78){
     const y=1.04+Math.sin(s.seconds*2)*.07,p=at(across(actor,.26),0,0,y);
     line(r,p,at(across(p,.14),0,0,.06),.020,steam);
   }
 },
 nap(ctx){
   if(ctx.s.index===1&&ctx.s.progress>.39)sleepSigns(ctx,1);
 },
 sleep(ctx){
   if(ctx.s.index===1)sleepSigns(ctx,2);
 }
};
function sleepSigns({r,s,head,actor,across},count){
 for(let i=0;i<count;i++){
   const p=at(across(head??actor,(head ? .13 : .26)+i*.12),0,0,(head ? .04 : .33)+i*.12+(s.seconds*.17+i*.25)%.20);
   const a=at(across(p,-.035)),b=at(across(p,.036)),c=at(a,0,0,-.056),d=at(b,0,0,-.056);
   line(r,a,b,.020,steam);line(r,b,c,.020,steam);line(r,c,d,.020,steam);
 }
}

export function drawRoomActivity(renderer,key,sample,actor,top,facing,contacts){
 const right=facing.endsWith('left')||facing==='left'?-1:1;
 const across=(p,x)=>at(p,right*x*.62,-right*x*.62);
 const hand=contacts?.hand?at(contacts.hand,.012,.012,.012):at(across(actor,.16+sample.swing*.11),.11,.14,
  sample.motion==='sit'?.31:sample.motion==='stoop'?.62:sample.motion==='sleep'?.08:.78+sample.amount*.21);
 const floor=at(actor,.31,.22,-actor.z);
 activityEffects[key]({r:renderer,s:sample,actor,top,hand,floor,across,
   head:contacts?.head,otherHand:contacts?.otherHand,mirrored:right===-1});
}
