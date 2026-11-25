// Bases are in actor space: forward, across the street, up. Both the painted
// surface and its pick ID follow this transform, including between cardinal views.
const tau=Math.PI*2;
function painter(r,id,pose,variant=0){
  function put(name,center,x,y,z,flex=0){
    const {u,v,du,dv}=pose;
    const axis=([a,b,c])=>[du*a-dv*b,dv*a+du*b,c,0];
    const [a,b,h]=center;
    r.illustratedPart(name,[...axis(x),...axis(y),...axis(z),
      u+du*a-dv*b,v+dv*a+du*b,pose.z+h,1],id,variant,flex);
  }
  function solid(name,x,y,z,length,width,height,pitch=0){
    const c=Math.cos(pitch),s=Math.sin(pitch);
    put(name,[x,y,z],[length*c,0,length*s],[0,width,0],[-height*s,0,height*c]);
  }
  function bone(name,a,b,width,depth){
    const [x,y,z]=a,dx=b[0]-x,dz=b[2]-z,len=Math.hypot(dx,dz);
    // The printed top of the bone stays at the upper joint; add a little overlap.
    put(name,[x+dx/2,y,z+dz/2],[-dz/len*width,0,dx/len*width],[0,depth,0],
      [-dx*(.5+.013/len),0,-dz*(.5+.013/len)]);
  }
  function portrait(kind,at,width,height){
    const lateral=(pose.du-pose.dv)*Math.SQRT1_2;
    const forward=Math.max(-1,Math.min(1,(pose.du+pose.dv)*Math.SQRT1_2));
    const frame=Math.round(Math.acos(forward)/Math.PI*16);
    const facing=lateral<0?-1:1;
    const b=1/Math.sqrt(6);
    // Express the camera basis in actor coordinates: the centre still tracks
    // the animal's neck in 3D while the silhouette has the painted head shape.
    put(kind+'Face'+frame,at,[lateral*width*facing,-forward*width*facing,0],
      [b*(pose.du+pose.dv)*height,b*(pose.du-pose.dv)*height,-2*b*height],[0,0,0]);
  }
  return {put,solid,bone,portrait};
}
export function drawCar(r,id,pose,red){
  const p=painter(r,id,pose,red?7:0);
  p.solid('car',0,0,.713,1.38,.607,.468);
  const angle=(pose.distance??0)/.255,c=Math.cos(angle),s=Math.sin(angle);
  for(const side of [-1,1]){
    for(const x of [-.838,.886]){
      // The axle and cylindrical tread connect the painted wheel faces.
      const wheel=[x,side*.515,.249],rad=.249;
      p.put('tyre',wheel,[rad*c,0,-rad*s],[0,.052,0],[rad*s,0,rad*c]);
      for(const dy of [-.053,.053]){
        p.put('wheel',[x,wheel[1]+dy,wheel[2]],[rad*c,0,-rad*s],[-rad*s,0,-rad*c],[0,0,0]);
      }
    }
    p.put('mirror',[.51,side*.628,.755],[0,side*.09,.008],[0,0,-.051],[0,0,0]);
  }
}
export function drawCat(r,id,pose,distance,grey,rest=0){
  const p=painter(r,id,pose,grey?8:0),phase=distance/.37;
  const bob=.004*Math.cos(tau*2*phase);
  p.solid('catBody',-.024,0,.276+bob,.235,.105,.118);
  p.portrait('cat',[.185,0,.407+bob],.121,.133);
  const sway=.055*Math.sin(tau*phase*.5);
  const pitch=-.79+.11*Math.cos(tau*phase*.5);
  const tail=.165;
  p.put('tail',[-.222-tail*Math.cos(pitch),sway/2,.302+bob-tail*Math.sin(pitch)],
    [tail*Math.cos(pitch),-sway/2,tail*Math.sin(pitch)],[0,.031,0],[-.044*Math.sin(pitch),0,.044*Math.cos(pitch)],phase*tau*.34);
  for(const side of [-1,1])for(const front of [false,true]){
    const x=front?.125:-.163,y=side*.061;
    const f=(phase+(side>0?.5:0)+(front?.13:0))%1,stance=.59;
    const q=Math.max(0,(f-stance)/(1-stance));
    const along=f<stance?.37*(stance/2-f):.37*stance*(q-.5)-.37*Math.sin(tau*q)/tau;
    const lift=.034*Math.sin(Math.PI*q)**2;
    const hip=[x,y,.263+bob],toe=[x+along*(1-rest),y,.048+lift*(1-rest)];
    const dx=toe[0]-x,dz=toe[2]-hip[2],length=Math.hypot(dx,dz);
    const bend=Math.sqrt(Math.max(0,(front?.123:.139)**2-(length/2)**2))*(front?-.65:.76);
    const knee=[x+dx/2-dz/length*bend,y,hip[2]+dz/2+dx/length*bend];
    p.bone(front?'foreThigh':'hindThigh',hip,knee,front?.035:.05,.033);
    p.bone(front?'foreShin':'hindShin',knee,toe,.027,.025);
    p.solid('paw',toe[0]+.018,y,.029+lift*(1-rest),.044,.030,.029);
  }
}
export function drawPigeon(r,id,pose,m){
  const p=painter(r,id,pose),spread=m.spread,tuck=Math.min(1,m.lift/.21);
  const step=m.distance/.18,nod=(1-tuck)*.013*Math.sin(step*tau);
  p.solid('birdBody',-.008,0,.124,.128,.073,.087,.07+tuck*.10);
  p.portrait('bird',[.093+nod,0,.204],.073,.078);
  p.put('fan',[-.141,0,.114],[-.071,0,-.013],[0,.051+spread*.017,0],[0,0,0]);
  for(const side of [-1,1]){
    p.put('foldedWing',[-.031,side*.052,.143], [.103,0,.029],[.010,side*.022,-.047],[0,0,0]);
    // The root stays at the shoulder. As the bird takes off, the span opens
    // laterally while the chord keeps its thickness in projection.
    const x=-.108+.106*spread,y=side*(.014+.29*spread);
    const z=-.038+spread*(.075+.135*m.beat);
    const chord=[-.012-.055*spread,side*.010,-.036*(1-spread)-.015*spread*m.beat];
    p.put('wing',[.027+x*.5,side*.049+y*.5,.168+z*.5],[x*.5,y*.5,z*.5],chord,[0,0,.055],-spread*m.beat);
    const f=(step+(side>0?.5:0))%1;
    const lift=f<.55?0:.02*Math.sin((f-.55)/.45*Math.PI);
    const swing=.030*Math.cos(tau*f)*(1-tuck);
    p.put('birdFoot',[swing-.020*tuck,side*.028,.051+lift+.036*tuck],
      [.029,0,.001],[swing*.5-.018*tuck,0,-.043+.026*tuck],[0,0,0]);
  }
}
