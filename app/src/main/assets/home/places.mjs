const color={
  wood:[1,.87,.79],cream:[.91,.85,.70],brick:[.58,.33,.28],green:[.65,.84,.76],
  iron:[.23,.27,.28],gold:[.97,.72,.34],glass:[.34,.53,.67]
};
const object=(id,name,u,v,w,d,kind,parts,meta={})=>({
  id,name,u,v,w,d,kind,parts,...meta
});
const part=(u,v,z,a,b,h,tint,mat)=>({u,v,z,a,b,h,tint,mat});
const legs=(w,d,h)=>[0,w-.07].flatMap(u=>[0,d-.07].map(v=>part(u,v,0,.07,.07,h,color.wood,'wood')));
const chair=(id,name,u,v)=>object(id,name,u,v,.45,.46,'chair',[
  ...legs(.45,.46,.43),part(0,0,.43,.45,.46,.08,[1,.75,.73],'cloth'),
  part(0,0,.51,.45,.075,.35,[1,.75,.73],'cloth')
]);
const lamp=object(5,'Лампа',.62,-1.95,.24,.24,'lamp',[
  part(0,0,.87,.26,.26,.05,color.gold),part(.10,.10,.92,.045,.045,.38,color.gold),
  part(.025,.03,1.28,.22,.20,.16,color.gold)
],{approach:[.68,-.98],solid:false,art:'brass-desk-lamp',z:.87,visualHeight:.46,bulbPart:2});
const streetLamp=object(9,'Фонарь',-1.35,1.65,.24,.24,'lamp',[
  part(0,0,0,.24,.24,.09,color.iron,'stone'),
  part(.04,.04,.09,.16,.16,.23,color.iron),part(.077,.077,.32,.086,.086,1.76,color.iron),
  part(.009,.009,2.08,.222,.222,.055,color.iron),
  part(.028,.028,2.135,.184,.184,.245,[.68,.57,.39]),
  ...[.012,.201].flatMap(u=>[.012,.201].map(v=>part(u,v,2.132,.027,.027,.252,color.iron))),
  part(-.03,-.03,2.38,.30,.30,.064,color.iron),part(.024,.024,2.444,.192,.192,.06,color.iron)
],{bulbPart:4});
const home=[
  object(1,'Письменный стол',-.66,-2.09,1.62,.72,'table',[
    ...legs(1.62,.72,.78),part(0,0,.78,1.62,.72,.09,color.wood,'wood'),
    part(.77,.29,.63,.60,.42,.15,color.wood,'wood'),part(1.02,.71,.70,.10,.035,.022,color.gold)
  ]),
  lamp,
  object(6,'Кружка',-.42,-1.70,.17,.16,'cup',[
    part(0,0,.87,.13,.13,.15,[.72,.85,.76]),part(.128,.04,.905,.06,.06,.045,[.72,.85,.76])
  ],{approach:[-.44,-1.11],solid:false,art:'home-mug',z:.87,visualHeight:.13,artBias:.48}),
  chair(2,'Стул',.98,-.23),
  object(3,'Кровать',-2.06,-.68,.88,2.1,'bed',[
    ...legs(.88,2.1,.31),part(0,0,.31,.88,2.1,.14,color.wood,'wood'),
    part(.035,.06,.45,.81,1.98,.12,[.71,.76,.70],'cloth'),
    part(0,0,.45,.88,.065,.44,color.wood,'wood'),
  ]),
  object(10,'Подушка',-1.92,-.54,.60,.34,'pillow',[
    part(0,0,.58,.60,.34,.12,[.86,.75,.61],'cloth')
  ],{solid:false,approach:[-1.0,-.25]}),
  object(11,'Плед',-2.02,.12,.80,1.26,'blanket',[
    part(0,0,.58,.80,1.26,.045,[1,.72,.74],'cloth')
  ],{solid:false,approach:[-1.0,.88]}),
  object(4,'Дверь на улицу',1.85,-2.56,.72,.12,'exit',[
    part(-.04,0,0,.08,.19,2.02,color.wood,'wood'),part(.71,0,0,.075,.19,2.02,color.wood,'wood'),
    part(0,.02,1.95,.72,.15,.10,color.wood,'wood'),part(.05,.02,0,.61,.05,1.94,[.69,.57,.52],'wood'),
    part(.52,.065,.93,.06,.075,.045,color.gold)
  ],{to:'street',approach:[2.16,-1.68]}),
  object(7,'Окно',-1.08,-2.88,1.66,.07,'window',[],{
    solid:false,approach:[.03,-1.01]
  })
];
const street=[
  object(4,'Дверь домой',1.35,-2.15,.74,.14,'exit',[
    part(-.05,0,0,.86,.16,2.05,color.wood,'wood'),
    part(0,.15,0,.74,.04,1.95,[.69,.57,.52],'wood'),
    part(.57,.20,.94,.075,.05,.07,color.gold)
  ],{to:'home',approach:[1.75,-1.63]}),
  object(12,'Скамейка',-1.03,-.73,1.52,.44,'chair',[
    ...legs(1.52,.44,.38),part(0,0,.38,1.52,.44,.10,color.wood,'wood'),
    part(0,0,.49,1.52,.07,.34,color.wood,'wood')
  ]),
  streetLamp,
  object(8,'Рэн',.86,.31,.32,.32,'npc',[],{solid:false,actor:'ren'}),
  object(13,'Кашпо',-1.83,-.12,.58,.52,'plant',[
    part(0,0,0,.58,.52,.31,color.wood,'wood'),
    part(.08,.085,.32,.43,.36,.17,color.green)
  ])
];
const portal=(id,name,u,to)=>object(id,name,u,-2.36,.66,.14,'exit',[
  part(-.04,0,0,.08,.21,2.11,color.wood,'wood'),
  part(.62,0,0,.08,.21,2.11,color.wood,'wood'),
  part(0,0,2.02,.66,.18,.12,color.wood,'wood'),
  part(.035,.03,0,.59,.075,2.01,[.67,.52,.44],'wood'),
  part(.44,.075,1.02,.075,.055,.055,color.gold)
],{to,approach:[u+.3,-1.85]});
street.push(
  portal(51,'Вход в школу',-.85,'school'),
  portal(52,'Дверь цветочной лавки',-.05,'shop'),
  portal(53,'Вход в кафе',.75,'cafe'),
  object(54,'Лестница к пляжу',-.99,2.51,.86,.39,'exit',[
    part(0,0,0,.86,.128,.09,color.cream,'stone'),
    part(0,.128,0,.86,.128,.17,color.cream,'stone'),
    part(0,.256,0,.86,.134,.26,color.cream,'stone')
  ],{to:'beach',approach:[-.53,2.13]})
);
const bench=(id,name,u,v,tint)=>object(id,name,u,v,1.35,.51,'chair',[
  ...legs(1.35,.51,.41),part(0,0,.41,1.35,.51,.09,tint,'seat'),
  part(0,0,.5,1.35,.13,.44,tint,'seat')
],{seatHeight:.5});

