// One immutable indexed buffer and one matrix palette upload per draw. Picking
// reuses the same posed mesh and depth buffer as the visible room.
export function createEvaSkin(gl){
 let gpu=null,current=null;
 function submit(mesh,pose,id,custom=false){
   if(gpu?.mesh!==mesh){
     retire();
     const vao=gl.createVertexArray(),buffer=gl.createBuffer(),elements=gl.createBuffer();
     gl.bindVertexArray(vao);
     gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
     gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);
     gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
     const attributes=[[3,0],[3,3],[2,6],[1,8],[1,9],[3,10],[3,13],[2,16]];
     attributes.forEach(([size,offset],i)=>{
       gl.vertexAttribPointer(i,size,gl.FLOAT,false,mesh.stride*4,offset*4);
       gl.enableVertexAttribArray(i);
     });
     gpu={mesh,vao,buffer,elements,count:mesh.indices.length};
   }
   current={pose,id,custom};
 }
 function draw(uniforms){
   if(!current)return;
   const {pose,id}=current;
   gl.uniform1i(uniforms.rigged,1);
   gl.uniformMatrix4fv(uniforms['rigMatrix[0]'],false,pose.matrices);
   gl.uniform2f(uniforms.rigInfo,id,pose.bedFloor);
   gl.uniform2f(uniforms.portrait,current.custom?-1:pose.face*.25,current.custom?0:pose.blink);
   gl.bindVertexArray(gpu.vao);
   gl.drawElements(gl.TRIANGLES,gpu.count,gl.UNSIGNED_SHORT,0);
   gl.uniform1i(uniforms.rigged,0);
 }
 function retire(){
   current=null;
   if(!gpu)return;
   gl.deleteVertexArray(gpu.vao);
   gl.deleteBuffer(gpu.buffer);
   gl.deleteBuffer(gpu.elements);
   gpu=null;
 }
 return {submit,draw,get visible(){return Boolean(current);},reset(){current=null;},retire};
}
