// Cosmii fever (dash / mash / clone) in a real browser (start `npm run serve` first).
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
      localStorage.setItem('mogu.clearedStages', '[1,2,3]');
      localStorage.setItem('mogu.unlockedStage', '4');
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__game);
    const r = await page.evaluate(() => {
      const g = window.__game, out = {};
      const begin = () => {
        g.startGame(3, []); g.bug = null; g.player.setBug(null);
        g.stageIntroTimer = 0; g._updateStageIntro(0.01);
        if (g.state === 'roulette') { g.skipRoulette(); g.skipRoulette(); }
        g.getStage(3).targetScore = 1e12;
        g._getMoveInput = Game.prototype._getMoveInput.bind(g);
      };
      const run = (sec) => { for (let i = 0; i < sec * 60 && g.state === 'play'; i++) g._updatePlay(1 / 60, 1 / 60); };
      const food = () => g.spawner.pool.find(o => o.active && o.state === 'idle' && !o.hazard && !o.gimmick && o.type.req <= g.player.eatScale);
      const fill = () => { for (let i = 0; i < 60 && g.power.state === 'charge'; i++) { g.comboCount = 8; g._consume(food()); } };

      begin();
      // 虹色アイテム(コスミーボーナス)は出てこない
      let tokens = 0; run(3);
      g.spawner.forEachActive(o => { if (o.rainbowCharge || o.type.id === 'rainbowToken') tokens++; });
      out.noTokens = tokens === 0 && !g.cosmiiAbility.enabled;
      // ゲージ:食べると溜まり、満タンで3つのアイコン、時間がゆっくり
      g.power.gauge = 0; g.comboCount = 1; g._consume(food());
      out.charged = g.power.gauge > 0;
      fill();
      out.choose = g.power.state;
      out.choiceVisible = !document.getElementById('fever-choice').classList.contains('hidden');
      const t0 = g.timeLeft; g._updatePlay(0.1, 0.1); out.slowed = (t0 - g.timeLeft) < 0.05;
      out.noAutoVacuum = !g.player.vacuumActive;

      // ダッシュ:タップで選び、はじくと突進して物を食べる(3回まで)
      document.querySelector('.fc-dash').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      out.dashState = g.power.state;
      const x0 = g.player.x, eaten0 = g.suckedCount;
      out.flick = g.power.flick(1, 0);
      run(0.5);
      out.dashMoved = g.player.x - x0;
      g.power.flick(-1, 0); run(0.5); g.power.flick(0, 1); run(0.5);
      out.extraFlick = g.power.flick(1, 0);
      out.afterDash = g.power.state;
      out.dashAte = g.suckedCount - eaten0;
      out.missionCount = g.vacuumCount;

      // 連打:叩くほどふくらみ、弾けて吸い込む
      fill(); g.power.pick('mash');
      out.mashLayer = !document.getElementById('mash-layer').classList.contains('hidden');
      const px = g.player.x;
      for (let i = 0; i < 20; i++) { document.getElementById('mash-layer').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); run(0.05); }
      out.puffed = g.player.powerMul > 1.5;
      out.stayed = Math.abs(g.player.x - px) < 1;
      run(2.5);
      out.popBoost = g.player.mouthBoost;
      run(1);
      out.afterMash = g.power.state;
      out.restored = g.player.powerMul === 1 && g.player.mouthBoost === 1;

      // 分身:本体より小さい1体が勝手に食べる。危険物は食べずに押しのける
      fill(); g.power.pick('clone');
      out.clones = g.power.clones.length;
      out.small = g.power.clones[0].bodyR < g.player.bodyR * 0.8;
      g._getMoveInput = () => ({ active: true, dx: Math.cos(g.time * 0.7), dy: Math.sin(g.time * 0.5), ratio: 0.6 });
      const e1 = g.suckedCount; run(3);
      g._getMoveInput = Game.prototype._getMoveInput.bind(g);
      out.cloneAte = g.suckedCount - e1;
      g._render();
      const c = g.power.clones[0];
      const hz = g.spawner.pool.find(o => o.active && o.hazard);
      if (hz) { hz.x = c.getMouth().x; hz.y = c.getMouth().y; }
      const stun0 = g.stunTimer;
      run(0.1);
      out.avoided = !hz || (hz.active && g.stunTimer <= stun0 && c.stun <= 0);
      run(5);
      out.afterClone = g.power.state;
      out.clonesGone = g.power.clones.length === 0 && g.player.powerMul === 1;

      // クリア(食べ放題)が始まったらフィーバーは止まる
      fill(); g.power.pick('clone');
      g.getStage(3).targetScore = 1; g.score = 10; g._checkTarget();
      out.cancelledByClear = g.power.state === 'charge' && g.power.clones.length === 0;
      return out;
    });
    assert.equal(r.noTokens, true, 'rainbow tokens removed');
    assert.equal(r.charged, true);
    assert.equal(r.choose, 'choose');
    assert.equal(r.choiceVisible, true);
    assert.equal(r.slowed, false, 'no slow-motion while choosing');
    assert.equal(r.noAutoVacuum, true);
    assert.equal(r.dashState, 'dash');
    assert.equal(r.flick, true);
    assert.ok(r.dashMoved > 150, `dash moved ${r.dashMoved}`);
    assert.equal(r.extraFlick, false, 'only 3 dashes');
    assert.equal(r.afterDash, 'charge');
    assert.ok(r.missionCount >= 1);
    assert.equal(r.mashLayer, true);
    assert.equal(r.puffed, true);
    assert.equal(r.stayed, true);
    assert.ok(r.popBoost > 2, `pop boost ${r.popBoost}`);
    assert.equal(r.afterMash, 'charge');
    assert.equal(r.restored, true);
    assert.equal(r.clones, 1);
    assert.equal(r.small, true);
    assert.ok(r.cloneAte > 0, `clones ate ${r.cloneAte}`);
    assert.equal(r.avoided, true, 'clone does not eat hazards');
    assert.equal(r.afterClone, 'charge');
    assert.equal(r.clonesGone, true);
    assert.equal(r.cancelledByClear, true);
    assert.deepEqual(errors, []);
    console.log('PASS: cosmii fever gauge + chooser (no slow-mo), dash x3, mash puff/pop, clone eats + avoids hazards, cancel on clear, rainbow removed.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
