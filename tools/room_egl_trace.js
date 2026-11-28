// Optional input for verify_ui.mjs. Loaded in an isolated browser profile before game.mjs.
// Each recorded handle is mapped to a real object in a surfaceless EGL context by the replay.
(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  const constants = {
    ...Object.getOwnPropertyDescriptors(WebGLRenderingContext.prototype),
    ...Object.getOwnPropertyDescriptors(WebGL2RenderingContext.prototype)
  };
  const entries = [];
  let capture = false, nextHandle = 1;

  function binary(view) {
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    let value = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      value += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return {binary: btoa(value)};
  }
  function source(value) {
    if (ArrayBuffer.isView(value)) return binary(value);
    if (value instanceof HTMLImageElement) {
      const url = new URL(value.src);
      if (url.origin === location.origin && url.pathname.startsWith('/art/')) return {file: url.pathname};
      // Locally imported character textures have no corresponding file in the source tree.
      const image = document.createElement('canvas');
      image.width = value.naturalWidth; image.height = value.naturalHeight;
      getContext.call(image, '2d').drawImage(value, 0, 0);
      return {image: image.toDataURL('image/png')};
    }
    if (value instanceof HTMLCanvasElement) return {image: value.toDataURL('image/png')};
    return value;
  }

  // State establishing geometry and textures is retained between snapshots. Per-frame
  // uniforms and streaming vertex buffers are retained only when a frame is requested.
  const resource = /^(?:delete|tex|generateMipmap|bind|framebuffer|renderbuffer|(?:en|dis)able|vertexAttrib|shaderSource|compileShader|attachShader|linkProgram|useProgram)/;
  const gl = new Proxy({}, {
    get(target, key) {
      if (/^[_A-Z0-9]+$/.test(key)) return constants[key]?.value;
      if (target[key]) return target[key];
      target[key] = (...args) => {
        if (key === 'getUniformLocation') return {uniform: args[1]};
        if (key === 'getShaderParameter' || key === 'getProgramParameter') return true;
        if (key === 'getParameter') {
          if (args[0] === gl.DEPTH_BITS) return 24;
          return args[0] === gl.STENCIL_BITS ? 8 : 0;
        }
        if (key === 'checkFramebufferStatus') return gl.FRAMEBUFFER_COMPLETE;
        if (key === 'isContextLost') return false;
        if (key === 'getExtension' || key === 'getError' || key === 'readPixels') return null;
        if (key.startsWith('create')) {
          const handle = {obj: nextHandle++};
          entries.push([key, handle, ...args]);
          return handle;
        }
        const staticBuffer = key === 'bufferData' && args[2] === gl.STATIC_DRAW;
        if (!capture && !resource.test(key) && !staticBuffer) return;
        if (key === 'bufferData' && args.length > 3) {
          const [target, data, usage, offset, count] = args;
          args = [target, binary(data.subarray(offset, offset + count)), usage];
        } else if (key.startsWith('uniform') && ArrayBuffer.isView(args.at(-1))) {
          args[args.length - 1] = Array.from(args.at(-1));
        } else {
          args = args.map(source);
        }
        entries.push([key, ...args]);
      };
      return target[key];
    }
  });

  HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
    return kind === 'webgl2' && this.id === 'scene' ? gl : getContext.call(this, kind, ...args);
  };
  window.evaGlesCapture = {
    start() {
      capture = true;
      window.dispatchEvent(new Event('resize'));
      return worldCheck().paintCount;
    },
    finish(name) {
      capture = false;
      const {width, height} = document.getElementById('scene');
      entries.push(['photo', name, width, height]);
      return entries.length;
    },
    slice: (start, end) => entries.slice(start, end)
  };
})();
