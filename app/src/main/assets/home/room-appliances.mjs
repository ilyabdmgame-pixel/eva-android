import {fixtureFrame,finish as f} from './room-mesh.mjs';

const dark=[.22,.245,.266], enamel=[.755,.833,.772], inner=[.347,.399,.407];

export function kitchenWorkPoint(o){
  if(o?.kind!=='stove'&&o?.kind!=='basin')return null;
  const {point,width,depth}=fixtureFrame(o);
  // The left front hob is free to cook on. The plate is washed inside the sink.
  return o.kind==='stove'?point(width*.28,depth*.73,.848):point(width*.35,depth*.67,.872);
}

function fridgeDoorPoint(depth,stage){
  const angle=stage*Math.PI*.43,hx=Math.cos(angle),hy=Math.sin(angle);
  return (across,forward,z)=>[.014+across*hx-forward*hy,depth-.008+across*hy+forward*hx,z];
}

export function fridgeHandle(o,stage){
  const {point,width,depth}=fixtureFrame(o);
  const handle=fridgeDoorPoint(depth,stage)((width-.026)*.86,.079,.961);
  return point(...handle);
}

export function fridgeDoorPlane(o,stage){
  const {point,depth}=fixtureFrame(o),local=fridgeDoorPoint(depth,stage);
  const hinge=point(...local(0,0,0)),front=point(...local(0,1,0));
  return {origin:hinge,normal:front.map((v,i)=>v-hinge[i])};
}

// Step towards the hinge as the free end swings out. Keeping the original
// entrance point makes reversing the door or interrupting an inspection safe.
export function fridgeVisit(o,visitor,stage,clear){
  const frame=fixtureFrame(o),start=frame.local([visitor.u,visitor.v,visitor.z??0]);
  const target=frame.point(start[0]-.59,start[1]+.043,start[2]);
  const to={u:target[0],v:target[1],z:target[2]};
  if(start[1]<frame.depth+.12||start[1]>frame.depth+.55||!clear(visitor,to))return {at:visitor};
  const ratio=Math.sin(stage*Math.PI*.43)/Math.sin(Math.PI*.43);
  const vector=[to.u-visitor.u,to.v-visitor.v,0];
  return {at:{u:visitor.u+vector[0]*ratio,v:visitor.v+vector[1]*ratio,z:visitor.z??0},
    stepAside:{ratio,vector,lead:o.turned?'right':'left'}};
}

function feet(m) {
  for(const x of [.078,m.width-.078])for(const y of [.060,m.depth-.06]){
    m.vessel(x,y,[[.002,.028],[.068,.031]],dark,8);
  }
}

function stove(m,o,s) {
  const {width:w,depth:d}=m;
  feet(m);
  m.cushion(.016,.021,.063,w-.032,d-.042,.737,.032,enamel);
  m.cushion(0,-.003,.79,w,d,.046,.028,f.steel);
  m.cushion(.014,.015,.824,w-.028,.048,.084,.015,f.cream);
  m.cushion(.043,d-.021,.163,w-.086,.035,.371,.019,f.ink);
  m.cushion(.071,d+.011,.192,w-.142,.011,.301,.010,[.322,.338,.349]);
  m.box(.118,d+.023,.403,w*.31,.004,.009,[.479,.487,.483]);
  m.rod([.07,d+.039,.572],[w-.07,d+.039,.572],.016,.016,dark);
  for(let i=0;i<4;i++){
    const x=w*(.145+.225*i);
    m.rod([x,d-.005,.687],[x,d+.022,.687],.028,.025,dark);
    m.box(x-.003,d+.022,.692,.006,.003,.012,f.cream);
  }
  for(const x of [w*.28,w*.73])for(const y of [d*.28,d*.73]){
    const radius=y>d*.5?.099:.083;
    m.vessel(x,y,[[.834,radius],[.842,radius]],dark,14);
    m.vessel(x,y,[[.842,radius*.68],[.845,radius*.68]],f.steel,14);
    m.vessel(x,y,[[.845,radius*.58],[.848,radius*.58]],dark,14);
    if(x>w*.5&&y>d*.5&&!s.kettleInHand){
      m.vessel(x,y,[[.850,.064],[.872,.094],[.945,.104],[.996,.083],[1.011,.061]],f.mint);
      m.vessel(x,y,[[1.011,.059],[1.022,.047],[1.03,.016]],f.brass);
      m.rod([x-.077,y,.929],[x-.137,y,.984],.022,.016,f.mint);
      let last=[x-.070,y,1.0];
      for(let i=1;i<=8;i++){
        const a=i*Math.PI/8,at=[x-.070*Math.cos(a),y,1+.076*Math.sin(a)];
        m.rod(last,at,.010,.010,dark,6);last=at;
      }
    }
  }
}

