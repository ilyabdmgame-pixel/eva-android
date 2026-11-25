import {wallShadow} from './lighting.mjs';
export const buildingEdge = 3.74;
const edge = buildingEdge;
const wallWidth = .18;
const wallHeight = 2.64;
const trim = [.64,.50,.38];
const bronze = [.90,.69,.39];
const entry = (at,width) => ({kind:'door',at,width,top:2.14});
const window = (at,width,id=252,bottom=.90,top=2.22) => ({kind:'window',at,width,id,bottom,top});

export const buildings = {
  home: {
    wall:[.72,.90,.85], shell:[.78,.87,.82], floor:[1,.91,.80], tile:'oak',
    roof:[.93,.96,1.00], material:'slate-roof', shape:'gable', light:[.25,-.55,2.31], sconce:-1.65,
    sides:[[window(-.25,1.66,7,1.02,2.27),entry(1.92,1.27)], [window(-.95,1.10)], [entry(.72,1.39)], [window(-.63,1.42)]]
  },
  school: {
    wall:[.82,.89,.98], shell:[.98,.88,.77], floor:[1.06,1.10,1.16], tile:'ceramic',
    roof:[.90,.95,.99], material:'zinc-roof', shape:'metal', light:[-.88,-.57,2.32], sconce:-.42,
    sides:[[window(-1.63,1.50),window(.84,1.50)], [entry(.08,1.42)], [window(-.95,1.48)], [entry(.03,1.48),window(-1.80,1.18),window(1.78,1.14)]]
  },
  shop: {
    wall:[.80,.91,.76], shell:[.70,.86,.67], floor:[1,.98,.81], tile:'oak',
    roof:[.94,1.00,.94], material:'copper-roof', shape:'hip', awning:[.44,.60,.48], light:[.08,-1.10,2.30], sconce:-.12,
    sides:[[window(-1.39,1.31),entry(1.94,1.38)], [entry(1.13,1.43),window(-1.05,1.63)], [window(-.51,1.59)], [window(-.15,1.78)]]
  },
  cafe: {
    wall:[1,.78,.73], shell:[.95,.79,.75], floor:[.99,.91,1.08], tile:'ceramic',
    roof:[1.00,.93,.88], material:'clay-roof', shape:'hip', awning:[.66,.36,.34], light:[-.99,-.56,2.25], sconce:-.08,
    sides:[[window(-1.31,1.62),entry(1.88,1.34)], [window(-.95,1.42)], [entry(.39,1.38),window(1.82,.98)], [window(-.77,1.73)]]
  }
};
buildings.courtyard={...buildings.home,roof:[.83,.94,.80],material:'copper-roof',shape:'hip',sides:[[entry(0,1.4),window(2.1,1.4)],[window(-1.4,1.6)],[entry(1.8,1.4)],[window(-1.1,1.6)]]};
buildings.terrace={...buildings.cafe,roof:[.87,.84,.78],shape:'gable',sides:[[entry(-1,1.4),window(1.8,1.5)],[window(.55,1.35)],[entry(.8,1.4)],[window(-1.4,1.2)]]};
export const partitions={courtyard:[.75],terrace:[-1.58,.99]};
const sides = [
  {cross:-edge,vertical:false,sign:-1}, {cross:-edge,vertical:true,sign:-1},
  {cross:edge,vertical:true,sign:1}, {cross:edge,vertical:false,sign:1}
];
const withMargin = (value,at,size,margin) => Math.abs(value-at)<size/2+margin;
// Each roof is a shell with a real underside, fascia and capped ridge.
export function drawRoof(renderer, plot, spec){
  const {u,v,w,d,z,rise,hip,colour}=spec;
  const material=spec.material??'slate-roof';
  const ridge=Math.max(.12,w-hip),top=z+rise;
  const at=([x,y,h])=>spec.turn?[plot.u+u+y,plot.v+v+x,h]:[plot.u+u+x,plot.v+v+y,h];
  const panel=(points,shade,mat=material)=>renderer.panel(points.map(at),shade,mat,251);
  const tone=n=>colour.map(x=>x*n);
  for(const side of [-1,1]){
    const y=side*d,cap=side*.07;
    panel([[-w,y,z],[w,y,z],[ridge,0,top],[-ridge,0,top]],tone(side>0?1.08:.94));
    panel([[-w,y,z],[w,y,z],[w,y,z-.095],[-w,y,z-.095]],tone(.59),'oak');
    panel([[-ridge,0,top+.05],[ridge,0,top+.05],[ridge,cap,top+.006],[-ridge,cap,top+.006]],tone(1.18),'asphalt');
    if(hip){
      const x=side*w,peak=side*ridge;
      panel([[x,-d,z],[x,d,z],[peak,0,top],[peak,0,top]],tone(side>0?1.01:.81));
      for(const back of [-1,1]){
        const edge=back*d;
        panel([[x,edge,z+.021],[x-side*.085,edge,z+.021],[peak-side*.055,0,top+.024],[peak,0,top+.024]],tone(1.14),'asphalt');
      }
    }else{
      const x=side*w;
      panel([[x,-d,z],[x,d,z],[x,0,top],[x,0,top]],spec.gable||[.73,.68,.59],'plaster');
      const fascia=x+side*.015;
      for(const back of [-1,1])panel([[fascia,back*d,z],[fascia,0,top],[fascia,0,top-.09],[fascia,back*d,z-.09]],tone(.70),'oak');
    }
    panel([[side*w,-d,z],[side*w,d,z],[side*w,d,z-.095],[side*w,-d,z-.095]],tone(.60),'oak');
    if(spec.metal)for(let x=-ridge+.22;x<ridge-.08;x+=.45){
      panel([[x,y,z+.009],[x+.022,y,z+.009],[x+.022,0,top+.009],[x,0,top+.009]],tone(1.28),'asphalt');
    }
  }
  panel([[-w,-d,z-.096],[w,-d,z-.096],[w,d,z-.096],[-w,d,z-.096]],tone(.57),'oak');
}

