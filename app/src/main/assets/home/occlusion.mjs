// Intersect the viewing ray with the front, side or top of a sprite's physical volume.
// Every shift along (1,1,1) preserves its projected screen position.
export function surfaceTriangles(corners,uv,limits,floor){
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
     const shift=Math.max(limits[plane]-[u,v,z][plane],floor===undefined?-Infinity:floor-z);
     return [u+shift,v+shift,z+shift,s,t];
   });
   for(let i=1;i+1<placed.length;i++)triangles.push(placed[0],placed[i],placed[i+1]);
 }
 return triangles;
}

// Three marked soles in each cutout map to the same ground points used for collisions.
const contacts={
 'writing-desk':[[.054,.683],[.722,.993],[.953,.841]],
 'desk-chair':[[.105,.847],[.529,.990],[.953,.837]],
 'single-bed':[[.028,.842],[.367,.992],[.964,.576]],
 'tv-cabinet':[[.050,.597],[.733,.993],[.937,.811]],
 'vinyl-shelf':[[.048,.747],[.738,.992],[.979,.894]],
 'cafe-settee':[[.049,.884],[.273,.995],[.947,.676]]
};

export function furnitureCorners(key,{u,v,z=0},[w,d],flipped){
 const marks=contacts[key];
 if(!marks)return null;
 const [a,b,c]=marks;
 const ab=[b[0]-a[0],b[1]-a[1]],ac=[c[0]-a[0],c[1]-a[1]];
 const area=ab[0]*ac[1]-ab[1]*ac[0];
 const floor=[[.03,.95],[.97,.95],[.97,.05]].map(([x,y])=>
   flipped?[(y-.5)*w,(x-.5)*d]:[(x-.5)*w,(y-.5)*d]);
 return [[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{
   const dx=x-a[0],dy=y-a[1];
   const s=(dx*ac[1]-dy*ac[0])/area,t=(ab[0]*dy-ab[1]*dx)/area;
   const du=floor[0][0]+s*(floor[1][0]-floor[0][0])+t*(floor[2][0]-floor[0][0]);
   const dv=floor[0][1]+s*(floor[1][1]-floor[0][1])+t*(floor[2][1]-floor[0][1]);
   return [u+(du-dv)/2,v-(du-dv)/2,z-(du+dv)/2];
 });
}

const worktops={
 'writing-desk':[.499,.311],
 'tv-cabinet':[.507,.352],
 'vinyl-shelf':[.493,.199]
};

export function furnitureSurface(key,size,flipped){
 const mark=worktops[key];
 if(!mark)return null;
 const [topLeft,topRight,,bottomLeft]=furnitureCorners(key,{u:0,v:0},size,flipped);
 const at=axis=>topLeft[axis]+mark[0]*(topRight[axis]-topLeft[axis])+mark[1]*(bottomLeft[axis]-topLeft[axis]);
 return {shift:at(0),height:at(2)};
}
