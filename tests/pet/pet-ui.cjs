const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.events = new Map();
    this.value = '';
    const classes = new Set();
    this.classList = { toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
  }
  append(...children) { this.children.push(...children); }
  prepend(child) { this.children.unshift(child); }
  insertAdjacentElement(position, child) {
    assert.equal(position, 'afterend');
    this.inserted = child;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, listener) { this.events.set(type, listener); }
  dispatchEvent(event) { this.events.get(event.type)?.(event); }
  click() { this.dispatchEvent({ type: 'click' }); }
}

const body = new Element('body');
const head = new Element('head');
const settings = new Element('button');
const input = new Element('textarea');
const mic = new Element('button');
const form = new Element('form');
const ids = new Map([['voice-settings-open', settings], ['form', form], ['mic', mic], ['input', input]]);
const saved = new Map([['eva-current-thread', 'test-thread']]);
const localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
const calls = [];
const document = {
  body, head,
  getElementById: id => ids.get(id) || body.children.find(child => child.id === id),
  createElement: name => new Element(name)
};
const EvaApp = Object.fromEntries(
  ['petSettings', 'petAppProfile', 'petMap', 'expandPetChat', 'closePetChat', 'petComposerDetails'].map(action => [action, () => calls.push(action)])
);
const script = fs.readFileSync(path.join(__dirname, '../../app/src/main/assets/eva-pet/ui.js'), 'utf8');
const window = {};
const globals = { document, EvaApp, window, localStorage, Event, queueMicrotask,
  matchMedia: () => ({ matches:false }),
  uiIcon: icon => '<svg aria-hidden="true" data-icon="'+icon+'"></svg>' };
vm.runInNewContext(script, globals);
vm.runInNewContext(script, globals);
assert.equal(head.children.length, 2);
assert.equal(body.children.length, 1);
assert.equal(head.children[0].href, '/eva-pet-ui.css');
assert.equal(head.children[1].href, '/eva-composer.css');
assert.equal(settings.inserted.id, 'eva-pet-controls');
settings.inserted.click();
const [presence, title, ...buttons] = body.children[0].children;
assert.equal(presence.attributes['aria-hidden'], 'true');
assert.equal(presence.children.length, 3);
window.evaMiniPresence('listening');
assert.equal(presence.dataset.state, 'listening');
const control = label => buttons.find(button => button.attributes['aria-label'] === label);
const expand = form.children[0], close = control('Закрыть мини-чат');
const profile = control('Поведение в приложении');
assert(profile);
profile.click();
const map = control('Покажи, что видишь');
assert(map);
map.click();
assert.equal(title.textContent, 'Ева');
assert.equal(expand.attributes['aria-label'], 'Развернуть чат');
assert.equal(close.attributes['aria-label'], 'Закрыть мини-чат');
expand.click();
close.click();
window.evaPetComposer(true, true);
assert(form.classList.contains('eva-composer') && !expand.hidden);
input.value = 'Черновик';
input.dispatchEvent(new Event('input'));
window.evaPetComposer(false, false);
assert(!form.classList.contains('eva-composer') && expand.hidden);
input.value = '';
window.evaPetComposer(true, true);
assert.equal(input.value, 'Черновик');
mic.click();
form.dispatchEvent(new Event('submit'));
assert.deepEqual(calls, ['petSettings', 'petAppProfile', 'petMap', 'expandPetChat', 'closePetChat',
  'petComposerDetails', 'petComposerDetails']);
const css = fs.readFileSync(path.join(__dirname, '../../app/src/main/assets/eva-pet/ui.css'), 'utf8');
const formRule = css.match(/body\.eva-pet-chat #form\s*\{([^}]*)\}/);
assert(formRule && !/display:\s*none/i.test(formRule[1]));
const home = fs.readFileSync(path.join(__dirname, '../../app/src/main/assets/home/index.html'), 'utf8');
assert(home.includes('href="composer.css"') && home.includes('id="town-compose" class="eva-composer"'));
const {parse} = require('../../runtime/codex-mobile/question-options');
assert.deepEqual(parse('Сначала уточню.\nКак оформить?\n\n1. **Список**\n2. Таблица'),
  {question: 'Как оформить?', options: ['Список', 'Таблица'], text: 'Сначала уточню.'});
assert.deepEqual(parse('```eva-poll\n{"question":"Где?","options":["Дома","В парке"]}\n```').options,
  ['Дома', 'В парке']);
assert.equal(parse('Порядок действий:\n1. Открыть\n2. Проверить'), null);
assert.equal(parse('Как оформить?\n1. Единственный способ'), null);
console.log('Pet UI: settings, CSP-compatible stylesheet, accessible controls and bridge actions OK');