export function insideBuilding(plot,u,v,margin=0) {
  if(plot?.theme==='lane'){
    const x=u-plot.u,y=v-plot.v;
    return x>postOffice.u-margin&&x<postOffice.u+postOffice.w+margin&&y>postOffice.v-margin&&y<postOffice.v+postOffice.d+margin;
  }
  const limit=edge+margin;
  return Boolean(buildings[plot?.theme])&&Math.abs(u-plot.u)<limit&&Math.abs(v-plot.v)<limit;
}

export function wallAt(theme,u,v) {
  const building=buildings[theme];
  if(!building)return false;
  if(v>=-edge&&v<-.57&&(partitions[theme]||[]).some(x=>Math.abs(u-x)<.19))return true;
  return sides.some(({cross,vertical},index)=>{
    const along=vertical?v:u,across=vertical?u:v;
    if(!withMargin(across,cross,wallWidth,.11)||Math.abs(along)>edge+.16)return false;
    return !building.sides[index].some(o=>o.kind==='door'&&Math.abs(along-o.at)<o.width/2-.11);
  });
}

export function drawBuilding(renderer,plot,climate,windowOpen) {
  const building=buildings[plot.theme];
  if(!building)return;
  const {wall,shell,floor,tile,shape,roof,awning}=building;
  const box=(id,u,v,z,a,b,h,tint,mat)=>renderer.box(id,{u:plot.u+u,v:plot.v+v,z},a,b,h,tint,mat);
  const face=(points,tint,mat)=>renderer.panel(points.map(([u,v,z])=>[u+plot.u,v+plot.v,z]),tint,mat,251);

  const shadeBand=(points,contact)=>renderer.shadeBand(points.map(([u,v,z])=>[plot.u+u,plot.v+v,z]),contact);
  const e=edge+.09;
  wallShadow(renderer,plot.u-e,plot.v-e,2*e,2*e,wallHeight+.125);

  for(const x of partitions[plot.theme]||[]){
    box(251,x-.067,-edge+.10,.020,.134,edge-.80,2.30,wall,'plaster');
    box(251,x-.082,-edge+.10,2.32,.164,edge-.80,.046,trim,'oak');
  }
  for(const [index,side] of sides.entries()){
    const drawSide=()=>{
    const {cross,vertical,sign}=side;
    const height=wallHeight;
    const half=wallWidth/2;
    const startOfWall=-edge+(vertical?half:-half);
    const endOfWall=edge+(vertical?-half:half);
    function band(id,a,b,z,h,tint,mat,width=wallWidth,offset=0) {
      if(b<=a||h<=0)return;
      const crossStart=cross-width/2+offset*sign;
      if(vertical)box(id,crossStart,a,z,width,b-a,h,tint,mat);
      else box(id,a,crossStart,z,b-a,width,h,tint,mat);
    }
    function segment(a,b,z,h) {
      if(b<=a||h<=0)return;
      band(251,a,b,z,h,wall,'plaster');
      const outer=cross+sign*(half+.004);
      const point=(along,height)=>vertical?[outer,along,height]:[along,outer,height];
      const shade=vertical?(sign>0?.96:.74):(sign>0?.90:.70);
      face([point(a,z+h),point(b,z+h),point(b,z),point(a,z)],shell.map(c=>c*shade),'facade');
      if(z===0 && h>.35){
        const inward=(along,d)=>vertical?[cross-sign*d,along,.026]:[along,cross-sign*d,.026];
        shadeBand([inward(a,.09),inward(b,.09),inward(b,.34),inward(a,.34)],true);
        const plinth=(along,height)=>vertical?[outer+sign*.014,along,height]:[along,outer+sign*.014,height];
        face([plinth(a,.26),plinth(b,.26),plinth(b,.015),plinth(a,.015)],[.71,.70,.65],'slate');
      }
    }
    function base(a,b) {
      if(b<=a)return;
      const across=cross-sign*(half+.018);
      const point=(along,z)=>vertical?[across,along,z]:[along,across,z];
      face([point(a,.11),point(b,.11),point(b,.005),point(a,.005)],trim,'oak');
    }
    let from=startOfWall;
    for(const hole of [...building.sides[index]].sort((a,b)=>a.at-b.at)){
      const a=hole.at-hole.width/2,b=hole.at+hole.width/2;
      segment(from,a,0,height);
      base(from,a);
      if(hole.kind==='door'){
        band(0,a-.03,b+.03,.006,.018,[1.10,.92,.69],'slate',.52);
          band(251,a,a+.052,0,hole.top,trim,'oak',.23);
          band(251,b-.052,b,0,hole.top,trim,'oak',.23);
          band(251,a,b,hole.top,.075,trim,'oak',.23);
          segment(a,b,hole.top+.075,height-hole.top-.075);
          band(251,a+.13,b-.13,2.27,.135,[.60,.50,.32],'oak',.10,.13);
          band(251,a+.23,b-.23,2.30,.030,bronze,'glow',.12,.16);
          if((plot.theme==='shop'&&index===1)||(plot.theme==='cafe'&&index===0)){
            const mount=(along,out,z)=>vertical?[cross+sign*out,along,z]:[along,cross+sign*out,z];
            for(let x=0;x<7;x++){
              const start=a-.23+x*(hole.width+.46)/7,end=a-.23+(x+1)*(hole.width+.46)/7;
              const tint=x%2?awning:[.94,.82,.63];
              face([mount(start,.085,2.49),mount(end,.085,2.49),mount(end,.69,2.18),mount(start,.69,2.18)],tint);
              band(251,start,end,2.10,.08,tint,undefined,.035,.68);
            }
          }
      }else{
        segment(a,b,0,Math.min(height,hole.bottom-.065));
        base(a,b);
          segment(a,b,hole.top,height-hole.top);
          band(hole.id,a-.06,b+.06,hole.bottom-.065,.065,trim,'oak',.30);
          band(hole.id,a-.05,b+.05,hole.top,.062,trim,'oak',.19);
          for(const [left,right] of [[a,a+.042],[hole.at-.025,hole.at+.025],[b-.042,b]])
            band(hole.id,left,right,hole.bottom,hole.top-hole.bottom,trim,'oak',.16);
          const open=hole.id===7&&windowOpen;
          const glass=climate.daylight<.65?[.89,.67,.36]:[.28,.43,.52];
          const mat=climate.daylight<.65?'glow':'glass';
          for(const [left,right] of [[a+.042,hole.at-.025],[hole.at+.025,b-.042]]){
            const bottom=open?hole.bottom+.31:hole.bottom;
            const middle=(bottom+hole.top)*.5;
            band(hole.id,left,right,bottom+.028,middle-bottom-.028,glass,mat,.038);
            band(hole.id,left,right,middle+.025,hole.top-middle-.025,glass,mat,.038);
            // Reflected sky breaks up the flat glazing while the timber mullions stay in front.
            const pane=(x,z)=>vertical?[cross+sign*.022,x,z]:[x,cross+sign*.022,z];
            if(mat!=='glow'){
              const delta=(right-left)*.22;
              renderer.panel([pane(left,middle+.09),pane(left+delta,middle+.09),pane(right,hole.top-.09),pane(right-delta,hole.top-.09)].map(([u,v,z])=>[u+plot.u,v+plot.v,z]),[.41,.57,.63],undefined,hole.id);
            }
            band(hole.id,left,right,middle,.025,trim,'oak',.102);
            band(hole.id,left,right,bottom,.028,trim,'oak',.10);
          }
      }
      from=b;
    }
    segment(from,endOfWall,0,height);
    base(from,endOfWall);
    const capStart=-edge+(vertical?.115:-.115),capEnd=-capStart;
    band(251,capStart,capEnd,height,.055,trim,'oak',.23);
    };
    if(climate.occupied&&index<2)renderer.structure(drawSide,false);else drawSide();
  }
  const metal=shape==='metal';
  const cover=()=>drawRoof(renderer,plot,{u:0,v:0,w:edge+.23,d:edge+.25,z:wallHeight+.125,rise:metal?.68:shape==='gable'?1.26:1.02,
    hip:shape==='hip'?(plot.theme==='shop'?1.24:1.85):0,turn:plot.theme==='home'||plot.theme==='shop',
    colour:roof,material:building.material,gable:shell,metal});
  if(climate.occupied)renderer.structure(cover,"roof");else cover();
  if(plot.theme==='home'){
    box(251,.89,-1.55,wallHeight+.55,.34,.36,.77,[.80,.64,.53],'facade');
    box(251,.85,-1.59,wallHeight+1.32,.42,.44,.09,[.50,.48,.47],'asphalt');
    const [a,b,c,d]=[-.76,.92,.20,2.14];
    renderer.artPanel([[a,c,.024],[b,c,.024],[b,d,.024],[a,d,.024]].map(([u,v,z])=>[u+plot.u,v+plot.v,z]),'attic-rug');
  }
}

