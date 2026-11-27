const furniture = {
  1: ['writing-desk',.87],
  2: ['desk-chair',.88,{seatHeight:.44,seatDirection:'down-right'}],
  3: ['single-bed',.93,{seatHeight:.47,seatDirection:'down-right'}],
  10: ['bed-pillow',.10,{z:.49,ground:.56,bias:.78}],
  11: ['bed-throw',.08,{z:.49,ground:.64,bias:.53}],
  12: ['iron-bench',.83],
  13: ['garden-pot',.50],
  21: ['vinyl-shelf',1.34],
  22: ['record',.25,{z:1.35}],
  23: ['books',.18,{z:1.35}],
  25: ['tv-cabinet',.55],
  33: ['town-bin',.70],
  34: ['flower-box',.43],
  62: ['studio-stool',.46],
  64: ['studio-sink',1.07],
  65: ['studio-cabinet',1.31],
  71: ['florist-table',1.12,{flip:true}],
  74: ['glazed-hydrangea',.68],
  75: ['florist-shelf',1.32],
  77: ['brass-register',1.02],
  82: ['bistro-table',.76],
  85: ['soda-crate',.39],
  87: ['potted-succulent',.31],
  91: ['boardwalk-bench',.78],
  93: ['striped-umbrella',1.66,{span:.88,ground:.95}],
  94: ['scallop-shell',.065],
  113: ['red-mailbox',1.00],
  119: ['herb-bed',.47],
  143: ['seaside-viewer',1.10],
  145: ['mooring-post',.42],
  151: ['coast-windsock',2.07,{span:.45,ground:.96,horizontal:.15}]
};

export function finishFixture(object) {
  const detail=furniture[object.id]??(
    object.kind==='lamp'&&object.id!==5?['street-lantern',2.38,{span:.28,ground:.97}]:
    object.kind==='chair'&&!object.art&&object.id>=110?['iron-bench',.83]:
    object.kind==='plant'&&object.id>=110?['glazed-hydrangea',.60]:null
  );
  if(!detail)return object;
  const [art,height,options={}]=detail;
  const span=(object.w+object.d)*.5;
  const visualHeight=height+span;
  const artAnchor=[options.horizontal??.5,options.ground??1-span/(2*visualHeight)];
  const metadata={...object,art,surfaceHeight:object.kind==='bed'?.53:object.kind==='chair'?(options.seatHeight??object.seatHeight??.48):height,visualHeight,artAnchor,artSpan:options.span??span,base:null};
  if(options.z!==undefined)metadata.z=options.z;
  if(options.bias)metadata.artBias=options.bias;
  if(options.flip)metadata.artFlip=true;
  if(options.seatHeight)metadata.seatHeight=options.seatHeight;
  if(options.seatDirection)metadata.seatDirection=options.seatDirection;
  return metadata;
}

// Swap the two ground axes, including the physical mesh and approach face.
export function turnFixture(o){
  const opposite={'down-left':'down-right','down-right':'down-left','up-left':'up-right','up-right':'up-left'};
  return {...o,turned:!o.turned,w:o.d,d:o.w,artFlip:!o.artFlip,alongV:!o.alongV,
    parts:o.parts.map(p=>({...p,u:p.v,v:p.u,a:p.b,b:p.a})),
    seatDirection:opposite[o.seatDirection||'down-left'],approach:null};
}
const reverseArt=new Set(['desk-chair','iron-bench','boardwalk-bench','art-easel','house-stove','house-basin','house-fridge','house-toilet','house-shower','house-screen','studio-cabinet','vinyl-shelf']);
export const hasReverse=o=>reverseArt.has(o.art);
export function halfTurn(o){
 const opposite={'down-left':'up-right','down-right':'up-left','up-left':'down-right','up-right':'down-left'};
 return {...o,back:!o.back,parts:o.parts.map(p=>({...p,u:o.w-p.u-p.a,v:o.d-p.v-p.b})),
   seatDirection:opposite[o.seatDirection||'down-left'],approach:null};
}
export function restoreTurn(o,record,volumetric=false){
 if(record?.turned)o=turnFixture(o);
 return record?.back&&(volumetric||hasReverse(o))?halfTurn(o):o;
}
export function nextTurn(o,volumetric=false){
 const result=turnFixture(o);
 return o.turned&&(volumetric||hasReverse(o))?halfTurn(result):result;
}
export function seatFront(o,gap=.28){
 const side=o.back?-1:1;
 const du=o.turned?side:0,dv=o.turned?0:side;
 return [o.u+o.w*.5+du*(o.w*.5+gap),o.v+o.d*.5+dv*(o.d*.5+gap)];
}
