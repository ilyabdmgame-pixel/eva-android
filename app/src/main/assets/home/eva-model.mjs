// Indexed, skinned model. Local Z points along each limb. A second bone on the
// cuff rings closes elbow and knee seams without stretching painted silhouettes.
import {boneIndex,proportions,add,sub,mul,cross,unit} from './eva-rig.mjs';

const TAU=2*Math.PI;
export const evaVertexSize=18;
const white=[.991,.984],skin=[1,.775,.664];
const zip=[.81,.72,.59],rib=[.182,.181,.205],ink=[.195,.172,.186],cream=[.90,.861,.781];
const seamThread=[.373,.382,.392],honeyThread=[.606,.479,.329],selvedge=[.307,.445,.432];
const hair=[1.02,.99,1.005],fabric=[1.035,1.018,1.025],denim=[.99,1,1.04];
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const tile=(col,u,v)=>[(col+.03+.94*u)/4,(1.025+.95*v)/2];
const island=(x,y,w,h)=>(u,v)=>[(x+u*w)/2048,(y+v*h)/1024];
const surface={
 hair:(u,v)=>tile(0,u,v),jacket:(u,v)=>tile(1,u,v),denim:(u,v)=>tile(2,u,v),
 lining:island(1807,527,226,225),badge:island(1797,774,118,145),
 canvas:island(1934,782,100,132)
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
   piping('pelvis',[[side*.126,.069,.067],[side*.11,.082,.037],[side*.087,.095,.027]],.0028,honeyThread,4);
   sphere('pelvis',[side*.110,.080,.045],[.004,.0025,.004],zip,0,6);
   piping('pelvis',[[side*.118,-.075,.051],[side*.054,-.101,.060],[side*.052,-.110,.019],
     [side*.091,-.096,-.006],[side*.120,-.073,.008],[side*.118,-.075,.051]],.0022,honeyThread,4);
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
     [(1536+256*(151-n*cleanSpan-79)/145)/2048,(1+(py-245)/268)/2]);
 })));
 const coat=[
   [-.071,.158,.108,-.008],[-.057,.170,.119,-.008],[-.025,.174,.120,-.009],
   [.035,.166,.114,-.011],[.142,.166,.117,-.012],[.225,.179,.123,-.008],
   [.286,.190,.121,-.009],[.327,.187,.106,-.007],[.354,.154,.095,-.008],
   [.368,.107,.077,-.009],[.376,.086,.068,-.010]];
 const gaps=[.74,.72,.69,.69,.69,.85,.91,.82,.69,.55,.58];
 loft({bone:'chest',rows:coat,tint:fabric,texture:surface.jacket,segments:24,
   range:(_,i)=>[gaps[i],TAU-gaps[i]]});
 loft({bone:'chest',rows:[[-.067,.164,.114,-.008],[-.055,.172,.121,-.008],[-.043,.173,.121,-.009]],
   tint:[.36,.37,.40],texture:surface.lining,range:[.75,TAU-.75],segments:24});
 for(const s of [-1,1]){
   const seam=coat.map(([z,w,d,y],i)=>[s*(sin(gaps[i])*w+.0007),y+cos(gaps[i])*d+.002,z]);
   piping('chest',seam,.0035,zip,5);
   const pocket=[[s*.153,.045,-.019],[s*.148,.050,.002],[s*.141,.057,.029],[s*.136,.061,.055]];
   piping('chest',pocket,.005,rib,5);
   piping('chest',pocket.map(([x,y,z])=>[x+s*.002,y+.001,z-.004]),.0019,seamThread,4);
   // Raglan seam, cut away at the armhole to allow free movement at the shoulder.
   piping('chest',[[s*.100,.078,.354],[s*.135,.075,.333],[s*.163,.054,.302],[s*.178,.027,.272]],.0026,seamThread,5);
 }
 // The hood is tucked behind the neck and flares white at both lapels.
 const hoodAngles=[.76,TAU-.76];
 const hoodRows=[0,.28,.63,1].map(h=>Array.from({length:25},(_,i)=>{
   const a=hoodAngles[0]+i*(hoodAngles[1]-hoodAngles[0])/24;
   const back=(1-cos(a))*.5;
   const x=sin(a)*(.148-h*.081+back*.030),y=cos(a)*(.111-h*.046)-.012-back*.031;
   const z=.254+.125*h+.045*(1-back)-.041*back*(1-h);
   return vertex('chest',[x,y,z],unit([sin(a)*.52,cos(a)*.52,.61]),
     scaleTint([1.025,1.008,.99],.90+.10*h),surface.lining(i/24,1-h));
 }));
 grid(hoodRows);
 for(const side of [-1,1]){
   const x=side*.092;
   piping('chest',[[x,.065,.348],[x+side*.012,.088,.282],[x+side*.018,.096,.231]],.0023,cream,5);
   piping('chest',[[x+side*.018,.096,.232],[x+side*.019,.097,.216]],.0036,zip,5);
 }
 // Face UVs are painted independently for each row. Mesh curvature carries
 // the cheeks and nose to a three-quarter view without mirroring the eyes.
 const faceRows=[
   [.072,.016,.052,.010,204,10],[.081,.042,.075,.010,199,27],[.104,.067,.088,.008,188,43],
   [.130,.086,.099,.004,175,56],[.151,.097,.102,.001,163,62],[.174,.104,.104,0,148,66],
   [.193,.108,.104,-.002,136,67],[.218,.113,.106,-.004,118,70],[.244,.116,.106,-.005,98,72],
   [.272,.111,.104,-.006,75,69],[.295,.103,.096,-.005,54,65],[.316,.083,.084,-.005,32,52],
   [.331,.055,.062,-.004,16,36],[.346,0,0,-.014,4,1]];
 const faceCols=24;
 grid(faceRows.map(([z,w,d,y,imageY,span],j)=>Array.from({length:faceCols+1},(_,i)=>{
   const a=(i/faceCols-.5)*Math.PI,x=sin(a)*w;
   const nose=.015*Math.exp(-((z-.145)**2)/.00014-(a*a)/.12);
   const normal=unit([sin(a)*.91,cos(a),((z-.18)/.15)*.53]);
   return vertex('head',[x,y+cos(a)*d+nose,z],normal,[1,1,1],
     [(151-sin(a)*span-52)/198/4,imageY/211/2],{style:1});
 })));
 for(const s of [-1,1]){
   sphere('head',[s*.099,.001,.146],[.014,.019,.030],skin,0,12);
   piping('head',[[s*.110,-.001,.157],[s*.113,.006,.153],[s*.112,.007,.143],
     [s*.108,.005,.135]],.0023,[.802,.542,.497],5);
 }
 // The painted front and the back share their actual temple edge. The
 // forehead stays a single surface, including its individually drawn bangs.
 // In the back the same mesh runs uninterrupted from the crown to the ends.
 const section=z=>{
   let j=1;
   while(j<faceRows.length-1&&faceRows[j][0]<z)j++;
   const a=faceRows[j-1],b=faceRows[j],k=clamp((z-a[0])/(b[0]-a[0]));
   return [1,2,3].map(i=>a[i]+(b[i]-a[i])*k);
 };
 const upper=faceRows.filter(row=>row[0]>=.218).reverse().map(row=>row[0]);
 const heights=[...upper,.193,.164,.124,.079,.014,-.065,-.15,-.23,-.31,-.37,-.419];
 const sectors=64;
 const mantle=heights.map(baseZ=>Array.from({length:sectors+1},(_,j)=>{
   const n=j/sectors,inside=sin(Math.PI*n);
   const sideDrop=clamp((.259-baseZ)/.133);
   const around=.55*sideDrop*sideDrop*(3-2*sideDrop);
   const a=Math.PI/2-around+(Math.PI+2*around)*n;
   const lower=clamp((.255-baseZ)/.67),tail=clamp((-baseZ-.22)/.19);
   const z=baseZ+tail*(.035*cos(9*a+.7)+.012*sin(14*a)+.088*(1-inside)**4);
   const [w0,d0,cy0]=section(z);
   const edgeBlend=Math.max(clamp(inside*4),sideDrop);
   const reach=clamp((.27-z)/.17)*edgeBlend;
   const w=w0+( .123+.036*sin(lower*Math.PI*.90)+.009*lower -w0)*reach;
   const d=d0+(.118+.033*sin(lower*Math.PI)-d0)*reach;
   const cy=cy0+(-.016-.071*Math.min(1,lower*1.9)-cy0)*reach;
   const puff=Math.max(inside,sideDrop)*clamp((.346-z)/.056);
   const ridge=.0028*sin(a*13+.76*lower)+.0013*cos(a*24+.81);
   const bend=.047*sin(4*lower+a)*lower;
   const p=[sin(a+bend)*(w+puff*(.012+ridge)),cy+cos(a+bend)*(d+puff*(.015+ridge)),z];
   const normal=unit([sin(a+bend),cos(a+bend),z>.248?(z-.248)*14.1:-.055*lower]);
   const matchingCrown=clamp((z-.24)/.081);
   const u=clamp(n+.037*sin(lower*3.7+a)*lower);
   return vertex('head',p,normal,scaleTint(hair,1.02+.025*cos(a*2.5)),
     surface.hair(.036+.928*u,.023+.94*clamp((.346-z)/.80)),
     {next:'hair',second:p,weight:clamp((.245-z)/.39),style:2+matchingCrown});
 }));
 grid(mantle);
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
       // Each sculpted lock takes a single band of paint from the hair sheet.
       // Sampling the full swatch on every strand repeats the highlights.
       const lane=(Math.abs(Math.round(az*11+offset*3)))%6;
       const u=clamp((lane+.48+.40*sin(b)+.07*sin(offset+k*3))/6);
       const uv=surface.hair(u,.07+.86*k);
       return vertex('head',p,n,scaleTint(hair,.91+.08*cos(offset*3)),uv,
         {next:'hair',second:p,weight:clamp((k-.14)/.56)*(front?.65:1),style:2});
     }));
   }
   grid(rows);
 }
 for(const s of [-1,1]){
   lock(s,1.08,.583+.030*s,.020,s*.61,true);
   lock(s,1.51,.62+.035*s,.021,s*.60+1.73);

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
   loft({bone:lower,segments:14,tint:[.26,.28,.30],texture:surface.lining,
     rows:[[b-.048,.041,.043],[b-.034,.036,.038],[b-.016,.031,.031]]});
   // A curved patch on only the left sleeve and a short woven cuff facing
   // make Eva's side views read without enlarging the rig or its hands.
   if(s<0){
     const rings=[[.047,.067,.070],[.075,.066,.068],[.111,.063,.063],[.139,.061,.060]];
     grid(rings.map(([z,w,h],j)=>Array.from({length:7},(_,i)=>{
       const u=i/6,angle=-Math.PI/2+(u-.5)*1.22-.12;
       return vertex(upper,[sin(angle)*(w+.0015),cos(angle)*(h+.0015),z],
         unit([sin(angle),cos(angle),0]),[1,1,1],surface.badge(u,j/(rings.length-1)));
     })));
   }
   piping(lower,[[s*.055,.015,.066],[s*.054,.011,.095],[s*.052,.011,.142],
     [s*.047,.011,b-.061]],.0022,seamThread,4);
   loft({bone:hand,segments:12,tint:skin,rows:[
     [-.025,.024,.022],[0,.029,.022],[.024,.032,.021,.002],[.051,.025,.015,.002],[.065,.010,.010,.001],[.067,.003,.005]]});
   sphere(hand,[-s*.025,.009,.027],[.012,.014,.029],skin,0,8);
   loft({bone:thigh,segments:16,tint:denim,texture:surface.denim,rows:[
     [-.066,.073,.091],[0,.079,.092],[.083,.080,.095],[.174,.072,.081],[.286,.062,.066],
     [c-.043,.051,.054],[c,.052,.053,0,0,[shin,-c,.50]]]});
   loft({bone:shin,segments:14,tint:denim,texture:surface.denim,rows:[
     [0,.052,.053,0,0,[thigh,c,.50]],[.036,.050,.052,0,0,[thigh,c,.18]],
     [.095,.055,.059],[.158,.054,.058],[.248,.043,.046],[d-.050,.041,.043],[d-.025,.044,.045],[d-.012,.039,.040]]});
   for(const [leg,profile] of [[thigh,[[.045,.081],[.09,.081],[.174,.073],[.284,.063],[c-.05,.052]]],
       [shin,[[.048,.052],[.095,.056],[.158,.055],[.248,.044],[d-.045,.043]]]]){
     piping(leg,profile.map(([z,w])=>[s*w,.002,z]),.0023,honeyThread,5);
   }
   loft({bone:shin,segments:14,texture:surface.denim,tint:[1.20,1.22,1.19],
     rows:[[d-.055,.043,.045],[d-.049,.045,.047],[d-.029,.045,.047],[d-.025,.043,.045]]});
   // Low canvas sneakers have an inset tongue, a separate sole, and three
   // crossing laces. Foot Z is measured at the ankle, not the shoe base.
   loft({bone:foot,segments:18,tint:[.680,.515,.396],rows:[
     [-.064,.049,.101,.037],[-.056,.052,.107,.037],[-.043,.052,.107,.037]]});
   loft({bone:foot,segments:18,tint:[1.035,1.028,.998],texture:surface.canvas,rows:[
     [-.044,.051,.105,.037],[-.025,.050,.103,.035],[-.005,.047,.088,.023],
     [.019,.041,.054,.009],[.035,.036,.042,.002]]});
   plate(foot,[[-.020,.011,.040],[.020,.011,.040],[.029,.081,.003],[-.029,.081,.003]],zip);
   for(const flank of [-1,1]){
     plate(foot,[[flank*.050,.023,-.009],[flank*.051,.036,-.016],[flank*.045,.076,-.006],
       [flank*.046,.066,-.018],[flank*.050,.035,-.027],[flank*.049,.019,-.020]],selvedge);
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
export function evaModel(){return mesh=mesh??build();}
