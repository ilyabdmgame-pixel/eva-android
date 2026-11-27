import {streamScenes} from './stream-scenes.mjs';

const greetings=[
  'Так, я в эфире. Чат, как слышно?',
  'Сап, чат. Чай налила, погнали.',
  'Заходи, чат. Место у монитора есть.',
  'Кружку убрала с клавы. Начинаем.',
  'Сап. У кого сегодня дурацкая идея?',
  'Микрофон слышит, как я ставлю кружку? Отлично, значит, и меня слышно.',
  'Так, вижу первый фонарик. Кто на этот раз следит за пробелом?',
  'Залетай. Сейчас будет один аккуратный прыжок. Про остальные договоримся отдельно.'
];
const gameMoments={
  flag:[
    ['Флаг! Кто успел заскринить?','Я успела убрать руку с пробела. Это пока весь мой фотоматериал.','pleased'],
    ['Крыши кончились, а ты доехала. Чат, протоколируйте.','В протокол запиши: до флага дошла на своих двоих.','pleased'],
    ['Финишная крыша пройдена!','Дай секунду полюбоваться. Я эту тряпочку на флагштоке честно заработала.','amused']],
  heart:[
    ['Минус сердечко. Оставшиеся забрать на хранение?','Знаю я ваше хранение. Вернёте скриншот сердечка.','wry'],
    ['Чат видел, как пропало сердце. Чат умеет молчать.','Тихие вы мои, я уже слышу, как клавиши затрещали.','amused']],
  lights:[
    ['Фонарики в углу считаются! Я думал, это декор.','Ещё какой счёт. За каждым пришлось лезть за край.','pleased'],
    ['О, лампочек уже на маленькую гирлянду хватит.','Перенесу победный свет на кухню. Над чайником будет аншлаг.','curious']]
};
const speakers=[0,1,2,0,3,1];
const minimumReplyGap=14000;
const expressions={
  amused:[1400,p=>[.009*Math.sin(p*5*Math.PI),.022*Math.sin(p*5*Math.PI)]],
  surprised:[1100,p=>[.010*Math.cos(p*Math.PI),-.034]],
  curious:[1600,()=>[.026,.008]],
  wry:[1300,p=>[-.021,.010*Math.cos(p*Math.PI)]],
  pleased:[1400,p=>[.008,.027*Math.sin(p*3*Math.PI)]]
};

export function streamExpression(emotion,elapsed){
  const expression=expressions[emotion];
  if(!expression||elapsed<=0||elapsed>=expression[0])return null;
  const phase=elapsed/expression[0],weight=Math.sin(Math.PI*phase)**2;
  const [x,y]=expression[1](phase);
  return {x:x*weight,y:y*weight};
}

export function createStreamDialogue(visit,random=Math.random){
  let sceneIndex=visit*9,sceneSerial=-1,scene,index,id=0,viewerCount=0;
  let due=delay(),reply=null,lastReply=null,lastReaction=-Infinity,unanswered=0;
  let pending=null,requestTopic,requests=0,lastRequest=-Infinity;
  const recent=[];
  let board=null,highlight=null,lastHighlight=-Infinity,highlightCount=0;

  function delay(){return 3000+Math.floor(random()*7001)}
  function openScene(){
    sceneSerial++;
    if(pending){
      scene=pending;pending=null;
    }else{
      const [topic,lines]=streamScenes[sceneIndex++%streamScenes.length];
      scene={topic,lines};
    }
    index=0;
  }
  function remember(role,text){
    recent.push({role,text});
    if(recent.length>5)recent.shift();
  }
  openScene();

  return {
    greeting:greetings[visit%greetings.length],
    observeGame(state){
      if(!state||!Number.isFinite(state.time))return;
      if(!board||state.time<board.time){
        board={};highlight=null;lastHighlight=-Infinity;
      }else{
        let event;
        if(state.stage>board.stage)event='flag';
        else if(state.hearts<board.hearts)event='heart';
        else if(Math.floor(state.score/6)>Math.floor(board.score/6))event='lights';
        if(event&&(!highlight||event==='flag')&&state.time-lastHighlight>16){
          const options=gameMoments[event];
          highlight={line:options[(visit+highlightCount++)%options.length],at:state.time};
          lastHighlight=state.time;
        }
      }
      board.time=state.time;board.stage=state.stage;board.score=state.score;board.hearts=state.hearts;
    },
    takeGeneration(elapsed,remaining){
      if(requests>=2||viewerCount<4||elapsed<12000||elapsed-lastRequest<80000||remaining<45000||pending)return null;
      lastRequest=elapsed;requests++;requestTopic=scene.topic;
      return {topic:requestTopic,context:recent.slice()};
    },
    addGenerated(lines){
      if(!requestTopic||!Array.isArray(lines)||lines.length!==5||!lines.every(line=>
        Array.isArray(line)&&line.length===3&&line.slice(0,2).every(text=>
          typeof text==='string'&&text.trim()&&text.length<=135&&!/[\r\n]/.test(text))&&
          Object.hasOwn(expressions,line[2])))return;
      pending={topic:requestTopic,lines,priorityReply:true};
      requestTopic=null;
    },
    next(elapsed){
      if(elapsed<due)return null;
      const current=reply;
      reply=null;
      const onTime=elapsed-due<10000;
      due=elapsed+delay();
      if(current&&onTime){
        lastReply=lastReaction=elapsed;unanswered=0;scene.priorityReply=false;
        remember('eva',current.text);
        return {id:id++,chat:false,text:current.text,emotion:current.emotion,respondsTo:current.respondsTo};
      }
      if(index>=scene.lines.length)openScene();
      const live=highlight&&board.time-highlight.at<=10?highlight.line:null;
      highlight=null;
      const [text,candidate,emotion]=live||scene.lines[index];
      const author=visit*7+sceneSerial*5+speakers[index%speakers.length];
      const cue={id:id++,chat:true,text,author};
      if(!live)index++;
      viewerCount++;unanswered++;
      remember('viewer',text);
      if(candidate&&(lastReply===null||elapsed-lastReply>=minimumReplyGap&&
          (scene.priorityReply||unanswered>=3||random()<.48))){
        reply={text:candidate,emotion,respondsTo:cue.id};
      }else if(emotion&&elapsed-lastReaction>=4200){
        cue.emotion=emotion;
        lastReaction=elapsed;
      }
      return cue;
    }
  };
}
