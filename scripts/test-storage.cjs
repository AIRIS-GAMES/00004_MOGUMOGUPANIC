const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/Storage.js'), 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
function setup(local, preferences) {
  const ctx = vm.createContext({ setTimeout, clearTimeout, window: { Capacitor: {
    isPluginAvailable: () => !!preferences, Plugins: { Preferences: preferences },
  } }, localStorage: { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, v) } });
  vm.runInContext(source, ctx);
  const storage = vm.runInContext('Storage', ctx);
  storage.IO_TIMEOUT = 20;
  return storage;
}
function native(disk) {
  return { get: async ({ key }) => ({ value: disk.get(key) ?? null }),
    set: async ({ key, value }) => disk.set(key, value) };
}
function value(disk, key = 'mogu.coins') {
  const record = JSON.parse(disk.get(key));
  return record?.__moguSave === 1 ? JSON.parse(record.raw) : record;
}
(async () => {
  const local = new Map([['mogu.coins', '100']]);
  const disk = new Map([['mogu.coins', '1000']]);
  const prefs = native(disk);
  const originalGet = prefs.get;
  prefs.get = async args => { if (args.key === 'mogu.coins') throw Error('read failed'); return originalGet(args); };
  await assert.rejects(setup(local, prefs).init(), /read failed/);
  assert.equal(value(disk), 1000);
  assert.equal(value(local), 100, 'Failed initialization does not modify either store');

  prefs.get = originalGet;
  const s = setup(local, prefs);
  await s.init();
  assert.equal(s.getCoins(), 1000, 'Native legacy save wins over stale legacy local data');
  assert.equal(value(local), 1000, 'Successful reads refresh the local mirror');
  prefs.set = async () => { throw Error('write failed'); };
  s.setCoins(1500); await s.flush();
  assert.equal(value(local), 1500);
  prefs.set = native(disk).set;
  const restarted = setup(local, prefs);
  await restarted.init(); await restarted.flush();
  assert.equal(restarted.getCoins(), 1500);
  assert.equal(value(disk), 1500, 'Newer local revision repairs failed native writes after restart');

  let finishOld;
  let first = true;
  prefs.set = ({ key, value: raw }) => {
    if (first) { first = false; return new Promise(resolve => { finishOld = () => { disk.set(key, raw); resolve(); }; }); }
    disk.set(key, raw); return Promise.resolve();
  };
  restarted.setCoins(2000); await turn();
  restarted.setCoins(2100); restarted.setUnlockedStage(3);
  await restarted.flush();
  assert.equal(value(disk), 2100);
  assert.equal(value(disk, 'mogu.unlockedStage'), 3, 'Timed-out writes do not block later saves');
  finishOld(); await turn(); await restarted.flush();
  assert.equal(value(disk), 2100, 'A late old completion is repaired');

  prefs.set = async () => { throw Error('offline'); };
  restarted.setCoins(2200); await restarted.flush();
  prefs.set = native(disk).set;
  await restarted.flush();
  assert.equal(value(disk), 2200, 'Foreground flush retries dirty values');

  const browserOnly = setup(new Map([['mogu.coins', '300']]), null);
  await browserOnly.init(); assert.equal(browserOnly.getCoins(), 300);
  browserOnly.setCoins(400); assert.equal(browserOnly.getCoins(), 400);
  const noLocal = setup({ get() { throw Error('blocked'); }, set() { throw Error('blocked'); } }, native(disk));
  await noLocal.init(); noLocal.setCoins(2300); await noLocal.flush();
  assert.equal(value(disk), 2300, 'Native saves work without localStorage');
  await assert.rejects(setup(new Map(), { get: () => new Promise(() => {}) }).init(), /タイムアウト/);
  console.log('PASS: legacy migration, read failure protection, revision recovery, timeout isolation, late writes, retry, storage availability.');
})().catch(error => { console.error(error); process.exitCode = 1; });
