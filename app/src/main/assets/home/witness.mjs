const recollections={
 bouquet:['Ты тогда так затянула ленту на букете, цветы точно никуда не сбегут.','У них был шанс до второго узла.'],
 sell:['Помнишь букет, который ты продала? Красиво он смотрелся у кассы.','Шесть монет за красоту. Лента вообще работала бесплатно.'],
 cargo:['Помнишь те ящики на разгрузке? Спина как?','Спина выставила счёт. Дороже смены.'],
 mail:['Помнишь, ты проверяла почтовый ящик? Мы тогда пересеклись у почты.','Почта и свидетели. Серьёзное у нас тут дело.']
};
export function witness(saved,kind,point,residents,sector,at){
 if(!recollections[kind])return;
 for(const p of residents){
   if(p.sleeping||p.sector!==sector||Math.hypot(p.u-point.u,p.v-point.v)>3.4)continue;
   saved.witnesses=saved.witnesses??{};
   const log=saved.witnesses[p.key]=saved.witnesses[p.key]??[];
   if(log.some(e=>e.kind===kind&&at-e.at<3600000))continue;
   log.push({kind,at});if(log.length>8)log.shift();
 }
}
export function recall(saved,person,at){
 const log=saved.witnesses?.[person.key];
 const e=log?.find(e=>!e.told&&at-e.at>=30000&&at-e.at<7*86400000&&recollections[e.kind]);
 if(!e)return null;
 e.told=true;
 const [line,reply]=recollections[e.kind];
 return [line,reply];
}