function basin(m,o,s) {
  const {width:w,depth:d}=m,h=.90;
  m.box(.046,.035,.011,w-.092,d-.064,.120,dark,'oak');
  m.cushion(.010,.015,.105,w-.02,d-.03,h-.142,.020,f.mint);
  for(const x of [.023,w*.51]){
    m.cushion(x,d-.030,.157,w*.46,.033,.608,.011,enamel);
    m.rod([x+w*.35,d+.007,.592],[x+w*.35,d+.007,.700],.009,.009,f.brass);
  }
  const left=w*.075,right=w*.62,back=d*.16,front=d*.86;
  m.box(-.008,-.004,h-.045,left+.008,d+.008,.045,f.cream);
  m.box(right,-.004,h-.045,w-right+.008,d+.008,.045,f.cream);
  m.box(left,-.004,h-.045,right-left,back+.004,.045,f.cream);
  m.box(left,front,h-.045,right-left,d-front+.004,.045,f.cream);
  const outer=[[left,back,h],[right,back,h],[right,front,h],[left,front,h]];
  const bottom=[[left+.053,back+.05,h-.115],[right-.053,back+.05,h-.115],
    [right-.053,front-.05,h-.115],[left+.053,front-.05,h-.115]];
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    m.face([outer[i],outer[j],bottom[j],bottom[i]],f.steel,null,false);
  }
  m.face(bottom,f.steel,null,false);
  const cx=(left+right)*.5,cy=(front+back)*.5;
  m.vessel(cx,cy,[[h-.114,.020],[h-.111,.020]],dark,9);
  for(let i=0;i<5;i++)m.box(right+.025+i*w*.061,back,h+.001,.008,front-back,.007,f.steel);
  const x=w*.39,y=d*.085;
  m.rod([x,y,h],[x,y,h+.20],.014,.014,f.steel);
  let previous=[x,y,h+.20];
  for(let i=1;i<=8;i++){
    const a=i*Math.PI/8,next=[x,y+.072*(1-Math.cos(a)),h+.20+.062*Math.sin(a)];
    m.rod(previous,next,.013,.012,f.steel);previous=next;
  }
  m.rod(previous,[x,previous[1],h+.168],.012,.016,f.steel);
  if(s.stage>.08){
    m.rod([x,previous[1],h+.167],[x,previous[1],h-.097],.004,.004,[.637,.827,.864],5);
    m.vessel(cx,cy,[[h-.102,.079,.057],[h-.098,.082,.058]],[.614,.760,.773],14);
  }
}

function fridge(m,o,s) {
  const {width:w,depth:d}=m;
  feet(m);
  const tint=[.688,.806,.727],top=1.66;
  m.cushion(.008,0,.061,w-.016,d-.024,top-.061,.043,tint);
  m.box(.038,d-.029,.108,w-.076,.012,top-.182,inner);
  for(const z of [.176,.512,.955,1.252]){
    m.box(.071,d-.025,z,w-.142,.025,.019,f.cream);
    for(let i=0;i<3;i++){
      const x=.120+i*w*.223,jar=.039+(i%2)*.009;
      m.vessel(x,d-.003,[[z+.019,jar],[z+.096,jar],[z+.113,jar*.86]],i%2?f.burgundy:f.mint,8);
    }
  }
  const p=fridgeDoorPoint(d,s.stage);
  function door(bottom,upper,open){
    if(!open){
      m.cushion(.012,d-.018,bottom,w-.024,.057,upper-bottom,.021,tint);
      m.rod([w*.86,d+.057,bottom+.065],[w*.86,d+.057,bottom+.177],.013,.013,f.steel);
      return;
    }
    const span=w-.026,thick=.043;
    m.face([p(0,0,bottom),p(span,0,bottom),p(span,0,upper),p(0,0,upper)],f.porcelain,null,false);
    m.face([p(0,thick,bottom),p(0,thick,upper),p(span,thick,upper),p(span,thick,bottom)],tint,null,false);
    m.face([p(0,0,upper),p(span,0,upper),p(span,thick,upper),p(0,thick,upper)],f.cream,null,false);
    m.face([p(span,0,bottom),p(span,thick,bottom),p(span,thick,upper),p(span,0,upper)],f.mint,null,false);
    const a=bottom+.168,b=bottom+.415;
    for(const z of [a,b])m.rod(p(span*.86,thick,z),p(span*.86,.079,z),.011,.011,f.steel);
    m.rod(p(span*.86,.079,a),p(span*.86,.079,b),.012,.012,f.steel);
    for(const [u,v,z,color] of [[.23,.13,1.31,f.rose],[.66,.09,1.43,f.edge]]){
      m.face([p(w*u,thick+.002,z),p(w*(u+v),thick+.002,z),p(w*(u+v),thick+.002,z+.089),p(w*u,thick+.002,z+.089)],color,null,false);
    }
  }
  door(.084,.548,false);door(.565,top-.019,true);
}

