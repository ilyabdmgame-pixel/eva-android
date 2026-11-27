const sinElevation = 1 / Math.sqrt(3);
const cosElevation = Math.sqrt(2 / 3);
export const defaultYaw = Math.PI / 4;

// The same orthographic basis is uploaded to the GPU and used for touch rays and labels.
export function camera({width,height,pixelsPerMeter:scale,u=0,v=0,yaw=defaultYaw}) {
  const cosYaw=Math.cos(yaw),sinYaw=Math.sin(yaw);
  return {width,height,scale,cosYaw,sinYaw,
    x:width/2-scale*(u*sinYaw-v*cosYaw),
    y:height/2-scale*sinElevation*(u*cosYaw+v*sinYaw)};
}

export function project(view,{u,v,z=0}) {
  const forward=u*view.cosYaw+v*view.sinYaw;
  return {
    x:view.x+view.scale*(u*view.sinYaw-v*view.cosYaw),
    y:view.y+view.scale*(forward*sinElevation-z*cosElevation),
    depth:forward*cosElevation+z*sinElevation
  };
}

export function worldAtHeight(view,x,y,z=0) {
  const across=(x-view.x)/view.scale;
  const forward=((y-view.y)/view.scale+z*cosElevation)/sinElevation;
  return {u:forward*view.cosYaw+across*view.sinYaw,v:forward*view.sinYaw-across*view.cosYaw,z};
}

export function inView(view,o,radius,height,margin=0) {
  const {x,y}=project(view,{u:o.u,v:o.v});
  const span=radius*(Math.abs(view.cosYaw)+Math.abs(view.sinYaw))*view.scale;
  const side=span+margin,depth=span*sinElevation+margin;
  return x+side>=0&&x-side<=view.width&&y+depth>=0&&y-depth-height*cosElevation*view.scale<=view.height;
}

// At the canonical 45° view one horizontal billboard unit spans both ground axes.
export function actorBillboardSpan(height,aspect){return height*cosElevation*aspect/Math.SQRT2;}
