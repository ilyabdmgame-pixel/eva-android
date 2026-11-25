'use strict';
const fs=require('fs'),path=require('path');
function saveImage(source, roots=['/sdcard/Documents/Codex','/root/.codex/generated_images'], destination='/sdcard/Download'){
 if(typeof source!=='string')throw Error('Не указан файл');
 const file=fs.realpathSync(require("./screenshot-path").resolveScreenshot(source));
 const allowed=roots.filter(p=>fs.existsSync(p)).map(p=>fs.realpathSync(p));
 if(!allowed.some(root=>file.startsWith(root+path.sep)))throw Error('Изображение вне доступных папок');
 const ext=path.extname(file).toLowerCase();
 if(!['.png','.jpg','.jpeg','.webp','.gif'].includes(ext)||!fs.statSync(file).isFile())throw Error('Формат изображения не поддерживается');
 const base=path.basename(file,ext);
 for(let i=0;i<1000;i++){
  const name=base+(i?' ('+i+')':'')+ext;
  try{fs.copyFileSync(file,path.join(destination,name),fs.constants.COPYFILE_EXCL);return name}catch(e){if(e.code!=='EEXIST')throw e}
 }
 throw Error('Не удалось подобрать имя файла');
}
module.exports={saveImage};
