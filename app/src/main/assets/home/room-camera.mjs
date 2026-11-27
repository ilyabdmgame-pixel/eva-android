import {defaultYaw} from './camera.mjs';
const tau=2*Math.PI;
export const cameraDefaults=Object.freeze({yaw:defaultYaw,zoom:1});
export function roomCamera(value) {
  const yaw=Number.isFinite(value?.yaw)?value.yaw:defaultYaw;
  const zoom=Number.isFinite(value?.zoom)?value.zoom:1;
  return {yaw:((yaw%tau)+tau)%tau,zoom:Math.min(1.45,Math.max(.75,zoom))};
}
export function visibleRoomWalls(yaw) {
  return {u:Math.cos(yaw)>-.025,v:Math.sin(yaw)>-.025};
}

export function bindRoomCamera(canvas,{enabled,read,write,releaseTouch}) {
  const touches=new Map();
  let gesture=null;
  function fingers(){
    const [a,b]=touches.values();
    return {x:(a.x+b.x)/2,angle:Math.atan2(b.y-a.y,b.x-a.x),span:Math.max(12,Math.hypot(b.x-a.x,b.y-a.y))};
  }
  function finish(save){
    if(gesture&&save)write(read(),true);
    const ids=[...touches.keys()];
    gesture=null;touches.clear();
    for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||!enabled())return;
    if(gesture){
      // A replacement finger must not rebase an ongoing pair or leak a tap to furniture.
      e.stopImmediatePropagation();e.preventDefault();return;
    }
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size<2)return;
    const start=fingers();
    // Ordinary single-finger taps and the system navigation edge keep their original handlers.
    releaseTouch();
    gesture={...read(),...start};
    for(const id of touches.keys())canvas.setPointerCapture(id);
    e.stopImmediatePropagation();e.preventDefault();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(!gesture)return;
    if(touches.size!==2){e.stopImmediatePropagation();e.preventDefault();return;}
    const p=fingers(),delta=p.angle-gesture.angle;
    const turn=Math.atan2(Math.sin(delta),Math.cos(delta));
    const yaw=gesture.yaw+turn+(p.x-gesture.x)/Math.max(120,canvas.clientWidth)*Math.PI;
    write(roomCamera({yaw,zoom:gesture.zoom*p.span/gesture.span}),false);
    e.stopImmediatePropagation();e.preventDefault();
  },true);
  function up(e){
    if(!touches.has(e.pointerId))return;
    if(e.type==='lostpointercapture'&&canvas.hasPointerCapture(e.pointerId))return;
    if(!gesture){touches.delete(e.pointerId);return;}
    // Keep consuming the last finger until it lifts, so releasing a pinch never opens furniture.
    e.stopImmediatePropagation();e.preventDefault();
    touches.delete(e.pointerId);
    if(!touches.size)finish(true);
  }
  canvas.addEventListener('pointerup',up,true);
  canvas.addEventListener('pointercancel',up,true);
  canvas.addEventListener('lostpointercapture',up,true);
  window.addEventListener('blur',()=>finish(Boolean(gesture)));
  return ()=>finish(Boolean(gesture));
}
