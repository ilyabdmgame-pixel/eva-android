const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../runtime/codex-mobile/app.js'), 'utf8');
const fadeStops = vm.runInNewContext(
  source.slice(source.indexOf('function chatFadeStops('), source.indexOf('function bindChatFade(')) + '\nchatFadeStops'
);

test('the face and neck stay clear and the fade leaves space to read in a smaller window', () => {
  const chat = {top: 0, height: 720};
  const portrait = {top: 20, height: 750};
  const normal = fadeStops(chat, portrait);
  assert.equal(normal.start, 395);
  assert.ok(normal.end > normal.start + 60);
  const compact = fadeStops({top: 0, height: 220}, {top: 0, height: 270});
  assert.ok(compact.end <= 132);
  assert.ok(compact.start >= 90 && compact.end > compact.start);
  assert.equal(fadeStops({top: 0, height: 70}, portrait).end, 0);
});
