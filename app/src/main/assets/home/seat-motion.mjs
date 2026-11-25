const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const x=clamp(value);return x*x*(3-2*x);};
const interpolate=(from,to,t)=>from+(to-from)*t;

export function seatMotion(seat,fromPoint,toPoint,facing,start,from=0,to=1){
 const duration=seat.sleep?880:to>from?690:550;
 return {seat,fromPoint,toPoint,facing,start,from,to,duration:duration*Math.max(.18,Math.abs(to-from))};
}

export function seatSample(motion,time,reduced=false){
 const t=reduced?1:clamp((time-motion.start)/motion.duration);
 const sitting=motion.to>motion.from;
 const pose=smooth(sitting?(t-.05)/.87:(t-.035)/.89);
 const step=smooth(sitting?(t-.15)/.77:(t-.21)/.78);
 return {
  amount:interpolate(motion.from,motion.to,pose),
  u:interpolate(motion.fromPoint.u,motion.toPoint.u,step),
  v:interpolate(motion.fromPoint.v,motion.toPoint.v,step),
  complete:t===1
 };
}
