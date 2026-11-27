import {faceUV} from './material-uv.mjs';
// Dimensions are metres. Local +y always faces the front of a piece of furniture.
export function fixtureFrame(fixture) {
  const {u, v, z = 0, w, d, turned, back} = fixture;
  const width = turned ? d : w, depth = turned ? w : d;
  function point(x, y, height) {
    const a = turned ? y : x, b = turned ? x : y;
    return [u + (back ? w - a : a), v + (back ? d - b : b), z + height];
  }
  function local([x,y,height]) {
    const a=back?u+w-x:x-u,b=back?v+d-y:y-v;
    return [turned?b:a,turned?a:b,height-z];
  }
  return {width, depth, point, local};
}

const shade = (color, gain) => color.map(channel => Math.min(1.16, channel * gain));
const tau = Math.PI * 2;
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const cross = ([x, y, z], [a, b, c]) => [y*c-z*b, z*a-x*c, x*b-y*a];
const unit = v => { const n = Math.hypot(...v) || 1; return v.map(k => k / n); };

export function roomMesh(renderer, fixture) {
  const {width, depth, point, local} = fixtureFrame(fixture);
  const id = fixture.id;

  function finishKey(mat,color){
    if(mat==='oak'||mat==='wood')return color===finish.walnut?'room-walnut':'room-oak';
    if(mat==='cloth')return color===finish.linen||color===finish.cream?'room-linen':'room-weave';
    if(mat)return mat;
    if(color===finish.black||color===finish.ink)return 'room-graphite';
    if(color===finish.steel)return 'room-steel';
    if(color===finish.brass)return 'room-brass';
    if(color===finish.porcelain)return 'room-enamel';
    if(color===finish.walnut)return 'room-walnut';
    if(color===finish.oak)return 'room-oak';
    return mat;
  }

  function face(vertices, color, material, lit = true, coordinates) {
    material=finishKey(material,color);
    const uv=coordinates??(material?.startsWith('room-')?faceUV(vertices):null);
    const points = vertices.map(p => point(...p));
    let tint = color;
    if (lit && material !== 'glow') {
      const normal = unit(cross(subtract(points[1], points[0]), subtract(points[2], points[0])));
      // Reflection in either room axis changes winding, but never changes which side catches the light.
      const sign = fixture.turned ? -1 : 1;
      const diffuse = sign * (.19 * normal[0] + .08 * normal[1] + .48 * normal[2]);
      tint = shade(color, .77 + diffuse);
    }
    if (points.length === 4) renderer.panel(points, tint, material, id, uv);
    else for (let i = 1; i + 1 < points.length; i++) renderer.triangle([points[0], points[i], points[i + 1]], tint, id, material,uv&&[uv[0],uv[i],uv[i+1]]);
  }

  function box(x, y, z, w, d, h, color, material) {
    const a = point(x, y, z), b = point(x + w, y + d, z);
    renderer.box(id, {u:Math.min(a[0],b[0]), v:Math.min(a[1],b[1]), z:a[2]},
      Math.abs(a[0]-b[0]), Math.abs(a[1]-b[1]), h, color, finishKey(material,color),local);
  }

  // Rounded upholstery, enamel and joinery share a continuous bevel at the corners.
  function cushion(x, y, z, w, d, h, radius, color, material) {
    const r = Math.max(.001, Math.min(radius, w*.45, d*.45)), lip = Math.min(r*.36,h*.24);
    function ring(inset, level) {
      const p = [], arc = Math.max(.0005, r-inset);
      for (const [cx,cy,angle] of [[x+w-r,y+d-r,0],[x+r,y+d-r,Math.PI/2],[x+r,y+r,Math.PI],[x+w-r,y+r,Math.PI*1.5]]) {
        for (let i=0;i<=3;i++) {
          const a=angle+i*Math.PI/6;
          p.push([cx+Math.cos(a)*arc,cy+Math.sin(a)*arc,level]);
        }
      }
      return p;
    }
    const rings=[ring(lip,z),ring(0,z+lip),ring(0,z+h-lip),ring(lip,z+h)];
    for(let row=0;row<3;row++){
      for(let i=0;i<rings[0].length;i++){
        const j=(i+1)%rings[0].length;
        face([rings[row][i],rings[row][j],rings[row+1][j],rings[row+1][i]],color,material);
      }
    }
    face(rings[3],color,material);
  }

  function backrest(x,y,z,w,d,h,rake,radius,color,material='cloth'){
    const r=Math.min(radius,w*.44,h*.44),lip=Math.min(.018,r*.35,d*.18);
    function outline(depth,inset){
      const ring=[];
      for(const [cx,cz,start] of [[x+w-r,z+h-r,0],[x+r,z+h-r,Math.PI/2],[x+r,z+r,Math.PI],[x+w-r,z+r,1.5*Math.PI]]){
        for(let i=0;i<=4;i++){
          const a=start+i*Math.PI/8,level=cz+Math.sin(a)*(r-inset);
          ring.push([cx+Math.cos(a)*(r-inset),y+depth+(level-z)*rake,level]);
        }
      }
      return ring;
    }
    const rings=[outline(0,lip),outline(lip,0),outline(d-lip,0),outline(d,lip)];
    // Clockwise in x/z faces -y, the front face at +y uses the opposite order.
    face(rings[0],color,material);
    face([...rings[3]].reverse(),color,material);
    for(let stage=0;stage<3;stage++)for(let i=0;i<rings[stage].length;i++){
      const j=(i+1)%rings[stage].length;
      face([rings[stage][j],rings[stage][i],rings[stage+1][i],rings[stage+1][j]],color,material);
    }
  }

  // Profiles run from bottom to top. The last ring is capped, so it can also be an inset surface.
  function vessel(x,y,profile,color,sides=14,material) {
    const rings=profile.map(([z,rx,ry=rx])=>Array.from({length:sides},(_,i)=>{
      const angle=i*tau/sides;
      return [x+Math.cos(angle)*rx,y+Math.sin(angle)*ry,z];
    }));
    for(let r=1;r<rings.length;r++){
      for(let i=0;i<sides;i++){
        const j=(i+1)%sides;
        face([rings[r-1][i],rings[r-1][j],rings[r][j],rings[r][i]],color,material);
      }
    }
    face(rings[rings.length-1],color,material);
  }

  function rod(start,end,r0,r1,color,sides=8) {
    const axis=unit(subtract(end,start));
    const a=unit(cross(Math.abs(axis[2])>.85?[1,0,0]:[0,0,1],axis)),b=cross(axis,a);
    function ring(center,r){
      return Array.from({length:sides},(_,i)=>center.map((p,n)=>p+r*(a[n]*Math.cos(tau*i/sides)+b[n]*Math.sin(tau*i/sides))));
    }
    const lower=ring(start,r0),upper=ring(end,r1);
    for(let i=0;i<sides;i++){
      const n=(i+1)%sides;
      face([lower[i],lower[n],upper[n],upper[i]],color);
    }
    face(upper,color);
  }

  return {width,depth,point,box,cushion,backrest,vessel,rod,face};
}

export const finish = {
  walnut:[.47,.31,.235], oak:[.76,.55,.39], edge:[.886,.699,.49], cream:[.93,.865,.735],
  ink:[.203,.199,.243], brass:[.803,.609,.367], mint:[.496,.663,.614], moss:[.289,.442,.366],
  blue:[.405,.516,.608], linen:[.845,.795,.709], burgundy:[.55,.30,.353], plum:[.443,.294,.403],
  rose:[.733,.465,.481], black:[.147,.151,.172], steel:[.621,.678,.676], porcelain:[.867,.885,.815]
};
