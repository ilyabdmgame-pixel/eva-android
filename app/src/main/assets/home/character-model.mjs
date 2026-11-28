// EVM1 models are baked into the same 16-joint local spaces as the built-in actor.
const STRIDE=18,MAX_VERTICES=65535,MAX_INDICES=196605;
export function readCharacterMesh(data){
 const view=new DataView(data);
 if(view.byteLength<16||view.getUint32(0,false)!==0x45564d31)throw Error('Invalid EVM1 header');
 const count=view.getUint32(4,true),indexCount=view.getUint32(8,true);
 if(!count||count>MAX_VERTICES||!indexCount||indexCount>MAX_INDICES||indexCount%3||
    view.getUint32(12,true)!==STRIDE||view.byteLength!==16+(count*STRIDE+indexCount)*4)throw Error('Invalid EVM1 dimensions');
 const vertices=new Float32Array(count*STRIDE);
 for(let i=0;i<vertices.length;i++){
   const value=view.getFloat32(16+i*4,true),field=i%STRIDE;
   if(!Number.isFinite(value)||((field===8||field===9)&&(!Number.isInteger(value)||value<0||value>=16))||
      (field===16&&(value<0||value>1))||(field===17&&value!==0))throw Error('Invalid EVM1 vertex');
   vertices[i]=value;
 }
 const indices=new Uint16Array(indexCount),start=16+vertices.length*4;
 for(let i=0;i<indexCount;i++){
   const index=view.getUint32(start+i*4,true);
   if(index>=count)throw Error('Invalid EVM1 index');
   indices[i]=index;
 }
 return {vertices,indices,stride:STRIDE};
}

async function characterAssets(revision,signal){
 const base='/character-model/'+revision+'/';
 const get=async(name)=>{
   const response=await fetch(base+name,{signal,credentials:'same-origin'});
   if(!response.ok)throw Error('Unavailable room character asset');
   return response;
 };
 const mesh=get('room.mesh').then(r=>r.arrayBuffer()).then(readCharacterMesh);
 const atlas=new Promise((resolve,reject)=>{
   const image=new Image();
   const cancel=()=>{image.onload=image.onerror=null;image.removeAttribute('src');reject(Error('Room atlas request superseded'));};
   signal.addEventListener('abort',cancel,{once:true});
   image.onload=()=>{
     signal.removeEventListener('abort',cancel);
     if(image.width&&image.height&&image.width<=4096&&image.height<=4096)resolve(image);
     else reject(Error('Invalid room atlas dimensions'));
   };
   image.onerror=()=>{signal.removeEventListener('abort',cancel);reject(Error('Invalid room atlas'));};
   image.src=base+'atlas.png';
 });
 return Promise.all([mesh,atlas]);
}

// Keep the last complete GPU pair until its replacement is decoded. A reset
// invalidates every older in-flight selection, including one with the same SHA.
export function characterSelection(activate,load=characterAssets){
 let active='',pending='',request=null,closed=false;
 async function select(value){
   const revision=typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:'';
   if(closed||(pending===revision&&request)||(active===revision&&!request))return;
   request?.abort();request=null;pending='';
   if(revision===active)return;
   if(!revision){active='';activate(null);return;}
   const operation=new AbortController();
   request=operation;pending=revision;
   try{
     const [mesh,atlas]=await load(revision,operation.signal);
     if(request!==operation||closed)return;
     activate({mesh,atlas});active=revision;
   }catch(error){
     if(request===operation&&!closed){active='';activate(null);console.warn('Room character:',error.message);}
   }finally{
     if(request===operation){request=null;pending='';}
   }
 }
 return {get revision(){return active;},select,retire(){closed=true;request?.abort();request=null;pending='';}};
}
