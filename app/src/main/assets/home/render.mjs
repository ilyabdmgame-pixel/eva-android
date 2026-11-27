import {faceUV} from './material-uv.mjs';
import {roomMaterials,roomTint} from './room-materials.mjs';
import {shadowOffset,clipToReceiver} from './lighting.mjs';
import {camera,actorBillboardSpan} from './camera.mjs';
import {propArt} from './prop-art.mjs';
import {furnitureCorners,surfaceTriangles} from './occlusion.mjs';
import {parts} from './painted-parts.mjs';
import {gait} from './orientation.mjs';
import {bones} from './eva-rig.mjs';
import {createEvaSkin} from './eva-skin.mjs';
import {groundSole,gripGrid} from './eva-motion.mjs';
import {createStreamGame} from './stream-game.mjs';

const vertexSize=10;
export const cameraScale=.174;
export const cameraOffset=.073;

export function createScene(canvas) {
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,stencil:true});
  if(!gl||gl.isContextLost())throw Error('Нет WebGL2');
  let retired=false;
  const shaders=[];
  function shader(type,source){
    const s=gl.createShader(type);
    gl.shaderSource(s,source);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      const message=gl.getShaderInfoLog(s);gl.deleteShader(s);
      for(const compiled of shaders)gl.deleteShader(compiled);
      gl.deleteProgram(program);throw Error(message);
    }
    shaders.push(s);
    return s;
  }
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`#version 300 es
    layout(location=0) in vec3 point;
    layout(location=1) in vec3 color;
    layout(location=2) in vec2 uv;
    layout(location=3) in float key;
    layout(location=4) in float cell;
    flat out float atlasCell;
    uniform bool placingPart;
    layout(location=5) in vec3 skinNormal;
    layout(location=6) in vec3 secondPoint;
    layout(location=7) in vec2 skinWeights;
    uniform bool rigged;
    uniform mat4 rigMatrix[${bones.length}];
    uniform vec2 rigInfo;
    uniform mat4 partMatrix;
    uniform vec2 partInfo;
    uniform vec2 partMotion;
    uniform vec3 view;
    uniform vec2 orbit;
    uniform bool backdrop;
    uniform vec2 size;
    uniform bool wave;
    uniform float wavePhase;
    out vec3 tint;
    out vec3 world;
    out vec2 coord;
    flat out float id;
    void main(){
      if(backdrop){
        vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);
        gl_Position=vec4(p,.999,1.);coord=p*.5+.5;return;
      }
      vec3 at=point;
      float skinLight=1.;
      if(rigged){
        mat4 primary=rigMatrix[int(key)],secondary=rigMatrix[int(cell)];
        at=mix((primary*vec4(point,1.)).xyz,(secondary*vec4(secondPoint,1.)).xyz,skinWeights.x);
        if(skinWeights.y>1.5)at.z=max(rigInfo.y,at.z);
        vec3 normal=normalize(mix(mat3(primary)*skinNormal,mat3(secondary)*skinNormal,skinWeights.x));
        float diffuse=smoothstep(-.55,.80,dot(normal,vec3(-.32,.48,.816)));
        skinLight=mix(.75,1.07,diffuse);
        if(skinWeights.y==1.)skinLight=mix(.91,1.03,diffuse);
        if(skinWeights.y>2.)skinLight=mix(skinLight,mix(.91,1.03,diffuse),skinWeights.y-2.);
      }
      if(placingPart){
        if(partMotion.x==1.){
          float k=(1.-point.x)*.5;
          at.y+=1.85*k*k*sin(partMotion.y-1.7*k);
          at.z+=.85*k*k*cos(partMotion.y*.8-k);
        }else if(partMotion.x==2.){
          float tip=(point.x+1.)*.5;
          at.z+=tip*tip*partMotion.y*(.65+.35*point.y);
        }
        at=(partMatrix*vec4(at,1.)).xyz;
      }
      if(wave)at.y+=sin(point.x*1.75+uv.x+wavePhase)*.15+sin(point.x*3.6+uv.x-wavePhase)*.031;
      float forward=dot(at.xy,orbit);
      vec2 projected=vec2(at.x*orbit.y-at.y*orbit.x,forward*.57735027-at.z*.81649658);
      vec2 p=view.xy+view.z*projected;
      gl_Position=vec4(2.*p.x/size.x-1.,1.-2.*p.y/size.y,-(forward*1.41421356+at.z)*.009,1.);
      // For a skinned mesh 'cell' is a bone index. City atlas variants apply only to room geometry.
      atlasCell=rigged?-1.:(placingPart?partInfo.y:cell);tint=color*skinLight;world=at;coord=uv;id=rigged?rigInfo.x:(placingPart?partInfo.x:key);
    }`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`#version 300 es
    precision highp float;
    in vec3 tint;
    in vec3 world;
    in vec2 coord;
    flat in float id;
    flat in float atlasCell;
    uniform sampler2D source;
    uniform bool rigged;
    uniform vec2 portrait;
    uniform float materialMeters;
    uniform int homeFinish;
    const int roomPaint = 1, roomGlass = 2;
    uniform bool pick;
    uniform bool backdrop;
    uniform float daylight;
    uniform vec3 windowBounds;
    uniform vec2 orbit;
    uniform int shadow;
    uniform vec3 revealCenter;
    uniform int structure;
    uniform bool coverage;
    uniform float castStrength;
    uniform bool glow;
    uniform bool cutout;
    uniform vec4 evaStep;
    uniform float evaStepRow;
    uniform vec4 evaFeet;
    uniform vec4 evaShoeTravel;
    uniform vec3 deskHands;


    uniform vec3 ambient;
    uniform vec4 lamps[4];
    out vec4 outColor;

    float shoeWeight(vec2 delta){
      float radius=length(delta*vec2(4.5,3.6));
      float w=max(0.,1.-radius);
      return w*w/(.004+radius*radius);
    }

    void main(){
      if(backdrop){
        vec3 top=mix(vec3(.145,.147,.224),vec3(.271,.334,.384),daylight);
        vec3 base=mix(vec3(.196,.164,.211),vec3(.471,.368,.339),daylight);
        vec3 color=mix(base,top,smoothstep(.12,.93,coord.y));
        vec2 delta=(coord-vec2(.52,.43))*vec2(.82,1.47);
        float bloom=exp(-dot(delta,delta)*6.);
        color+=vec3(.105,.075,.054)*bloom;
        float vignette=smoothstep(.40,.82,length((coord-.5)*vec2(.73,1.05)));
        outColor=vec4(color*(1.-.21*vignette),1.);return;
      }
      // Gradients are evaluated before the cutaway discards any neighbouring fragment.
      vec2 tile=coord/max(materialMeters,.001)+vec2(.213,.367);
      vec2 cell=vec2(mod(atlasCell,2.),floor(atlasCell*.5))*.5;
      if(materialMeters==3.4){
        if(cell.y>.25)tile*=cell.x>.25?2.25:3.2;
        else if(cell.x>.25)tile.y*=1.7;
      }
      if(materialMeters==4.3){
        if(cell.x>.25){tile*=1.65;tile+=.16*sin(coord.yx*vec2(.33,.47));}
        else tile*=2.05;
      }
      vec2 gradX=dFdx(tile),gradY=dFdy(tile);
      vec2 paintDX=dFdx(coord),paintDY=dFdy(coord);
      vec2 uvWidth=fwidth(coord);
      vec3 n=abs(cross(dFdx(world),dFdy(world)));
      float opacity=1.;
      if(structure!=0){
        vec3 d=world-revealCenter;
        vec2 screen=vec2(d.x*orbit.y-d.y*orbit.x,dot(d.xy,orbit)*.57735027-d.z*.81649658);
        float front=structure==3?1.:smoothstep(-.28,.48,dot(d.xy,orbit)*1.41421356+d.z+.48);
        float opening=structure==2?smoothstep(.43,.87,length(screen)):smoothstep(1.42,2.48,length(screen));
        opacity=1.-front*(1.-opening);
        if(pick){if(opacity<.5)discard;}
        else if(opacity<.003)discard;
        else if(!coverage&&opacity<.997){
          float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
          if(opacity<threshold)discard;
        }
      }
      if(shadow==1){
        float r=length((coord-.5)*2.);
        if(r>=1.)discard;
        outColor=vec4(.085,.068,.092,.49*(1.-smoothstep(.08,1.,r)));return;
      }
      if(shadow==3){
        outColor=vec4(.10,.097,.14,castStrength*.95*(1.-smoothstep(.63,1.,coord.y)));return;
      }
      if(shadow==4){
        outColor=vec4(.10,.082,.085,.25*(1.-smoothstep(0.,1.,coord.y)));return;
      }
      if(shadow==2){
        float a=texture(source,coord).a;
        if(a<.08)discard;
        outColor=vec4(.095,.105,.16,castStrength*smoothstep(.08,.96,a));return;
      }
      if(pick&&!cutout){outColor=vec4(mod(id,256.)/255.,floor(id/256.)/255.,0.,1.);return;}
      vec4 px;
      vec2 currentUV=coord,nextUV=coord;
      if(homeFinish==roomPaint){
        // Evaluate derivatives on unwrapped local metres: orbit/pinch cannot change the selected texel.
        vec2 paint=coord;
        vec2 dx=paintDX,dy=paintDY;
        vec2 mirrorUV=1.-abs(mod(paint,2.)-1.);
        vec2 signUV=1.-2.*step(vec2(1.),mod(paint,2.));
        vec2 origin=vec2(mod(atlasCell,4.),floor(atlasCell*.25))*.25;
        float footprint=max(length(dx),length(dy))*512.;
        float guard=clamp(footprint*.65,1.5,32.)/512.;
        vec2 inside=clamp(mirrorUV,vec2(guard),vec2(1.-guard));
        px=textureGrad(source,origin+inside*.25,dx*signUV*.25,dy*signUV*.25);
        if(atlasCell==0.||atlasCell==3.){
          float value=dot(px.rgb,vec3(.29,.56,.15));
          px.rgb=mix(vec3(value),px.rgb,.79)*vec3(.958,1.0,1.035);
        }
      }else if(materialMeters>0.){
        vec2 mirrorUV=1.-abs(mod(tile,2.)-1.);
        vec2 localUV=(materialMeters==2.8||(materialMeters==3.4&&cell.y>.25))?fract(tile):mirrorUV;
        vec2 atlasUV=cell+.012+.476*localUV;
        if(materialMeters!=2.8&&!(materialMeters==3.4&&cell.y>.25)){
          vec2 orientation=mix(vec2(1.),vec2(-1.),step(vec2(1.),mod(tile,2.)));
          gradX*=orientation;gradY*=orientation;
        }
        px=textureGrad(source,atlasUV,.476*gradX,.476*gradY);
        float wash=.98+.035*sin(dot(world.xy,vec2(.55,.31))+world.z*.35);
        // Keep the painted values across the scene, soften the noisy far mip levels.
        float distant=smoothstep(.011,.060,max(length(gradX),length(gradY)));
        float value=dot(px.rgb,vec3(.25,.60,.15));
        px.rgb=mix(px.rgb,vec3(value*.96,value,value*1.03),.10*distant)*wash;
        if(structure==1&&n.z<max(n.x,n.y)*.25&&world.z<2.73){
          px.rgb*=mix(.73,1.,smoothstep(0.,.31,2.73-world.z));
        }
      }else{
        if(evaStep.y>0.){
          vec2 extent=vec2(.125,1./7.);
          vec2 local=(coord-evaStep.zw)/extent;
          float a=shoeWeight(local-evaFeet.xy),b=shoeWeight(local-evaFeet.zw);
          vec2 travel=(a*evaShoeTravel.xy+b*evaShoeTravel.zw)/(.35+a+b);
          travel*=smoothstep(.57,.74,local.y);
          vec2 low=evaStep.zw+vec2(.0005),high=evaStep.zw+extent-vec2(.0005);
          currentUV=clamp(coord-travel*extent*evaStep.y,low,high);
          nextUV=clamp(coord+travel*extent*(1.-evaStep.y),low,high)+vec2(evaStep.x,evaStepRow);
        }
        if(rigged&&coord.y<.5){
          px=texture(source,coord+vec2(portrait.x,0.));
          if(portrait.y>0.)px=mix(px,texture(source,coord+vec2(.25,0.)),portrait.y);
        }else px=texture(source,currentUV);
        if(evaStep.y>0.){
          vec4 next=texture(source,nextUV);
          vec3 rgb=mix(px.rgb*px.a,next.rgb*next.a,evaStep.y);
          float a=mix(px.a,next.a,evaStep.y);
          px=vec4(rgb/max(.001,a),a);
        }
      }
      if(deskHands.z>0.){
        vec2 cellUV=(coord-deskHands.xy)*vec2(8.,5.);
        float sleeve=1.-smoothstep(.72,1.,length((cellUV-vec2(.539,.621))/vec2(.106,.066)));
        float skin=smoothstep(.10,.21,px.r-px.b)*smoothstep(.43,.64,px.r);
        px.rgb=mix(px.rgb,px.rgb*.43+vec3(.040,.029,.034),deskHands.z*sleeve*skin);
      }
      if(cutout&&evaStep.y>0.&&!pick&&coverage){
        if(px.a<.035)discard;
        opacity*=px.a;
      }else if(cutout&&px.a<.49)discard;
      // An inner ink line stays inside the illustrated silhouette, including in the pick pass.
      if(cutout&&!pick){
        vec2 edge=min(uvWidth*.90,vec2(2.6)/vec2(textureSize(source,0)));
        float neighbour=min(min(texture(source,currentUV+vec2(edge.x,0.)).a,texture(source,currentUV-vec2(edge.x,0.)).a),
                            min(texture(source,currentUV+vec2(0.,edge.y)).a,texture(source,currentUV-vec2(0.,edge.y)).a));
        if(evaStep.y>0.){
          vec2 c=nextUV;
          float other=min(min(texture(source,c+vec2(edge.x,0.)).a,texture(source,c-vec2(edge.x,0.)).a),
                          min(texture(source,c+vec2(0.,edge.y)).a,texture(source,c-vec2(0.,edge.y)).a));
          neighbour=mix(neighbour,other,evaStep.y);
        }
        float ink=1.-smoothstep(.24,.88,neighbour);
        px.rgb=mix(px.rgb,px.rgb*vec3(.50,.47,.54)+vec3(.033,.026,.037),ink*.77);
      }
      if(homeFinish!=roomPaint&&atlasCell==8.){
        float l=dot(px.rgb,vec3(.299,.587,.114));
        px.rgb=mix(px.rgb,vec3(l*.86,l*.91,l*.97),.93);
      }else if(homeFinish!=roomPaint&&atlasCell==7.&&px.g>px.r*1.12&&px.b>px.r*1.07){
        px.rgb=vec3(px.g*1.32,px.r*.92,px.r*.76);
      }
      if(pick){outColor=vec4(mod(id,256.)/255.,floor(id/256.)/255.,0.,1.);return;}
      if(homeFinish==roomGlass){
        float glint=1.-smoothstep(.004,.023,abs(coord.x+.22*coord.y-.77));
        outColor=vec4(mix(tint,vec3(.88,.95,.91),glint*.5),.13+.10*glint);return;
      }
      if(glow){outColor=vec4(px.rgb*tint,opacity);return;}
      float local=0.;
      for(int i=0;i<4;i++){
        vec3 delta=(world-lamps[i].xyz)*vec3(.71,.71,.37);
        float reach=max(0.,1.-dot(delta,delta)*.15);
        local+=lamps[i].w*reach*reach*reach;
      }
      vec3 lit=mix(ambient,vec3(.99,.90,.80),min(.70,local*.59))+vec3(.18,.123,.069)*min(local,1.38);
      // Window light is attached to the room, so the mullion shadows stay put during an orbit.
      if(materialMeters>0.&&world.z<.12&&daylight>.05){
        float run=world.y-windowBounds.z;
        float across=world.x+.25*run;
        float pane=(across-windowBounds.x)/(windowBounds.y-windowBounds.x);
        float sun=smoothstep(.90,1.24,run)*(1.-smoothstep(3.09,3.61,run));
        sun*=smoothstep(-.025,.045,pane)*(1.-smoothstep(.955,1.025,pane));
        float bar=abs(fract(pane*3.+.5)-.5);
        sun*=mix(.55,1.,smoothstep(.009,.041,bar));
        lit+=vec3(.23,.15,.066)*sun*daylight;
      }
      outColor=vec4(px.rgb*tint*lit,opacity);
    }`));
  gl.linkProgram(program);
  for(const compiled of shaders)gl.deleteShader(compiled);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
    const message=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error(message);
  }
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.DITHER);
  const hasCoverage=gl.getParameter(gl.SAMPLES)>1;
  const shadowStencil=gl.getParameter(gl.STENCIL_BITS)>0;
  const uniforms=Object.fromEntries(['rigged','rigMatrix[0]','rigInfo','portrait','backdrop','daylight','windowBounds','homeFinish','orbit','placingPart','partMatrix','partInfo','partMotion','view','size','pick','ambient','lamps[0]','shadow','glow','cutout','structure','coverage','revealCenter','castStrength','materialMeters','wave','wavePhase','evaStep','evaStepRow','evaFeet','evaShoeTravel','deskHands'].map(name=>[name,gl.getUniformLocation(program,name)]));
  const buf=gl.createBuffer();
  function vertexArray(buffer){
    const vao=gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [index,length,offset] of [[0,3,0],[1,3,12],[2,2,24],[3,1,32],[4,1,36]]){
      gl.vertexAttribPointer(index,length,gl.FLOAT,false,vertexSize*4,offset);
      gl.enableVertexAttribArray(index);
    }
    return vao;
  }
  const backdropVao=gl.createVertexArray();
  const dynamicVao=vertexArray(buf);
  const textures=new Map();
  const anisotropic=gl.getExtension('EXT_texture_filter_anisotropic');
  function texture(key,src){
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    const result={t,aspect:.37,ready:!src,cutout:src?.endsWith('.png')??false};
    textures.set(key,result);
    if(src){
      const image=new Image();
      image.onload=()=>{
        if(retired||gl.isContextLost())return;
        gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        // Packed cells have padding for the first two minified levels.
        const packed=key.startsWith('walk-')||Object.values(propArt).some(frame=>frame[0]===key);
        const mipLimit=key==='room-indie'?6:key==='eva-rig-skin'?5:packed?2:4;
        const lastLevel=Math.min(mipLimit,Math.floor(Math.log2(Math.max(image.width,image.height))));
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAX_LEVEL,lastLevel);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        if(anisotropic&&(src.endsWith('.jpg')||key==='room-indie'))gl.texParameterf(gl.TEXTURE_2D,anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        result.aspect=image.width/image.height;
        result.ready=true;
        canvas.dispatchEvent(new Event('art'));
      };
      image.src=src;
    }
  }
  const materialSheets={material:'material',district:'district',terrain:'anime-ground',building:'anime-building',coast:'anime-coast',roofs:'anime-roofs'};
  texture('white');texture('glow');texture('foam');texture('room-indie','art/room-indie-atlas.webp');
  function artReady(key){
    const sheet=propArt[key]?.[0]??key;
    if(!textures.has(sheet))texture(sheet,'art/'+sheet+'.png');
    return textures.get(sheet).ready;
  }
  function artAspect(key){
    if(!artReady(key))return 0;
    return propArt[key]?.[5]??textures.get(key).aspect;
  }
  let isStructure=false,reveal=[0,0,.78],lightDay=1;
  function structure(draw,enabled=true){
    const previous=isStructure;isStructure=enabled;
    try{draw();}finally{isStructure=previous;}
  }
  let view, batches=new Map(), sceneryBuffers=[], wavePhase=0;
  let uploadBuffer=new Float32Array(4096);
  function uploadDynamic(vertices){
    if(uploadBuffer.length<vertices.length)uploadBuffer=new Float32Array(
      Math.max(vertices.length,uploadBuffer.length*2));
    uploadBuffer.set(vertices);
    gl.bufferData(gl.ARRAY_BUFFER,uploadBuffer,gl.STREAM_DRAW,0,vertices.length);
  }

  const resident=new Map();
  function scenery(plots,draw){
    const keep=new Set(plots.map(p=>p.cacheKey??p.key));
    const dynamic=batches;
    sceneryBuffers=[];
    let warmed=false;
    for(const plot of plots){
      const key=plot.cacheKey??plot.key;
      let layers=resident.get(key);
      if(!layers){
        if(plot.preload&&warmed)continue;
        if(plot.preload)warmed=true;
        batches=new Map();
        draw(plot);
        layers=Array.from(batches,([texture,vertices])=>{
          const buffer=gl.createBuffer();
          const vao=vertexArray(buffer);
          gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
          return {texture,buffer,vao,length:vertices.length/vertexSize};
        });
        resident.set(key,layers);
      }
      if(!plot.preload)sceneryBuffers.push(layers);
    }
    batches=dynamic;
    // Edits and rotation can create arbitrarily many revisions of one room. Retain only the active buffers.
    for(const [key,layers] of resident)if(!keep.has(key)){
      for(const x of layers){gl.deleteVertexArray(x.vao);gl.deleteBuffer(x.buffer);}
      resident.delete(key);
    }
  }
  const material={
    water:[.012,.012,.487,.487],ceramic:[.512,.012,.987,.487],glass:[.012,.512,.487,.987],asphalt:[.512,.512,.987,.987],
    'slate-roof':[.012,.012,.487,.487],'clay-roof':[.512,.012,.987,.487],
    'zinc-roof':[.012,.512,.487,.987],'copper-roof':[.512,.512,.987,.987],
    'room-oak':[.512,.012,.987,.487],'room-weave':[.012,.512,.487,.987],'room-plaster':[.012,.012,.487,.487],
    wood:[.012,.012,.487,.487],wall:[.512,.012,.987,.487],
    cloth:[.012,.512,.487,.987],stone:[.512,.512,.987,.987],
    studio:[.012,.012,.487,.487],glaze:[.512,.012,.987,.487],
    seat:[.012,.512,.487,.987],sand:[.012,.512,.487,.987],
    cobbles:[.012,.012,.487,.487],'grass-field':[.512,.012,.987,.487],brick:[.012,.512,.487,.987],frost:[.512,.512,.987,.987],
    plaster:[.012,.012,.487,.487],oak:[.512,.012,.987,.487],facade:[.012,.512,.487,.987],roof:[.512,.512,.987,.987],slate:[.012,.012,.487,.487]
  };
  const materialTexture=mat=>{
    if(roomMaterials[mat])return 'room-indie';
    if(!mat||mat==='glow'||mat==='room-glass')return mat||'white';
    if(mat.endsWith('-roof'))return 'roofs';
    if(['water','ceramic','glass','asphalt'].includes(mat))return 'coast';
    if(['studio','glaze','seat'].includes(mat))return 'district';
    if(['cobbles','grass-field','sand','frost','slate'].includes(mat))return 'terrain';
    if(['plaster','oak','facade','roof','brick'].includes(mat))return 'building';
    return 'material';
  };
  function paintedFace(points,id,tint,mat,coords){
    const finish=roomMaterials[mat];
    const key=(isStructure&&id?(isStructure==='roof'?'cover:':'shell:'):'')+'room-indie';
    if(!batches.has(key))batches.set(key,[]);
    const out=batches.get(key),uv=coords??faceUV(points),color=roomTint(tint,finish);
    // One vertex stream and one texture for all sixteen finishes.
    for(const i of points.length===4?[0,1,2,0,2,3]:[0,1,2])
      out.push(...points[i],...color,uv[i][0]/finish.width,uv[i][1]/finish.height,id,finish.cell);
  }
  function triangle(points,tint,id=0,mat,coords){
    if(roomMaterials[mat])return paintedFace(points,id,tint,mat,coords);
    const key=materialTexture(mat),rect=material[mat];
    if(!batches.has(key))batches.set(key,[]);
    const out=batches.get(key),uv=rect?faceUV(points):null;
    const cell=rect?Math.floor(rect[0]*2)+2*Math.floor(rect[1]*2):0;
    for(const [i,p] of points.entries())out.push(...p,...tint,uv?.[i][0]??0,uv?.[i][1]??0,id,cell);
  }

  const evaSkin=createEvaSkin(gl);
  texture('eva-rig-skin','art/eva-rig-skin.webp');
  function actorMesh(mesh,pose,id){
    evaSkin.submit(mesh,pose,id);
  }
  const partBuffers=new Map(),partInstances=[];
  function illustratedPart(name,matrix,id,variant,flex=0){
    if(!artReady('street-illustrations'))return;
    let gpu=partBuffers.get(name);
    if(!gpu){
      const {v,i}=parts[name],vertices=new Float32Array(v.length/5*vertexSize);
      for(let n=0;n<v.length/5;n++){
        const j=n*5;
        vertices.set([v[j],v[j+1],v[j+2],1,1,1,v[j+3],v[j+4],0,0],n*vertexSize);
      }
      const buffer=gl.createBuffer(),vao=vertexArray(buffer);
      gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
      const elements=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(i),gl.STATIC_DRAW);
      gpu={vao,buffer,elements,count:i.length};partBuffers.set(name,gpu);
    }
    partInstances.push({gpu,matrix,id,variant,flex,mode:name==='tail'?1:name==='wing'?2:0});
  }
  function ball({u,v,z},r,tint){
    const point=(lat,lon)=>[u+r*Math.cos(lat)*Math.cos(lon),v+r*Math.cos(lat)*Math.sin(lon),z+r*Math.sin(lat)];
    for(let i=0;i<5;i++)for(let j=0;j<8;j++){
      const lat=-Math.PI/2+i*Math.PI/5,lon=j*Math.PI/4;
      const shade=.74+.22*Math.sin(lat)+.06*Math.cos(lon);
      const c=tint.map(v=>v*shade);
      const a=point(lat,lon),b=point(lat,lon+Math.PI/4),d=point(lat+Math.PI/5,lon),e=point(lat+Math.PI/5,lon+Math.PI/4);
      triangle([a,b,e],c);triangle([a,e,d],c);
    }
  }
  function quad(points,id,tint,key='white',uv=[0,0,1,1],mat){
    if(isStructure&&id)key=(isStructure==='roof'?'cover:':'shell:')+key;
    if(!batches.has(key))batches.set(key,[]);
    const out=batches.get(key),[x,y,r,b]=uv;
    const tex=mat?faceUV(points,key.endsWith('roofs')):[[x,y],[r,y],[r,b],[x,b]];
    const cell=mat?Math.floor(x*2)+2*Math.floor(y*2):0;
    for(const i of [0,1,2,0,2,3])out.push(...points[i],...tint,...tex[i],id,cell);
  }
  function box(id,{u,v,z=0},a,b,h,tint,mat,toLocal){
    const p=[[u,v,z],[u+a,v,z],[u+a,v+b,z],[u,v+b,z],[u,v,z+h],[u+a,v,z+h],[u+a,v+b,z+h],[u,v+b,z+h]];
    const textureKey=materialTexture(mat);
    const faces=[[4,5,6,7],[1,2,6,5],[2,3,7,6],[3,0,4,7],[0,1,5,4]];
    for(const [i,side] of faces.entries()){
      const s=[1,.86,.76,.68,.72][i];
      const points=side.map(j=>p[j]),shade=tint.map(x=>x*s);
      if(roomMaterials[mat])paintedFace(points,id,shade,mat,toLocal?faceUV(points.map(toLocal)):null);
      else quad(points,id,shade,textureKey,material[mat],material[mat]);
    }
  }
  function panel(points,tint,mat,id,coords){
    if(roomMaterials[mat])return paintedFace(points,id,tint,mat,coords);
    quad(points,id,tint,materialTexture(mat),material[mat],material[mat]);
  }
  function foam(points,tint,row){quad(points,0,tint,'foam',[row,0,row,1]);}
  function artPanel(points,key,id=0){
    if(key==='attic-rug')return paintedFace(points,id,[.95,.95,.95],'room-rug',[[0,0],[1,0],[1,1],[0,1]]);
    artReady(key);
    const frame=propArt[key];
    quad(points,id,[1,1,1],frame?.[0]??key,frame?.slice(1,5));
  }
  function castFloor(points){
    const key='cast:white';if(!batches.has(key))batches.set(key,[]);
    const out=batches.get(key);
    for(let i=1;i+1<points.length;i++)for(const p of [points[0],points[i],points[i+1]])out.push(...p,1,1,1,0,0,0,0);
  }
  function shadow({u,v,z=0},a,b){
    quad([[u-a,v-b,z],[u+a,v-b,z],[u+a,v+b,z],[u-a,v+b,z]],0,[1,1,1],'shadow');
  }
  const anchors={
    'iso-idle':.68,'iso-walk-a':.57,'iso-walk-b':.54,'iso-sit':[.43,.67],
    'rear-idle':.58,'rear-walk-a':.47,'rear-walk-b':.45,'rear-sit':[.34,.72],
    'front-reach':.34,'rear-reach':.31,'front-stoop':.33,'rear-stoop':.25,
    'ren-rear-idle':.52,'ren-rear-walk':.48,'mio-rear-idle':.50,'mio-rear-walk':.52
  };
  // Horizontal centre of the painted crown within each Eva cutout.
  const crowns={'iso-idle':.537,'rear-idle':.552,'iso-sit':.447,'rear-sit':.378,
    'front-stoop':.452,'rear-stoop':.614,'front-reach':.303,'rear-reach':.317,
    'mood-wry':.510,'mood-pleased':.512,'mood-surprised':.515,'mood-curious':.498};
  let evaStep,deskHands;
  function sprite(id,key,{u,v,z=0},h,flip,options,actor=false){
    if(!artReady(key))return;
    const frame=propArt[key];
    const sheet=frame?.[0]??key;
    const aspect=frame?.[5]??textures.get(sheet).aspect;
    const atlas=options?.row!==undefined;
    const raw=options?.anchor??(atlas?[.5,gait.anchorY]:anchors[key]??.5);
    const [anchorU,anchorY]=Array.isArray(raw)?raw:[raw,1];
    if(atlas)h/=gait.bodyRatio;
    const span=actor?actorBillboardSpan(h,atlas?gait.aspect:aspect):
      options?.span??actorBillboardSpan(h,aspect)*(options?.widthScale??1);
    const anchor=flip?1-anchorU:anchorU;
    const left=span*anchor,right=span*(1-anchor),bottom=z-h*(1-anchorY),top=z+h*anchorY;
    const rows=options?.atlasRows||gait.rows;
    const rowsPerView=gait.frames/gait.columns;
    const x=atlas?(options.column%gait.columns)/gait.columns:frame?.[1]??0;
    const y=atlas?(options.row*rowsPerView+Math.floor(options.column/gait.columns))/rows:frame?.[2]??0;
    const rightU=atlas?x+1/gait.columns:frame?.[3]??1,bottomV=atlas?y+1/rows:frame?.[4]??1;
    if(key==='walk-eva')evaStep=options?.step?{...options.step,x,y}:null;
    if(options?.deskHands)deskHands={key:sheet,x,y};
    // Offsets along the view axis preserve screen placement and adjust occlusion.
    const bias=options?.bias??0;
    const foot=options?.floor?h*(1-anchorY)+.016:0;
    const canonical=Math.abs(view.cosYaw-Math.SQRT1_2)<.00001&&Math.abs(view.sinYaw-Math.SQRT1_2)<.00001;
    const acrossU=Math.SQRT2*view.sinYaw,acrossV=-Math.SQRT2*view.cosYaw;
    const calibrated=options?.footprint&&canonical?furnitureCorners(key,{u,v,z},options.footprint,flip):null;
    const physical=calibrated??[[u-left*acrossU,v-left*acrossV,top],[u+right*acrossU,v+right*acrossV,top],[u+right*acrossU,v+right*acrossV,bottom],[u-left*acrossU,v-left*acrossV,bottom]];
    const lean=options?.lean??0;
    if(lean)for(const point of physical.slice(0,2)){point[0]+=lean*acrossU;point[1]+=lean*acrossV;}
    const limited=Boolean(canonical&&options?.limits);
    const viewRay=[Math.SQRT2*view.cosYaw,Math.SQRT2*view.sinYaw,1];
    const corners=!limited&&(bias||foot)?physical.map(p=>[...p]):physical;
    if(!limited&&(bias||foot))for(const [index,point] of corners.entries()){
      const depth=bias+(index>=2?foot:0);
      for(let axis=0;axis<3;axis++)point[axis]+=depth*viewRay[axis];
    }
    if(options?.bedPlane!=null)for(const p of corners){
      const delta=(options.bedPlane-p[2])*options.restAmount;
      for(let i=0;i<3;i++)p[i]+=delta*viewRay[i];
    }
    const uv=flip&&!calibrated?[rightU,y,x,bottomV]:[x,y,rightU,bottomV];
    const volume=limited?surfaceTriangles(corners,uv,options.limits,options.floorPlane):null;
    if(options?.cast){
      const {ground,inside}=options.cast;
      const [sx,sy]=shadowOffset(1,inside);
      const receiver=ground+.028;
      const projected=([x,y,h])=>{
        const above=Math.max(0,h-ground);
        return [x+above*sx,y+above*sy,receiver];
      };
      const shadowKey='cast:'+sheet;
      if(volume||options.cast.support){
        if(!batches.has(shadowKey))batches.set(shadowKey,[]);
        const vertices=batches.get(shadowKey);
        if(!options.cast.support){
          for(const vertex of volume)vertices.push(...projected(vertex),1,1,1,vertex[3],vertex[4],0,0);
        }else{
          const uvPairs=[[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]];
          const mesh=volume??[0,1,2,0,2,3].map(i=>[...physical[i],...uvPairs[i]]);
          for(let i=0;i<mesh.length;i+=3){
            const plane=mesh.slice(i,i+3).map(v=>[...projected(v),v[3],v[4]]);
            const polygon=clipToReceiver(plane,options.cast.support);
            for(let j=1;j+1<polygon.length;j++){
              for(const [x,y,z,s,t] of [polygon[0],polygon[j],polygon[j+1]])vertices.push(x,y,z,1,1,1,s,t,0,0);
            }
          }
        }
      }else quad(physical.map(projected),0,[1,1,1],shadowKey,uv);
    }
    const batch=options?.foliage?'leaves:'+sheet:sheet;
    const contact=options?.grip;
    const posed=contact&&(options.footFloor==null?contact:groundSole(corners,contact,options.footFloor));
    const grip=posed&&gripGrid(corners,posed,flip);
    if(volume){
      if(!batches.has(batch))batches.set(batch,[]);
      const vertices=batches.get(batch);
      for(const [u,v,z,s,t] of volume)vertices.push(u,v,z,1,1,1,s,t,id,0);
    }else if(grip?.warped){
      if(!batches.has(batch))batches.set(batch,[]);
      const vertices=batches.get(batch),[l,t,r,b]=uv;
      const vertex=(x,y)=>vertices.push(...grip.move(x,y),1,1,1,l+(r-l)*x,t+(b-t)*y,id,0);
      for(let i=1;i<grip.xs.length;i++)for(let j=1;j<grip.ys.length;j++){
        const x=grip.xs[i-1],y=grip.ys[j-1],right=grip.xs[i],bottom=grip.ys[j];
        vertex(x,y);vertex(right,y);vertex(right,bottom);
        vertex(x,y);vertex(right,bottom);vertex(x,bottom);
      }
    }else quad(corners,id,[1,1,1],batch,uv);
    const crownPoint=options?.grip?.crown?.to??options?.crown;
    const crown=crownPoint?.[0]??crowns[key]??.5;
    const crownX=span*((flip?1-crown:crown)-anchor)+lean;
    return {...(grip?.head??{u:u+crownX*acrossU,v:v+crownX*acrossV,z:top-h*(crownPoint?.[1]??(atlas?.027:0))}),
      hand:grip?.hand,otherHand:grip?.other};
  }
  function sleepingSprite(id,{u,v,z},key='eva-asleep'){
    if(!artReady(key))return;
    // The face lies on the pillow. Lay the entire cutout on the occupied bedding plane.
    const width=1.46,height=width/textures.get(key).aspect;
    const corners=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{
      const dx=(x-.84)*width/Math.SQRT2,dy=(y-.22)*height*Math.sqrt(1.5);
      return [u+dy+dx,v+dy-dx,z];
    });
    quad(corners,id,[1,1,1],key);
    return {u,v,z:z+.15};
  }
  function prepare(center,scale=cameraScale,offset=cameraOffset,yaw){
    const cw=Math.max(1,canvas.clientWidth),ch=Math.max(1,canvas.clientHeight);
    const d=Math.min(devicePixelRatio,Math.sqrt(3200000/Math.max(1,cw*ch)));
    const w=Math.round(cw*d),h=Math.round(ch*d);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    view=camera({width:w,height:h,pixelsPerMeter:w*scale,u:center.u,v:center.v,yaw});
    view.cssWidth=cw;view.cssHeight=ch;
    view.y+=h*offset;
    return view;
  }
  function bindTexture(key){
    const finish=key==='room-glass'?2:key==='room-indie'?1:0;
    gl.uniform1i(uniforms.homeFinish,finish);
    if(key==='room-glass')key='white';
    if(key==='room-indie'&&!textures.has(key))texture(key,'art/room-indie-atlas.webp');
    if(!textures.has(key)&&materialSheets[key])texture(key,'art/'+materialSheets[key]+'.jpg');
    const tex=textures.get(key);
    gl.uniform1i(uniforms.glow,key==='glow'||key==='room-window'||key==='stream-game'?1:0);
    gl.uniform1i(uniforms.cutout,tex.cutout?1:0);
    gl.uniform1i(uniforms.wave,key==='foam'?1:0);
    gl.bindTexture(gl.TEXTURE_2D,tex.t);
  }
  function flush(pick,night,lamp,climate=[1,1,1],x=0,y=0){
    const width=pick?1:canvas.width,height=pick?1:canvas.height;
    gl.viewport(0,0,width,height);
    gl.clearColor(pick?0:.145,pick?0:.128,pick?0:.15,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|(pick?0:gl.STENCIL_BUFFER_BIT));
    gl.uniform3f(uniforms.view,view.x-x,view.y-y,view.scale);
    gl.uniform2f(uniforms.size,width,height);
    gl.uniform2f(uniforms.orbit,view.cosYaw,view.sinYaw);
    gl.uniform3fv(uniforms.windowBounds,windowBounds);
    if(!pick){
      gl.uniform1i(uniforms.backdrop,1);
      gl.uniform1f(uniforms.daylight,lightDay);
      gl.bindVertexArray(backdropVao);gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.depthMask(true);gl.uniform1i(uniforms.backdrop,0);
    }

    gl.uniform1f(uniforms.wavePhase,wavePhase);
    gl.uniform1i(uniforms.pick,pick?1:0);
    gl.uniform1i(uniforms.shadow,0);
    if(!pick){
      gl.uniform3f(uniforms.ambient,climate[0]*(1-.31*night),climate[1]*(1-.26*night),climate[2]*(1-.15*night));
      gl.uniform4fv(uniforms['lamps[0]'],lamp);
    }
    gl.uniform3fv(uniforms.revealCenter,reveal);
    gl.uniform1f(uniforms.castStrength,.18+.16*lightDay);
    gl.uniform1i(uniforms.coverage,hasCoverage?1:0);
    function material(key,step,typing){
      const scale=key==='room-indie'?1:key==='roofs'?2.8:key==='coast'?2.4:key==='terrain'?4.3:key==='building'?3.4:
        key==='material'||key==='district'?2.7:0;
      gl.uniform1f(uniforms.materialMeters,scale);
      if(step){
        gl.uniform4f(uniforms.evaStep,step.offset,step.weight,step.x,step.y);
        gl.uniform1f(uniforms.evaStepRow,step.offsetY);
        gl.uniform4fv(uniforms.evaFeet,step.feet);
        gl.uniform4fv(uniforms.evaShoeTravel,step.travel);
      }else gl.uniform4f(uniforms.evaStep,0,0,0,0);
      if(typing)gl.uniform3f(uniforms.deskHands,typing.x,typing.y,1);
      else gl.uniform3f(uniforms.deskHands,0,0,0);
      bindTexture(key);
    }
    const glassLayers=[],glassMeshes=[];
    function geometry(){
      for(const layers of sceneryBuffers)for(const layer of layers){
        const cover=layer.texture.startsWith('cover:');
        const shell=cover||layer.texture.startsWith('shell:');
        if(layer.texture==='groundShade'||layer.texture==='cornerShade')continue;
        const key=shell?layer.texture.slice(6):layer.texture;
        if(!pick&&key==='room-glass'){glassLayers.push(layer);continue;}
        gl.uniform1i(uniforms.structure,cover?3:shell?1:0);
        material(key);gl.bindVertexArray(layer.vao);
        gl.drawArrays(gl.TRIANGLES,0,layer.length);
      }
      gl.bindVertexArray(dynamicVao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      for(const [batch,vertices] of batches){
        if(batch==='shadow'||batch.startsWith('cast:'))continue;
        const shell=batch.startsWith('shell:');
        const leaves=batch.startsWith('leaves:');

        const key=shell?batch.slice(6):leaves?batch.slice(7):batch;
        if(!pick&&key==='room-glass'){glassMeshes.push(vertices);continue;}
        gl.uniform1i(uniforms.structure,shell?1:leaves?2:0);
        material(key,batch==='walk-eva'?evaStep:null,deskHands?.key===batch?deskHands:null);
        uploadDynamic(vertices);
        gl.drawArrays(gl.TRIANGLES,0,vertices.length/vertexSize);
      }
    }
    if(!pick&&hasCoverage)gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    geometry();
    if(evaSkin.visible&&(pick||textures.get('eva-rig-skin').ready)){
      gl.uniform1i(uniforms.structure,0);
      material('eva-rig-skin');
      evaSkin.draw(uniforms);
    }
    if(partInstances.length){
      gl.uniform1i(uniforms.structure,0);material('street-illustrations');
      gl.uniform1i(uniforms.placingPart,1);
      for(const {gpu,matrix,id,variant,flex,mode} of partInstances){
        gl.uniform2f(uniforms.partMotion,mode,flex);
        gl.uniformMatrix4fv(uniforms.partMatrix,false,matrix);
        gl.uniform2f(uniforms.partInfo,id,variant);gl.bindVertexArray(gpu.vao);
        gl.drawElements(gl.TRIANGLES,gpu.count,gl.UNSIGNED_SHORT,0);
      }
      gl.uniform1i(uniforms.placingPart,0);
    }
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.uniform4f(uniforms.evaStep,0,0,0,0);
    if(pick)return;
    gl.uniform1i(uniforms.structure,0);gl.uniform1i(uniforms.wave,0);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for(const layers of sceneryBuffers)for(const layer of layers){
      if(layer.texture!=='groundShade'&&layer.texture!=='cornerShade')continue;
      gl.uniform1i(uniforms.shadow,layer.texture==='groundShade'?3:4);
      gl.bindVertexArray(layer.vao);
      gl.drawArrays(gl.TRIANGLES,0,layer.length);
    }
    gl.bindVertexArray(dynamicVao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    function drawShadow(batch,vertices){
      const contact=batch==='shadow';
      gl.uniform1i(uniforms.shadow,contact?1:2);
      if(!contact)gl.bindTexture(gl.TEXTURE_2D,textures.get(batch.slice(5)).t);
      uploadDynamic(vertices);
      gl.drawArrays(gl.TRIANGLES,0,vertices.length/vertexSize);
    }
    const contact=batches.get('shadow');
    if(contact)drawShadow('shadow',contact);
    // A cast silhouette blocks the sun once, even where projected faces overlap.
    if(shadowStencil){
      gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,1);
      gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);
    }
    for(const [batch,vertices] of batches)if(batch.startsWith('cast:'))drawShadow(batch,vertices);
    if(shadowStencil)gl.disable(gl.STENCIL_TEST);
    gl.uniform1i(uniforms.shadow,0);
    if(glassLayers.length||glassMeshes.length){
      gl.uniform1i(uniforms.structure,0);material('room-glass');
      for(const layer of glassLayers){gl.bindVertexArray(layer.vao);gl.drawArrays(gl.TRIANGLES,0,layer.length);}
      gl.bindVertexArray(dynamicVao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      for(const vertices of glassMeshes){uploadDynamic(vertices);gl.drawArrays(gl.TRIANGLES,0,vertices.length/vertexSize);}
    }
    gl.depthMask(true);gl.disable(gl.BLEND);
  }
  const hitBuffer=gl.createFramebuffer(),hitImage=gl.createTexture(),hitDepth=gl.createRenderbuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER,hitBuffer);
  gl.bindTexture(gl.TEXTURE_2D,hitImage);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,1,1);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,hitImage,0);
  gl.bindRenderbuffer(gl.RENDERBUFFER,hitDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,1,1);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,hitDepth);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Нет буфера касаний');
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const pixel=new Uint8Array(4);
  function imagePanel(key,points,id,image,pixelated=false){
    if(!textures.has(key))texture(key);
    const target=textures.get(key);
    if(image){
      gl.bindTexture(gl.TEXTURE_2D,target.t);
      if(target.width!==image.width||target.height!==image.height){
        target.width=image.width;target.height=image.height;
        if(pixelated)gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      }else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,image);
    }
    quad(points,id,[1,1,1],key);
  }
  let windowBounds=[0,1,0];
  let streamCanvas,streamCtx,streamGame,streamFrame=-1,streamTextureFrame=-1,streamSeconds=-1;
  function advanceStreamScreen(elapsed=0){
    if(!streamCanvas){
      streamCanvas=document.createElement('canvas');
      streamCanvas.width=128;streamCanvas.height=64;
      streamCtx=streamCanvas.getContext('2d');streamGame=createStreamGame();
    }
    const seconds=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
    if(streamSeconds<0||seconds<streamSeconds){
      streamGame.reset();streamFrame=streamTextureFrame=-1;streamSeconds=seconds;
    }
    const frame=Math.floor(seconds*30);
    if(frame!==streamFrame){
      // Backgrounding or jumping between activities must not simulate minutes of missed physics.
      streamGame.advance(Math.min(.25,Math.max(0,seconds-streamSeconds)));
      streamGame.draw(streamCtx);
      streamFrame=frame;streamSeconds=seconds;
    }
    return streamCanvas;
  }
  function streamPanel(points,id,elapsed){
    const screen=advanceStreamScreen(elapsed);
    imagePanel('stream-game',points,id,streamTextureFrame===streamFrame?null:screen,true);
    streamTextureFrame=streamFrame;
  }
  return {actorMesh,sleepingSprite,prepare,structure,scenery,streamPanel,advanceStreamScreen,
    streamGameState(){return streamSeconds>=0?streamGame?.state??null:null;},
    endStream(){streamFrame=streamTextureFrame=-1;streamSeconds=-1;},
    windowPanel(points,id,image,visible=true){
      windowBounds=[Math.min(points[0][0],points[1][0]),Math.max(points[0][0],points[1][0]),points[0][1]];
      if(visible)imagePanel('room-window',points,id,image);
    },
    retire(){
      retired=true;
      if(gl.isContextLost())return;
      for(const layers of resident.values())for(const layer of layers){
        gl.deleteBuffer(layer.buffer);gl.deleteVertexArray(layer.vao);
      }
      for(const entry of textures.values())gl.deleteTexture(entry.t);
      for(const part of partBuffers.values()){
        gl.deleteVertexArray(part.vao);gl.deleteBuffer(part.buffer);gl.deleteBuffer(part.elements);
      }
      evaSkin.retire?.();
      gl.deleteBuffer(buf);gl.deleteVertexArray(backdropVao);gl.deleteVertexArray(dynamicVao);
      gl.deleteFramebuffer(hitBuffer);gl.deleteTexture(hitImage);gl.deleteRenderbuffer(hitDepth);
      gl.deleteProgram(program);
    },
    shadeBand(points,contact){quad(points,0,[1,1,1],contact?'cornerShade':'groundShade');},box,panel,artPanel,sprite,triangle,illustratedPart,ball,shadow,castFloor,foam,flush,
    setLightingFocus(at,day){reveal=[at.u,at.v,at.z];lightDay=day;},
    setWavePhase(value){wavePhase=value;},
    reset(){batches=new Map();partInstances.length=0;evaSkin.reset();deskHands=null;},
    pick(x,y,night,lamp,climate){
      gl.bindFramebuffer(gl.FRAMEBUFFER,hitBuffer);
      flush(true,night,lamp,climate,Math.floor(x),Math.floor(y));
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      return pixel[0]+256*pixel[1];
    },
    depthBits:gl.getParameter(gl.DEPTH_BITS), artAspect,artReady
  };
}
