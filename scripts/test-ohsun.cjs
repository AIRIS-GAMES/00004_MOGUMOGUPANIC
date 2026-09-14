const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
// A disabled build for baseline tests, isolated from the real distribution.
const configPath = require.resolve('../collaborations/ohsun.config.js');
const originalConfig = require(configPath);
const originalArgs = [...process.argv];
let normalBuild;
try {
  require.cache[configPath].exports = { ...originalConfig, enabled: false };
  process.argv.push('--test-build');
  normalBuild = require('./build-web.js').out;
} finally {
  require.cache[configPath].exports = originalConfig;
  process.argv = originalArgs;
}
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mogu-sun-bonus-'));
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const servingRoot = pathname.startsWith('/www/') ? normalBuild : root;
  const relativePath = pathname.startsWith('/www/') ? pathname.slice(4) : pathname;
  const file = path.resolve(servingRoot, '.' + relativePath + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(servingRoot + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    const base = `http://127.0.0.1:${server.address().port}`;
    const run = async (url) => {
      await page.goto(url);
      await page.waitForFunction(() => window.__game?.state === 'title');
      await page.evaluate(() => __game.ui.closeLoginBonus());
      if (url.includes('ohsun-preview=1')) {
        assert.equal(await page.locator('.sun-collab-banner').isVisible(), true);
        await page.locator('.sun-collab-banner').click();
        assert.equal(await page.locator('.sun-rules').isVisible(), true);
        await page.locator('.sun-rules button').click();
        assert.equal(await page.locator('.sun-rules').isVisible(), false);
      }
      await page.locator('#btn-start').click();
      await page.locator('#btn-boost-start').click();
      await page.waitForFunction(() => __game.state === 'play');
      // Event lifecycle tests use a high target so early clear cannot interrupt them.
      await page.evaluate(() => { __game.currentStageId = 10; });
    };
    const collect = async (number) => page.evaluate(n => {
      for (let i = 0; i < n; i++) {
        __game.collaboration.spawnSun();
        const obj = __game.spawner.eventPool.find(o => o.active && o.type.id === 'sunToken');
        if (!obj) throw Error('No SUN STAR');
        __game._consume(obj);
      }
    }, number);
    await run(base + '/?ohsun-preview=1');
    const blurred = await page.evaluate(() => {
      __game.keys.add('arrowright');
      window.dispatchEvent(new Event('blur'));
      return { state: __game.state, keys: __game.keys.size, input: __game.input.active };
    });
    assert.deepEqual(blurred, { state: 'play', keys: 0, input: false }, 'Transient focus loss clears controls without pausing');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.evaluate(() => __game.state), 'pause', 'Hidden page must still auto-pause');
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.evaluate(() => __game.state), 'pause', 'Return does not resume without user action');
    await page.locator('#btn-resume').click();
    assert.equal(await page.locator('#btn-ohsun').count(), 0);
    assert.equal(await page.locator('.ohsun-status').count(), 0);
    assert.equal(await page.evaluate(() => __game.currentStageId), 10);
    const baseline = await page.evaluate(() => ({ speed: __game.player.moveSpeed, time: __game.timeLeft }));
    const rareCheck = await page.evaluate(() => {
      const g = __game, e = g.collaboration;
      g._consume(g.spawner.pool.find(o => o.active && o.type.id === 'coin'));
      const coinCharge = e.count;
      for (let i = 0; i < 10; i++) e.spawnSun();
      return { coinCharge, liveSuns: g.spawner.eventPool.filter(o => o.active && o.sunCharge).length };
    });
    assert.deepEqual(rareCheck, { coinCharge: 0, liveSuns: 2 });
    const recycled = await page.evaluate(() => {
      const g = __game, e = g.collaboration;
      const suns = g.spawner.eventPool.filter(o => o.sunCharge && o.active);
      suns.forEach(o => { o.x = 50; o.y = 50; });
      e.sunSpawnTimer = .01;
      e.update(.02);
      const view = g.camera.viewBounds(g.w, g.h, 0);
      const visible = o => o.x >= view.l && o.x <= view.r && o.y >= view.t && o.y <= view.b;
      const first = suns.filter(visible).length;
      e.update(4);
      return { first, second: suns.filter(visible).length, total: suns.filter(o => o.active).length,
        separated: Math.hypot(suns[0].x - suns[1].x, suns[0].y - suns[1].y) * g.camera.zoom > 70 };
    });
    assert.deepEqual(recycled, { first: 1, second: 2, total: 2, separated: true });
    await collect(4);
    assert.equal(await page.evaluate(() => __game.collaboration.state), 'normal');
    assert.equal(await page.evaluate(() => __game.collaboration.count), 4);
    await page.screenshot({ path: path.join(output, 'normal-mobile.png') });
    await collect(1);
    assert.equal(await page.evaluate(() => __game.state), 'play');
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusActive');
    await page.locator('.sun-guest img').evaluate(img => img.decode());
    const active = await page.evaluate(() => {
      const g = __game, e = g.collaboration, p = g.player;
      const range = p.mouthRadius;
      p.sunRangeMul = 1;
      const normalRange = p.mouthRadius;
      p.sunRangeMul = 1.5;
      const normalCount = g.spawner.pool.length;
      const obj = g.spawner.eventPool.find(o => o.active && o.type.id === 'coin');
      g.comboCount = 0;
      const before = g.score;
      p.vacuumActive = false;
      p.vacuumGauge = .25;
      const beforeSize = p.scale;
      g._consume(obj);
      const unchanged = p.scale === beforeSize && p.vacuumGauge === .25;
      const normalObj = g.spawner.pool.find(o => o.active && o.type.id === 'coin');
      const bonusScore = g.score - before;
      g._consume(normalObj);
      const normalScore = g.score - before - bonusScore;
      const normalStillGrows = p.scale > beforeSize && p.vacuumGauge > .25;
      return { unchanged, normalStillGrows, normalScore, ratio: range / normalRange, scoreDelta: bonusScore, normalCount,
        bonusCount: g.spawner.eventPool.filter(o => !o.sunCharge).length, count: e.count,
        noGuestObject: [...g.spawner.pool, ...g.spawner.eventPool].every(o => !o.type.id.includes('ohsun')) };
    });
    assert.equal(active.ratio, 1.5);
    assert.equal(active.unchanged, true);
    assert.equal(active.normalStillGrows, true);
    assert.equal(active.scoreDelta, 15);
    assert.equal(active.normalScore, 60);
    assert.equal(active.normalCount, 300);
    assert.equal(active.bonusCount, 40);
    assert.equal(active.count, 5);
    assert.equal(active.noGuestObject, true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, 'bonus-mobile.png') });
    await page.locator('#btn-pause').click();
    const paused = await page.evaluate(() => [__game.timeLeft, __game.collaboration.remaining]);
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => [__game.timeLeft, __game.collaboration.remaining]), paused);
    await page.locator('#btn-resume').click();
    await page.evaluate(() => {
      const e = __game.collaboration;
      e.onConsume({ type: e.sunType, sunCharge: true, x: 0, y: 0 });
      e.remaining = .01;
    });
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusEnding');
    assert.equal(await page.evaluate(() => __game.player.sunRangeMul), 1);
    assert.equal(await page.evaluate(() => __game.collaboration.scoreMultiplier), 1);
    await page.waitForFunction(() => __game.collaboration.state === 'normal');
    assert.equal(await page.evaluate(() => __game.collaboration.count), 1, 'Rare sun collected during bonus carries over');
    assert.equal(await page.evaluate(() => __game.collaboration.requiredStars), 5);
    assert.equal(await page.evaluate(() => {
      const g = __game;
      g.collaboration.emitItems(1);
      const obj = g.spawner.eventPool.find(o => o.active && o.scoreOnly);
      const beforeSize = g.player.scale, beforeGauge = g.player.vacuumGauge;
      g.comboCount = 0;
      const beforeScore = g.score;
      g._consume(obj);
      return g.player.scale === beforeSize && g.player.vacuumGauge === beforeGauge &&
        g.score - beforeScore === Math.floor(obj.type.score * .5 * g.scoreMultiplier);
    }), true, 'Leftover bonus items remain score-only');
    const leftoverCount = await page.evaluate(() => {
      const e = __game.collaboration;
      e.onConsume({ type: { id: 'coin' }, eventOnly: true, x: 0, y: 0 });
      return e.count;
    });
    assert.equal(leftoverCount, 1, 'Bonus stars cannot recharge SUN after bonus ends');
    assert.equal(await page.evaluate(() => __game.timeLeft < 60), true);
    await collect(4);
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusActive');
    const normalBest = await page.evaluate(() => Storage.getStageBest(__game.currentStageId));
    await page.evaluate(() => __game.endGame());
    assert.equal(await page.evaluate(() => Storage.getStageBest(__game.currentStageId)), normalBest);
    assert.equal(await page.evaluate(() => Storage.getStageBest(__game.currentStageId, true)), await page.evaluate(() => __game.score));
    assert.equal(await page.locator('#res-best').evaluate(el => el.previousElementSibling.textContent), 'SUN BEST');
    assert.equal(await page.evaluate(() => __game.collaboration.enabled), false);
    assert.equal(await page.evaluate(() => __game.spawner.eventPool.length), 0);
    assert.equal(await page.locator('.sun-guest').isVisible(), false);

    await page.setViewportSize({ width: 667, height: 375 });
    await run(base + '/?ohsun-preview=1');
    await collect(5);
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusActive');
    await page.locator('.sun-guest img').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(output, 'bonus-landscape.png') });
    const bounds = await page.locator('.sun-guest').boundingBox();
    assert.ok(bounds.y > 110 && bounds.x + bounds.width <= 667 && bounds.y + bounds.height < 375);

    await page.route('**/ohsun_09.png', route => route.abort());
    await run(base + '/?ohsun-preview=1');
    await collect(5);
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusActive');
    assert.equal(await page.locator('.sun-guest').isVisible(), false, 'Failed image is hidden');
    assert.equal(await page.evaluate(() => __game.collaboration.scoreMultiplier), 2);
    assert.equal(await page.evaluate(() => __game.state), 'play');
    await page.unroute('**/ohsun_09.png');

    // Production expiry cancels only the event and keeps normal gameplay running.
    const now = Date.now();
    await page.route('**/collaborations/ohsun.config.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.OHSUN_COLLAB_CONFIG={enabled:true,startsAt:'${new Date(now - 1000).toISOString()}',endsAt:'${new Date(now + 60000).toISOString()}'};` }));
    await run(base);
    await collect(5);
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusActive');
    await page.evaluate(future => { Date.now = () => future; __game.collaboration.tick(); }, now + 60000);
    assert.equal(await page.evaluate(() => __game.state), 'play');
    assert.equal(await page.evaluate(() => __game.player.sunRangeMul), 1);
    assert.equal(await page.locator('.sun-guest img[src]').count(), 0);
    await page.unroute('**/collaborations/ohsun.config.js');
    await run(base);
    assert.equal(await page.locator('.sun-hud').isVisible(), false);
    assert.equal(await page.locator('.sun-collab-banner').isVisible(), false);
    await run(base + '/www/');
    assert.equal(await page.locator('.sun-hud').count(), 0);
    assert.equal(await page.evaluate(() => __game.player.moveSpeed), baseline.speed);
    // Immediate target clear, timing records and idempotent rewards.
    await page.evaluate(() => {
      const g = __game;
      g.currentStageId = 1;
      g.timeLeft = g.runTimeLimit - 12.5;
      g.comboCount = 0;
      const coin = g.spawner.pool.find(o => o.active && o.type.id === 'coin');
      g.score = Game.STAGES[0].targetScore - coin.type.score;
      g._consume(coin);
    });
    assert.equal(await page.evaluate(() => __game.state), 'result');
    assert.equal(await page.locator('#res-clear-time').textContent(), '12.50s');
    assert.equal(await page.evaluate(() => Storage.getClearTime(1)), 12.5);
    const coins = await page.evaluate(() => Storage.getCoins());
    await page.evaluate(() => __game.endGame());
    assert.equal(await page.evaluate(() => Storage.getCoins()), coins);

    await run(base + '/?ohsun-preview=1');
    await collect(5);
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusActive');
    await page.evaluate(() => {
      const g = __game;
      g.currentStageId = 1;
      g.timeLeft = g.runTimeLimit - 10;
      g.score = Game.STAGES[0].targetScore;
      g._checkTarget();
    });
    assert.equal(await page.evaluate(() => __game.state), 'play');
    assert.equal(await page.evaluate(() => __game.clearTime), 10);
    await page.evaluate(() => { __game.collaboration.remaining = .01; });
    await page.waitForFunction(() => __game.state === 'result');
    assert.equal(await page.locator('#res-clear-time').textContent(), '10.00s');
    await page.screenshot({ path: path.join(output, 'clear-result-landscape.png') });
    assert.equal(await page.evaluate(() => Storage.getClearTime(1, true)), 10);
    assert.equal(await page.evaluate(() => Storage.getClearTime(1)), 12.5);

    // Timeout takes precedence even when a confirmed clear is waiting on SUN BONUS.
    await run(base + '/?ohsun-preview=1');
    await collect(5);
    await page.waitForFunction(() => __game.collaboration.state === 'sunBonusActive');
    await page.evaluate(() => {
      const g = __game;
      g.currentStageId = 1;
      g.score = Game.STAGES[0].targetScore;
      g._checkTarget();
      g.timeLeft = .01;
      g._updatePlay(.02);
    });
    assert.equal(await page.locator('#res-title').textContent(), 'STAGE CLEAR!');
    await run(base);
    await page.evaluate(() => { __game.score = 0; __game.timeLeft = .01; __game._updatePlay(.02); });
    assert.equal(await page.locator('#res-title').textContent(), 'TRY AGAIN');
    assert.equal(await page.locator('#res-clear-time').textContent(), '—');
    assert.deepEqual(errors, []);
    console.log('PASS: SUN lifecycle, scoring, pause, expiry, image failure, target clear, bonus grace, timeout, clear-time records and reward idempotency.');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