// A door stays attached to the same hinge in the full and cutaway views.
export const postOffice={u:-3.35,v:-4.16,w:6.25,d:3.18,entry:.35};
export function postWall(x,y){
 const {u,v,w,d,entry}=postOffice,gap=.12,t=.14;
 if(x<u-gap||x>u+w+gap||y<v-gap||y>v+d+gap)return false;
 if(y<v+t+gap||x<u+t+gap||x>u+w-t-gap)return true;
 return y>v+d-t-gap&&Math.abs(x-entry)>.52-gap;
}
export function doorsFor(plots){
  const doors=[];
  for(const plot of plots){
    function add(u,v,vertical,sign,width,residence=false){
      doors.push({id:230+doors.length,u:plot.u+u,v:plot.v+v,vertical,sign,width:width-.020,residence,sector:plot.key});
    }
    if(plot.key==='lane')add(postOffice.entry,postOffice.v+postOffice.d,false,1,1.04,true);
    for(const [index,holes] of (buildings[plot.theme]?.sides??[]).entries()){
      const {vertical,cross,sign}=sides[index];
      for(const hole of holes.filter(h=>h.kind==='door')){
        add(vertical?cross:hole.at,vertical?hole.at:cross,vertical,sign,hole.width-.104);
      }
    }
  }
  return doors;
}
export const doorHalfThickness=.046;
export function drawDoor(renderer,door,amount,height=2.13){
  const {u,v,width,vertical,sign,id}=door;
  const angle=amount*Math.PI*.49;
  function point(along,z,offset=0){
    const a=-width/2+Math.cos(angle)*along+offset*Math.sin(angle);
    const b=sign*(Math.sin(angle)*along-offset*Math.cos(angle));
    return vertical?[u+b,v+a,z]:[u+a,v+b,z];
  }
  function face(left,right,bottom,top,offset,shade,material){
    if(bottom>=height)return;
    top=Math.min(height,top);
    renderer.panel([point(left,top,offset),point(right,top,offset),point(right,bottom,offset),point(left,bottom,offset)],shade,material,id);
  }
  for(const side of [-1,1]){
    face(0,width,.025,2.13,side*doorHalfThickness,[.69,.54,.40],'oak');
    face(.13,width-.13,.17,.64,side*(doorHalfThickness+.008),[.81,.66,.50],'oak');
    face(.13,width-.13,.89,1.90,side*(doorHalfThickness+.007),[.72,.83,.84],'glass');
    face(width-.21,width-.06,.78,.83,side*(doorHalfThickness+.039),bronze);
  }
  const t=doorHalfThickness;
  for(const end of [0,width])renderer.panel([point(end,height,-t),point(end,height,t),point(end,.025,t),point(end,.025,-t)],trim,'oak',id);
  renderer.panel([point(0,height,-t),point(width,height,-t),point(width,height,t),point(0,height,t)],trim,'oak',id);
}
