// Intersect the viewing ray with the front, side or top of a sprite's physical volume.
// Every shift along (1,1,1) preserves its projected screen position.
export function surfaceTriangles(corners,uv,limits){
 const [l,t,r,b]=uv;
 const vertices=corners.map((p,i)=>[...p,i===0||i===3?l:r,i<2?t:b]);
 const triangles=[];
 for(let plane=0;plane<3;plane++){
   let poly=vertices;
   for(let other=0;other<3&&poly.length;other++){
     if(other===plane)continue;
     const side=p=>(limits[other]-p[other])-(limits[plane]-p[plane]);
     const clipped=[];
     for(let i=0;i<poly.length;i++){
       const a=poly[i],end=poly[(i+1)%poly.length],da=side(a),db=side(end);
       if(da>=0)clipped.push(a);
       if((da<0)!==(db<0)){
         const f=da/(da-db);
         clipped.push(a.map((v,k)=>v+(end[k]-v)*f));
       }
     }
     poly=clipped;
   }
   const placed=poly.map(([u,v,z,s,t])=>{
     const shift=limits[plane]-[u,v,z][plane];
     return [u+shift,v+shift,z+shift,s,t];
   });
   for(let i=1;i+1<placed.length;i++)triangles.push(placed[0],placed[i],placed[i+1]);
 }
 return triangles;
}
