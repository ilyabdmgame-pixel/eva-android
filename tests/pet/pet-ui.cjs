const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
  }
  append(child) { this.children.push(child); }
  prepend(child) { this.children.unshift(child); }
  insertAdjacentElement(position, child) {
    assert.equal(position, 'afterend');
    this.inserted = child;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, listener) { assert.equal(type, 'click'); this.click = listener; }
}

const body = new Element('body');
const head = new Element('head');
const settings = new Element('section');
const access = new Element('button');
const ids = new Map([['voice-settings', settings], ['accessibility-open', access]]);
const calls = [];
const document = {
  body, head,
  getElementById: id => ids.get(id) || body.children.find(child => child.id === id),
  createElement: name => new Element(name)
};
const EvaApp = Object.fromEntries(
  ['petSettings', 'petAppProfile', 'petMap', 'expandPetChat', 'closePetChat'].map(action => [action, () => calls.push(action)])
);
const script = fs.readFileSync(path.join(__dirname, '../../app/src/main/assets/eva-pet/ui.js'), 'utf8');
vm.runInNewContext(script, { document, EvaApp });
vm.runInNewContext(script, { document, EvaApp });
assert.equal(head.children.length, 1);
assert.equal(body.children.length, 1);
assert.equal(head.children[0].href, '/eva-pet-ui.css');
assert.equal(access.inserted.id, 'eva-pet-controls');
access.inserted.click();
const [title, ...buttons] = body.children[0].children;
const control = label => buttons.find(button => button.attributes['aria-label'] === label);
const expand = control('Развернуть Еву'), close = control('Закрыть мини-чат');
const profile = control('Поведение в приложении');
assert(profile);
profile.click();
const map = control('Покажи, что видишь');
assert(map);
map.click();
assert.equal(title.textContent, 'Ева');
assert.equal(expand.attributes['aria-label'], 'Развернуть Еву');
assert.equal(close.attributes['aria-label'], 'Закрыть мини-чат');
expand.click();
close.click();
assert.deepEqual(calls, ['petSettings', 'petAppProfile', 'petMap', 'expandPetChat', 'closePetChat']);
const css = fs.readFileSync(path.join(__dirname, '../../app/src/main/assets/eva-pet/ui.css'), 'utf8');
const formRule = css.match(/body\.eva-pet-chat #form\s*\{([^}]*)\}/);
assert(formRule && !/display:\s*none/i.test(formRule[1]));
console.log('Pet UI: settings, CSP-compatible stylesheet, accessible controls and bridge actions OK');
