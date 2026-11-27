const units=[
 ['stove','Плита с чайником',.71,.61,.91],['basin','Кухонная мойка',.90,.56,.90],
 ['fridge','Холодильник',.63,.60,1.66],['toilet','Унитаз',.48,.67,.79],
 ['shower','Душевая кабина',.78,.78,1.95],['screen','Ширма санузла',1.04,.16,1.51]
];
const plans={
 home:[[.4,2.9],[-.6,2.9],[-1.4,2.9],[2.8,2.2],[1.9,1.6],[1.7,2.7]],
 courtyard:[[-.4,2.9],[.4,2.9],[1.5,2.9],[3.05,2.75],[1.4,1.1],[1.1,2]],
 terrace:[[-.4,2.9],[.4,2.9],[1.5,2.9],[2.45,2.75],[1.4,1.1],[1.2,2]]
};
export function household(sector){
 return (plans[sector]||[]).map(([u,v],i)=>{
   const [kind,name,w,d,height]=units[i],span=(w+d)/2;
   return {id:300+Object.keys(plans).indexOf(sector)*10+i,name,kind,u,v,w,d,parts:[],art:'house-'+kind,
     visualHeight:height+span,surfaceHeight:height,artAnchor:[.5,1-span/(2*(height+span))],artSpan:span};
 });
}
export const domestic={
 stove:['Поставить чайник',['Щёлк. Чайник на плите.','Пошёл пар. Чашку бы ещё найти.','Свистит. Всё, снимаю!']],
 basin:['Вымыть кружку',['Смыла чайный ободок.','Губка решила жить за краном. Достала.','Поставила кружку сушиться.']],
 fridge:['Заглянуть внутрь',['Молоко на дверце, варенье за ним.','Опять открыла и забыла зачем. Классика.','Нашла лимон. Уже победа.']],
 toilet:['Воспользоваться',['Закрою ширму на минутку.','Всё, можно заходить.','Бумага на месте. Редкая бытовая победа.']],
 shower:['Принять душ',['Поймала тёплую воду со второй попытки.','Пар на стекле. Нарисовала кота.','Полотенце сухое. День уже удался.']],
 screen:['Поправить ширму',['Так из коридора меньше видно.','Ширма чуть съехала. Поправила.','Вот теперь приватность.']]
};
export const actionTime={fridge:1750,basin:1560,screen:1050};
export function useProgress(kind,uses,progress){
 if(!actionTime[kind])return 0;
 if(progress==null)return Number(Boolean(kind==='basin'&&uses||kind==='screen'&&uses%2));
 const x=Math.min(1,Math.max(0,progress));
 const stage=kind==='fridge'?Math.min(1,x/.32,(1-x)/.30):
   kind==='screen'?(uses%2?x:1-x):uses<=1?x:Math.abs(2*x-1);
 return stage*stage*(3-2*stage);
}

export function useFrame(kind,uses,progress){
 return Math.round(8*useProgress(kind,uses,progress));
}
