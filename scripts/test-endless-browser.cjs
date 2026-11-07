// Endless mode in a real browser (start `npm run serve` first).
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
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__game);
    const r = await page.evaluate(() => {
      const g = window.__game, out = {};
      // 解放前は始まらない
      out.lockedClass = document.getElementById('btn-endless').classList.contains('locked');
      g.startEndless();
      out.lockedState = g.state;
      Storage.markStageCleared(3);
      g.showTitle();
      out.unlockedClass = document.getElementById('btn-endless').classList.contains('locked');

      // しきい値は増え続ける
      out.thresholds = [1, 2, 3, 10, 11, 20].map(Endless.threshold);
      out.areaFor = [0, Endless.threshold(1), Endless.threshold(3) + 1].map(Endless.areaFor);

      const begin = () => {
        g.startGame(1, [], { endless: true }); g.stageIntroTimer = 0; g._updateStageIntro(0.01);
        if (g.state === 'roulette') { g.skipRoulette(); g.skipRoulette(); }
      };
      begin();
      out.state = g.state;
      out.time = g.timeLeft;
      out.boosts = g.activeBoosts.size;
      out.stageId = g.currentStageId;
      out.intro = document.getElementById('stage-intro-number').textContent;

      // 食べると時間が増える(上限あり)
      g.timeLeft = 10;
      const food = g.spawner.pool.find(o => o.active && o.state === 'idle' && !o.hazard && !o.gimmick);
      g._consume(food);
      out.gained = g.timeLeft > 10;
      g.timeLeft = Endless.MAX_TIME;
      g._consume(g.spawner.pool.find(o => o.active && o.state === 'idle' && !o.hazard && !o.gimmick));
      out.capped = g.timeLeft <= Endless.MAX_TIME;

      // スコアが区切りを越えるとエリアが進み、街と仕掛けが入れ替わる
      const theme1 = g.getStage('endless').theme;
      g.score = Endless.threshold(2) + 1;
      g.timeLeft = 5;
      g._checkTarget();
      out.area = g.endlessRun.area;
      out.theme = g.getStage('endless').theme !== theme1;
      out.bonus = g.timeLeft > 5;
      out.stillPlaying = g.state === 'play';
      out.gimmick = !!g.gimmick;
      // 新しい危険物はプレイヤーのすぐ横に置かない
      let near = 0;
      g.spawner.forEachActive(o => { if (o.hazard && Math.hypot(o.x - g.player.x, o.y - g.player.y) < 300) near++; });
      out.hazardNear = near;
      g._updatePlay(1 / 60, 1 / 60);
      out.hud = document.getElementById('hud-target').textContent;
      for (let i = 0; i < 300; i++) g._updatePlay(1 / 60, 1 / 60);
      g._render();
      // 時間切れで終わり、ベストとコインが記録される
      const coins = Storage.getCoins();
      // (コスミーの特技が動いている間は、終わるまで待ってから終了する)
      for (let i = 0; i < 60 * 30 && g.state === 'play'; i++) { g.timeLeft = 0; g._updatePlay(1 / 60, 1 / 60); }
      out.endState = g.state;
      out.best = Endless.best();
      out.coins = Storage.getCoins() - coins;
      out.resultEndless = document.getElementById('screen-result').classList.contains('is-endless');
      out.story = document.getElementById('res-area').textContent;
      out.rankingHidden = document.getElementById('btn-ranking').classList.contains('hidden');
      // ふつうのステージに戻るとエンドレスの表示は消える
      g.startGame(2, []);
      out.normalStage = g.currentStageId;
      out.normalEndless = !!g.endlessRun;
      g.stageIntroTimer = 0; g._updateStageIntro(0.01);
      if (g.state === 'roulette') { g.skipRoulette(); g.skipRoulette(); }
      g.timeLeft = 0; g._updatePlay(1 / 60, 1 / 60);
      out.normalResult = document.getElementById('screen-result').classList.contains('is-endless');
      return out;
    });

    assert.equal(r.lockedClass, true);
    assert.notEqual(r.lockedState, 'intro');
    assert.equal(r.unlockedClass, false);
    for (let i = 1; i < r.thresholds.length; i++) assert.ok(r.thresholds[i] > r.thresholds[i - 1]);
    assert.deepEqual(r.areaFor, [1, 2, 4]);
    assert.equal(r.state, 'play');
    assert.equal(r.time, 30);
    assert.equal(r.boosts, 0);
    assert.equal(r.stageId, 'endless');
    assert.equal(r.intro, 'ENDLESS');
    assert.equal(r.gained, true);
    assert.equal(r.capped, true);
    assert.equal(r.area, 3);
    assert.equal(r.theme, true);
    assert.equal(r.bonus, true);
    assert.equal(r.stillPlaying, true);
    assert.equal(r.gimmick, true);
    assert.match(r.hud, /^AREA 3/);
    assert.equal(r.hazardNear, 0);
    assert.equal(r.endState, 'result');
    assert.ok(r.best.score > 0 && r.best.area >= 3, JSON.stringify(r.best));
    assert.ok(r.coins > 0);
    assert.equal(r.resultEndless, true);
    assert.match(r.story, /AREA \d+/);
    assert.equal(r.rankingHidden, true, 'no Game Center in the browser');
    assert.equal(r.normalStage, 2);
    assert.equal(r.normalEndless, false);
    assert.equal(r.normalResult, false);
    assert.deepEqual(errors, []);
    console.log('PASS: endless lock/unlock, areas + thresholds, time gain/cap, area switch, result + best + coins, back to stages.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