const stand=(id,u,v)=>object(id,'Мольберт',u,v,.64,.5,'easel',[
  part(.015,.12,0,.063,.067,1.49,color.wood,'wood'),
  part(.56,.12,0,.063,.067,1.49,color.wood,'wood'),
  part(.30,.37,0,.065,.066,1.53,color.wood,'wood'),
  part(.026,.17,.69,.58,.04,.72,color.cream),
  part(.012,.179,.64,.62,.079,.056,color.wood,'wood')
],{art:'art-easel',visualHeight:1.52});
const shelf=(id,name,u,v,kind='shelf')=>object(id,name,u,v,1.43,.36,kind,[
  part(0,0,0,.075,.36,1.43,color.wood,'wood'),
  part(1.355,0,0,.075,.36,1.43,color.wood,'wood'),
  ...[.05,.49,.92,1.36].map(z=>part(.074,0,z,1.28,.36,.065,color.wood,'wood'))
]);
const npc=(id,name,u,v,actor)=>object(id,name,u,v,.23,.23,'npc',[],{actor,solid:false});
const prop=(id,name,u,v,w,d,kind,art,meta={})=>object(id,name,u,v,w,d,kind,[],{art,...meta});
home.push(
  {...shelf(21,'Полка',-2.25,1.84),art:'vinyl-shelf',visualHeight:1.43},
  object(22,'Проигрыватель',-2.12,1.88,.44,.28,'record',[
    part(0,0,1.43,.44,.28,.052,[.63,.39,.39],'wood'),
    part(0,0,1.48,.44,.035,.22,[.68,.44,.43],'wood'),
    part(.29,.07,1.49,.11,.022,.018,color.gold)
  ],{art:'record',z:1.435,visualHeight:.30,artWidthScale:1.17,solid:false,approach:[-1.77,2.58]}),
  object(23,'Книги',-1.50,1.89,.43,.24,'books',[
    part(0,0,1.425,.43,.23,.042,[.44,.60,.63],'wood'),
    part(.02,.015,1.466,.385,.20,.045,[.86,.78,.62]),
    part(.01,0,1.508,.415,.225,.028,[.45,.60,.63],'wood'),
    part(.065,.025,1.537,.35,.17,.046,[.57,.38,.38],'wood'),
    part(.075,.037,1.579,.325,.149,.021,[.77,.68,.57]),
    part(.06,.02,1.600,.36,.185,.028,[.57,.38,.38],'wood')
  ],{art:'books',z:1.435,visualHeight:.20,artWidthScale:1.28,solid:false,approach:[-1.28,2.55]}),
  prop(24,'Монстера',1.66,-.19,.36,.36,'plant','monstera',{portable:true,visualHeight:.83}),
  object(25,'Тумба под телевизор',-1.49,-2.02,.53,.45,'table',[
    ...legs(.53,.45,.49),part(0,0,.47,.53,.45,.075,color.wood,'wood')
  ]),
  prop(26,'Пузатый телевизор',-1.41,-1.96,.41,.32,'television','tv',
    {z:.55,solid:false,visualHeight:.48,artBias:.24,approach:[-1.13,-1.19]})
);
street.push(
  object(31,'Автомат с газировкой',-2.04,-1.73,.61,.41,'vending',[
    part(0,0,0,.61,.41,1.54,[.38,.52,.58],'stone'),
    part(.055,.415,.57,.43,.026,.81,[.30,.43,.51]),
    part(.065,.445,.20,.41,.028,.26,[.24,.27,.31]),
    part(.50,.44,.64,.062,.044,.25,[.66,.71,.69])
  ],{art:'vending',visualHeight:1.54,artWidthScale:.84}),
  object(32,'Меню на тротуаре',.27,-.87,.38,.22,'sign',[
    part(0,0,0,.046,.051,.69,color.wood,'wood'),part(.334,0,0,.046,.051,.69,color.wood,'wood'),
    part(0,.17,0,.046,.042,.65,color.wood,'wood'),part(.334,.17,0,.046,.042,.65,color.wood,'wood'),
    part(.046,0,.17,.288,.055,.49,[.24,.36,.35]),
    part(.103,.051,.36,.18,.008,.011,[.87,.79,.61]),
    part(.10,.051,.42,.205,.008,.013,[.87,.79,.61]),
    part(.086,.051,.51,.12,.008,.012,[.87,.79,.61])
  ],{art:'chalkboard',visualHeight:.70,artWidthScale:.83}),
  object(33,'Урна',2.48,1.83,.30,.30,'bin',[
    part(0,0,0,.30,.30,.66,[.52,.63,.62],'stone'),
    part(-.015,-.015,.66,.33,.33,.07,[.45,.53,.52],'stone'),
    part(.114,.111,.731,.072,.073,.033,[.33,.40,.39])
  ]),
  prop(34,'Ящик с цветами',-.29,2.92,.54,.30,'plant','hydrangea',{base:'planter',visualHeight:.36})
);
const school=[
  portal(60,'Выход в город',1.95,'street'),
  stand(61,-1.49,-.74),
  object(62,'Табурет',-.38,.02,.34,.36,'chair',[
    ...legs(.34,.36,.42),part(0,0,.42,.34,.36,.054,color.wood,'wood')
  ],{portable:true,seatHeight:.47}),
  prop(63,'Этюдник',.64,-.26,.41,.29,'kit','kit',{portable:true,visualHeight:.32}),
  object(64,'Раковина',-1.59,-2.16,1.22,.48,'sink',[
   ...legs(1.22,.48,.67),part(0,0,.67,1.22,.48,.19,[.72,.74,.73]),
   part(.11,.15,.86,1.00,.23,.006,[.41,.49,.56]),part(.56,.06,.87,.08,.08,.23,color.iron)
  ]),
  shelf(65,'Шкаф с материалами',-2.11,1.17),
  npc(66,'Рэн',.46,.71,'ren')
];
const shop=[
  portal(70,'Дверь на улицу',1.95,'street'),
  object(71,'Стол для букетов',-.84,-1.55,1.51,.65,'bouquet',[
    ...legs(1.51,.65,.79),part(0,0,.79,1.51,.65,.065,color.wood,'wood')
  ],{art:'wrapping-station',visualHeight:1.04,artWidthScale:1.17}),
  prop(72,'Ведро Мио',-.28,-.40,.37,.37,'bucket','bucket',{portable:true,visualHeight:.36}),
  prop(73,'Коралловый букет',.11,-1.29,.28,.28,'flowers','flowers',{solid:false,z:.855,visualHeight:.49,approach:[.28,-.61]}),
  prop(74,'Гортензия',-1.39,1.10,.46,.46,'plant','hydrangea',{base:'planter',visualHeight:.61}),
  shelf(75,'Полка для заказов',-1.92,-2.18),
  npc(76,'Мио',.87,-.36,'mio'),
  object(77,'Касса',1.45,.17,.64,.44,'register',[
    part(0,0,0,.64,.44,.81,[.77,.63,.52],'wood'),
    part(.08,.08,.81,.45,.30,.14,color.iron),part(.11,.09,.946,.38,.084,.18,color.gold)
  ])
];
const cafe=[
  portal(80,'Выход в город',1.95,'street'),
  {...bench(81,'Бордовый диван',-1.86,-1.65,[1,.83,.84]),art:'cafe-settee',artFlip:true,visualHeight:1.01},
  object(82,'Столик',-1.61,-.69,.77,.68,'table',[
    ...legs(.77,.68,.69),part(0,0,.69,.77,.68,.067,color.wood,'wood')
  ]),
  prop(83,'Чашка чая',-1.27,-.42,.16,.16,'cup','mug',{z:.76,solid:false,visualHeight:.19,approach:[-.55,-.33]}),
  object(84,'Кофемашина',.35,-1.97,.87,.51,'coffee',[
    part(0,0,0,.87,.51,.89,color.wood,'wood'),
    part(.08,.09,.89,.69,.26,.39,color.iron),
    part(.14,.326,1.01,.52,.058,.21,[.79,.80,.77]),
    part(.33,.37,1.10,.09,.083,.063,color.gold)
  ],{art:'espresso-station',visualHeight:1.26,artWidthScale:.90}),
  object(85,'Ящик газировки',1.21,.99,.49,.38,'soda',[
    part(0,0,0,.49,.38,.23,color.wood,'wood'),
    ...[.09,.25,.40].map(u=>part(u,.11,.19,.075,.074,.25,[.44,.72,.58]))
  ],{portable:true}),
  npc(86,'Мио',.77,.16,'mio'),
  prop(87,'Суккулент',-1.79,.61,.31,.31,'plant','succulent',{base:'planter',visualHeight:.25})
];
const beach=[
  portal(90,'Вверх в город',1.96,'street'),
  bench(91,'Лавка на настиле',-.95,-1.86,[.94,.91,.77]),
  prop(92,'Магнитола',.19,.78,.31,.18,'radio','radio',{portable:true,visualHeight:.24}),
  object(93,'Пляжный зонт',-1.51,.66,.73,.72,'umbrella',[],{solid:false}),
  object(94,'Ракушка',-.64,1.92,.16,.12,'shell',[
    part(0,0,0,.14,.11,.054,[.95,.73,.54]),part(.028,.025,.052,.085,.058,.033,[.94,.82,.64])
  ],{solid:false}),
  prop(95,'Прибрежная трава',-1.93,1.64,.31,.22,'grass','grass',{solid:false,visualHeight:.32}),
  npc(96,'Рэн',.92,.34,'ren'),
  prop(97,'Спасательный круг',-1.67,-.73,.32,.27,'rescue','rescue-post',{visualHeight:1.37})
];
export const places={
  home:{title:'Комната',objects:home,start:[.30,.62],theme:'home'},
  street:{title:'Улица',objects:street,start:[1.76,-1.37],theme:'street'},
  school:{title:'Школа',objects:school,start:[.65,1.03],theme:'school'},
  shop:{title:'Цветочная лавка',objects:shop,start:[.56,.83],theme:'shop'},
  cafe:{title:'Кафе',objects:cafe,start:[.64,1.04],theme:'cafe'},
  beach:{title:'Пляж',objects:beach,start:[.42,.50],theme:'beach'}
};
export function floorHeight(section,v){
  if(section!=='beach'||v>=-.50||v<-4)return 0;
  if(v<-3.66)return .18;
  if(v<-3.32)return .36;
  if(v>=-.72)return .18;
  if(v>=-.94)return .36;
  return .54;
}
