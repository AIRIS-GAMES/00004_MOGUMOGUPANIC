const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/Game.js'), 'utf8'), context);
const Game = vm.runInContext('Game', context);
const g = Object.create(Game.prototype), draws = [];
const item = (id, y, state = 'idle', x = 0) => ({ id, y, state, x, r: 10, active: true, draw: () => draws.push(id) });
const low = item('low', 10), high = item('high', 90), sucked = item('sucked', 0, 'suck');
const event = item('sun', 20), outside = item('outside', 0, 'idle', 500);
Object.assign(g, {
  dpr: 2, w: 390, h: 844, state: 'play', input: { active: false },
  ctx: { setTransform() {}, clearRect() {}, save() {}, restore() {} },
  camera: { apply() {}, viewBounds: () => ({ l: -100, r: 100, t: -100, b: 100 }) },
  spawner: { pool: [high, low, sucked, outside], eventPool: [event] },
  player: { y: 30, bodyR: 10, mouthOpen: 1, draw: () => draws.push('player') },
  particles: { draw() {} }, _drawBackground() {},
  collaboration: { drawItem: (_ctx, o) => o.draw(), renderWorld() {} },
});
g._render();
assert.deepEqual(draws, ['low', 'sun', 'player', 'high', 'sucked']);
const list = g.drawList, suckingList = g.suckingList, entry = g.renderEntries.get(low);
draws.length = 0; low.y = 95; event.active = false;
g._render();
assert.deepEqual(draws, ['player', 'high', 'low', 'sucked']);
assert.equal(g.drawList, list);
assert.equal(g.suckingList, suckingList);
assert.equal(g.renderEntries.get(low), entry);
g.player = null;
g.walkers = [{ id: 'walker', y: -30 }];
g._drawWalker = (_ctx, walker) => draws.push(walker.id);
draws.length = 0; g._render();
assert.deepEqual(draws, ['sucked', 'walker', 'high', 'low']);
assert.equal(g.dpr, 2);
console.log('PASS: render ordering, suction foreground, culling, collaboration, title walkers and entry/list reuse.');
