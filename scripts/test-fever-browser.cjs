// Post-clear "eat everything" fever in a real browser (start `npm run serve` first).
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:8080/';

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('airisPrivacyConsent', 'declined');
      localStorage.setItem('mogu.tutorialDone', 'true');
      localStorage.setItem('mogu.clearedStages', '[1,2]');
      localStorage.setItem('mogu.unlockedStage', '3');
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__game);
    const r = await page.evaluate(() => {
      const g = window.__game, out = {};
      g.startGame(3, []); g.bug = null; g.player.setBug(null);
      g.stageIntroTimer = 0; g._updateStageIntro(0.01);
      if (g.state === 'roulette') { g.skipRoulette(); g.skipRoulette(); }
      g._getMoveInput = () => ({ active: false, dx: 0, dy: 0, ratio: 0 });
      for (let i = 0; i < 60; i++) g._updatePlay(1 / 60, 1 / 60);
      const coins0 = Storage.getCoins();
      g.score = g.getStage(3).targetScore;
      g._checkTarget();
      out.feverOn = !!g.fever;
      out.state = g.state;
      out.clearTime = g.clearTime;
      // まず「STAGE CLEAR!」とスロー、そのあと食べ放題の表示
      out.clearBanner = !document.getElementById('clear-banner').classList.contains('hidden');
      out.feverHudLater = document.getElementById('fever').classList.contains('hidden');
      out.slow = g.clearHold > 0;
      const t0 = g.timeLeft;
      for (let i = 0; i < 60; i++) g._updatePlay(1 / 60, 1 / 60);
      out.banner = !document.getElementById('fever').classList.contains('hidden');
      out.timeFrozen = g.timeLeft === t0;
      out.big = g.player.feverMul > 1.5;
      // 何でも食べられる:大きな家や塔も、危険物も
      const huge = { type: OBJECT_TYPES.find(t => t.id === 'tower'), noSuck: 0 };
      out.eatHuge = g.canEat(huge);
      out.stunIgnored = (g.stun(2), g.stunTimer === 0);
      const hz = g.spawner.pool.find(o => o.active && o.hazard) || null;
      if (hz) { const before = g.fever.coins; g._consume(hz); out.hazardHarmless = !g.rampage && g.stunTimer === 0 && g.fever.coins >= before; }
      else out.hazardHarmless = true;
      // 食べるとコインが増える(上限あり)
      const food = g.spawner.pool.find(o => o.active && o.state === 'idle' && !o.hazard);
      g._consume(food);
      out.coinsUp = g.fever.coins > 0;
      g.fever.coins = 9999; g._consume(g.spawner.pool.find(o => o.active && o.state === 'idle' && !o.hazard));
      out.capped = g.fever.coins === Game.feverCoinCap(3);
      // 5秒で終わってリザルトへ
      // 食べ放題のあと「ごちそうさま」で一回転してからリザルトへ
      let outro = false, spun = 0;
      for (let i = 0; i < 60 * 9 && g.state === 'play'; i++) {
        g._updatePlay(1 / 60, 1 / 60);
        if (g.feverOutro) { outro = true; spun = Math.max(spun, g.player.spin); }
      }
      out.outro = outro; out.spun = spun > 6; out.spinVal = spun;
      out.flash = document.getElementById('white-flash').classList.contains('go');
      out.endState = g.state;
      out.feverOff = !g.fever && g.player.feverMul === 1;
      out.bannerHidden = document.getElementById('fever').classList.contains('hidden');
      out.hint = document.getElementById('res-star-hint').textContent;
      out.gotCoins = Storage.getCoins() - coins0;
      out.stars = document.querySelectorAll('#res-stars .on').length;
      return out;
    });
    assert.equal(r.feverOn, true);
    assert.equal(r.state, 'play');
    assert.ok(r.clearTime > 0, 'clear time is fixed at the moment of clearing');
    assert.equal(r.clearBanner, true);
    assert.equal(r.feverHudLater, true);
    assert.equal(r.slow, true);
    assert.equal(r.banner, true);
    assert.equal(r.outro, true);
    assert.equal(r.spun, true, `spin ${r.spinVal}`);
    assert.equal(r.flash, true);
    assert.equal(r.timeFrozen, true);
    assert.equal(r.big, true);
    assert.equal(r.eatHuge, true);
    assert.equal(r.stunIgnored, true);
    assert.equal(r.hazardHarmless, true);
    assert.equal(r.coinsUp, true);
    assert.equal(r.capped, true);
    assert.equal(r.endState, 'result');
    assert.equal(r.feverOff, true);
    assert.equal(r.bannerHidden, true);
    assert.ok(r.hint.includes('+'), `fever chip ${r.hint}`);
    assert.ok(r.gotCoins >= Game_cap(3), `coins ${r.gotCoins}`);
    assert.ok(r.stars >= 1);
    assert.deepEqual(errors, []);
    console.log('PASS: fever starts on clear, time frozen, eat anything, hazards harmless, coin cap, CLEAR banner + slow-mo, outro spin + flash, ends into result with FEVER bonus.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
function Game_cap(id) { return 20 + id * 8; }
