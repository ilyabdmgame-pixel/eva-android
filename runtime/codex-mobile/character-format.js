'use strict';

// This preflight runs before any image decoder, accessor allocation or URL lookup.
(function (root) {
  const MAX_BYTES = 16 * 1024 * 1024;
  const MAX_VERTICES = 65535, MAX_INDICES = 196605;
  const fail = message => { throw new Error(message); };
  const whole = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  function dims(bytes, mime) {
    const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (mime === 'image/png' && d.byteLength >= 24 && d.getUint32(0) === 0x89504e47 && d.getUint32(12) === 0x49484452) {
      return [d.getUint32(16), d.getUint32(20)];
    }
    if (mime === 'image/jpeg' && d.byteLength >= 11 && d.getUint16(0) === 0xffd8) {
      for (let p = 2; p + 9 <= d.byteLength && bytes[p] === 255;) {
        while (bytes[p] === 255) p++;
        const marker = bytes[p++], size = d.getUint16(p);
        if (size < 2 || p + size > d.byteLength) break;
        if ([192,193,194].includes(marker)) return [d.getUint16(p+5),d.getUint16(p+3)];
        p += size;
      }
    }
    fail('Встрой в GLB текстуры PNG или JPEG.');
  }
  function inspect(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 48 || bytes.length > MAX_BYTES || d.getUint32(0,true) !== 0x46546c67 ||
        d.getUint32(4,true) !== 2 || d.getUint32(8,true) !== bytes.length || d.getUint32(16,true) !== 0x4e4f534a)
      fail('Нужен один двоичный файл GLB 2.0 размером до 16 МиБ.');
    const jsonSize = d.getUint32(12,true), start = 20 + jsonSize;
    if (jsonSize % 4 || jsonSize > 1024*1024 || start+8 > bytes.length || d.getUint32(start+4,true) !== 0x004e4942)
      fail('В GLB должны быть встроены геометрия и текстуры.');
    const binSize = d.getUint32(start,true);
    if (binSize % 4 || start+8+binSize !== bytes.length) fail('Повреждён двоичный блок GLB.');
    const data = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(20,start)), (key,value) => {
      if (key === 'uri') fail('Встрой все ресурсы в GLB. Внешние ссылки не загружаются.');
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail('Недопустимое поле GLB.');
      return value;
    });
    const list = (key, max) => {
      const v = data[key] ?? [];
      if (!Array.isArray(v) || v.length > max) fail('Слишком сложный GLB: '+key);
      return v;
    };
    if (data.asset?.version !== '2.0' || data.buffers?.length !== 1 ||
        !whole(data.buffers[0].byteLength,binSize) || binSize-data.buffers[0].byteLength > 3)
      fail('Нужен GLB 2.0 со встроенным буфером.');
    const allowed = ['KHR_materials_unlit','KHR_texture_transform','KHR_mesh_quantization'];
    if ((data.extensionsRequired || []).some(k=>!allowed.includes(k)) ||
        (data.extensionsUsed || []).some(k=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu','EXT_mesh_gpu_instancing'].includes(k)))
      fail('Экспортируй GLB без Draco, Meshopt, KTX2 и обязательных нестандартных расширений.');
    const views=list('bufferViews',4096), access=list('accessors',4096), nodes=list('nodes',1024);
    const meshes=list('meshes',256), scenes=list('scenes',32), images=list('images',32);
    list('textures',64);list('materials',32);list('skins',32);list('animations',48);
    for (const v of views) {
      if (v.buffer !== 0 || !whole(v.byteLength,binSize) || !whole(v.byteOffset??0, data.buffers[0].byteLength-v.byteLength))
        fail('Буфер GLB выходит за границы файла.');
    }
    const sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
    const fields={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
    for (const a of access) {
      const v=views[a.bufferView], field=fields[a.type]*sizes[a.componentType];
      if (a.sparse || !v || !field || !whole(a.count,786420) || !a.count) fail('Неподдерживаемый accessor GLB. Экспортируй обычные массивы вершин.');
      const stride=v.byteStride??field, offset=a.byteOffset??0;
      if (!whole(offset,v.byteLength) || !whole(stride,252) || stride<field || offset+(a.count-1)*stride+field>v.byteLength)
        fail('Данные вершин GLB обрезаны.');
    }
    let pixels=0;
    for(const i of images) {
      const v=views[i.bufferView];
      if(!v) fail('Текстура должна храниться внутри GLB.');
      const p=start+8+(v.byteOffset??0);
      const [w,h]=dims(bytes.subarray(p,p+v.byteLength),i.mimeType);
      pixels+=w*h;
      if (!w||!h||w>4096||h>4096||pixels>16*1024*1024) fail('Уменьши текстуры: до 4096 на сторону и 16 Мпикс в сумме.');
    }
    // A glTF node has at most one parent. Inspect every node, including unused scenes,
    // because the loader also resolves skins and animations outside the default scene.
    const visited=new Set(), active=new Set(), parents=new Set();
    function visit(id,depth) {
      if (!whole(id,nodes.length-1) || active.has(id) || depth>96) fail('Некорректная иерархия узлов GLB.');
      if (visited.has(id)) return;
      active.add(id);
      for(const child of nodes[id].children??[]) {
        if(parents.has(child)) fail('Узлу модели назначены два родителя.');
        parents.add(child); visit(child,depth+1);
      }
      active.delete(id);visited.add(id);
    }
    nodes.forEach((_,i)=>visit(i,0));
    if (!scenes[data.scene??0]?.nodes?.length) fail('В GLB нет активной сцены.');
    let vertices=0,indices=0;
    for (const node of nodes) {
      if(node.mesh===undefined) continue;
      const obj=meshes[node.mesh];
      if (!obj?.primitives?.length || obj.primitives.length>128) fail('В GLB нет поддерживаемой геометрии.');
      for(const p of obj.primitives) {
        const pos=access[p.attributes?.POSITION];
        if ((p.mode??4)!==4 || !pos || pos.type!=='VEC3' || (p.targets?.length??0)>32) fail('Экспортируй меш треугольниками.');
        const count=p.indices===undefined?pos.count:access[p.indices]?.count;
        if(!count || count%3) fail('Некорректные индексы треугольников.');
        vertices+=pos.count;indices+=count;
      }
    }
    if(!vertices||vertices>MAX_VERTICES||indices>MAX_INDICES) fail('Для телефона упрости модель до 65 535 вершин и 65 535 треугольников.');
    return data;
  }
  const format = {inspect,MAX_BYTES,MAX_VERTICES,MAX_INDICES};
  if (typeof module !== 'undefined' && module.exports) module.exports = format;
  else root.EvaCharacterFormat = format;
})(globalThis);
