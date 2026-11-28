// Lazy: the stock 2D chat and stock launcher never instantiate a glTF loader.
import * as THREE from './model-vendor/three.module.min.js';
import {GLTFLoader} from './model-vendor/GLTFLoader.js';
import './character-format.js';

export async function openActor(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  globalThis.EvaCharacterFormat.inspect(bytes);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    if (!url.startsWith('blob:')) throw Error('Ресурсы модели должны быть встроены в GLB.');
    return url;
  });
  const loader = new GLTFLoader(manager);
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const scene = new THREE.Group();
  scene.add(gltf.scene); scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene,true);
  const size=bounds.getSize(new THREE.Vector3());
  const height = size.y;
  if (!Number.isFinite(height) || height<=1e-6 || !Number.isFinite(size.x+size.z) || Math.max(size.x,size.z)>16*height) {
    release();throw Error('Проверь размер и вертикальную ось Y модели.');
  }
  // A parent holds the normalization so animation tracks can still target the
  // artist's original scene root and its local transforms.
  const center=bounds.getCenter(new THREE.Vector3()), scale=1.65/height;
  scene.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  scene.scale.setScalar(scale);scene.updateMatrixWorld(true);
  function release() {
    const geometries=new Set(), mats=new Set(), textures=new Set(), skeletons=new Set(), images=new Set();
    for(const source of gltf.scenes) source.traverse(o=>{
      if(o.geometry) geometries.add(o.geometry);
      if(o.skeleton) skeletons.add(o.skeleton);
      for(const mat of (Array.isArray(o.material)?o.material:[o.material])) {
        if(!mat)continue; mats.add(mat);
        for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);
      }
    });
    for(const t of textures){if(t.image)images.add(t.image);t.dispose();}
    for(const obj of [...mats,...geometries,...skeletons])obj.dispose();
    for(const i of images)i.close?.();
  }
  return {THREE,scene,animations:gltf.animations,dispose:release};
}
