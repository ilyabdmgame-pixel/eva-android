// Cells in the painted 2048×2048 atlas. Repetitions are measured in fixture-local metres.
const finish=(cell,width,height,light,dye=[1,1,1])=>({cell,width,height,light,dye});
export const roomMaterials={
  'room-floor':finish(0,3.6,2.9,.96),
  'room-walnut':finish(1,1.09,.70,.39),
  'room-painted-wood':finish(2,1.14,.88,.56),
  'room-oak':finish(3,1.16,.72,.67),
  'room-plaster':finish(4,2.12,2.12,.91),
  'room-wallpaper':finish(5,1.40,1.40,.82),
  'room-tiles':finish(6,1.08,1.08,.85),
  'room-brick':finish(7,1.47,1.04,.76),
  'room-quilt':finish(8,1,1,.48),
  'room-rug':finish(9,1,1,.95),
  'room-linen':finish(10,.64,.64,.84),
  'room-runner':finish(10,.43,.43,.67,[.55,.79,.68]),
  'room-weave':finish(11,.86,.91,.47),
  'room-graphite':finish(12,.51,.51,.25),
  'room-steel':finish(12,.42,.42,.61,[1.20,1.22,1.21]),
  'room-enamel':finish(13,.80,.80,.84),
  'room-brass':finish(13,.40,.40,.64,[.93,.69,.44]),
  'room-glaze':finish(14,.57,.57,.56),
  'room-leaf':finish(15,.23,.23,.415)
};
export function roomTint(color,material){
  const l=.24*color[0]+.59*color[1]+.17*color[2];
  const light=Math.max(.40,Math.min(1.16,.97*(l/material.light)**.72));
  return color.map((c,i)=>light*material.dye[i]*(1+.16*(c-l)));
}
