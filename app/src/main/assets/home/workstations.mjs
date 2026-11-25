// IDs are stable when the user moves a station. Durations are real seconds on site.
const jobs={
 school:{
  ren:[[61,'пишет этюд',9],[65,'выбирает краску',5],[63,'сверяет эскиз',6],[64,'промывает кисть',5]],
  nika:[[63,'смешивает краски',6],[64,'моет кисти',5],[61,'наносит мазки',9],[65,'убирает материалы',5]]},
 shop:{mio:[[71,'собирает букет',8],[73,'перебирает цветы',7],[72,'меняет воду',5]],kir:[[75,'сверяет накладную',6],[71,'передаёт заказ',5]]},
 cafe:{asya:[[84,'готовит заказ',7],[82,'накрывает столик',6],[87,'поливает растение',5]]},
 lane:{kir:[[113,'проверяет почту',5],[224,'разбирает посылки',8],[225,'сортирует конверты',7]]},
 pier:{kir:[[144,'сверяет доставку',8],[145,'осматривает причал',5]]}
};
export function nextStation(person,sector,fixtures,residents){
 const list=jobs[sector]?.[person.key];if(!list)return null;
 for(let n=0;n<list.length;n++){
   const index=((person.jobIndex||0)+n)%list.length,[id,label,seconds]=list[index];
   const object=fixtures.find(o=>o.id===id&&o.sector===sector);
   if(!object||residents.some(n=>n!==person&&n.job?.id===id))continue;
   person.jobIndex=(index+1)%list.length;
   return {object,id,label,seconds};
 }
 return null;
}
export function jobPose(person,t,reduced){
 const job=person.job;if(!job?.arrived)return null;
 const elapsed=Math.max(0,(t-job.start)/1000);
 const stroke=(1-Math.cos(elapsed*(person.key==='kir'?2.4:3.8)))/2;
 const blend=Math.min(1,elapsed/.38,Math.max(0,(job.end-t)/380));
 const amount=reduced?.75:blend*(.52+.48*stroke);
 return {key:'job-'+person.key,row:person.direction.startsWith('up')?1:0,column:Math.round(7*amount),
   flip:person.direction==='down-left'||person.direction==='up-left',atlasRows:2};
}
