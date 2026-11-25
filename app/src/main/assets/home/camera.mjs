const ROOT_2 = Math.sqrt(2);
const ROOT_3 = Math.sqrt(3);
const ROOT_6 = Math.sqrt(6);
const VERTICAL = Math.sqrt(2 / 3);

export function camera({ width, height, pixelsPerMeter, u = 0, v = 0 }) {
  return {
    width, height,
    scale: pixelsPerMeter,
    x: width / 2 - pixelsPerMeter * (u - v) / ROOT_2,
    y: height / 2 - pixelsPerMeter * (u + v) / ROOT_6
  };
}

export function project(view, { u, v, z = 0 }) {
  return {
    x: view.x + view.scale * (u - v) / ROOT_2,
    y: view.y + view.scale * ((u + v) / ROOT_6 - z * VERTICAL),
    depth: (u + v + z) / ROOT_3
  };
}

export function worldAtHeight(view, x, y, z = 0) {
  const difference = (x - view.x) * ROOT_2 / view.scale;
  const sum = ((y - view.y) / view.scale + z * VERTICAL) * ROOT_6;
  return { u: (sum + difference) / 2, v: (sum - difference) / 2, z };
}

export function inView(view,o,radius,height,margin=0){
  const x=view.x+view.scale*(o.u-o.v)/ROOT_2;
  const y=view.y+view.scale*(o.u+o.v)/ROOT_6;
  const side=radius*ROOT_2*view.scale+margin;
  const depth=radius*2/ROOT_6*view.scale+margin;
  return x+side>=0&&x-side<=view.width&&y+depth>=0&&y-depth-height*VERTICAL*view.scale<=view.height;
}

// Horizontal offsets are applied on BOTH ground axes by the billboard renderer.
export function actorBillboardSpan(height,aspect){
  return height*VERTICAL*aspect/ROOT_2;
}
