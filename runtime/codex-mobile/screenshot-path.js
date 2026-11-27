'use strict';
const path = require('node:path');
const fs = require('node:fs');
const shared = '/sdcard/Documents/Codex';
const directory = path.join(shared, 'Снимки экрана');

// Historical chat messages contain the original absolute screenshot paths.
const builtinRoot='/root/.codex/generated_images/eva-builtin-20261116';
function resolveScreenshot(file,exists=fs.existsSync) {
  if(typeof file==='string'&&path.dirname(path.dirname(file))===builtinRoot&&
      /^(emotions|speech)$/.test(path.basename(path.dirname(file)))&&/^[a-z0-9-]+\.png$/i.test(path.basename(file))&&!exists(file)){
    const webp=file.slice(0,-4)+'.webp';
    if(exists(webp))return webp;
  }
  if (typeof file === 'string' && path.dirname(file) === shared &&
      /^Экран-\d+-[a-f0-9]{6}\.png$/.test(path.basename(file)) && !exists(file)) {
    return path.join(directory, path.basename(file));
  }
  return file;
}
module.exports = {directory, resolveScreenshot};
