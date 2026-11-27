import {camera,project} from './camera.mjs';

// Use the same model builder for catalog art as for a piece already placed in the room.
export function collectMesh(draw) {
  const faces=[];
  const face=(points,tint,material,id)=>faces.push({points,tint,material,id});
  const renderer={
    panel:face,
    triangle(points,tint,id,material){face(points,tint,material,id);},
    box(id,{u,v,z=0},w,d,h,tint,material){
      const p=[[u,v,z],[u+w,v,z],[u+w,v+d,z],[u,v+d,z],[u,v,z+h],[u+w,v,z+h],[u+w,v+d,z+h],[u,v+d,z+h]];
      for(const [indices,gain] of [[[4,5,6,7],1],[[1,2,6,5],.86],[[2,3,7,6],.76],[[3,0,4,7],.68],[[0,1,5,4],.72]]){
        face(indices.map(i=>p[i]),tint.map(n=>n*gain),material,id);
      }
    }
  };
  draw(renderer,faces);
  return faces;
}

function framedView(faces,width,height){
  const basis=camera({width:0,height:0,pixelsPerMeter:1});
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const {points} of faces)for(const [u,v,z] of points){
    const {x,y}=project(basis,{u,v,z});
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  const scale=Math.min((width-12)/Math.max(.01,right-left),(height-10)/Math.max(.01,bottom-top));
  return {...basis,width,height,scale,x:(width-scale*(left+right))/2,y:(height-scale*(top+bottom))/2};
}

const screenPoints=(view,face)=>face.points.map(([u,v,z])=>project(view,{u,v,z}));

// A z-buffer keeps thin handles and the legs behind a chair in their proper order.
export function rasterMesh(faces,view,pixels,sample=null,ids=null){
  const width=view.width,height=view.height;
  const depths=new Float32Array(width*height).fill(-Infinity);
  for(const face of faces){
    const points=screenPoints(view,face),a=points[0],rgb=face.tint.map(v=>Math.max(0,Math.min(255,Math.round(255*v))));
    for(let n=1;n<points.length-1;n++){
      const b=points[n],c=points[n+1];
      const dx=b.x-a.x,dy=b.y-a.y,ex=c.x-a.x,ey=c.y-a.y,det=dx*ey-dy*ex;
      if(Math.abs(det)<.000001)continue;
      const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(width,Math.ceil(Math.max(a.x,b.x,c.x)));
      const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(height,Math.ceil(Math.max(a.y,b.y,c.y)));
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
        const px=x+.5-a.x,py=y+.5-a.y,v=(px*ey-py*ex)/det,w=(dx*py-dy*px)/det,u=1-v-w;
        if(u<-.0001||v<-.0001||w<-.0001)continue;
        const depth=u*a.depth+v*b.depth+w*c.depth,at=y*width+x;
        if(depth<depths[at])continue;
        const color=sample?sample(face,n,u,v,w,rgb,at):rgb;
        if(!color)continue;
        depths[at]=depth;
        const offset=4*at;
        pixels[offset]=color[0];pixels[offset+1]=color[1];pixels[offset+2]=color[2];pixels[offset+3]=255;
        if(ids)ids[at]=face.id;
      }
    }
  }
}

export function meshThumbnail(canvas,faces){
  const ctx=canvas.getContext('2d'),view=framedView(faces,canvas.width,canvas.height);
  const image=ctx.createImageData(canvas.width,canvas.height);
  rasterMesh(faces,view,image.data);
  ctx.putImageData(image,0,0);
}
