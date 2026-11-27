import {roomMesh, finish as f} from './room-mesh.mjs';
import {applianceModels} from './room-appliances.mjs';

const ink=f.ink, timber=f.walnut, oak=f.oak, brass=f.brass;
const bindings=[f.mint,f.burgundy,f.blue,f.edge,f.plum,f.moss];
const idOf=o=>o.model??o.id;

// These heights are shared by the visible mesh, attached objects, hands and resting poses.
export function roomSurface(o) {
  if(o.kind==='bed')return .57;
  if(o.kind==='chair'||o.kind==='streamChair')return o.seatHeight??.48;
  if(idOf(o)===1)return .80;
  return o.surfaceHeight??null;
}

function legs(m,width,depth,top,inset=.045) {
  for(const x of [inset,width-inset])for(const y of [inset,depth-inset]){
    m.rod([x,y,.005],[x,y,top],.024,.037,timber);
    m.vessel(x,y,[[.001,.024],[.023,.026]],f.brass,8);
  }
}

function table(m,o,s) {
  const {width:w,depth:d}=m,top=roomSurface(o)??.755;
  legs(m,w,d,top-.054);
  m.box(.035,.028,top-.135,w-.07,.045,.095,timber,'oak');
  m.box(.034,.065,top-.135,.045,d-.13,.096,timber,'oak');
  m.cushion(-.009,-.008,top-.057,w+.018,d+.016,.057,.029,f.edge,'oak');
  if(idOf(o)===1||s.drawer){
    const a=w*.43,span=w*.48,y=d-.32+.18*s.drawer;
    m.box(a,y,top-.188,span,.32,.123,timber,'oak');
    m.cushion(a-.008,y+.304,top-.19,span+.016,.028,.126,.014,oak,'oak');
    m.rod([a+span*.37,y+.346,top-.121],[a+span*.61,y+.346,top-.121],.012,.012,brass);
  }
}

function coffeeTable(m){
  const {width:w,depth:d}=m,top=.436;
  legs(m,w,d,top-.049,.050);
  m.cushion(.040,.039,.172,w-.080,d-.078,.036,.024,timber,'oak');
  m.cushion(-.012,-.009,top-.052,w+.024,d+.018,.052,.044,f.edge,'oak');
  m.cushion(w*.11,d*.30,top+.001,.222,.158,.026,.008,f.blue,'cloth');
  m.box(w*.11+.008,d*.30+.008,top+.009,.209,.148,.011,f.linen);
  m.box(w*.11+.018,d*.30+.033,top+.029,.093,.016,.003,f.cream);
  m.vessel(w*.72,d*.46,[[top+.001,.063],[top+.009,.063]],oak,14);
  m.vessel(w*.72,d*.46,[[top+.010,.029],[top+.015,.034],[top+.065,.039],[top+.068,.036],[top+.064,.030]],f.mint,14);
  m.vessel(w*.72,d*.46,[[top+.061,.030],[top+.062,.031]],f.walnut,14);
}

