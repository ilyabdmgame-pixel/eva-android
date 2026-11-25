import {fullness} from './economy.mjs';

// IDs refer to the same interactive fixtures that a tap selects.
const activities={
  orchard:[[357,'forage'],[355,'sit']],arcade:[[358,'buyBun'],[359,'plant'],[361,'sit']],
  courtyard:[[310,'stove'],[313,'toilet'],[203,'sit'],[204,'plant']],terrace:[[324,'shower'],[321,'basin'],[208,'sit'],[209,'plant']],
  home:[[300,'stove'],[301,'basin'],[302,'fridge'],[305,'screen'],[304,'shower'],[23,'books'],[24,'plant'],[2,'sit'],[22,'record'],[11,'blanket']],
  street:[[33,'shift'],[32,'sign'],[12,'sit']],
  school:[[61,'draw'],[64,'wash'],[65,'sellDrawing'],[63,'kit'],[62,'sit']],
  shop:[[71,'bouquet'],[72,'fill'],[77,'sell'],[73,'flowers'],[75,'buyRibbon'],[75,'buyPaper']],
  cafe:[[84,'coffee'],[84,'staffSnack'],[81,'sit'],[82,'tableWipe'],[87,'plant']],
  beach:[[94,'shell'],[95,'grass'],[91,'sit'],[97,'rescue']],
  lane:[[113,'mail'],[224,'dockShift'],[114,'sit'],[115,'plant']],
  garden:[[119,'forage'],[120,'sit'],[118,'plant']],
  park:[[125,'fountain'],[126,'sit']],
  square:[[128,'clock'],[129,'sit'],[132,'plant']],
  market:[[133,'buyBun'],[136,'plant'],[137,'sit']],
  promenade:[[143,'lookout'],[138,'sit'],[139,'sit']],
  pier:[[144,'dockShift'],[145,'bollard'],[146,'sit']],
  headland:[[151,'windsock'],[150,'sit'],[152,'plant']]
};

export function choosePastime(sector,objects,saved,cursor,at){
  const state=saved.economy,stock=state.stock,fed=fullness(state,at);
  const local=id=>objects.find(o=>o.sector===sector&&o.id===id);
  const food=['tea','bun','soda'].find(item=>stock[item]);
  const breakfast=sector==='home'&&(Math.floor(at/3600000)+3)%24<9;
  if(food&&fed<(breakfast?87:65)){
    const table=objects.find(o=>o.sector===sector&&['table','chair','cup'].includes(o.kind));
    if(table)return {object:table,action:'eatSnack',item:food,next:cursor};
  }
  if(!food&&fed<66&&(state.shifts.kitchen||0)<=at){
    const stove=objects.find(o=>o.sector===sector&&o.kind==='stove');if(stove)return {object:stove,action:'homeMeal',next:cursor};
  }
  const eligible={
    draw:stock.paper&&fed>=10,bouquet:stock.ribbon&&fed>=10,
    sell:stock.bouquet,sellDrawing:stock.drawing,shell:!saved.pickedShell,
    buyRibbon:!stock.ribbon&&state.coins>=2,buyPaper:!stock.paper&&state.coins>=2,
    staffSnack:fed<18&&!food&&state.coins<2,
    coffee:!stock.tea&&fed<80&&state.coins>=2,buyBun:!food&&fed<75&&state.coins>=3,
    shift:fed>=10&&(state.shifts.clean||0)<=at,dockShift:fed>=10&&(state.shifts.pier||0)<=at,
    forage:(state.shifts.gather||0)<=at
  };
  const choices=activities[sector]||[];
  for(let i=0;i<choices.length;i++){
    const index=(cursor+i)%choices.length;
    const [id,action]=choices[index],object=local(id);
    if(object&&(!(action in eligible)||eligible[action]))return {object,action,next:(index+1)%choices.length};
  }
  return null;
}
