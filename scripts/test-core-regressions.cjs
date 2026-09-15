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
for (const file of ['Storage', 'Player', 'Game', 'UI']) vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8'), ctx);
const Storage = vm.runInContext('Storage', ctx), Game = vm.runInContext('Game', ctx), Player = vm.runInContext('Player', ctx);
(async () => {
  const UI = vm.runInContext('UI', ctx);
  const ui = Object.create(UI.prototype);
  let textWrites = 0;
  const element = () => ({ value: '', classList: { toggle() {} },
    get textContent() { return this.value; },
    set textContent(value) { this.value = String(value); textWrites++; } });
  ui.el = { score: element(), size: element(), time: element(), target: element() };
  ui.updateHUD(100, 1.25, 59.9, 800);
  assert.equal(textWrites, 4);
  for (let i = 0; i < 60; i++) ui.updateHUD(100, 1.25, 59.5, 800);
  assert.equal(textWrites, 4, 'Unchanged HUD must not rewrite text nodes');
  ui.updateHUD(100, 1.25, 58.9, 800);
  assert.equal(textWrites, 5, 'Only changed timer is written');
  for (const [count, multiplier] of [[0, 1], [1, 1], [2, 2], [3, 3], [4, 4], [9, 4], [10, 5], [19, 5], [20, 6], [29, 6], [30, 7], [100, 14]]) {
    assert.equal(Game.comboMultiplier(count), multiplier, `Combo ${count}`);
  }
  const native = [];
  // Batch pickup UI independently from scoring; any layout read fails this test.
  const comboFrames = new Map(), comboClasses = new Set();
  let comboFrameId = 0, comboWrites = 0, comboText = '';
  ctx.requestAnimationFrame = fn => { comboFrames.set(++comboFrameId, fn); return comboFrameId; };
  ctx.cancelAnimationFrame = id => comboFrames.delete(id);
  const flushCombo = () => {
    const callbacks = [...comboFrames.values()]; comboFrames.clear(); callbacks.forEach(fn => fn(now));
  };
  ui.el.comboPop = {
    get offsetWidth() { throw Error('Synchronous combo layout read'); },
    get textContent() { return comboText; },
    set textContent(value) { comboText = value; comboWrites++; },
    classList: { remove: (...names) => names.forEach(n => comboClasses.delete(n)), add: n => comboClasses.add(n) },
  };
  ui.clearCombo();
  for (let i = 1; i <= 100; i++) ui.showCombo(Game.comboMultiplier(i), i);
  assert.equal(comboFrames.size, 1);
  assert.equal(comboWrites, 0);
  flushCombo();
  assert.equal(comboWrites, 1);
  assert.equal(comboText, '100 COMBO · SCORE ×14');
  assert.equal(comboClasses.has('show'), true);
  now += 100; ui.showCombo(14, 101); flushCombo();
  assert.equal(comboText, '101 COMBO · SCORE ×14');
  assert.equal(comboClasses.has('show'), true, 'Animation is throttled while text stays current');
  now += 500; ui.showCombo(14, 102); flushCombo();
  assert.equal(comboClasses.has('show-alt'), true, 'Alternate animation restarts without layout');
  const writesBeforeSame = comboWrites;
  ui.showCombo(14, 102); flushCombo();
  assert.equal(comboWrites, writesBeforeSame);
  ui.showCombo(14, 103);
  ui.screens = {};
  ui.showScreen('result');
  assert.equal(comboFrames.size, 0, 'Screen transitions cancel queued combo UI');
  assert.equal(comboClasses.size, 0);
  ui.showCombo(2, 2); flushCombo();
  assert.equal(comboClasses.has('show'), true, 'Next run can animate immediately');
  ui.clearCombo();
  ctx.requestAnimationFrame = () => {};
  now = 1000;
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
  g.sunRecord = true; g.state = 'play'; ended = false; g.clearTime = null;
  g.timeLeft = 30.01;
  assert.equal(g._checkTarget(), true, 'Meeting the target before 30 seconds must clear without a time gate');
  assert.equal(ended, true);
  assert.ok(g.clearTime < 30);
  g.state = 'play'; ended = false; g.clearTime = null; g.timeLeft = 30;
  g.score = 0;
  assert.equal(g._checkTarget(), false, 'Thirty seconds alone is not a clear');
  g.score = Game.STAGES[0].targetScore;
  assert.equal(g._checkTarget(), true);
  assert.equal(g.clearTime, 30);
  Storage.setClearTime(1, 18);
  Storage.setClearTime(1, 12, true);
  assert.equal(Storage.getClearTime(1), 18);
  assert.equal(Storage.getClearTime(1, true), 12);
  console.log('PASS: independent storage fallbacks, write order, real-time clocks, pause exclusion, input reset, timeout.');
})().catch(error => { console.error(error); process.exitCode=1; });
