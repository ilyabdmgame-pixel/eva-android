import {camera,project} from './camera.mjs';
import {faceUV} from './material-uv.mjs';
import {roomMaterials,roomTint} from './room-materials.mjs';

// Use the same model builder for catalog art as for a piece already placed in the room.
export function collectMesh(draw) {
  const faces=[];
  const face=(points,tint,material,id,coords)=>{
    const item={points,tint,material,id},finish=roomMaterials[material];
    if(finish){
      item.paint=finish;item.paintTint=roomTint(tint,finish);
      item.uv=coords??faceUV(points);
    }
    faces.push(item);
  };
  const renderer={
    panel:face,
    triangle(points,tint,id,material,uv){face(points,tint,material,id,uv);},
    box(id,{u,v,z=0},w,d,h,tint,material,toLocal){
      const p=[[u,v,z],[u+w,v,z],[u+w,v+d,z],[u,v+d,z],[u,v,z+h],[u+w,v,z+h],[u+w,v+d,z+h],[u,v+d,z+h]];
      for(const [indices,gain] of [[[4,5,6,7],1],[[1,2,6,5],.86],[[2,3,7,6],.76],[[3,0,4,7],.68],[[0,1,5,4],.72]]){
        const vertices=indices.map(i=>p[i]);
        face(vertices,tint.map(n=>n*gain),material,id,toLocal&&faceUV(vertices.map(toLocal)));
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

const mirror=x=>1-Math.abs(((x%2)+2)%2-1);

export function sampleRoomPaint(face,n,a,b,c,atlas,out){
  const {cell,width,height}=face.paint,coords=face.uv,scale=atlas.width/4;
  const x=(coords[0][0]*a+coords[n][0]*b+coords[n+1][0]*c)/width;
  const y=(coords[0][1]*a+coords[n][1]*b+coords[n+1][1]*c)/height;
  const col=(cell%4)*scale+1+Math.round(mirror(x)*(scale-3));
  const row=Math.floor(cell/4)*scale+1+Math.round(mirror(y)*(scale-3));
  const i=(row*atlas.width+col)*4,p=atlas.data,t=face.paintTint;
  const l=.29*p[i]+.56*p[i+1]+.15*p[i+2];
  if(cell===0||cell===3){
    out[0]=(.21*l+.79*p[i])*.958*t[0];
    out[1]=(.21*l+.79*p[i+1])*t[1];
    out[2]=(.21*l+.79*p[i+2])*1.035*t[2];
  }else for(let channel=0;channel<3;channel++)out[channel]=p[i+channel]*t[channel];
  return out;
}

export function meshThumbnail(canvas,faces,atlas){
  const ctx=canvas.getContext('2d'),view=framedView(faces,canvas.width,canvas.height);
  const image=ctx.createImageData(canvas.width,canvas.height);
  const rgb=[0,0,0];
  rasterMesh(faces,view,image.data,atlas?(face,n,a,b,c,base)=>face.material==='room-glass'?null:
    face.paint?sampleRoomPaint(face,n,a,b,c,atlas,rgb):base:null);
  ctx.putImageData(image,0,0);
}