function stationChair(m,o) {
  const {width:w,depth:d}=m;
  const office=o.kind==='streamChair';
  const soft=idOf(o)===81||idOf(o)===703, pouf=idOf(o)===704, bench=[12,91].includes(idOf(o));
  const top=roomSurface(o),color=office?f.plum:soft?f.burgundy:pouf?f.mint:bench?oak:f.rose;
  if(office){
    m.vessel(w*.5,d*.5,[[.06,.038],[.11,.052],[top-.070,.038]],f.steel);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*.4,end=[w*.5+Math.cos(a)*w*.45,d*.5+Math.sin(a)*d*.45,.059];
      m.rod([w*.5,d*.5,.102],end,.024,.019,ink);
      m.vessel(end[0],end[1],[[.003,.018],[.030,.027],[.060,.019]],ink,8);
    }
  }else legs(m,w,d,soft?.19:top-.06,soft?.071:.039);
  if(soft||pouf)m.cushion(.012,.017,soft?.14:.095,w-.024,d-.034,top-(soft?.14:.095)-.058,.057,color,'cloth');
  if(soft&&w>1){
    for(const x of [.067,w*.5+.004])
      m.cushion(x,.084,top-.082,w*.5-.073,d-.104,.082,.059,f.rose,'cloth');
  }else m.cushion(.012,.014,top-.065,w-.024,d-.028,.065,Math.min(.059,w*.11),color,bench?'oak':'cloth');
  if(pouf)return;
  const backY=office?d-.075:0;
  const backHeight=office?.43:soft?.43:bench?.32:.36;
  for(const x of [.052,w-.052]) m.rod([x,backY+.029,top-.027],[x,backY+.029,top+backHeight],.023,.024,timber);
  m.backrest(.012,backY,top+(soft?.004:.09),w-.024,soft?.116:.074,backHeight-(soft?.004:.09),
    office?.105:-.090,soft?.081:.057,color,bench?'oak':'cloth');
  if(!bench){
    const y=office?backY-.003:backY+(soft?.112:.070)-.025;
    for(const x of [w*.29,w*.70]){
      m.rod([x,y,top+.28],[x,y+(office?-.009:.009),top+.28],.009,.008,office?f.rose:f.plum,7);
    }
  }
  if(soft){
    for(const x of [0,w-.083]){
      m.cushion(x,.031,top-.035,.083,d-.052,.105,.031,color,'cloth');
      m.rod([x+.040,.088,top+.072],[x+.040,d-.069,top+.072],.049,.046,color,12);
    }
    if(w>1){
      for(const x of [w*.26,w*.72]){
        m.backrest(x-w*.17,.099,top+.012,w*.34,.116,.252,-.20,.073,x<w*.5?f.rose:f.linen);
      }
      m.box(w*.50,.12,top+.002,.008,d-.17,.003,f.plum);
    }
  }else if(office){
    for(const x of [.025,w-.025]){
      m.rod([x,d*.60,top-.069],[x,d*.60,top+.097],.013,.013,ink);
      m.cushion(x-.024,d*.29,top+.086,.048,d*.43,.032,.013,ink);
    }
    m.cushion(w*.19,d-.089,top+.359,w*.62,.071,.059,.022,f.rose,'cloth');
  }
}

function bed(m,o) {
  const {width:w,depth:d}=m,top=roomSurface(o);
  legs(m,w,d,.32,.059);
  m.cushion(.006,.018,.25,w-.012,d-.036,.132,.019,timber,'oak');
  m.box(.031,.023,.353,w-.062,d-.045,.037,oak,'oak');
  m.cushion(.028,.057,.382,w-.056,d-.091,top-.382,.047,f.linen,'cloth');
  m.cushion(.037,.063,top-.065,w-.074,d-.107,.014,.034,f.cream,'cloth');
  m.backrest(.015,.021,.312,w-.030,.081,.575,-.041,.066,oak,'oak');
  for(const x of [.068,w*.5,w-.084])m.box(x,.086,.54,.015,.011,.284,f.edge,'oak');
  for(const x of [.021,w-.052])m.box(x,d-.055,.267,.032,.036,.124,brass);
}

