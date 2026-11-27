const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../runtime/codex-mobile/app.js'), 'utf8');
const fadeDepth = vm.runInNewContext(
  source.slice(source.indexOf('function chatFadeDepth('), source.indexOf('function bindChatFade(')) + '\nchatFadeDepth'
);

test('the chat fade stops before the latest reply and shrinks with the visible chat', () => {
  const chat = {top: 0, height: 720};
  const portrait = {top: 20, height: 750};
  assert.ok(fadeDepth(chat, portrait, 450) > 0);
  assert.equal(fadeDepth(chat, portrait, 180), 180);
  assert.equal(fadeDepth(chat, portrait, -25), 0);
  assert.ok(fadeDepth({top: 0, height: 220}, portrait, Infinity) < 90);
});
