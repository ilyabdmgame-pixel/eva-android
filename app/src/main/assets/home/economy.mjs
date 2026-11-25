export const fixtureItems={2:'foldingChair',24:'monstera',62:'stool',63:'artKit',72:'bucket',85:'crate',92:'radio'};
export const items={
  foldingChair:{name:'Складной стул'},monstera:{name:'Монстера'},stool:{name:'Табурет'},
  artKit:{name:'Этюдник'},bucket:{name:'Ведро Мио'},crate:{name:'Ящик газировки'},radio:{name:'Магнитола'},
  bun:{name:'Булочка',food:42,price:3,art:'cafe-bun',height:.118},
  tea:{name:'Чай',food:20,price:2,art:'mug',height:.19},
  soda:{name:'Газировка',food:24,price:2,art:'soda-bottle',height:.205},
  ribbon:{name:'Лента',price:2,art:'florist-ribbon',height:.095},
  paper:{name:'Бумага',price:2,art:'sketch-paper',height:.105},
  bouquet:{name:'Готовый букет',art:'flowers',height:.39},
  drawing:{name:'Этюд',art:'landscape-study',height:.168},
  shell:{name:'Ракушка',art:'scallop-shell',height:.11},
  lamp:{name:'Настольная лампа',price:9,art:'brass-desk-lamp',height:.48},
  pot:{name:'Горшок с растением',price:7,art:'potted-succulent',height:.34},
  can:{name:'Пустая банка',art:'discarded-can',height:.109},
  blossom:{name:'Весенний цветок',art:'flowers',height:.20},
  leaf:{name:'Лист для гербария',art:'maple-leaf',height:.076},
  pinecone:{name:'Шишка',art:'pinecone',height:.092}
};

export function initialEconomy(previous,legacy={},now=Date.now()){
  if(previous?.version===1)return previous;
  const stock={paper:1,ribbon:1,bun:1};
  if(legacy.pickedShell)stock.shell=1;
  if(Number.isInteger(legacy.cans)&&legacy.cans>0)stock.soda=Math.min(99,legacy.cans);
  return {version:1,coins:4,fullness:83,at:now,stock,placements:[],next:1,shifts:{},completed:0};
}

export function fullness(state,now){
  return Math.max(0,state.fullness-Math.max(0,(now-state.at))/900_000);
}

const amount=(state,item)=>state.stock[item]||0;
const copy=state=>({...state,stock:{...state.stock},shifts:{...state.shifts},placements:[...state.placements]});
const count=(state,item,delta)=>{
  const n=amount(state,item)+delta;
  if(n>0)state.stock[item]=n;
  else delete state.stock[item];
};
export function apply(state,op,now=Date.now()){
  const item=items[op.item];
  const next=copy(state);
  next.fullness=fullness(state,now);next.at=Math.max(state.at,now);
  const fail=reason=>({state,ok:false,reason});
  const done=()=>({state:next,ok:true});
  switch(op.type){
    case 'buy':
      if(!item?.price)return fail('Такой вещи в продаже нет.');
      if(state.coins<item.price)return fail('Монет не хватает. Кошелёк издал грустный звук.');
      next.coins-=item.price;count(next,op.item,1);return done();
    case 'eat':
      if(!item?.food||!amount(state,op.item))return fail('В кармане пусто.');
      if(next.fullness>=97)return fail('Попозже. Я не бездонный рюкзак.');
      count(next,op.item,-1);
      if(op.item==='soda')count(next,'can',1);
      next.fullness=Math.min(100,next.fullness+item.food);
      return done();
    case 'pickup':
      if(!item)return fail('Эту штуку в карман не запихнуть.');
      if(op.id){
        if(!state.placements.some(p=>p.id===op.id&&p.item===op.item))return fail('Уже забрала.');
        next.placements=next.placements.filter(p=>p.id!==op.id);
      }
      count(next,op.item,1);return done();
    case 'drop':
      if(!item||!amount(state,op.item))return fail('Такой вещи уже нет в кармане.');
      if(next.placements.length>=30)return fail('По городу уже разложено 30 вещей. Подберу что-нибудь для начала.');
      if(!Number.isFinite(op.u)||!Number.isFinite(op.v))return fail('Туда поставить не выйдет.');
      count(next,op.item,-1);
      next.placements.push({id:next.next++,item:op.item,u:op.u,v:op.v});
      return done();
    case 'toggle': {
      const index=next.placements.findIndex(p=>p.id===op.id&&p.item==='lamp');
      if(index<0)return fail('Лампа пока в кармане.');
      const entry=next.placements[index];
      next.placements[index]={...entry,on:!entry.on};return done();
    }
    case 'discard':
      if(!amount(state,'can'))return fail('Даже урне у меня нечего предложить.');
      count(next,'can',-1);return done();
    case 'make': {
      const needs=op.item==='bouquet'?'ribbon':op.item==='drawing'?'paper':null;
      if(!needs||!amount(state,needs))return fail('Нужен расходник. Куплю у полки в цветочной лавке.');
      if(next.fullness<10)return fail('Я голодная. Сначала поем, потом изображу трудоголика.');
      count(next,needs,-1);count(next,op.item,1);next.fullness-=6;return done();
    }
    case 'sell': {
      const pay=op.item==='bouquet'?6:op.item==='drawing'?5:0;
      if(!pay||!amount(state,op.item))return fail('Сначала сделаю заказ. Воздух пока не принимают.');
      count(next,op.item,-1);next.coins+=pay;next.completed++;return done();
    }
    case 'shift': {
      const key=op.site==='pier'?'pier':'clean';
      const wait=next.shifts[key]||0;
      if(wait>now)return fail('Уборка недавно была. Грязи дай хоть пару секунд пожить.');
      if(next.fullness<10)return fail('С голодухи сейчас швабру съем. Сначала перекушу.');
      next.shifts[key]=now+30_000;next.coins+=key==='pier'?4:3;next.fullness-=8;next.completed++;return done();
    }
    case 'forage':
      if(!['blossom','leaf','pinecone'].includes(op.item))return fail('Собирать тут нечего.');
      if((next.shifts.gather||0)>now)return fail('Тут недавно прошлась. Дай природе минутку.');
      next.shifts.gather=now+60_000;count(next,op.item,1);return done();
    case 'homeMeal':
      if(next.fullness>=66||(next.shifts.kitchen||0)>now)return fail('Обед ещё не нужен.');
      next.fullness=Math.min(100,next.fullness+36);next.shifts.kitchen=now+4*3600000;return done();
    case 'break':
      if(next.fullness>=18||state.coins>=2||state.stock.bun||state.stock.tea||state.stock.soda)
        return fail('Запасной перекус только если совсем прижало.');
      next.fullness=33;return done();
    default:return fail('С этим действием вышла хрень.');
  }
}
