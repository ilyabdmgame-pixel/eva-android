import {doorHalfThickness} from './buildings.mjs';

export function startFlight(kind,from,to,t,ground=()=>0){
  return {kind,fromZ:ground(from.u,from.v),toZ:ground(to.u,to.v),from:{...from},to:{...to},start:t,checkedAt:t,duration:kind==='ball'?1120:1550};
}
export function flightPoint(flight,t){
  if(flight.impact){
    const hit=flight.impact;
    const progress=Math.max(0,Math.min(1,(t-hit.at)/360));
    const ease=1-(1-progress)**2;
    return {u:hit.u+(flight.to.u-hit.u)*ease,v:hit.v+(flight.to.v-hit.v)*ease,
      z:flight.toZ+.085+(hit.z-flight.toZ-.085)*(1-progress**2),phase:progress};
  }
  const phase=Math.min(1,Math.max(0,(t-flight.start)/flight.duration));
  const {from,to,kind}=flight;
  const u=from.u+(to.u-from.u)*phase,v=from.v+(to.v-from.v)*phase;
  const arc=kind==='ball'?Math.abs(Math.sin(phase*Math.PI*3))*((1-phase)*.69):Math.sin(phase*Math.PI)*.92;
  const z=flight.fromZ*(1-phase)+flight.toZ*phase+.085+arc+.51*(1-phase);
  return {u,v,z,phase};
}
// Sweep even after a skipped frame. The landing point also drives retrieval.
export function advanceFlight(flight,t,blocked,ground=()=>0){
  if(flight.impact)return flightPoint(flight,t);
  const until=Math.max(flight.checkedAt,Math.min(t,flight.start+flight.duration));
  const end=flightPoint(flight,until);
  let previous=flightPoint(flight,flight.checkedAt);
  const length=Math.hypot(end.u-previous.u,end.v-previous.v);
  const count=Math.max(1,Math.ceil(length/.035));
  for(let i=1;i<=count;i++){
    const at=flight.checkedAt+(until-flight.checkedAt)*i/count;
    const point=flightPoint(flight,at);
    if(blocked(point,flight.kind==='ball'?.092:.17)){
      const du=previous.u-flight.from.u,dv=previous.v-flight.from.v,travel=Math.hypot(du,dv);
      const back=flight.kind==='ball'?Math.min(.25,travel)/Math.max(travel,.001):0;
      flight.to={u:previous.u-du*back,v:previous.v-dv*back};
      flight.toZ=ground(flight.to.u,flight.to.v);
      flight.impact={...previous,at};
      return flightPoint(flight,t);
    }
    previous=point;
  }
  flight.checkedAt=until;
  return end;
}

export function hitsDoor(point,radius,door){
  const along=(door.vertical?point.v-door.v:point.u-door.u)+door.width/2;
  const across=(door.vertical?point.u-door.u:point.v-door.v)*door.sign;
  const angle=door.open*Math.PI*.49,a=Math.cos(angle),b=Math.sin(angle);
  const length=Math.max(0,Math.min(door.width,along*a+across*b));
  return Math.hypot(along-length*a,across-length*b)<radius+doorHalfThickness&&point.z-radius<2.13;
}
export function drawToy(renderer,flight,point,z){
  const {u,v}=point;
  if(flight.kind==='ball'){
    renderer.ball({u,v,z},.092,[.87,.55,.29]);
    return;
  }
  const du=flight.to.u-flight.from.u,dv=flight.to.v-flight.from.v,length=Math.hypot(du,dv)||1;
  const a=du/length,b=dv/length;
  const p=(front,side,height)=>[u+a*front-b*side,v+b*front+a*side,z+height];
  renderer.triangle([p(.19,0,.01),p(-.10,-.12,0),p(-.047,0,-.044)],[.92,.84,.71]);
  renderer.triangle([p(.19,0,.01),p(-.047,0,-.044),p(-.10,.12,.014)],[.72,.72,.74]);
  renderer.triangle([p(.19,0,.01),p(-.12,0,.047),p(-.047,0,-.044)],[.87,.79,.65]);
}