function vinylShelf(m,o) {
  const {width:w,depth:d}=m,top=roomSurface(o)??1.31;
  const plank=.041;
  m.box(.022,.018,.005,w-.044,d-.036,.087,timber,'oak');
  m.box(0,0,.067,plank,d,top-.067,oak,'oak');
  m.box(w-plank,0,.067,plank,d,top-.067,oak,'oak');
  m.box(plank,.018,.083,w-2*plank,.027,top-.104,timber,'oak');
  const shelves=[.08,.08+(top-.08)*.35,.08+(top-.08)*.69,top-plank];
  for(const z of shelves)m.box(.01,.002,z,w-.02,d,plank,oak,'oak');
  for(let row=0;row<3;row++){
    const base=shelves[row]+plank;
    let x=.072+row*.021;
    for(let i=0;i<(row===1?5:11)&&x<w-.075;i++){
      const thick=.036+(i*7%9)*.0038;
      const h=Math.min(shelves[row+1]-base-.025,.188+(i*13%15)*.009);
      const front=d-.026-(i*3%5)*.009;
      m.box(x,front-d*.65,base,thick,d*.65,h,bindings[(i+row*2)%bindings.length]);
      m.box(x+.005,front+.001,base+h*.73,thick-.010,.004,.007,f.cream);
      if(i%2===0)m.box(x+.006,front+.001,base+.026,thick-.012,.004,.004,f.brass);
      x+=thick+.005;
    }
    if(row===1&&x<w-.21){
      m.cushion(w-.35,d*.25,base,.26,d*.68,.115,.015,f.mint,'cloth');
      m.box(w-.274,d*.931,base+.046,.084,.005,.033,f.cream);
    }
  }
}

function books(m) {
  const {width:w,depth:d}=m;
  for(let i=0;i<3;i++){
    const a=.008+(i%2)*.014,b=i*.052;
    m.box(a,.013+.012*(i%2),b,w-.032,d-.037,.046,bindings[1+i*2]);
    m.box(a+.011,.005+d-.034+.012*(i%2),b+.007,w-.054,.008,.028,f.linen);
  }
}

function recordPlayer(m,o,s) {
  const {width:w,depth:d}=m;
  m.cushion(0,0,0,w,d,.063,.022,timber,'oak');
  m.cushion(.019,.017,.061,w-.038,d-.034,.015,.016,ink);
  const radius=Math.min(w,d)*.345,x=w*.410,y=d*.53;
  m.vessel(x,y,[[.074,radius],[.080,radius]],f.black,22);
  m.vessel(x,y,[[.080,radius*.35],[.084,radius*.35]],f.rose,14);
  const angle=s.spin*.94;
  const a=[x+Math.cos(angle)*radius*.16,y+Math.sin(angle)*radius*.16,.085];
  m.vessel(a[0],a[1],[[.084,.004],[.086,.004]],f.cream,6);
  m.rod([w*.83,d*.24,.087],[w*.71,d*.55,.094],.007,.006,f.steel);
  m.rod([w*.71,d*.55,.094],[w*.67,d*.57,.087],.006,.009,f.cream);
  m.box(w*.25,.015,.072,w*.64,.023,d*.61,f.walnut,'oak');
}

function television(m,o,s) {
  const {width:w,depth:d}=m;
  m.cushion(.021,.015,.011,w-.042,d-.037,.320,.046,oak,'oak');
  m.cushion(.012,d-.089,.041,w-.024,.086,.247,.029,ink);
  m.cushion(.029,d-.012,.066,w*.68,.021,.196,.017,s.channel?f.blue:[.263,.306,.324]);
  for(const z of [.155,.220]){
    m.rod([w*.855,d-.016,z],[w*.855,d+.017,z],.021,.018,f.brass);
  }
  for(let i=0;i<4;i++)m.box(w*.76,d-.001,.080+i*.013,w*.17,.005,.004,f.steel);
  m.rod([w*.43,d*.43,.330],[w*.18,d*.41,.446],.008,.003,f.steel);
  m.rod([w*.46,d*.43,.331],[w*.73,d*.39,.451],.008,.003,f.steel);
}

