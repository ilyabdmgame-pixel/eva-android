// Indexed, skinned model. Local Z points along each limb. A second bone on the
// cuff rings closes elbow and knee seams without stretching painted silhouettes.
import {boneIndex,proportions,add,sub,mul,cross,unit} from './eva-rig.mjs';

const TAU=2*Math.PI;
export const evaVertexSize=18;
const white=[.991,.984],skin=[1,.775,.664],lining=[.90,.839,.789];
const zip=[.72,.65,.61],rib=[.18,.155,.166],ink=[.195,.172,.186],cream=[.87,.82,.742];
const hair=[1.02,.99,1.005],fabric=[1.035,1.018,1.025],denim=[.99,1,1.04];
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const tile=(col,u,v)=>[(col+.03+.94*u)/4,(1.025+.95*v)/2];
const surface={
 hair:(u,v)=>tile(0,u,v),jacket:(u,v)=>tile(1,u,v),denim:(u,v)=>tile(2,u,v)
};
const cos=Math.cos,sin=Math.sin;
const scaleTint=(t,k)=>t.map(v=>v*k);
let mesh;

function build(){
 const vertices=[],indices=[];
 function vertex(bone,p,n,tint,uv=white,{next=bone,second=p,weight=0,style=0}={}){
   const id=vertices.length/evaVertexSize;
   vertices.push(...p,...tint,...uv,boneIndex[bone],boneIndex[next],...n,...second,weight,style);
   return id;
 }
 function grid(rows){
   for(let j=1;j<rows.length;j++)for(let i=1;i<rows[j].length;i++){
     const a=rows[j-1][i-1],b=rows[j-1][i],c=rows[j][i],d=rows[j][i-1];
     indices.push(a,b,c,a,c,d);
   }
 }
 // A loft follows a fitted set of cross sections. Cylindrical textures wrap
 // continuously; the tangent across adjacent rings supplies a smooth normal.
 function loft({bone,rows,tint,segments=14,range=[0,TAU],texture,style=0}){
   const points=rows.map((row,j)=>Array.from({length:segments+1},(_,i)=>{
     const [z,w,d,y=0,x=0]=row,n=i/segments;
     const span=typeof range==='function'?range(row,j):range;
     const a=span[0]+(span[1]-span[0])*n;
     return {p:[x+sin(a)*w,y+cos(a)*d,z],a,n};
   }));
   grid(points.map((row,j)=>row.map(({p,a,n},i)=>{
     const low=points[Math.max(0,j-1)][i].p,high=points[Math.min(points.length-1,j+1)][i].p;
     const tangent=[cos(a)*rows[j][1],-sin(a)*rows[j][2],0];
     const norm=unit(cross(sub(high,low),tangent),[sin(a),cos(a),0]);
     const joint=rows[j][5];
     const tintHere=typeof tint==='function'?tint(j,n):tint;
     const uv=texture?texture(n,1-j/(rows.length-1)):white;
     return vertex(bone,p,norm,tintHere,uv,{style,...(joint&&{next:joint[0],
       second:[p[0],p[1],p[2]+joint[1]],weight:joint[2]})});
   })));
 }
 function sphere(bone,center,radii,tint,style=0,segments=12,texture=null){
   const rows=[];
   for(let j=0;j<=8;j++){
     const a=-Math.PI/2+j*Math.PI/8,rad=Math.max(.012,cos(a));
     rows.push([center[2]+sin(a)*radii[2],radii[0]*rad,radii[1]*rad,center[1],center[0]]);
   }
   loft({bone,rows,tint,segments,texture,style});
 }
 function piping(bone,path,radius,tint,sides=6){
   const rings=path.map((p,i)=>{
     const dir=unit(sub(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)]));
     const x=unit(cross(dir,Math.abs(dir[2])<.8?[0,0,1]:[0,1,0])),y=cross(dir,x);
     return Array.from({length:sides+1},(_,j)=>{
       const a=j*TAU/sides,n=add(mul(x,cos(a)),mul(y,sin(a)));
       return vertex(bone,add(p,mul(n,radius)),n,tint);
     });
   });
   grid(rings);
 }
 function plate(bone,points,tint){
   const normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
   const ids=points.map(p=>vertex(bone,p,normal,tint));
   for(let i=1;i+1<ids.length;i++)indices.push(ids[0],ids[i],ids[i+1]);
 }

 // Waistband, cropped top and the pale lining of her unzipped charcoal hoodie.
 loft({bone:'pelvis',segments:20,texture:surface.denim,tint:denim,rows:[
   [-.101,.102,.075,-.002],[-.081,.139,.098,-.016],[-.02,.148,.106,-.012],
   [.040,.142,.102,-.005],[.090,.126,.090,.001],[.094,.120,.089]]});
 loft({bone:'pelvis',segments:20,tint:rib,rows:[[.063,.143,.102,-.005],[.087,.137,.099,-.003]]});
 sphere('pelvis',[.001,.103,.076],[.010,.004,.010],zip,0,8);
 for(const side of [-1,1]){
   piping('pelvis',[[side*.126,.069,.067],[side*.11,.082,.037],[side*.087,.095,.027]],.0028,[.42,.343,.331],4);
 }
 loft({bone:'chest',segments:20,tint:skin,rows:[
   [-.004,.120,.081],[.085,.114,.079,-.002],[.168,.129,.087,-.002],
   [.271,.152,.101,.001],[.322,.145,.087],[.361,.108,.064],[.385,.053,.047],
   [.437,.048,.044,.002],[.450,.052,.047,.003]]});
 loft({bone:'chest',segments:20,tint:ink,rows:[
   [.118,.121,.084],[.130,.125,.087],[.221,.144,.105],[.281,.151,.110,.004],
   [.310,.143,.101],[.324,.111,.078,-.003]]});
 // The vest neckline, clavicles, hem and midriff come from the same portrait
 // as the face. This narrow curved insert sits inside the jacket opening.
 const frontRows=[
   [-.001,.123,.086,505,48],[.044,.120,.086,480,50],[.081,.119,.087,459,54],
   [.115,.124,.090,442,58],[.166,.134,.100,410,62],[.236,.147,.111,355,65],
   [.273,.152,.115,321,68],[.307,.143,.105,296,67],[.335,.124,.087,274,60],
   [.363,.092,.070,253,49],[.38,.051,.053,248,24]];
 grid(frontRows.map(([z,w,d,py,span])=>Array.from({length:17},(_,i)=>{
   const a=(i/16-.5)*2.20,n=sin(a);
   const cleanSpan=Math.min(span,py<360?34:43);
   return vertex('chest',[n*w,cos(a)*d+.003,z],unit([n,cos(a),.06]),[1,1,1],
     [(3+(151-n*cleanSpan-79)/145)/4,(1+(py-245)/268)/2]);
 })));
 const coat=[
   [-.071,.158,.108,-.008],[-.057,.170,.119,-.008],[-.025,.174,.120,-.009],
   [.035,.166,.114,-.011],[.142,.166,.117,-.012],[.225,.179,.123,-.008],
   [.286,.190,.121,-.009],[.327,.187,.106,-.007],[.354,.154,.095,-.008],
   [.368,.107,.077,-.009],[.376,.086,.068,-.010]];
 const gaps=[.74,.72,.69,.69,.69,.85,.91,.82,.69,.55,.58];
 loft({bone:'chest',rows:coat,tint:fabric,texture:surface.jacket,segments:24,
   range:(_,i)=>[gaps[i],TAU-gaps[i]]});
 for(const s of [-1,1]){
   const seam=coat.map(([z,w,d,y],i)=>[s*(sin(gaps[i])*w+.0007),y+cos(gaps[i])*d+.002,z]);
   piping('chest',seam,.0035,zip,5);
   for(let i=0;i<6;i++){
     const p=[s*(.13+.008*i/5),.061+.012*i/5,.012+.055*i/5];
     if(i)piping('chest',[[p[0]-s*.006,p[1]-.002,p[2]-.009],p],.0026,rib,4);
   }
 }
 // The hood is tucked behind the neck and flares white at both lapels.
 const hoodAngles=[.76,TAU-.76];
 const hoodRows=[0,.28,.63,1].map(h=>Array.from({length:25},(_,i)=>{
   const a=hoodAngles[0]+i*(hoodAngles[1]-hoodAngles[0])/24;
   const back=(1-cos(a))*.5;
   const x=sin(a)*(.148-h*.081+back*.030),y=cos(a)*(.111-h*.046)-.012-back*.031;
   const z=.254+.125*h+.045*(1-back)-.041*back*(1-h);
   return vertex('chest',[x,y,z],unit([sin(a)*.52,cos(a)*.52,.61]),
     scaleTint(lining,.88+.12*h));
 }));
 grid(hoodRows);
 for(const side of [-1,1]){
   const x=side*.092;
   piping('chest',[[x,.065,.348],[x+side*.012,.088,.282],[x+side*.018,.096,.231]],.0023,cream,5);
 }
 // Face UVs are painted independently for each row. Mesh curvature carries
 // the cheeks and nose to a three-quarter view without mirroring the eyes.
 const faceRows=[
   [.072,.016,.052,.010,204,10],[.081,.042,.075,.010,199,27],[.104,.067,.088,.008,188,43],
   [.130,.086,.099,.004,175,56],[.151,.097,.102,.001,163,62],[.174,.104,.104,0,148,66],
   [.193,.108,.104,-.002,136,67],[.218,.113,.106,-.004,118,70],[.244,.116,.106,-.005,98,72],
   [.272,.111,.104,-.006,75,69],[.295,.103,.096,-.005,54,65],[.316,.083,.084,-.005,32,52],
   [.331,.055,.062,-.004,16,36],[.341,.009,.016,-.004,4,7]];
 const faceCols=24;
 grid(faceRows.map(([z,w,d,y,imageY,span],j)=>Array.from({length:faceCols+1},(_,i)=>{
   const a=(i/faceCols-.5)*Math.PI,x=sin(a)*w;
   const nose=.015*Math.exp(-((z-.145)**2)/.00014-(a*a)/.12);
   const normal=unit([sin(a)*.91,cos(a),((z-.18)/.15)*.53]);
   return vertex('head',[x,y+cos(a)*d+nose,z],normal,[1,1,1],
     [(151-sin(a)*span-52)/198/4,imageY/211/2],{style:1});
 })));
 for(const s of [-1,1]){
   sphere('head',[s*.100,.000,.147],[.016,.024,.033],skin,0,12);
   sphere('head',[s*.113,.001,.146],[.004,.015,.022],[.81,.548,.511],0,10);
 }
 // The nape and the long overlapping locks have real thickness. The fitted
 // middle rings follow the shoulders; the roots continue to turn with the head.
 const cap=faceRows.map(([z,w,d,y])=>[z,w+.005,d+.011,y-.009]);
 loft({bone:'head',rows:cap,segments:25,range:[1.40,TAU-1.40],tint:hair,texture:surface.hair,style:2});
 const curtainLevels=Array.from({length:9},(_,i)=>i/8);
 grid(curtainLevels.map(k=>Array.from({length:45},(_,i)=>{
   const a=1.30+i/44*(TAU-2.60),tip=-.32-.110*(.35+.65*cos(9*a+.4)**2);
   const w=.109+.047*sin(k*Math.PI*.9)+.016*k;
   const d=.106+.033*sin(k*Math.PI),y=-.018-.062*Math.min(1,k*2.0);
   const n=unit([sin(a),cos(a),-.08*k]);
   return vertex('head',[sin(a)*w,y+cos(a)*d,.268*(1-k)+tip*k],n,
     scaleTint(hair,.82),surface.hair(.08+.84*(i/44),.08+.84*k),
     {next:'hair',second:[sin(a)*w,y+cos(a)*d,.268*(1-k)+tip*k],weight:clamp(k*1.5),style:2});
 })));
 // An open-ended ribbon wraps its forehead, temple and back side. Each strand
 // has a lifted center ridge and uneven tip, so it remains drawn from behind.
 function lock(s,az,length,width,offset,front=false){
   const rows=[],phases=[0,.16,.35,.55,.76,.90,1];
   for(const k of phases){
     const a=az+(.06*sin(k*TAU+offset)-.032)*s;
     const flare=.109+.060*sin(k*Math.PI*.9);
     const x=front?s*(.087+.036*sin(k*Math.PI)-.011*k):s*sin(a)*flare+s*.012*sin(k*6+offset)*k;
     const y=front?.046+.075*clamp((k-.12)/.55):cos(a)*(.108+.035*k)-.012-.078*clamp(k*1.85);
     const z=.282-k*length;
     const w=width*(.22+.94*sin(Math.PI*(.10+k*.84)))*(1-.95*k**4);
     const sides=8;
     rows.push(Array.from({length:sides+1},(_,i)=>{
       const b=i*TAU/sides;
       const tangent=[cos(a),-s*sin(a),0],out=[s*sin(a),cos(a),0];
       const n=unit(add(mul(tangent,sin(b)*.53),mul(out,cos(b))));
       const p=add([x,y,z],add(mul(tangent,sin(b)*w),mul(out,cos(b)*(.003+w*.32))));
       const u=clamp(.48+.33*sin(b)+.14*sin(offset*4+k*.55));
       const uv=surface.hair(u,.07+.86*k);
       return vertex('head',p,n,scaleTint(hair,.91+.08*cos(offset*3)),uv,
         {next:'hair',second:p,weight:clamp((k-.14)/.56)*(front?.65:1),style:2});
     }));
   }
   grid(rows);
 }
 for(const s of [-1,1]){
   for(const [i,a] of [1.08,1.35,1.62,1.96,2.31,2.67,2.97].entries()){
     const front=i===0;
     lock(s,a,front?.59:.61+.056*sin(i*1.6+s*.7)+.047*(1-i/7),
       front?.025:.033,s*.6+i*.77,front);
   }
 }
 // Sleeve and trouser volumes blend the joint rings in their adjacent bone
 // frames. Their neutral lengths are shared with the inverse kinematics solver.
 for(const [side,s] of [['left',-1],['right',1]]){
   const upper=side+'Upper',lower=side+'Lower',hand=side+'Hand';
   const thigh=side+'Thigh',shin=side+'Shin',foot=side+'Foot';
   const a=proportions.arm,b=proportions.forearm,c=proportions.thigh,d=proportions.shin;
   sphere(upper,[0,0,.016],[.063,.060,.068],fabric,0,14,surface.jacket);
   loft({bone:upper,segments:14,tint:fabric,texture:surface.jacket,rows:[
     [-.037,.040,.047],[0,.064,.061],[.046,.066,.069],[.115,.062,.062],[a-.052,.055,.053],
     [a-.010,.055,.054,0,0,[lower,-a,.35]],[a,.053,.052,0,0,[lower,-a,.50]]]});
   loft({bone:lower,segments:14,tint:fabric,texture:surface.jacket,rows:[
     [0,.053,.052,0,0,[upper,a,.50]],[.024,.056,.055,0,0,[upper,a,.29]],[.077,.056,.054],
     [.146,.053,.052],[b-.055,.045,.047],[b-.029,.031,.032]]});
   loft({bone:lower,segments:14,tint:rib,rows:[[b-.048,.041,.043],[b-.034,.036,.038],[b-.016,.031,.031]]});
   loft({bone:hand,segments:12,tint:skin,rows:[
     [-.025,.024,.022],[0,.029,.022],[.024,.032,.021,.002],[.051,.025,.015,.002],[.065,.010,.010,.001],[.067,.003,.005]]});
   sphere(hand,[-s*.025,.009,.027],[.012,.014,.029],skin,0,8);
   loft({bone:thigh,segments:16,tint:denim,texture:surface.denim,rows:[
     [-.066,.073,.091],[0,.079,.092],[.083,.080,.095],[.174,.072,.081],[.286,.062,.066],
     [c-.043,.051,.054],[c,.052,.053,0,0,[shin,-c,.50]]]});
   loft({bone:shin,segments:14,tint:denim,texture:surface.denim,rows:[
     [0,.052,.053,0,0,[thigh,c,.50]],[.036,.050,.052,0,0,[thigh,c,.18]],
     [.095,.055,.059],[.158,.054,.058],[.248,.043,.046],[d-.050,.041,.043],[d-.025,.044,.045],[d-.012,.039,.040]]});
   // Low canvas sneakers have an inset tongue, a separate sole, and three
   // crossing laces. Foot Z is measured at the ankle, not the shoe base.
   loft({bone:foot,segments:18,tint:[.71,.66,.625],rows:[
     [-.064,.049,.101,.037],[-.056,.052,.107,.037],[-.043,.052,.107,.037]]});
   loft({bone:foot,segments:18,tint:cream,rows:[
     [-.044,.051,.105,.037],[-.025,.050,.103,.035],[-.005,.047,.088,.023],
     [.019,.041,.054,.009],[.035,.036,.042,.002]]});
   plate(foot,[[-.020,.011,.040],[.020,.011,.040],[.029,.081,.003],[-.029,.081,.003]],zip);
   for(const flank of [-1,1]){
     piping(foot,[[flank*.035,.013,.023],[flank*.043,.034,.005],[flank*.044,.082,-.015],
       [flank*.032,.108,-.022]],.0035,[.67,.607,.55],5);
   }
   piping(foot,[[-.037,.084,-.009],[0,.100,-.001],[.037,.084,-.009]],.0029,[.71,.65,.59],5);
   for(let j=0;j<3;j++){
     const y=.027+j*.015,z=.042-j*.0072;
     piping(foot,[[-.025,y-.004,z],[.021,y+.009,z-.003]],.0026,[.96,.92,.84],4);
     piping(foot,[[.025,y-.004,z+.001],[-.021,y+.009,z-.002]],.0026,[.96,.92,.84],4);
   }
 }
 return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices),stride:evaVertexSize};
}
export function evaModel(){return mesh??=build();}
