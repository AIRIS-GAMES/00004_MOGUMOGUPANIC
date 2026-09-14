const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let now = 1000, localFails = false;
const local = new Map();
const ctx = vm.createContext({ console, window: {}, document: { hidden: false },
  performance: { now: () => now }, requestAnimationFrame: () => {},
  localStorage: { getItem: k => local.get(k) ?? null, setItem: (k, v) => { if (localFails) throw Error('unavailable'); local.set(k, v); } } });
for (const file of ['Storage', 'Player', 'Game']) vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8'), ctx);
const Storage = vm.runInContext('Storage', ctx), Game = vm.runInContext('Game', ctx), Player = vm.runInContext('Player', ctx);
(async () => {
  for (const [count, multiplier] of [[0, 1], [1, 1], [2, 2], [3, 3], [4, 4], [9, 4], [10, 5], [19, 5], [20, 6], [29, 6], [30, 7], [100, 14]]) {
    assert.equal(Game.comboMultiplier(count), multiplier, `Combo ${count}`);
  }
  const native = [];
  Storage.preferences = { set: async value => native.push(value) };
  localFails = true;
  Storage.set('coins', 123);
  await Storage.flush();
  assert.equal(native[0].value, '123');
  assert.equal(Storage.get('coins', 0), 123);
  localFails = false;
  Storage.preferences = { set: async () => { throw Error('native unavailable'); } };
  Storage.set('coins', 456);
  await Storage.flush();
  assert.equal(local.get('coins'), '456');
  Storage.preferences = { set: async value => native.push(value) };
  Storage.set('coins', 1); Storage.set('coins', 2);
  await Storage.flush();
  assert.equal(native.at(-1).value, '2');

  let released = null, eventElapsed = 0;
  const g = Object.create(Game.prototype);
  Object.assign(g, { state: 'play', _lastT: now, time: 0, timeLeft: 60,
    score: 0, currentStageId: 1, comboTimer: .5, comboCount: 4,
    player: new Player({}, {}, 1750, 1750), input: {active: true, id: 9}, keys: new Set(['arrowright']),
    canvas: {hasPointerCapture: () => true, releasePointerCapture: id => {released=id;}},
    ui: {updateHUD() {}, showScreen() {}}, camera: { follow() {}, update() {} },
    spawner: {update() {}}, particles: {update() {}, vacuumSpark() {}},
    collaboration: {tick() {}, update: (_dt, elapsed) => {eventElapsed=elapsed;}},
    _getMoveInput: () => ({active:false,ratio:0}), _updateSuction() {}, _render() {},
  });
  g.ui.setGauge = () => {};
  g.player.startVacuum();
  now = 2000;
  g._loop(now);
  assert.equal(g.timeLeft, 59);
  assert.equal(g.player.vacuumTimer, 4);
  assert.equal(eventElapsed, 1);
  assert.equal(g.comboCount, 0);
  g.pauseGame();
  assert.equal(g.keys.size, 0); assert.equal(g.input.active, false); assert.equal(released, 9);
  now = 12000; g._loop(now);
  assert.equal(g.timeLeft, 59);
  g.resumeGame();
  now = 13000; g._loop(now);
  assert.equal(g.timeLeft, 58);
  let ended = false, suctionAfterTimeout = false;
  g.timeLeft = .2; g.endGame = () => {ended=true;g.state='result';};
  g._updateSuction = () => {suctionAfterTimeout=true;};
  now = 14000; g._loop(now);
  assert.equal(ended, true); assert.equal(g.timeLeft, 0); assert.equal(suctionAfterTimeout, false);
  g.state = 'play'; ended = false;
  g.runTimeLimit = 60; g.timeLeft = 42; g.clearTime = null;
  g.score = Game.STAGES[0].targetScore;
  g.collaboration.enabled = true;
  for (const phase of ['sunBonusEntering', 'sunBonusActive', 'sunBonusEnding']) {
    g.collaboration.state = phase;
    assert.equal(g._checkTarget(), false);
    assert.equal(g.clearTime, 18);
    g.timeLeft--;
  }
  g.collaboration.state = 'normal';
  assert.equal(g._checkTarget(), true);
  assert.equal(ended, true);
  assert.equal(g.clearTime, 18, 'Bonus grace must not inflate clear time');
  Storage.setClearTime(1, 18);
  Storage.setClearTime(1, 12, true);
  assert.equal(Storage.getClearTime(1), 18);
  assert.equal(Storage.getClearTime(1, true), 12);
  console.log('PASS: independent storage fallbacks, write order, real-time clocks, pause exclusion, input reset, timeout.');
})().catch(error => { console.error(error); process.exitCode=1; });
