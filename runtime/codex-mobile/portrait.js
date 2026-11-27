'use strict';

(function (root) {
  // Corresponding features on the 325x578 reference drawings, followed by depth from the neck.
  // Pairs are front, shallow left, left, shallow right and right.
  const landmarks = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // topLeft
    [325, 0, 325, 0, 325, 0, 325, 0, 325, 0, 0], // topRight
    [0, 578, 0, 578, 0, 578, 0, 578, 0, 578, 0], // bottomLeft
    [325, 578, 325, 578, 325, 578, 325, 578, 325, 578, 0], // bottomRight
    [0, 151, 0, 151, 0, 151, 0, 151, 0, 151, 0], // leftTempleBorder
    [325, 151, 325, 151, 325, 151, 325, 151, 325, 151, 0], // rightTempleBorder
    [0, 302, 0, 302, 0, 302, 0, 302, 0, 302, 0], // leftShoulderBorder
    [325, 302, 325, 302, 325, 302, 325, 302, 325, 302, 0], // rightShoulderBorder
    [0, 486, 0, 486, 0, 486, 0, 486, 0, 486, 0], // leftWaistBorder
    [325, 486, 325, 486, 325, 486, 325, 486, 325, 486, 0], // rightWaistBorder
    [159, 3, 153, 5, 159, 5, 165, 5, 166, 5, 0.4], // crown
    [161, 36, 139, 38, 140, 35, 179, 37, 189, 36, 0.6], // part
    [103, 26, 105, 26, 106, 25, 111, 26, 112, 26, 0.33], // hairUpperLeft
    [224, 28, 214, 26, 210, 27, 214, 27, 211, 28, 0.33], // hairUpperRight
    [55, 144, 71, 145, 68, 147, 70, 145, 76, 142, 0.12], // templeLeft
    [269, 145, 252, 145, 255, 144, 254, 145, 262, 146, 0.12], // templeRight
    [66, 211, 78, 211, 81, 211, 66, 213, 70, 212, 0.05], // hairLeftUnderEar
    [275, 213, 255, 211, 264, 209, 245, 213, 248, 213, 0.05], // hairRightUnderEar
    [125, 130, 120, 133, 119, 140, 156, 129, 181, 127, 0.83], // browLeft
    [198, 128, 179, 131, 171, 124, 212, 132, 229, 138, 0.83], // browRight
    [105, 151, 106, 152, 101, 158, 140, 149, 164, 146, 0.73], // outerCornerLeft
    [127, 157, 121, 160, 118, 163, 158, 156, 182, 153, 0.96], // irisLeft
    [144, 153, 134, 154, 129, 157, 171, 152, 198, 151, 1], // innerCornerLeft
    [217, 150, 196, 150, 189, 144, 227, 151, 242, 154, 0.73], // outerCornerRight
    [197, 155, 178, 158, 172, 151, 214, 157, 229, 158, 0.96], // irisRight
    [182, 152, 164, 153, 155, 152, 202, 154, 218, 155, 1], // innerCornerRight
    [126, 166, 121, 169, 118, 172, 158, 167, 183, 162, 0.86], // lowerLidLeft
    [197, 165, 179, 168, 172, 161, 214, 167, 228, 167, 0.86], // lowerLidRight
    [164, 149, 152, 151, 144, 148, 186, 150, 211, 148, 1.04], // browBridge
    [164, 183, 143, 185, 135, 184, 195, 184, 219, 183, 1.3], // noseTip
    [153, 198, 142, 202, 138, 201, 176, 202, 195, 198, 0.92], // mouthLeft
    [175, 198, 162, 201, 157, 199, 195, 202, 213, 200, 0.92], // mouthRight
    [164, 201, 152, 205, 147, 204, 185, 205, 204, 203, 1.06], // mouthMiddle
    [164, 225, 154, 232, 149, 230, 181, 232, 198, 229, 0.81], // chin
    [93, 168, 104, 171, 90, 169, 119, 169, 132, 162, 0.27], // earLeft
    [107, 183, 114, 184, 100, 185, 136, 182, 145, 180, 0.78], // cheekLeft
    [231, 167, 215, 169, 211, 163, 228, 170, 242, 168, 0.27], // earRight
    [217, 185, 197, 184, 190, 182, 221, 185, 234, 185, 0.78], // cheekRight
    [141, 246, 149, 250, 150, 247, 145, 251, 154, 249, 0.33], // neckLeft
    [190, 246, 189, 248, 184, 244, 178, 248, 191, 246, 0.33], // neckRight
    [162, 281, 171, 288, 172, 284, 155, 288, 149, 286, 0.38], // collarCenter
    [45, 296, 61, 302, 62, 284, 52, 302, 62, 302, 0.1], // shoulderLeft
    [285, 296, 269, 303, 267, 302, 266, 302, 268, 287, 0.1], // shoulderRight
    [83, 275, 102, 277, 114, 269, 98, 277, 104, 277, 0.2], // hoodLeft
    [247, 274, 235, 278, 235, 277, 229, 277, 232, 267, 0.2], // hoodRight
    [162, 332, 173, 339, 194, 336, 153, 338, 136, 337, 0.44], // shirtNeck
    [104, 395, 128, 405, 147, 404, 107, 405, 87, 407, 0.65], // nearLockLeft
    [219, 396, 224, 405, 249, 407, 190, 406, 168, 404, 0.65], // nearLockRight
    [6, 459, 20, 461, 12, 454, 12, 461, 17, 455, -0.3], // outerHairLeft
    [321, 455, 309, 457, 313, 454, 304, 457, 316, 455, -0.3], // outerHairRight
    [130, 482, 146, 489, 169, 489, 126, 489, 111, 491, 0.33], // shirtHemLeft
    [191, 482, 202, 489, 227, 489, 181, 489, 166, 491, 0.33], // shirtHemRight
    [162, 525, 174, 535, 193, 532, 153, 534, 142, 533, 0.3], // navel
    [43, 562, 60, 564, 63, 561, 47, 564, 49, 564, 0], // jacketLowerLeft
    [285, 563, 280, 564, 285, 562, 271, 564, 268, 562, 0], // jacketLowerRight
    [142, 578, 154, 578, 180, 578, 136, 578, 123, 578, 0], // zipLowerLeft
    [178, 578, 192, 578, 217, 578, 171, 578, 157, 578, 0], // zipLowerRight
    [117, 195, 117, 195, 114, 195, 136, 195, 153, 195, 0.75], // jawLeftUpper
    [136, 212, 127, 212, 126, 212, 148, 212, 167, 212, 0.76], // jawLeftLower
    [153, 221, 145, 227, 140, 225, 169, 226, 186, 224, 0.79], // jawLeftTip
    [210, 195, 196, 195, 189, 195, 218, 195, 229, 195, 0.75], // jawRightUpper
    [192, 212, 187, 212, 178, 212, 209, 212, 218, 212, 0.76], // jawRightLower
    [175, 221, 167, 227, 159, 225, 194, 225, 205, 225, 0.79], // jawRightTip
    [235, 149, 220, 149, 216, 142, 232, 154, 248, 148, 0.28], // earRightTop
    [221, 185, 205, 186, 194, 182, 224, 186, 235, 182, 0.28], // earRightLobe
    [39, 302, 56, 305, 56, 292, 49, 307, 59, 310, 0.12], // hoodOuterLeft
    [288, 302, 272, 307, 269, 309, 270, 306, 274, 292, 0.12], // hoodOuterRight
    [74, 328, 89, 335, 103, 332, 87, 342, 81, 340, 0.25], // zipLeftShoulder
    [251, 328, 240, 336, 245, 346, 229, 335, 213, 321, 0.25], // zipRightShoulder
    [108, 405, 129, 408, 148, 413, 109, 410, 86, 410, 0.22], // zipLeftChest
    [217, 405, 222, 409, 243, 412, 196, 410, 165, 408, 0.22], // zipRightChest
  ];
  const triangles = new Uint16Array([
    0,1,10,  0,10,12,  10,11,12,  10,1,13,  11,10,13,  4,0,14,  0,12,14,  1,5,15,
    13,1,15,  6,4,16,  4,14,16,  5,7,17,  15,5,17,  12,11,18,  14,12,18,  11,13,19,
    13,15,19,  18,11,19,  14,18,20,  20,18,21,  21,18,22,  19,23,24,  19,24,25,  20,21,26,
    21,22,26,  24,23,27,  25,24,27,  18,19,28,  22,18,28,  19,25,28,  26,22,29,  25,27,29,
    28,25,29,  22,28,29,  26,29,30,  29,27,31,  30,29,32,  29,31,32,  16,14,34,  14,20,34,
    20,26,35,  34,20,35,  16,34,35,  15,17,36,  27,23,36,  36,64,27,  38,33,39,  38,39,40,
    6,16,41,  17,7,42,  16,38,43,  41,16,43,  38,40,43,  17,42,44,  40,39,44,  43,40,45,
    8,6,48,  7,9,49,  8,48,50,  49,9,51,  50,51,52,  2,8,53,  8,50,53,  9,3,54,
    51,9,54,  50,52,55,  53,50,55,  2,53,55,  52,51,56,  51,54,56,  54,3,56,  55,52,56,
    26,30,57,  35,26,57,  16,35,57,  57,30,58,  38,16,58,  16,57,58,  30,32,59,  32,33,59,
    58,30,59,  33,38,59,  38,58,59,  31,27,60,  27,37,60,  17,44,60,  39,61,44,  31,60,61,
    60,44,61,  32,31,62,  33,32,62,  31,61,62,  39,33,62,  61,39,62,  19,15,63,  23,19,63,
    15,36,63,  36,23,63,  36,17,64,  37,27,64,  60,37,17,  64,17,37,  6,41,65,  42,7,66,
    41,43,67,  43,45,67,  45,46,67,  65,41,67,  46,48,67,  48,6,67,  6,65,67,  40,44,68,
    45,40,68,  47,45,68,  44,42,68,  42,66,68,  7,49,68,  66,7,68,  49,47,68,  46,45,69,
    48,46,69,  50,48,69,  51,50,69,  47,49,70,  49,51,70,  47,69,45,  69,47,70,  51,69,70,
  ]);

  const width = 325;
  const height = 578;
  const paths = {left: '/avatar/turn-left.webp', right: '/avatar/turn-right.webp', between: '/avatar/turn-between.webp'};
  const frameInterval = 1000 / 30;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const ease = t => t * t * (3 - 2 * t);

  function interleavedVertices() {
    return new Float32Array(landmarks.flatMap(p => {
      const vertex = [];
      for (let i=0;i<10;i+=2) vertex.push(p[i]/width, p[i+1]/height);
      return [...vertex, p[10]];
    }));
  }

  const vertexShader = `
    attribute vec2 aFront, aLeftMid, aLeft, aRightMid, aRight;
    attribute float aDepth;
    uniform float uYaw, uPitch;
    varying vec2 vFront, vMid, vSide;
    void main() {
      vFront = aFront;
      vMid = uYaw < 0.0 ? aLeftMid : aRightMid;
      vSide = uYaw < 0.0 ? aLeft : aRight;
      float t = abs(uYaw);
      float step = t * 2.0;
      vec2 p = step < 1.0 ? mix(aFront, vMid, step) : mix(vMid, vSide, step - 1.0);
      // The nose travels further than the ears or the back of the hair in each arc.
      p.x += sin(3.14159 * step) * sign(uYaw) * aDepth * .0025;
      p.y += uPitch * aDepth * .003;
      gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
    }`;
  const fragmentShader = `
    precision mediump float;
    varying vec2 vFront, vMid, vSide;
    uniform sampler2D uFront, uSide, uLids, uBetween;
    uniform float uAmount, uBlink, uSideRow, uHaveBetween;
    float eye(vec2 center, vec2 radius) {
      return 1.0 - smoothstep(.69, 1.0, length((vFront - center) / radius));
    }
    void main() {
      float phase = uAmount * 2.0;
      float t = phase < 1.0 ? phase : phase - 1.0;
      vec4 mid = texture2D(uSide, vec2(.5 * vMid.x, vMid.y));
      vec4 a = phase < 1.0 ? texture2D(uFront, vFront) : mid;
      vec4 b = phase < 1.0 ? mid : texture2D(uSide, vec2(.5 + .5 * vSide.x, vSide.y));
      if (uHaveBetween > .5) {
        vec2 first = phase < 1.0 ? vFront : vMid;
        vec2 second = phase < 1.0 ? vMid : vSide;
        vec2 tile = vec2(step(1.0, phase), uSideRow);
        vec4 bridge = texture2D(uBetween, ((first + second) * .5 + tile) * .5);
        if (t < .5) { b = bridge; t *= 2.0; }
        else { a = bridge; t = t * 2.0 - 1.0; }
      }
      // Give ink and silhouette edges a shorter mix than the softly shaded surfaces.
      float edge = smoothstep(.05,.31,max(abs(a.a-b.a),length(a.rgb-b.rgb)));
      float w = mix(smoothstep(.23,.77,t), smoothstep(.43,.57,t), edge);
      vec4 paint = mix(a, b, w);
      if (uBlink > 0.001) {
        float eyes = max(eye(vec2(.389,.269),vec2(.087,.031)),
                         eye(vec2(.611,.268),vec2(.086,.031)));
        paint = mix(paint, texture2D(uLids, vFront), eyes * uBlink);
      }
      gl_FragColor = paint;
    }`;

  function makeGpu(canvas) {
    const gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: 'low-power'
    });
    if (!gl) return null;
    const program = gl.createProgram();
    function attach(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const detail = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(detail);
      }
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    attach(gl.VERTEX_SHADER, vertexShader);
    attach(gl.FRAGMENT_SHADER, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const positions = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positions);
    gl.bufferData(gl.ARRAY_BUFFER, interleavedVertices(), gl.STATIC_DRAW);
    for (const [name, size, offset] of [['aFront',2,0], ['aLeftMid',2,8], ['aLeft',2,16], ['aRightMid',2,24], ['aRight',2,32], ['aDepth',1,40]]) {
      const attr = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, size, gl.FLOAT, false, 44, offset);
    }
    const faces = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faces);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangles, gl.STATIC_DRAW);
    const uniforms = {};
    for (const name of ['uFront','uSide','uLids','uYaw','uPitch','uAmount','uBlink','uBetween','uHaveBetween','uSideRow']) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    for (const [index, name] of ['uFront', 'uSide', 'uLids', 'uBetween'].entries()) gl.uniform1i(uniforms[name], index);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.clearColor(0, 0, 0, 0);
    const textures = new Map();
    function bind(picture, unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      let texture = textures.get(picture);
      if (texture) { gl.bindTexture(gl.TEXTURE_2D, texture); return; }
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, picture);
      textures.set(picture, texture);
    }
    return function draw(front, side, lids, between, yaw, pitch, blink) {
      bind(front, 0);
      bind(side, 1);
      bind(lids || front, 2);
      bind(between || front, 3);
      gl.uniform1f(uniforms.uHaveBetween, between ? 1 : 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.uYaw, yaw);
      gl.uniform1f(uniforms.uSideRow, yaw < 0 ? 0 : 1);
      gl.uniform1f(uniforms.uPitch, pitch);
      gl.uniform1f(uniforms.uAmount, Math.abs(yaw));
      gl.uniform1f(uniforms.uBlink, lids ? blink : 0);
      gl.drawElements(gl.TRIANGLES, triangles.length, gl.UNSIGNED_SHORT, 0);
    };
  }

  // Some WebView drivers disable WebGL. Rasterise the same registered triangles with Canvas 2D.
  function makeSoftware(canvas) {
    const out = canvas.getContext('2d');
    if (!out) return null;
    const buffer = document.createElement('canvas');
    const brush = buffer.getContext('2d');
    const sourceViews = [0, 2, 4, 6, 8].map(i =>
      landmarks.map(p => [p[i] / width, p[i+1] / height]));
    const betweenViews = [[0,1],[1,2],[0,3],[3,4]].map(([first,second]) =>
      sourceViews[first].map(([x,y],i) => [(x+sourceViews[second][i][0])*.5,(y+sourceViews[second][i][1])*.5]));
    let eyelids;
    function eyePaint(image) {
      if (eyelids) return eyelids;
      eyelids = document.createElement('canvas');
      eyelids.width = 650; eyelids.height = 1156;
      const ctx = eyelids.getContext('2d');
      ctx.scale(2,2);
      for (const [x,y,rx,ry] of [[126.4,155.5,28,18],[198.6,155,28,18]]) {
        ctx.save(); ctx.translate(x,y); ctx.scale(rx,ry);
        const gradient=ctx.createRadialGradient(0,0,.69,0,0,1);
        gradient.addColorStop(0,'#000'); gradient.addColorStop(1,'transparent');
        ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
      }
      ctx.globalCompositeOperation='source-in';
      ctx.drawImage(image,0,0,width,height);
      return eyelids;
    }
    function warp(image, source, positions, patchOnly, column = -1, row = -1) {
      brush.setTransform(1,0,0,1,0,0);
      brush.clearRect(0,0,buffer.width,buffer.height);
      const iw=(image.naturalWidth || image.width)/(column<0?1:2), ih=(image.naturalHeight || image.height)/(row<0?1:2);
      const origin=column<0?0:column*iw, originY=row<0?0:row*ih;
      for(let t=0;t<triangles.length;t+=3){
        const a=triangles[t], b=triangles[t+1], c=triangles[t+2];
        const [ua,va]=source[a], [ub,vb]=source[b], [uc,vc]=source[c];
        if(patchOnly && (Math.min(va,vb,vc)>.31 || Math.max(va,vb,vc)<.23))continue;
        const sx=origin+ua*iw, sy=originY+va*ih, su=(ub-ua)*iw, sv=(vb-va)*ih, tu=(uc-ua)*iw, tv=(vc-va)*ih;
        const det=su*tv-sv*tu;
        if(Math.abs(det)<.00001)continue;
        const [ax,ay]=positions[a], [bx,by]=positions[b], [cx,cy]=positions[c];
        const dx=bx-ax, dy=by-ay, ex=cx-ax, ey=cy-ay;
        const m00=(dx*tv-ex*sv)/det, m01=(ex*su-dx*tu)/det;
        const m10=(dy*tv-ey*sv)/det, m11=(ey*su-dy*tu)/det;
        const mx=(ax+bx+cx)/3, my=(ay+by+cy)/3;
        brush.save();
        brush.beginPath();
        for(const [j,[x,y]] of [positions[a],positions[b],positions[c]].entries()){
          // Half a pixel of overlap closes the antialiased inner edges between neighbours.
          const length=Math.hypot(x-mx,y-my)||1;
          const px=x+.62*(x-mx)/length, py=y+.62*(y-my)/length;
          if(j===0)brush.moveTo(px,py);else brush.lineTo(px,py);
        }
        brush.closePath();brush.clip();
        brush.setTransform(m00,m10,m01,m11,ax-m00*sx-m01*sy,ay-m10*sx-m11*sy);
        const left=Math.max(0,Math.floor(Math.min(ua,ub,uc)*iw)-2);
        const top=Math.max(0,Math.floor(Math.min(va,vb,vc)*ih)-2);
        const w=Math.min(iw,Math.ceil(Math.max(ua,ub,uc)*iw)+2)-left;
        const h=Math.min(ih,Math.ceil(Math.max(va,vb,vc)*ih)+2)-top;
        if(w>0&&h>0)brush.drawImage(image,origin+left,originY+top,w,h,origin+left,originY+top,w,h);
        brush.restore();
      }
    }
    return function draw(front,side,lids,between,yaw,pitch,blink) {
      if(buffer.width!==canvas.width || buffer.height!==canvas.height){buffer.width=canvas.width;buffer.height=canvas.height;}
      const factor=Math.abs(yaw), mid=sourceViews[yaw<0?1:3], outer=sourceViews[yaw<0?2:4], neutral=sourceViews[0];
      const phase=factor*2, first=phase<1, t=first?phase:phase-1;
      const from=first?neutral:mid, to=first?mid:outer;
      const arc=Math.sin(Math.PI*phase)*Math.sign(yaw)*.0025;
      const positions=landmarks.map((p,i)=>[
        (from[i][0]*(1-t)+to[i][0]*t+p[10]*arc)*buffer.width,
        (from[i][1]*(1-t)+to[i][1]*t+p[10]*pitch*.003)*buffer.height
      ]);
      let a=first?[front,from,-1,-1]:[side,from,0,-1], b=[side,to,first?0:1,-1], mix=t;
      if(between){
        const column=first?0:1, row=yaw<0?0:1;
        const bridge=[between,betweenViews[row*2+column],column,row];
        if(t<.5){b=bridge;mix=t*2;}else{a=bridge;mix=t*2-1;}
      }
      const blend=ease(clamp((mix-.3)/.4,0,1));
      out.clearRect(0,0,canvas.width,canvas.height);
      const atPose=Math.abs(pitch)<.0001 && Math.abs(arc)<.00001;
      function paintKey([image,src,column,row], opacity, exact){
        if(opacity<=0)return;
        out.globalAlpha=opacity;
        if(atPose&&exact){
          const w=image.naturalWidth/(column<0?1:2), h=image.naturalHeight/(row<0?1:2);
          out.drawImage(image,Math.max(0,column)*w,Math.max(0,row)*h,w,h,0,0,canvas.width,canvas.height);
        }else{warp(image,src,positions,false,column,row);out.drawImage(buffer,0,0);}
      }
      paintKey(a,1-blend,mix<.0001);
      if(blend>0){out.globalCompositeOperation='lighter';paintKey(b,blend,mix>.9999);out.globalCompositeOperation='source-over';}
      if(lids && blink>.001){
        warp(eyePaint(lids),neutral,positions,true);out.globalAlpha=blink;out.drawImage(buffer,0,0);
      }
      out.globalAlpha=1;
    };
  }

  const frontOnly = /^avatar-(?:speaking|thinking|is-(?:reading|searching|working|music|happy|surprised)|idle-(?:scratch|yawn|calm)|expression-[\w-]+-active)$/;
  function usesFrontArt(classes) {
    return Array.from(classes).some(name => frontOnly.test(name));
  }

  // No continuous render loop. A transition wakes the painter and its last frame remains on screen.
  function mount(stage, motion) {
    const figure = stage.querySelector('.avatar-figure');
    const front = figure.querySelector('.avatar-idle');
    const layer = document.createElement('canvas');
    const softwareLayer = document.createElement('canvas');
    const flat = document.createElement('div');
    layer.className = 'avatar-turn';
    softwareLayer.className = flat.className = 'avatar-turn';
    softwareLayer.setAttribute('aria-hidden', 'true');
    flat.hidden = softwareLayer.hidden = layer.hidden = true;
    flat.setAttribute('aria-hidden', 'true');
    layer.setAttribute('aria-hidden', 'true');
    figure.append(layer, softwareLayer, flat);
    const sides = new Map();
    let gpu, software, contextLost = false, changeId = 0;
    let frame = 0, currentYaw = 0, currentPitch = 0, currentBlink = 0;
    let targetYaw = 0, targetPitch = 0, targetBlink = 0;
    let shown = false, glanceSide = -1, wasGlancing = false, lookX = 0, lookY = 0;
    let releaseTimer, pointerOrigin, welcomeTimer;
    let enabled = false;

    function visible() {
      return !stage.hidden && !document.hidden && !document.body.classList.contains('eva-pet-chat');
    }
    function paint(frontImage, side, between, yaw, pitch, blink) {
      if (!visible() || !side) return;
      if (gpu === undefined && !contextLost) {
        try { gpu = makeGpu(layer); }
        catch (error) { console.warn('Портрет WebGL:', error); gpu = null; }
      }
      const useGpu = !!gpu && !contextLost;
      if (!useGpu && software === undefined) software = makeSoftware(softwareLayer);
      const renderer = useGpu ? gpu : software;
      const surface = useGpu ? layer : softwareLayer;
      if (renderer) {
        const limit = useGpu ? 1280 : 720;
        const scale = Math.min(2, window.devicePixelRatio || 1, limit / Math.max(1, figure.clientHeight));
        const w = Math.max(1, Math.round(figure.clientWidth * scale));
        const h = Math.max(1, Math.round(figure.clientHeight * scale));
        if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
        const lids = figure.querySelector('.avatar-blink');
        renderer(frontImage, side, lids?.complete && lids.naturalWidth ? lids : null, between, yaw, pitch, blink);
        flat.hidden = true; layer.hidden = !useGpu; softwareLayer.hidden = useGpu;
        stage.dataset.portraitRenderer = useGpu ? 'mesh' : 'canvas';
      } else {
        const angle = Math.abs(yaw);
        flat.style.backgroundImage = 'url("'+(angle>.24?side.src:frontImage.src)+'")';
        flat.style.backgroundSize = angle>.24?'200% 100%':'100% 100%';
        flat.style.backgroundPosition = angle>.75?'right':'left';
        flat.hidden = false; layer.hidden = softwareLayer.hidden = true;
        stage.dataset.portraitRenderer = 'paint';
      }
      figure.classList.add('portrait-turned');
      shown = true;
    }
    function restoreFront() {
      figure.classList.remove('portrait-turned');
      layer.hidden = softwareLayer.hidden = flat.hidden = true;
      figure.style.removeProperty('--portrait-paint');
      shown = false;
      currentYaw = currentPitch = currentBlink = 0;
    }
    function pictureFor(key) {
      if (sides.has(key)) return sides.get(key);
      const img = new Image();
      img.decoding = 'async';
      img.src = paths[key];
      const promise = img.decode().then(() => img).catch(error => {
        sides.delete(key);
        throw error;
      });
      sides.set(key, promise);
      return promise;
    }
    async function move(yaw, pitch, blink, instant = false, returning = false) {
      const id = ++changeId;
      cancelAnimationFrame(frame);
      frame = 0;
      targetYaw = yaw; targetPitch = pitch; targetBlink = blink;
      if (!visible() || (!shown && !yaw && !pitch)) { restoreFront(); return; }
      const fromYaw = currentYaw, fromPitch = currentPitch, fromBlink = currentBlink;
      const sideSign = yaw || fromYaw || 1;
      try {
        // A sweep across the nose is registered to each painting on its own side of center.
        const cross = fromYaw * yaw < 0;
        const [desired, departing, between] = await Promise.all([
          pictureFor(sideSign<0?'left':'right'), cross ? pictureFor(fromYaw<0?'left':'right') : null,
          pictureFor('between').catch(()=>null), front.decode()
        ]);
        if (id !== changeId || !visible()) return;
        const angularDelta = Math.max(Math.abs(yaw-fromYaw), Math.abs(pitch-fromPitch));
        const duration = instant ? 0 : returning ? 310 : angularDelta < .012 ? 85 : 340 + 580 * angularDelta;
        let began, previous = -Infinity;
        function step(now) {
          if (id !== changeId || !visible()) return;
          if (began === undefined) began = now;
          const t = duration ? Math.min(1, (now-began)/duration) : 1;
          if (t === 1 || now-previous >= frameInterval-.8) {
            const amount = ease(t);
            currentYaw = fromYaw + (yaw-fromYaw)*amount;
            currentPitch = fromPitch + (pitch-fromPitch)*amount;
            currentBlink = fromBlink + (blink-fromBlink)*amount;
            if (Math.abs(currentYaw)+Math.abs(currentPitch) > .002) {
              const side = cross && currentYaw*fromYaw > 0 ? departing : desired;
              paint(front, side, between, currentYaw, currentPitch, currentBlink);
              if (returning) figure.style.setProperty('--portrait-paint',(1-ease(clamp((t-.28)/.72,0,1))).toFixed(3));
              else figure.style.removeProperty('--portrait-paint');
            } else if (shown) restoreFront();
            previous = now - Math.max(0, (now-previous) % frameInterval || 0);
          }
          frame = t < 1 ? requestAnimationFrame(step) : 0;
        }
        frame = requestAnimationFrame(step);
      } catch {
        if (id === changeId) restoreFront();
      }
    }
    function sync(force = false) {
      const classes = stage.classList;
      const override = stage.getAttribute('data-preview-yaw');
      const dragging = override !== null && Number.isFinite(Number(override)) && document.body.classList.contains('avatar-preview-active');
      const manual = dragging ? clamp(Number(override),-1,1) : classes.contains('avatar-turn-left') ? -1 : classes.contains('avatar-turn-right') ? 1 : 0;
      if (!visible() || (motion.matches && !manual)) {
        if (enabled) { ++changeId; cancelAnimationFrame(frame); frame = 0; restoreFront(); }
        enabled = false;
        return;
      }
      enabled = true;
      const glance = classes.contains('avatar-is-glancing') || classes.contains('avatar-preview-glance');
      if (glance && !wasGlancing) glanceSide *= -1;
      wasGlancing = glance;
      const listening = classes.contains('avatar-listening');
      const reserved = !manual && usesFrontArt(classes);
      let yaw = dragging ? manual : manual || lookX || (glance ? glanceSide * .94 : listening ? -.48 : 0);
      let pitch = lookY || (listening ? .35 : 0);
      if (reserved) { yaw = 0; pitch = 0; }
      const blink = classes.contains('avatar-blinking') ? 1 : 0;
      if (force || yaw !== targetYaw || pitch !== targetPitch || blink !== targetBlink || (manual && !shown)) {
        move(yaw,pitch,blink,motion.matches||dragging,reserved && shown);
      }
    }
    function attend(x, y, duration = 1650) {
      if (motion.matches || !visible() || document.body.classList.contains('avatar-preview-active')) return;
      lookX = clamp(x, -1, 1); lookY = clamp(y, -1, 1); sync();
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => { lookX = lookY = 0; sync(); }, duration);
    }
    const observer = new MutationObserver(() => sync());
    observer.observe(stage, {attributes:true, attributeFilter:['class','hidden','data-preview-yaw']});
    observer.observe(document.body, {attributes:true, attributeFilter:['class']});
    document.addEventListener('visibilitychange', () => sync(true));
    motion.addEventListener('change', () => sync(true));
    const resize = new ResizeObserver(() => { if (shown && !frame) sync(true); });
    resize.observe(figure);
    layer.addEventListener('webglcontextlost', event => {
      event.preventDefault(); ++changeId; cancelAnimationFrame(frame); frame = 0;
      contextLost = true; gpu = undefined; layer.hidden = true; sync(true);
    });
    layer.addEventListener('webglcontextrestored', () => { contextLost = false; sync(true); });
    // Observe completed taps only. The chat retains all native scrolling, links and gestures.
    const messages = document.getElementById('messages');
    messages.addEventListener('pointerdown', event => {
      pointerOrigin = event.isPrimary ? {id:event.pointerId,x:event.clientX,y:event.clientY} : null;
    }, {passive:true});
    messages.addEventListener('pointercancel', () => { pointerOrigin = null; }, {passive:true});
    messages.addEventListener('pointerup', event => {
      const start = pointerOrigin; pointerOrigin = null;
      if (!start || event.pointerId !== start.id || Math.hypot(event.clientX-start.x, event.clientY-start.y)>12) return;
      if (event.target.closest('a,button,input,textarea,summary,[contenteditable]')) return;
      const b = stage.getBoundingClientRect();
      attend((event.clientX-b.left)/Math.max(1,b.width)*2-1, (event.clientY-b.top)/Math.max(1,b.height)-.27);
    }, {passive:true});
    const input = document.getElementById('input');
    input.addEventListener('focus', () => attend(-.28, .75, 1450));
    // Give the WebView time to enter mini-chat mode before requesting second-view art.
    welcomeTimer = setTimeout(() => attend(.54, -.12, 1750), 1300);
    window.addEventListener('pagehide', () => {
      clearTimeout(welcomeTimer); clearTimeout(releaseTimer); lookX = lookY = 0;
      ++changeId; cancelAnimationFrame(frame); frame = 0; restoreFront();
    });
    sync();
  }

  // Approximate articulation between word boundaries. Timings use relative speech units.
  function speechTrack(text) {
    const cues = [], byOffset = new Map(), groups = ['аяa', 'еэыиei', 'оёo', 'уюuw', 'мбпmbp', 'вфfv'];
    let duration = 0, offset = 0;
    for (const letter of text.toLowerCase()) {
      const pair = groups.findIndex(group => group.includes(letter));
      const rest = /[\s.,!?;:…—–-]/u.test(letter);
      const weight = rest ? (/[.!?…]/u.test(letter) ? 2.8 : /[,;:—–]/u.test(letter) ? 1.6 : .58) : pair < 0 ? .68 : pair >= 4 ? .8 : 1.2;
      const begin = duration;
      duration += weight;
      cues.push({offset, begin, end:duration, shape:rest ? -1 : pair < 0 ? 2 : pair * 2,
        strength:rest ? 0 : pair < 0 ? .35 : pair >= 4 ? .65 : 1});
      byOffset.set(offset,cues[cues.length-1]);
      offset += letter.length;
    }
    return {cues, byOffset, duration};
  }

  function speechCue(track, position) {
    if (!track || position < 0 || position >= track.duration) return null;
    let low = 0, high = track.cues.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (track.cues[mid].end <= position) low = mid + 1;
      else high = mid;
    }
    return track.cues[low] || null;
  }

  const api = {mount, usesFrontArt, interleavedVertices, triangles, landmarks, speechTrack, speechCue};
  root.EvaPortrait = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
