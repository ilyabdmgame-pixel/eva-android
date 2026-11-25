import {insideBuilding} from './buildings.mjs';

const obj=(id,name,u,v,w,d,kind,parts=[],info={})=>({id,name,u,v,w,d,kind,parts,...info});
const part=(u,v,z,a,b,h,tint,mat)=>({u,v,z,a,b,h,tint,mat});
const wood=[.78,.62,.49],iron=[.35,.46,.48],gold=[.82,.63,.39];
const art=(id,name,u,v,w,d,kind,key,visualHeight,info)=>obj(id,name,u,v,w,d,kind,[],{art:key,visualHeight,...info});
const tree=(id,u,v,w=.76)=>obj(id,'Дерево',u,v,w,.65,'seasonTree',[],{visualHeight:2.58+(id%4)*.18,approach:[u+w+.34,v+.43]});
const seat=(id,u,v)=>obj(id,'Скамья',u,v,1.33,.49,'chair',[
  ...[.045,1.16].flatMap(x=>[.035,.365].map(y=>part(x,y,0,.10,.10,.46,iron))),
  part(0,.014,.43,1.33,.461,.073,wood,'wood'),
  part(.03,0,.51,1.27,.081,.33,wood,'wood')
],{seatHeight:.50});
const light=(id,u,v)=>obj(id,'Фонарь',u,v,.21,.20,'lamp',[
  part(0,0,0,.21,.21,.12,iron,'stone'),part(.036,.036,.12,.138,.138,.18,iron),
  part(.070,.070,.30,.070,.070,1.68,iron),part(-.022,-.022,1.98,.254,.254,.07,iron),
  part(.025,.025,2.05,.16,.16,.244,gold),
  ...[0,.184].flatMap(a=>[0,.184].map(b=>part(a,b,2.05,.026,.026,.244,iron))),
  part(-.038,-.038,2.294,.286,.286,.061,iron),part(.024,.024,2.35,.162,.162,.045,iron)
],{visualHeight:2.395,bulbPart:4});
const planter=(id,u,v)=>art(id,'Цветы в кашпо',u,v,.46,.44,'plant','hydrangea',.51,{base:'planter'});
const tile=(title,theme,start,objects)=>({title,theme,start,objects,outside:true});