function lamp(m,o,s) {
  const {width:w,depth:d}=m,x=w/2,y=d/2,tall=idOf(o)===706;
  const h=tall?1.48:idOf(o)===5?.46:o.surfaceHeight??.50,base=Math.min(w,d)*.45;
  m.vessel(x,y,[[0,base*.76],[.014,base],[.041,base*.87]],brass);
  m.rod([x,y,.034],[x,y,h*.74],tall?.018:.015,tall?.013:.012,brass);
  if(!tall)m.rod([x,y,h*.71],[x+w*.08,y+d*.095,h*.79],.014,.011,brass);
  const cx=x+w*.06,cy=y+d*.075,r=Math.min(w,d)*(tall?.49:.40);
  m.vessel(cx,cy,[[h*.65,r],[h*.69,r*.99],[h*.96,r*.59],[h,r*.56]],s.lit?f.cream:f.linen);
  m.vessel(cx,cy,[[h*.646,r],[h*.657,r*.996]],brass);
  if(s.lit)m.vessel(cx,cy,[[h*.638,r*.71],[h*.645,r*.73]],[1,.82,.51]);
}

function cup(m) {
  const {width:w,depth:d}=m,x=w*.43,y=d*.50,r=Math.min(w,d)*.36;
  m.vessel(x,y,[[.001,r*.68],[.016,r*.79],[.105,r],[.124,r*.98],[.128,r*.81]],f.mint);
  m.vessel(x,y,[[.126,r*.78],[.129,r*.78]],[.293,.203,.159]);
  const edge=x+r*.91;
  let previous=[edge,y,.102];
  for(let i=1;i<=8;i++){
    const a=i*Math.PI/8,next=[edge+.037*Math.sin(a),y,.073+.029*Math.cos(a)];
    m.rod(previous,next,.010,.009,f.mint,6);previous=next;
  }
}

function plant(m,o) {
  const {width:w,depth:d}=m,x=w*.5,y=d*.5,small=idOf(o)===87,flower=[34,74].includes(idOf(o));
  const r=Math.min(w,d)*(small?.38:.36),pot=small?.122:flower?.20:.232;
  m.vessel(x,y,[[.005,r*.64],[.018,r*.72],[pot*.85,r],[pot*.89,r*1.08],[pot,r*1.08]],
    flower?f.mint:[.695,.404,.286]);
  m.vessel(x,y,[[pot-.001,r*.90],[pot+.002,r*.90]],f.walnut);
  const total=small?.20:flower?.36:.62;
  for(let i=0;i<(small?11:13);i++){
    const a=i*2.39996,radial=(.42+(i%5)*.09)*Math.min(w,d);
    const leafHeight=total*(.55+(i*3%7)*.069),tipZ=pot+leafHeight;
    const dir=[Math.cos(a),Math.sin(a)],side=[-dir[1],dir[0]];
    const p=(along,wide,z)=>[x+dir[0]*along+side[0]*wide,y+dir[1]*along+side[1]*wide,z];
    const leafBase=p(radial*.52,0,tipZ-.081),mid=p(radial*.86,0,tipZ),tip=p(radial*1.34,0,tipZ-.065);
    m.rod(p(.014,0,pot),leafBase,small?.003:.006,.003,f.moss,5);
    const span=small?.022:flower?.032:.051;
    for(const sign of [-1,1]){
      const lip=p(radial*.88,span*sign,tipZ-.015);
      m.face([leafBase,mid,lip],sign<0?f.moss:f.mint,null,false);
      m.face([mid,tip,lip],sign<0?f.moss:[.366,.571,.417],null,false);
    }
    if(flower&&i%3===0){
      for(let j=0;j<5;j++){
        const a=j*2*Math.PI/5,bx=mid[0]+Math.cos(a)*.020,by=mid[1]+Math.sin(a)*.020;
        m.vessel(bx,by,[[tipZ,.012],[tipZ+.013,.018],[tipZ+.023,.009]],i%2?f.plum:f.rose,7);
      }
    }
  }
}

