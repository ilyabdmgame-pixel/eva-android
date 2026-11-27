import {streamScenes} from './stream-scenes.mjs';

const greetings=[
  'Так, я в эфире. Чат, как слышно?',
  'Сап, чат. Чай налила, погнали.',
  'Заходи, чат. Место у монитора есть.',
  'Кружку убрала с клавы. Начинаем.',
  'Сап. У кого сегодня дурацкая идея?'
];
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
      if(reply&&elapsed>=reply.at){
        const queued=reply;reply=null;
        if(elapsed<due){
          lastReply=lastReaction=elapsed;unanswered=0;scene.priorityReply=false;
          remember('eva',queued.text);
          return {id:id++,chat:false,text:queued.text,emotion:queued.emotion,respondsTo:queued.respondsTo};
        }
      }
      if(elapsed<due)return null;
      reply=null;
      if(index>=scene.lines.length)openScene();
      const [text,candidate,emotion]=scene.lines[index];
      const author=visit*7+sceneSerial*5+speakers[index%speakers.length];
      const cue={id:id++,chat:true,text,author};
      index++;viewerCount++;unanswered++;
      remember('viewer',text);
      due=elapsed+delay();
      if(candidate&&(lastReply===null||elapsed-lastReply>=minimumReplyGap&&
          (scene.priorityReply||unanswered>=3||random()<.48))){
        reply={at:elapsed+1200+Math.floor(random()*801),text:candidate,emotion,respondsTo:cue.id};
      }else if(emotion&&elapsed-lastReaction>=4200){
        cue.emotion=emotion;
        lastReaction=elapsed;
      }
      return cue;
    }
  };
}