const residentBed=(id,name,u,v)=>[
 art(id,'Кровать · '+name,u,v,1.03,2.10,'bed','single-bed',2.21,{artSpan:1.565,artAnchor:[.5,.65],surfaceHeight:.53}),
 art(({201:210,202:211,205:212,206:213,207:214})[id],'Плед · '+name,u+.035,v+.78,.96,1.26,'blanket','bed-throw',1.20,{solid:false,z:.55,artSpan:1.11,artAnchor:[.5,.64],artBias:.39})
];
const indoorSeat=(id,u,v)=>art(id,'Деревянный стул',u,v,.48,.48,'chair','desk-chair',1.36,{seatHeight:.44,seatDirection:'down-right',artSpan:.48,artAnchor:[.5,.82]});
const houseDesk=(id,u,v)=>art(id,'Стол у окна',u,v,1.62,.72,'table','writing-desk',2.04,{surfaceHeight:.87,artSpan:1.17,artAnchor:[.5,.71]});
export const neighborhood={
 orchard:tile('Яблоневый сад','garden',[.2,.65],[
   tree(351,-2.3,-2.1),tree(352,-.4,-2.65),tree(353,1.85,-2.2),tree(354,-2.1,.4),seat(355,1.3,1.83),planter(356,1.97,.70),
   art(357,'Корзины урожая',-1.7,2.3,1.04,.66,'forage','cargo-stack',.95)]),
 arcade:tile('Цветочный пассаж','square',[.2,.65],[
   art(358,'Павильон рассады',-1.88,-2.05,1.36,.82,'market','market-kiosk',2.04),planter(359,-1.86,-.82),
   planter(360,-.98,-.73),seat(361,1.3,.73),light(362,2.72,1.85),art(363,'Стеллаж с цветами',1.65,-1.56,1,.58,'flowers','flower-box',.93)]),
 courtyard:{title:'Садовый дом',theme:'courtyard',start:[.1,1.40],objects:[
   ...residentBed(201,'Рэн',-2.9,-2.6),...residentBed(202,'Ника',1.7,-2.6),
   indoorSeat(203,-2.64,1.65),houseDesk(215,-2.83,2.52),planter(204,2.34,2.32)]},
 terrace:{title:'Дом у сквера',theme:'terrace',start:[.35,.85],objects:[
   ...residentBed(205,'Мио',-2.9,-2.65),...residentBed(206,'Ася',-.28,-2.65),...residentBed(207,'Кир',2.03,-2.65),
   indoorSeat(208,-2.28,1.68),houseDesk(216,-2.73,2.55),planter(209,2.36,2.18)]},
 lane:tile('Жилой переулок','lane',[.72,.67],[
  tree(111,-3.54,.02),light(112,2.86,-.38),
  art(224,'Посылки на сортировке',-2.81,-3.72,.77,.60,'cargo','cargo-stack',.88),
  art(225,'Почтовый стеллаж',1.30,-3.66,1.40,.40,'books','vinyl-shelf',2.23,{surfaceHeight:1.34,artSpan:.90,artAnchor:[.5,.76]}),
  obj(113,'Почтовый ящик',1.78,.91,.28,.28,'mail',[
    part(.09,.10,0,.07,.071,.76,iron),part(0,0,.75,.28,.28,.22,[.66,.56,.49],'brick'),
    part(.062,.26,.872,.15,.028,.047,[.29,.33,.36])
  ]),
  seat(114,-1.89,1.66),planter(115,2.76,2.7)
 ]),
 garden:tile('Сад за домами','garden',[.86,.51],[
  tree(116,-1.64,-1.65,.83),tree(117,1.76,1.63),planter(118,-1.76,1.73),
  obj(119,'Грядка с травами',1.73,-1.82,.72,.68,'forage',[
    part(0,0,0,.72,.68,.11,wood,'wood'),part(.071,.066,.112,.57,.51,.11,[.46,.68,.48],'grass-field')
  ]),
  seat(120,-3.03,.94)
 ]),
 park:tile('Парк','park',[1.39,.2],[
  tree(121,-2.21,-1.99),tree(122,2.45,-2.24),tree(123,-2.84,2.67),tree(124,2.51,2.81),
  art(125,'Фонтан',-.65,-.60,1.14,1.11,'fountain','park-fountain',1.08,{artWidthScale:1.14}),
  seat(126,.86,-2.87),light(127,-2.76,.89)
 ]),
 square:tile('Старая площадь','square',[.89,.95],[
  art(128,'Часы на площади',-.38,-.51,.51,.53,'clock','street-clock',2.12,{artWidthScale:.79}),
  seat(129,1.86,-1.67),seat(130,-2.65,1.33),
  light(131,-2.86,-2.48),planter(132,1.89,1.54)
 ]),
 market:tile('Рынок','market',[.65,.70],[
  art(133,'Киоск рынка',-.73,-1.82,1.21,.77,'market','market-kiosk',2.04,{artWidthScale:.88}),
  art(134,'Овощные ящики',1.69,-1.47,.75,.53,'market','cargo-stack',.86),
  light(135,2.03,1.86),planter(136,-2.23,1.62),seat(137,-2.64,-2.21)
 ]),
 promenade:tile('Набережная','promenade',[.71,.66],[
  seat(138,-2.10,.91),seat(139,1.0,-2.4),light(140,-2.08,-1.8),
  light(141,2.31,1.92),tree(142,-2.30,2.36),
  obj(143,'Вид на море',1.77,2.87,.46,.22,'lookout',[
    part(0,0,0,.45,.07,.89,wood,'wood'),part(0,.151,0,.45,.071,.86,wood,'wood'),
    part(-.025,-.04,.826,.5,.302,.10,[.62,.66,.62],'stone')
  ])
 ]),
 pier:tile('Причал','pier',[.63,.99],[
  art(144,'Груз для порта',-1.03,-1.56,.77,.60,'cargo','cargo-stack',.95),
  obj(145,'Швартовка',2.37,1.11,.29,.36,'bollard',[
    part(0,0,0,.25,.31,.13,iron,'stone'),part(.060,.086,.11,.13,.14,.36,iron),
    part(.008,.044,.37,.235,.208,.09,wood,'wood')
  ]),
  seat(146,-2.36,1.52),light(147,1.6,-1.63)
 ]),
 headland:tile('Мыс','headland',[.83,.74],[
  tree(148,-2.29,-1.13),tree(149,1.51,-1.76),seat(150,-2.72,1.51),
  obj(151,'Ветроуказатель',1.89,.98,.25,.25,'windsock',[
    part(.08,.09,0,.07,.069,2.12,iron),part(.13,.12,1.87,.59,.078,.21,[.85,.45,.37],'cloth'),
    part(.31,.111,1.867,.11,.091,.213,[.88,.78,.68],'cloth')
  ]),planter(152,.98,2.38)
 ])
};

export function outsideAt(plot,u,v){
 return !insideBuilding(plot,u,v);
}

export const shorelineRails={promenade:3.68,pier:2.78};
export const railSpans=[[-3.68,-1.51],[1.55,3.72]];

export function railingBlocks(theme,u,v){
 const cross=shorelineRails[theme];
 return cross!==undefined&&Math.abs(v-cross)<.15&&railSpans.some(([left,right])=>u>left-.11&&u<right+.11);
}
