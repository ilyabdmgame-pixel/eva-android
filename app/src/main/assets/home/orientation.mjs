const directions={
  'down-right':{rear:false,flip:false},
  'down-left':{rear:false,flip:true},
  'up-right':{rear:true,flip:false},
  'up-left':{rear:true,flip:true},
  down:{rear:false,flip:false,row:2},up:{rear:true,flip:false,row:3},
  right:{rear:false,flip:false,row:4},left:{rear:false,flip:true,row:4}
};
export const gait={frames:8,columns:8,rows:7,aspect:160/192,anchorY:.935,bodyRatio:.885,stride:1.14};

// Positive u projects down-right and positive v projects down-left.
export function heading(u,v,previous='down-right'){
  const a=Math.abs(u),b=Math.abs(v);
  if(Math.max(a,b)<.014)return previous;
  const byU=u>0?'down-right':'up-left';
  const byV=v>0?'down-left':'up-right';
  if(Math.abs(a-b)<.065&&(byU===previous||byV===previous))return previous;
  return a>=b?byU:byV;
}
const compass=['down-right','down','down-left','left','up-left','up','up-right','right'];
export function walkHeading(u,v,previous='down-right'){
  if(Math.hypot(u,v)<1e-6)return previous;
  const angle=Math.atan2(v,u),prior=compass.indexOf(previous)*Math.PI/4;
  const distance=Math.atan2(Math.sin(angle-prior),Math.cos(angle-prior));
  if(Math.abs(distance)<Math.PI*.15)return previous;
  return compass[(Math.round(angle/(Math.PI/4))+8)%8];
}
export function orientation(direction){
  return directions[direction];
}

export function walkPose(actor,direction,distance){
  const {rear,flip,row}=orientation(direction);
  const column=Math.floor((distance%gait.stride)*gait.frames/gait.stride);
  return {key:'walk-'+actor,flip,row:row??(rear?1:0),column};
}

// Shoe centres in pixels on the 210 × 252 cells, ordered across each view.
const shoes=[
 [[69,183,151,216],[63,176,135,207],[78,170,116,202],[85,184,124,210],[76,175,142,221],[73,166,131,214],[96,166,103,203],[73,192,155,211]],
 [[83,222,143,169],[76,221,133,181],[88,201,97,183],[81,214,144,172],[71,221,147,186],[60,222,136,188],[89,177,116,205],[91,217,143,166]],
 [[95,198,112,212],[98,198,113,217],[94,175,107,218],[95,181,109,216],[98,212,115,183],[99,219,113,202],[99,215,116,181],[101,217,120,187]],
 [[96,195,111,213],[96,205,110,221],[101,193,104,222],[94,177,111,215],[99,212,113,191],[100,223,114,204],[96,188,111,218],[94,209,115,185]],
 [[70,209,152,214],[82,211,132,217],[92,186,108,215],[97,182,102,216],[73,215,150,213],[82,217,142,214],[96,186,106,216],[81,220,122,191]]
];

export function evaPose(direction,activity,phase=0){
  if(activity==='walk'){
    const pose=walkPose('eva',direction,phase);
    const step=(phase%gait.stride)*gait.frames/gait.stride;
    const next=(pose.column+1)%gait.frames;
    const weight=step-pose.column;
    const travel=shoes[pose.row][pose.column].map((value,i)=>(shoes[pose.row][next][i]-value)/(i%2?252:210));
    const feet=shoes[pose.row][pose.column].map((value,i)=>value/(i%2?252:210)+travel[i]*weight);
    return {...pose,height:1.62,step:{offset:(next-pose.column)/gait.columns,weight,feet,travel}};
  }
  return actionPose(direction,activity,phase);
}

export function standingPose(actor,direction){
 const {rear,flip,row}=orientation(direction);
 // Side and cardinal views have a feet-together passing cel in the walking atlas.
 return {key:'walk-'+actor,row:row??(rear?6:5),column:row===4?6:row===undefined?0:3,flip};
}

export function actionPose(direction,activity,amount=0,mood=null){
 const {rear,flip}=orientation(direction),row=['reach','stoop','sit','sleep'].indexOf(activity);
 if(row<0&&(!mood||orientation(direction).row!==undefined))return {...standingPose('eva',direction),height:1.62};
 const emotions=['wry','pleased','surprised','curious'];
 const column=row<0?Math.max(0,emotions.indexOf(mood)):Math.round(7*Math.min(1,Math.max(0,amount)));
 return {key:'act-eva-'+(rear?'rear':'front'),height:1.62,row:row<0?4:row,column,flip,atlasRows:5};
}
