'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { crc32, inflate } = require('node:zlib');
const { promisify } = require('node:util');

const decompress = promisify(inflate);
const MAX_STYLE = 4000;
const MAX_PNG = 8 * 1024 * 1024;
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
function bad(message) { return Object.assign(new Error(message), { status: 400 }); }

// The picker draws one frame to a fresh canvas. Revalidate its pixels and retain
// only image chunks, so comments, profiles and camera metadata never reach disk.
async function cleanPng(data) {
  if (data.length < 45 || data.length > MAX_PNG || !data.subarray(0, 8).equals(signature)) {
    throw bad('Не удалось прочитать PNG портрета.');
  }
  const pixels = [], chunks = [signature];
  let offset = 8, width = 0, height = 0, channels = 0, end = false;
  while (offset + 12 <= data.length && !end) {
    const length = data.readUInt32BE(offset);
    const next = offset + length + 12;
    if (next > data.length) throw bad('Файл портрета обрезан.');
    const type = data.toString('latin1', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, next - 4);
    if (crc32(data.subarray(offset + 4, next - 4)) !== data.readUInt32BE(next - 4)) throw bad('Портрет повреждён.');
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13) throw bad('Некорректный заголовок PNG.');
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      if (!width || !height || width > 1600 || height > 1600 || width * height > 2000000 ||
          body[8] !== 8 || !channels || body[10] || body[11] || body[12]) {
        throw bad('Неподдерживаемые размеры или цвет портрета.');
      }
    } else if (!width) throw bad('У портрета нет заголовка PNG.');
    else if (type === 'IDAT') pixels.push(body);
    else if (type === 'IEND') {
      if (length || next !== data.length) throw bad('Некорректное окончание PNG.');
      end = true;
    } else if (type === 'acTL' || /^[A-Z]/.test(type)) throw bad('Нужен статичный RGB-портрет.');
    if (['IHDR', 'IDAT', 'IEND'].includes(type)) chunks.push(data.subarray(offset, next));
    offset = next;
  }
  if (!end || !pixels.length) throw bad('В портрете нет изображения.');
  const row = width * channels + 1;
  let decoded;
  try { decoded = await decompress(Buffer.concat(pixels), { maxOutputLength: height * row }); }
  catch { throw bad('Не удалось декодировать пиксели портрета.'); }
  if (decoded.length !== height * row) throw bad('Неполное изображение.');
  for (let y = 0; y < height; y++) if (decoded[y * row] > 4) throw bad('Некорректные строки PNG.');
  return Buffer.concat(chunks);
}

function makeProfile(home = process.env.EVA_RUNTIME_HOME || os.homedir()) {
  const dir = path.join(home, '.config', 'eva', 'appearance');
  const stylePath = path.join(dir, 'conversation-style.txt'), imagePath = path.join(dir, 'portrait.png');
  function style() {
    try { return fs.readFileSync(stylePath, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return ''; throw e; }
  }
  function version() {
    try { const s = fs.statSync(imagePath, { bigint: true }); return s.ino.toString(36) + '-' + s.mtimeNs.toString(36); }
    catch (e) { if (e.code === 'ENOENT') return ''; throw e; }
  }
  function store(file, value) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const staging = path.join(dir, randomUUID() + '.tmp');
    try {
      fs.writeFileSync(staging, value, { flag: 'wx', mode: 0o600 });
      fs.renameSync(staging, file);
    } finally { fs.rmSync(staging, { force: true }); }
  }
  function setStyle(value) {
    if (typeof value !== 'string' || value.length > MAX_STYLE) throw bad('Инструкции должны содержать до 4000 знаков.');
    const trimmed = value.trim();
    if (trimmed) store(stylePath, trimmed);
    else fs.rmSync(stylePath, { force: true });
    return trimmed;
  }
  return {
    style, version, imagePath, setStyle,
    state: () => ({ style: style(), portraitVersion: version() }),
    savePortrait: async bytes => { store(imagePath, await cleanPng(bytes)); return version(); },
    resetPortrait: () => fs.rmSync(imagePath, { force: true })
  };
}

module.exports = { MAX_PNG, cleanPng, makeProfile, profile: makeProfile() };