function toilet(m) {
  const {width:w,depth:d}=m,x=w/2;
  m.cushion(.028,.003,.365,w-.056,d*.28,.413,.032,f.porcelain);
  m.cushion(.020,0,.766,w-.04,d*.30,.025,.018,f.cream);
  m.vessel(w*.68,d*.14,[[.791,.023,.013],[.795,.023,.013]],f.steel,10);
  m.vessel(x,d*.60,[[.006,w*.215,d*.166],[.056,w*.238,d*.179],[.17,w*.192,d*.162],
    [.28,w*.307,d*.264],[.353,w*.413,d*.319],[.386,w*.428,d*.315]],f.porcelain,20);
  m.vessel(x,d*.60,[[.384,w*.433,d*.324],[.410,w*.442,d*.324]],f.cream,20);
  m.vessel(x,d*.619,[[.411,w*.309,d*.228],[.413,w*.309,d*.228]],[.637,.707,.688],18);
  m.vessel(x,d*.632,[[.414,w*.202,d*.132],[.415,w*.202,d*.132]],[.731,.805,.789],16);
}

function shower(m) {
  const {width:w,depth:d}=m,h=1.95;
  m.cushion(.006,.007,0,w-.012,d-.014,.118,.045,f.porcelain);
  m.cushion(.047,.045,.115,w-.094,d-.09,.009,.034,f.steel);
  m.vessel(w*.28,d*.24,[[.125,.026],[.127,.026]],dark,10);
  for(const [x,y] of [[.035,.035],[w-.035,.035],[.035,d-.035],[w-.035,d-.035]]){
    m.box(x-.012,y-.012,.10,.024,.024,h-.10,f.steel);
  }
  for(const z of [.166,h-.041]){
    m.box(.032,.023,z,w-.064,.031,.027,f.steel);
    m.box(.024,.033,z,.031,d-.066,.027,f.steel);
    m.box(w-.050,.032,z,.026,d-.064,.023,f.steel);
    m.box(.032,d-.049,z,w-.064,.026,.023,f.steel);
  }
  // The two back panes have a blue edge. Leave the clear entry transparent so the shower hardware reads in depth.
  m.face([[.038,.031,.178],[w-.038,.031,.178],[w-.038,.031,h-.044],[.038,.031,h-.044]],[.566,.697,.725],null,false);
  m.face([[.033,.038,.178],[.033,.038,h-.044],[.033,d-.038,h-.044],[.033,d-.038,.178]],[.507,.637,.672],null,false);
  for(let i=0;i<4;i++){
    const x=w*(.15+i*.20);
    m.box(x,.036,.21,.004,.004,h-.302,[.644,.747,.747]);
  }
  m.rod([w*.60,.078,.73],[w*.60,.078,1.69],.019,.017,f.steel);
  m.rod([w*.60,.078,1.69],[w*.60,.212,1.75],.017,.017,f.steel);
  m.rod([w*.60,.212,1.74],[w*.60,.258,1.699],.042,.062,f.steel);
  m.box(w*.36,.056,.723,w*.30,.061,.039,f.steel);
  m.box(w-.067,d*.57,.790,.024,.104,.018,f.steel);
  for(const [x,c] of [[w*.18,f.mint],[w*.28,f.rose]]){
    m.vessel(x,.092,[[.126,.024],[.219,.024],[.233,.014]],c,8);
  }
}

function screen(m,o,s){
  const {width:w,depth:d}=m,h=1.51;
  const offsets=[0,.81,.15,.76].map(fold=>.015+fold*d*(1-s.stage*.46));
  for(let i=0;i<3;i++){
    const a=w*i/3,b=w*(i+1)/3,x=[a,offsets[i]],y=[b,offsets[i+1]];
    m.rod([...x,.012],[...x,h],.017,.017,f.oak);
    m.rod([...x,.173],[...y,.173],.015,.015,f.oak);
    m.rod([...x,h-.020],[...y,h-.020],.015,.015,f.oak);
    m.face([[...x,.19],[...y,.19],[...y,1.47],[...x,1.47]],i%2?f.linen:f.cream,'cloth',false);
    m.rod([...x,1.23],[...y,1.23],.006,.006,f.oak);
  }
  m.rod([w,offsets[3],.012],[w,offsets[3],h],.017,.017,f.oak);
}

export const applianceModels={stove,basin,fridge,toilet,shower,screen};
