const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

class Node extends EventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.classList = {add: name => { this.className += ' ' + name; }};
  }
  prepend(child) { this.children.unshift(child); child.parent = this; }
  append(...children) { this.children.push(...children); for (const child of children) child.parent=this; }
  replaceChildren(...children) { this.children=[]; this.append(...children); }
  setAttribute(name,value) { this.attributes[name]=value; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  focus() { document.activeElement=this; }
  close() { this.open=false; }
  showModal() { this.open=true; }
  remove() { this.parent.children=this.parent.children.filter(child=>child!==this); }
}

const document = new Node('document');
document.head = new Node('head');
document.body = new Node('body');
document.createElement = tag=>new Node(tag);
const nodes = (root=document.body)=>[root, ...root.children.flatMap(nodes)];
document.getElementById = id => nodes().find(n=>n.id===id);
const window = {};
let now=1000, pending, id=0;
function advance() {
  assert(pending,'Expected active timer');
  const event=pending;
  pending=null;
  now+=event.delay;
  event.fn();
}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app/src/main/assets/eva-pet/ui.js'),'utf8'), {
  document, window, performance:{now:()=>now},
  Math:Object.assign(Object.create(Math),{random:()=>.999}),
  setTimeout:(fn,delay)=>{ pending={fn,delay,id:++id}; return id; },
  clearTimeout:value=>{ if (pending && pending.id===value) pending=null; }
});
const launch = document.getElementById('eva-pet-games-launcher');
const button = text => nodes().find(n=>n.tagName==='button' && nodes(n).some(c=>c.textContent===text));
const named = name => nodes().find(n=>n.attributes['aria-label']===name);
const line = ()=>nodes().find(n=>n.className==='game-status').textContent;
launch.click();
button('Карманные пары').click();
const pocket = i=>named('Открыть карман '+i).click();
pocket(1); pocket(2); pocket(3);
assert.match(line(), /Мимо/);
advance();
for(const [a,b] of [[1,4],[2,5],[3,6]]) { pocket(a);pocket(b); }
assert.match(line(), /Ходов: 4/);
button('Ещё раз').click();
pocket(1);pocket(2);
assert(window.evaPetGameBack());
assert(!pending);
assert.equal(document.activeElement,launch);
assert(!window.evaPetGameBack());
launch.click();
button('Отбей подачу').click();
button('Я готова. Начнём?').click();
button('Жди…').click();
assert.match(line(),/Рано/);
button('Следующая подача').click();
advance();advance();
assert.match(line(),/Мимо/);
for (let i=0;i<3;i++) { button('Следующая подача').click(); advance(); now+=230; button('Отбить!').click(); }
assert.match(line(),/Отбито 3 из 5/);
assert.equal(pending,null);
button('К играм').click();
button('Отбей подачу').click();
button('Я готова. Начнём?').click();
document.hidden=true;
document.dispatchEvent(new Event('visibilitychange'));
assert.equal(pending,null);
assert(!document.getElementById('eva-pet-games'));
console.log('Pet games: pair shuffle/reveal/match, five serves, retry, cancel timers, background and Back passed');