function wardrobe(m,o,s){
  const {width:w,depth:d}=m,top=1.77,side=.039;
  legs(m,w,d,.138,.067);
  m.box(0,0,.13,side,d,top-.13,oak,'oak');
  m.box(w-side,0,.13,side,d,top-.13,oak,'oak');
  m.box(side,0,.148,w-2*side,.032,top-.183,timber,'oak');
  m.box(0,0,.127,w,d,.045,oak,'oak');
  m.cushion(-.012,-.009,top-.055,w+.024,d+.018,.055,.024,f.edge,'oak');
  m.box(side,0,1.40,w-2*side,d-.027,.032,oak,'oak');
  m.rod([.067,d*.5,1.307],[w-.067,d*.5,1.307],.011,.011,f.steel);
  for(let i=0;i<5;i++){
    const x=.117+i*w*.165,y=d*.60;
    m.rod([x,y,1.303],[x,y,1.19],.005,.005,brass,6);
    const fold=bindings[i];
    m.face([[x-.019,y-.106,1.156],[x+.019,y+.106,1.156],[x+.046,y+.105,.652],[x-.046,y-.102,.64]],fold,'cloth',false);
  }
  const door=(x0,sign)=>{
    const angle=s.stage*Math.PI*.39,span=w*.475;
    const point=(x,y,z)=>[x0+sign*x*Math.cos(angle)-sign*y*Math.sin(angle),d-.031+x*Math.sin(angle)+y*Math.cos(angle),z];
    const a=point(0,0,.191),b=point(span,0,.191),c=point(span,0,top-.085),e=point(0,0,top-.085);
    m.face([a,b,c,e],oak,'oak',false);
    const front=(x,y,z)=>point(x,.028+y,z);
    m.face([front(0,0,.191),front(span,0,.191),front(span,0,top-.085),front(0,0,top-.085)],f.edge,'oak',false);
    m.face([e,c,front(span,0,top-.085),front(0,0,top-.085)],oak,'oak',false);
    for(const offset of [.028,span-.029])m.rod(front(offset,.006,.259),front(offset,.006,top-.149),.007,.007,oak,6);
    for(const z of [.259,top-.149])m.rod(front(.030,.006,z),front(span-.03,.006,z),.007,.007,oak,6);
    m.rod(front(span-.048,.018,.795),front(span-.048,.018,.928),.011,.011,brass);
  };
  door(.016,1);door(w-.016,-1);
}

function easel(m,o,s) {
  const {width:w,depth:d}=m;
  for(const x of [.045,w-.045]){
    m.rod([x,d*.62,0],[w*.5+(x-w*.5)*.72,d*.28,1.44],.022,.022,oak,6);
  }
  m.rod([w*.5,.017,0],[w*.5,d*.31,1.39],.025,.019,timber,6);
  const panel=(x,y,z,a,b,h,color)=>m.face([[x,y,z],[x+a,y,z],[x+a,b,h],[x,b,h]],color,null,false);
  panel(.019,d*.55,.637,w-.038,d*.27,1.36,f.edge);
  panel(.037,d*.55+.004,.663,w-.074,d*.27+.004,1.331,f.linen);
  if(s.painted){
    m.face([[w*.12,d*.48,.76],[w*.58,d*.35,1.16],[w*.82,d*.44,.92]],f.mint,null,false);
    m.face([[w*.32,d*.49,.76],[w*.68,d*.38,1.04],[w*.90,d*.49,.76]],f.blue,null,false);
  }
  m.box(.004,d*.52,.619,w-.008,.058,.039,oak,'oak');
}

// Use a single dispatch for previews, cached scenery and objects moving under a finger.
const models={
  table, chair:stationChair, streamChair:stationChair, bed, shelf:vinylShelf, record:recordPlayer,
  books, television, lamp, placedLamp:lamp, cup, plant, flowers:plant, easel, wardrobe, smallTable:coffeeTable, ...applianceModels
};

export function hasRoomModel(o){return Object.hasOwn(models,o.kind);}

export function drawRoomModel(renderer,o,state={}) {
  const draw=models[o.kind];
  if(!draw)return false;
  const m=roomMesh(renderer,o);
  draw(m,o,{drawer:0,spin:0,stage:0,...state});
  return true;
}
