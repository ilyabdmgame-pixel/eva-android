// Coordinates sit under the front lip of a canopy. The solid back is behind the seats.
const stands={
 lane:[1.25,.25],garden:[.22,2.93],street:[3,-2.5],park:[2.8,-3.8],square:[2.8,3.6],
 market:[2.8,3.65],promenade:[3,-.75],pier:[2.5,-3.5],beach:[2.9,-3.6],
 headland:[2.8,-3.6],arcade:[2.9,3.5],orchard:[2.9,3.5]
};
export function rainStand(key){
 const xy=stands[key];if(!xy)return [];
 const [u,v]=xy;
 const part=(x,y,z,a,b,h,tint,mat)=>({u:x,v:y,z,a,b,h,tint,mat});
 const steel=[.34,.41,.42],wood=[.65,.48,.35],roof=[.39,.51,.49];
 return [{id:400+Object.keys(stands).indexOf(key),name:'Навес от дождя',kind:'shelter',streetMesh:true,visualHeight:2.06,w:1.9,d:.12,
   u:u-.95,v:v-.62,approach:[u,v],parts:[
     part(.03,0,0,.09,.12,2,steel),part(1.78,0,0,.09,.12,2,steel),
     ...[.58,.79,1,1.21].map(z=>part(.07,.01,z,1.75,.08,.15,wood,'wood')),
     part(-.12,-.12,1.97,2.14,1.16,.09,roof,'zinc-roof'),part(-.12,.97,1.91,2.14,.065,.09,steel)
   ]}];
}
export function shelterPoint(plot,slot=0){
 const xy=stands[plot.key],offset=[0,-.62,.62,-.32,.32][slot%5];
 if(xy)return {u:plot.u+xy[0]+offset,v:plot.v+xy[1]};
 if(plot.key==='shop')return {u:plot.u-4.14,v:plot.v+1.13+offset*.48};
 if(plot.key==='cafe')return {u:plot.u+1.88+offset*.48,v:plot.v-4.14};
 return null;
}
export const raining=weather=>weather==='rain'||weather==='storm';
export function stepPrints(){
 const moisture=new Map(),prints=[];
 return {
   step(id,p,du,dv,beat,t,wet,outside,nearDoor){
     const count=wet&&outside?6:Math.max(0,(moisture.get(id)||0)-1);
     moisture.set(id,count);
     if(!nearDoor||!count)return;
     const norm=Math.hypot(du,dv)||1,side=beat%2?.087:-.087;
     prints.push({u:p.u-side*dv/norm,v:p.v+side*du/norm,t,intensity:count/6});
     if(prints.length>60)prints.shift();
   },
   draw(t,mark){
     while(prints.length&&t-prints[0].t>11000)prints.shift();
     for(const p of prints)mark(p,(1-Math.max(0,t-p.t)/11000)*p.intensity);
   }
 };
}
