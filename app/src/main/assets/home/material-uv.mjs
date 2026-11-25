// Planar coordinates belong to the face and stay constant as the camera pans.
export function faceUV(points,roof=false){
  const [a,b,c]=points;
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
  const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  const horizontal=Math.hypot(nx,ny);
  if(roof&&Math.abs(nz)>.000001&&horizontal>Math.abs(nz)*.08){
    const sign=Math.sign(nz),x=sign*nx/horizontal,y=sign*ny/horizontal;
    const slope=Math.hypot(horizontal,nz)/Math.abs(nz);
    return points.map(([u,v])=>[u*y-v*x,(u*x+v*y)*slope]);
  }
  if(Math.abs(nz)>=Math.max(Math.abs(nx),Math.abs(ny)))return points.map(([u,v])=>[u,v]);
  const along=Math.abs(nx)>Math.abs(ny)?1:0;
  return points.map(p=>[p[along],-p[2]]);
}
