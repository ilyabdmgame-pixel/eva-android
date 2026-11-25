const localTime=new Intl.DateTimeFormat('en-GB',{
  year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'
});
export const seasons={
  spring:{name:'Весна',ground:[.89,1,.88],trees:'tree-spring',resource:'blossom'},
  summer:{name:'Лето',ground:[.87,1,.82],trees:'tree-summer',resource:'leaf'},
  autumn:{name:'Осень',ground:[1,.84,.68],trees:'tree-autumn',resource:'leaf'},
  winter:{name:'Зима',ground:[.87,.93,1],trees:'tree-winter',resource:'pinecone'}
};
export const weathers={
  clear:{name:'ясно',light:[1.05,1.02,.96]},
  cloudy:{name:'облачно',light:[.91,.95,1]},
  rain:{name:'дождь',light:[.73,.83,.99],wet:true},
  storm:{name:'гроза',light:[.61,.70,.89],wet:true},
  fog:{name:'туман',light:[.94,.98,1]},
  snow:{name:'снег',light:[.91,.98,1.09],snow:true},
  wind:{name:'ветрено',light:[.94,.98,1]}
};
const weighted={
  spring:['clear','rain','cloudy','wind','rain','clear','fog','cloudy'],
  summer:['clear','clear','cloudy','storm','clear','rain','wind','clear'],
  autumn:['cloudy','rain','fog','clear','wind','rain','cloudy','storm'],
  winter:['snow','cloudy','clear','snow','wind','fog','snow','cloudy']
};
export function seasonFor(month){
  return month<=2||month===12?'winter':month<=5?'spring':month<=8?'summer':'autumn';
}
function roll(n){
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  return (n^(n>>>16))>>>0;
}
export function climateAt(instant,options={}){
  const local=Object.fromEntries(localTime.formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  const season=Object.hasOwn(seasons,options.season)?options.season:seasonFor(local.month);
  const slot=local.year*4100+local.month*340+local.day*9+Math.floor((local.hour*60+local.minute)/180);
  const natural=weighted[season][roll(slot)%weighted[season].length];
  const weather=Object.hasOwn(weathers,options.weather)?options.weather:natural;
  const daylight=(()=>{
    const hour=local.hour+local.minute/60;
    const day=({winter:[8.7,16.3],spring:[6,19.4],summer:[4.4,22],autumn:[7,18]})[season];
    return Math.max(0,Math.min(1,(hour-day[0]+1)/1.7,(day[1]+1.15-hour)/1.75));
  })();
  return {season,weather,daylight,slot};
}
export function paletteFor(climate,outside){
  const outdoor=weathers[climate.weather].light;
  return outside?outdoor:outdoor.map(x=>.88+x*.12);
}
export function terrainState(climate){
  const weather=weathers[climate.weather];
  return {season:climate.season,wet:Boolean(weather.wet),snow:climate.season==='winter'||Boolean(weather.snow)};
}

export function widgetWeather(labels){
  const rules=[
    ['storm',/гроз|гром|thunder|lightning/i],['snow',/снег|снеж|метел|мокрый снег|snow|sleet|blizzard/i],
    ['rain',/дожд|ливен|ливн|морос|rain|shower|drizzle/i],['fog',/туман|дымк|fog|mist|haze/i],
    ['cloudy',/облач|пасмур|cloud|overcast/i],['clear',/ясно|солнеч|clear|sunny/i],['wind',/ветрен|ветрено|windy/i]
  ];
  const texts=labels.filter(s=>typeof s==='string'&&!/завтра|вчера|tomorrow|yesterday/i.test(s));
  const area=texts.find(s=>s.startsWith('area=')&&!/мо[её] местоположение|my location/i.test(s))?.slice(5)||null;
  const current=texts.filter(s=>!s.startsWith('area=')&&!/район|округ|district|максим|миним|high:|low:|макс\.|мин\./i.test(s));
  const weather=rules.find(([,pattern])=>current.some(s=>pattern.test(s)))?.[0]??null;
  let temperature=null;
  for(const s of current){
    const temps=[...s.matchAll(/([+−-]?\d{1,3})\s*[°℃℉]\s*([CFС]?)/gi)];
    if(temperature===null&&temps.length===1&&!/макс|мин\.|высшая|низшая|high:|low:/i.test(s)){
      const [match,n,unit]=temps[0];temperature=n+'°'+(unit.toUpperCase()==='F'||match.includes('℉')?'F':'');
    }
  }
  return {weather,temperature,area};
}

const cityConditions={
  0:['clear','ясно'],1:['clear','малооблачно'],2:['cloudy','переменная облачность'],3:['cloudy','пасмурно'],
  45:['fog','туман'],48:['fog','ледяной туман'],
  51:['rain','слабая морось'],53:['rain','морось'],55:['rain','сильная морось'],
  56:['rain','ледяная морось'],57:['rain','сильная ледяная морось'],
  61:['rain','небольшой дождь'],63:['rain','дождь'],65:['rain','сильный дождь'],
  66:['rain','ледяной дождь'],67:['rain','сильный ледяной дождь'],
  71:['snow','небольшой снег'],73:['snow','снег'],75:['snow','сильный снег'],77:['snow','снежные зёрна'],
  80:['rain','небольшой ливень'],81:['rain','ливень'],82:['rain','сильный ливень'],
  85:['snow','снежный заряд'],86:['snow','сильный снежный заряд'],
  95:['storm','гроза'],96:['storm','гроза с градом'],99:['storm','гроза с крупным градом']
};
export function cityReading(data,now){
  if(!data||!Number.isFinite(data.at)||!Number.isFinite(data.degrees)||data.at>now+900000||now-data.at>6*3600000)return null;
  const condition=cityConditions[data.code];
  if(!Array.isArray(condition))return null;
  const [weather,description]=condition;
  return {weather,description,temperature:Math.round(data.degrees)+' °C',at:data.at,stale:now-data.at>90*60000};
}
