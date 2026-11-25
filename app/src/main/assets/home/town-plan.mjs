// Metres in the simulation. Both the map and the meshes use these coordinates.
export const SIZE=14;
export const plots={
  orchard:[-1,-2],arcade:[1,-2],home:[-1,0],street:[0,0],school:[0,-1],shop:[1,0],cafe:[0,1],beach:[1,1],
  courtyard:[-2,1],terrace:[-1,1],lane:[-2,0],garden:[-2,-1],park:[-1,-1],square:[0,-2],market:[1,-1],
  promenade:[2,1],pier:[2,2],headland:[3,1]
};
export const extensions=[[-35,-7,'Западный квартал'],[0,-35,'Северный квартал'],[49,14,'Береговой маршрут']];
export const roads=[
  {axis:'u',at:-7,from:-35,to:21,cross:[-28,-14,0,14]},
  {axis:'v',at:-7,from:-21,to:7,cross:[-14,0]},
  {axis:'v',at:7,from:-21,to:7,cross:[-14,0]},
  {axis:'u',at:7,from:-35,to:7,cross:[-28,-14,0]},
  {axis:'v',at:-21,from:-7,to:7,cross:[0]},
  {axis:'u',at:-21,from:-7,to:7,cross:[0]}
];
export const carriage=1.68,kerb=.14,pavement=.92;
const outer=carriage+kerb+pavement;
function on(road,u,v,width){
  const along=road.axis==='u'?u:v,across=road.axis==='u'?v:u;
  return along>=road.from-width&&along<=road.to+width&&Math.abs(across-road.at)<=width;
}
export function streetSurface(u,v){
  for(const r of roads)if(on(r,u,v,carriage))return 'road';
  for(const r of roads)if(on(r,u,v,carriage+kerb))return 'kerb';
  for(const r of roads)if(on(r,u,v,outer))return 'walk';
  return '';
}
export function crossing(u,v){
  return roads.some(r=>on(r,u,v,outer)&&r.cross.some(c=>Math.abs((r.axis==='u'?u:v)-c)<.84));
}
export const walkingRestricted=(u,v)=>streetSurface(u,v)==='road'&&!crossing(u,v);
// Cut the union at every change of material, including junctions and dropped kerbs.
export function streetCells(plot){
  const half=SIZE/2,x0=plot.u-half,x1=plot.u+half,y0=plot.v-half,y1=plot.v+half;
  const xs=new Set([x0,x1]),ys=new Set([y0,y1]);
  const add=(set,n,lo,hi)=>{if(n>lo&&n<hi)set.add(n);};
  for(const r of roads){
    const h=r.axis==='u';
    for(const w of [carriage,carriage+kerb,outer]){
      for(const n of [r.at-w,r.at+w])add(h?ys:xs,n,h?y0:x0,h?y1:x1);
      for(const n of [r.from-w,r.to+w])add(h?xs:ys,n,h?x0:y0,h?x1:y1);
    }
    for(const c of r.cross)for(const n of [c-.84,c+.84])add(h?xs:ys,n,h?x0:y0,h?x1:y1);
  }
  const x=[...xs].sort((a,b)=>a-b),y=[...ys].sort((a,b)=>a-b),cells=[];
  for(let j=1;j<y.length;j++){
    let last;
    for(let i=1;i<x.length;i++){
      const u=(x[i]+x[i-1])/2,v=(y[j]+y[j-1])/2,kind=streetSurface(u,v);
      if(!kind){last=null;continue;}
      const ramp=crossing(u,v);
      if(last&&last.kind===kind&&last.ramp===ramp){last.x1=x[i];continue;}
      last={x:x[i-1],y:y[j-1],x1:x[i],y1:y[j],kind,ramp};cells.push(last);
    }
  }
  return cells;
}
export function migrateTown(save){
  if(save.townGrid===SIZE)return false;
  const old=save.townGrid||8;
  function move(p){
    if(!p||!Number.isFinite(p.u)||!Number.isFinite(p.v))return;
    p.u+=Math.floor(p.u/old+.5)*(SIZE-old);
    p.v+=Math.floor(p.v/old+.5)*(SIZE-old);
  }
  move(save.lastLocation);
  for(const p of Object.values(save.chairs||{}))if(p.world)move(p);
  for(const p of save.economy?.placements||[])move(p);
  save.townGrid=SIZE;
  return true;
}
