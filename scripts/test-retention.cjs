// Retention features: login streak, star rating/bonus, daily missions, comeback notifications.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function setup({ plugin = null, start = new Date(2026, 10, 7, 9, 0, 0) } = {}) {
  let nowMs = start.getTime();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(nowMs); }
    static now() { return nowMs; }
  }
  const local = new Map();
  const events = [];
  const window = plugin ? { Capacitor: { isPluginAvailable: name => name === 'LocalNotifications', Plugins: { LocalNotifications: plugin } } } : {};
  const ctx = vm.createContext({ console, Date: FakeDate, Math, JSON, setTimeout, clearTimeout, window,
    Analytics: { design: (id, v) => events.push([id, v]) },
    localStorage: { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, v) } });
  for (const file of ['Storage', 'Retention', 'Notifications']) {
    vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8'), ctx);
  }
  const get = name => vm.runInContext(name, ctx);
  return {
    Storage: get('Storage'), Retention: get('Retention'), Notifier: get('Notifier'), events, local,
    advanceDays(days, hour = 9) { const d = new RealDate(nowMs); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); nowMs = d.getTime(); },
    now: () => new RealDate(nowMs),
  };
}

(async () => {
  /* ---------- 連続ログインボーナス ---------- */
  {
    const t = setup();
    const R = t.Retention.STREAK_REWARDS;
    let claim = t.Storage.claimDailyBonus(R);
    assert.deepEqual({ ...claim }, { total: 100, day: 1, amount: 100 });
    assert.equal(t.Storage.claimDailyBonus(R), null, 'Only once per day');
    for (let day = 2; day <= 7; day++) {
      t.advanceDays(1);
      claim = t.Storage.claimDailyBonus(R);
      assert.equal(claim.day, day);
      assert.equal(claim.amount, R[day - 1]);
    }
    assert.equal(t.Storage.getCoins(), R.reduce((a, b) => a + b, 0));
    t.advanceDays(1);
    assert.equal(t.Storage.claimDailyBonus(R).day, 1, 'Cycle restarts after day 7');
    t.advanceDays(1);
    assert.equal(t.Storage.claimDailyBonus(R).day, 2);
    t.advanceDays(2);
    assert.equal(t.Storage.claimDailyBonus(R).day, 1, 'Missing a day resets the streak');
    // Late night then early morning on the next calendar day still counts as consecutive.
    t.advanceDays(0, 23); t.advanceDays(1, 1);
    assert.equal(t.Storage.claimDailyBonus(R).day, 2);
    // Legacy saves (no streak key, fixed amount) keep working.
    assert.equal(t.Storage.claimDailyBonus(100), null);
    t.advanceDays(1);
    assert.equal(t.Storage.claimDailyBonus(100).amount, 100);
  }
  {
    const t = setup();
    t.Storage.claimDailyBonus([100]);
    t.Storage.set(t.Storage.KEYS.lastSeenAt, t.now().getTime() + 72 * 3600e3);
    t.advanceDays(1);
    assert.equal(t.Storage.claimDailyBonus([100]), null, 'Clock rollback protection is kept');
  }

  /* ---------- ★評価と★ボーナス ---------- */
  {
    const t = setup();
    const stage = { id: 1, rewardCoins: 100, starTimes: [30, 15] };
    const { Retention, Storage } = t;
    assert.equal(Retention.starsFor(stage, false, 5), 0);
    assert.equal(Retention.starsFor(stage, true, 15), 3);
    assert.equal(Retention.starsFor(stage, true, 15.01), 2);
    assert.equal(Retention.starsFor(stage, true, 30), 2);
    assert.equal(Retention.starsFor(stage, true, 31), 1);
    assert.equal(Retention.starsFor(stage, true, null), 1, 'Old clears without a time are one star');
    assert.equal(Retention.awardStarBonus(stage, 1), 0, 'One star is the normal stage reward');
    assert.equal(Retention.awardStarBonus(stage, 2), 30);
    assert.equal(Retention.awardStarBonus(stage, 2), 0, 'Each star level pays once');
    assert.equal(Retention.awardStarBonus(stage, 3), 60);
    assert.equal(Retention.awardStarBonus(stage, 3), 0);
    const other = { id: 2, rewardCoins: 150, starTimes: [36, 18] };
    assert.equal(Retention.awardStarBonus(other, 3), 50 + 90, 'Jumping straight to three stars pays both levels');
    assert.equal(Storage.getCoins(), 30 + 60 + 140);
    Storage.markStageCleared(1); Storage.setClearTime(1, 14);
    Storage.markStageCleared(2);
    assert.equal(Retention.stageStars(stage), 3);
    assert.equal(Retention.stageStars(other), 1);
    assert.equal(Retention.totalStars([stage, other]), 4);
  }

  /* ---------- デイリーミッション ---------- */
  {
    const t = setup();
    const { Retention } = t;
    const ids = Retention.pickMissionIds('2026-11-07');
    assert.deepEqual(ids, Retention.pickMissionIds('2026-11-07'), 'Same day, same missions');
    assert.deepEqual([...ids].map(id => Retention.MISSIONS.find(m => m.id === id).tier), [0, 1, 2]);
    const seen = new Set();
    for (let d = 1; d <= 60; d++) seen.add(Retention.pickMissionIds(`2026-12-${d}`).join());
    assert.ok(seen.size > 10, 'Missions vary from day to day');

    // Force a known set for deterministic progress checks.
    const date = t.now();
    const state = Retention.missionState(date);
    state.ids = ['play3', 'combo15', 'eat300'];
    t.Storage.set(t.Storage.KEYS.missions, state);
    let done = Retention.recordRun({ plays: 1, eaten: 120, maxCombo: 9, clears: 1 }, date);
    assert.deepEqual([...done], []);
    done = Retention.recordRun({ plays: 1, eaten: 100, maxCombo: 16 }, date);
    assert.deepEqual([...done].map(m => m.id), ['combo15'], 'max-mode uses the best single run');
    assert.equal(Retention.claimMission('play3', date), 0, 'Unfinished mission cannot be claimed');
    done = Retention.recordRun({ plays: 1, eaten: 90, maxCombo: 3 }, date);
    assert.deepEqual([...done].map(m => m.id), ['play3', 'eat300']);
    assert.equal(Retention.claimableCount(date), 3);
    assert.equal(Retention.claimMission('play3', date), 80);
    assert.equal(Retention.claimMission('play3', date), 0, 'Claim once');
    assert.equal(Retention.claimMission('star3', date), 0, 'Not one of today\'s missions');
    assert.equal(Retention.claimableCount(date), 2);
    assert.equal(Retention.missions(date)[2].progress, 300, 'Progress is capped at the goal');
    t.advanceDays(1);
    const tomorrow = Retention.missions(t.now());
    assert.ok(tomorrow.every(m => m.progress === 0 && !m.claimed), 'New day resets missions');
    // Corrupt saves are replaced instead of crashing.
    t.Storage.set(t.Storage.KEYS.missions, { date: 'x', ids: 'bad' });
    assert.equal(Retention.missions(t.now()).length, 3);
  }

  /* ---------- チュートリアル ---------- */
  {
    const t = setup();
    assert.equal(t.Retention.tutorialDone(), false);
    t.Retention.markTutorialDone();
    assert.equal(t.Retention.tutorialDone(), true);
  }

  /* ---------- カムバック通知 ---------- */
  {
    const t = setup();
    assert.equal(t.Notifier.supported, false);
    assert.equal(t.Notifier.shouldOffer(1, true), false, 'Web build never offers notifications');
    assert.equal(await t.Notifier.reschedule({}), false);
  }
  {
    const calls = [];
    let permission = 'prompt';
    const plugin = {
      cancel: async o => calls.push(['cancel', o]),
      checkPermissions: async () => ({ display: permission }),
      requestPermissions: async () => { permission = 'granted'; return { display: 'granted' }; },
      schedule: async o => calls.push(['schedule', o]),
    };
    const t = setup({ plugin, start: new Date(2026, 10, 7, 23, 30, 0) });
    const { Notifier } = t;
    assert.equal(Notifier.shouldOffer(2, true), false, 'Only offered on stage 1 or 3');
    assert.equal(Notifier.shouldOffer(1, false), false, 'Only right after a first clear');
    assert.equal(Notifier.shouldOffer(1, true), true);
    Notifier.decline();
    assert.equal(Notifier.shouldOffer(1, true), false);
    assert.equal(Notifier.shouldOffer(3, true), true, 'One more chance after stage 3');
    assert.equal(await Notifier.reschedule({}), false, 'No scheduling without permission');
    assert.deepEqual(calls.map(c => c[0]), ['cancel']);
    calls.length = 0;
    assert.equal(await Notifier.accept({ nextStage: { id: 4, name: 'ショッピングパニック' } }), true);
    assert.equal(Notifier.shouldOffer(3, true), false, 'Never asked twice once the OS dialog was shown');
    assert.deepEqual(calls.map(c => c[0]), ['cancel', 'schedule']);
    const list = calls[1][1].notifications;
    assert.deepEqual([...list].map(n => n.id), [3101, 3102]);
    const fmt = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    assert.equal(fmt(list[0].schedule.at), '2026-11-10 22:00', '3 days later at 22:00 local');
    assert.equal(fmt(list[1].schedule.at), '2026-11-14 22:00', '7 days later at 22:00 local');
    assert.match(list[0].body, /STAGE 4「ショッピングパニック」/);
    assert.match(Notifier.messages({ nextStage: null })[0].body, /★3/);
    assert.ok(t.events.some(e => e[0] === 'notify:permission:granted'));
    // Month boundary.
    assert.equal(fmt(Notifier.fireDate(7, new Date(2026, 11, 28, 8))), '2027-1-4 22:00');
    // Plugin failures never throw into the game.
    plugin.schedule = async () => { throw Error('native failure'); };
    const warn = console.warn; console.warn = () => {};
    assert.equal(await Notifier.reschedule({}), false);
    console.warn = warn;
  }
  console.log('PASS: login streak, star rating/bonus, daily missions, tutorial flag, comeback notifications.');
})().catch(error => { console.error(error); process.exitCode = 1; });
