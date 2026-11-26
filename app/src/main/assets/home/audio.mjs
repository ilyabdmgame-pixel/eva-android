let enabled=false,visible=true,volume=.42;
let context,master,bed,bedFilter,bedLevel,grain,lastStep=0,profile='';
let chirpAt=0;
const songs={
  uiTap:[430],chatTap:[587,784],stream:[392,523,659],
  record:[147,196,220,196,175,165,147],television:[91,152,96,181],vending:[415,311],
  radio:[196,220,233,261,196,174,196,233],coffee:[93,101,113],sell:[494,740],lamp:[187],grass:[138,117,104],
  chime:[622,830,1046],water:[490,520,588],press:[260,310],pickup:[420,610]
};
function updateMaster(){
 if(master)master.gain.setTargetAtTime(enabled&&visible?volume:0,context.currentTime,.07);
}
function waveform(){
 const frames=context.sampleRate*3,data=context.createBuffer(1,frames,context.sampleRate),b=data.getChannelData(0);
 let s=0;
 for(let i=0;i<frames;i++){s=(s+Math.random()*.16-.08)/1.08;b[i]=s*3;}
 return data;
}
export function prepareSound(){
 if(!enabled||!visible)return;
 try{
   if(!context){
     context=new AudioContext();
     master=context.createGain();master.gain.value=0;master.connect(context.destination);
     grain=waveform();
     bed=context.createBufferSource();bed.buffer=grain;bed.loop=true;
     bedFilter=context.createBiquadFilter();bedFilter.type='lowpass';
     bedLevel=context.createGain();bedLevel.gain.value=0;
     bed.connect(bedFilter).connect(bedLevel).connect(master);bed.start();
   }
   updateMaster();
   if(context.state!=='running')context.resume().catch(()=>{});
 }catch{}
}
export function settings(on,level){
 enabled=Boolean(on);volume=Number.isFinite(level)?Math.max(0,Math.min(1,level)):.42;updateMaster();
 if(enabled&&visible)prepareSound();
 else if(context)context.suspend().catch(()=>{});
}
export function audioVisible(next){
 visible=next;updateMaster();
 if(!visible&&context)context.suspend().catch(()=>{});
 else if(enabled)prepareSound();
}
function note(hz,at,length,level,type='sine'){
 const oscillator=context.createOscillator(),g=context.createGain();
 oscillator.type=type;oscillator.frequency.value=hz;
 g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.015);
 g.gain.exponentialRampToValueAtTime(.0001,at+length);
 oscillator.connect(g).connect(master);oscillator.start(at);oscillator.stop(at+length+.022);
}
export function sound(kind){
 if(!enabled||!visible||context?.state!=='running')return;
 const list=songs[kind];if(!list)return;
 const interval=['radio','record'].includes(kind)?.19:.11;
 for(const [i,hz] of list.entries())note(hz,context.currentTime+.01+i*interval,interval,kind==='radio'?.075:.045,kind==='radio'?'triangle':'sine');
}
export function ambience(weather,zone,outside,open=false){
 if(!enabled||!visible||context?.state!=='running')return;
 const key=weather+'/'+zone+'/'+outside+'/'+open;
 const t=context.currentTime;
 if(key!==profile){
   profile=key;
   const coast=['beach','promenade','pier','headland'].includes(zone);
   const state=!outside?({
     rain:open?[1380,.24]:[470,.06],storm:open?[1110,.33]:[410,.09],
     wind:open?[580,.14]:[380,.03]
   }[weather]||[470,.013]):weather==='storm'?[1900,.76]:weather==='rain'?[2350,.65]:
     weather==='wind'?[640,.31]:coast?[780,.44]:weather==='snow'?[580,.14]:[830,.12];
   bedFilter.frequency.setTargetAtTime(state[0],t,.8);bedLevel.gain.setTargetAtTime(state[1],t,1.10);
   chirpAt=t+3;
 }
 if(t>chirpAt){
   chirpAt=t+5+Math.random()*12;
   if(outside&&['clear','cloudy'].includes(weather)&&['park','garden','lane','headland'].includes(zone)){
     note(1760,t,.094,.032);note(2250,t+.10,.11,.026);note(1970,t+.24,.07,.018);
   }
   if(outside&&weather==='storm'){
     note(39,t,1.5,.085,'triangle');note(53,t+.14,1.1,.045);
   }
 }
}
export function footstep(surface){
 if(!enabled||!visible||context?.state!=='running')return;
 const t=context.currentTime;
 if(t-lastStep<.18)return;
 lastStep=t;
 const [hz,gain,duration]={
   wood:[670,.21,.10],stone:[1430,.20,.075],snow:[2010,.23,.13],
   sand:[740,.15,.12],wet:[2520,.23,.099],grass:[1100,.15,.095]
 }[surface]||[1300,.15,.085];
 const n=context.createBufferSource(),filter=context.createBiquadFilter(),g=context.createGain();
 n.buffer=grain;
 filter.type='bandpass';filter.frequency.value=hz;filter.Q.value=.67;
 g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(gain,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+duration);
 n.connect(filter).connect(g).connect(master);n.start(t,Math.random()*2.7,duration+.01);
}

export function audioState(){return {enabled,visible,state:context?.state||'not-started',profile};}
