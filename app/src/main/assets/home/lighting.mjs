// The viewer is on the positive u/v side. A vertical post casts away from the lens.
export function shadowOffset(height,inside=false){
  const reach=height*(inside?.58:1);
  return [-.48*reach,-.34*reach];
}
export function wallShadow(renderer,u,v,w,d,height){
  const [du,dv]=shadowOffset(height),z=.025;
  for(const [a,b] of [[[u,v],[u,v+d]],[[u,v],[u+w,v]]])
    renderer.shadeBand([[...a,z],[...b,z],[b[0]+du,b[1]+dv,z],[a[0]+du,a[1]+dv,z]],false);
}

// Vertices contain u, v, z and the silhouette UV. Keep the UV at a clipped edge.
export function clipToReceiver(points,box){
  let polygon=points;
  for(const [axis,edge,sign] of [[0,box.u,1],[0,box.u+box.w,-1],[1,box.v,1],[1,box.v+box.d,-1]]){
    if(!polygon.length)break;
    const result=[];
    let a=polygon.at(-1),da=sign*(a[axis]-edge);
    for(const b of polygon){
      const db=sign*(b[axis]-edge);
      if((da<0)!==(db<0)){
        const t=da/(da-db);
        result.push(a.map((x,i)=>x+t*(b[i]-x)));
      }
      if(db>=0)result.push(b);
      a=b;da=db;
    }
    polygon=result;
  }
  return polygon;
}
