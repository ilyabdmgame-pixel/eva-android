'use strict';
const path = require('node:path');
const fs = require('node:fs');
const shared = '/sdcard/Documents/Codex';
const directory = path.join(shared, 'Снимки экрана');

// Historical chat messages contain the original absolute screenshot paths.
function resolveScreenshot(file) {
  if (typeof file === 'string' && path.dirname(file) === shared &&
      /^Экран-\d+-[a-f0-9]{6}\.png$/.test(path.basename(file)) && !fs.existsSync(file)) {
    return path.join(directory, path.basename(file));
  }
  return file;
}
module.exports = {directory, resolveScreenshot};
