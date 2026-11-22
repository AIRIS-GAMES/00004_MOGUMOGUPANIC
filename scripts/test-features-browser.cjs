// Error zukan, UFO catcher, wind and bubbles in a real browser (start `npm run serve` first).
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
      localStorage.setItem('mogu.clearedStages', '[1,2,3,4,5,6,7,8,9]');
      localStorage.setItem('mogu.unlockedStage', '10');
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__game);
    const r = await page.evaluate(() => {
      const g = window.__game, out = {};
      const type = id => OBJECT_TYPES.find(t => t.id === id);

      // --- Zukan ---
      out.first = Zukan.record(type('flower'));
      out.again = Zukan.record(type('flower'));
      out.rare = Zukan.record(type('flower'), true);
      out.notListed = Zukan.record({ id: 'nope' });
      for (const id of ['coin', 'trash', 'bench', 'tree']) Zukan.record(type(id));
      out.claimable = Zukan.claimableCount();
      const c0 = Storage.getCoins();
      out.claimNormal = Zukan.claim('machi', 'normal');
      out.coinsGained = Storage.getCoins() - c0;
      out.claimTwice = Zukan.claim('machi', 'normal');
      out.claimRareEarly = Zukan.claim('machi', 'rare');
      for (const id of ['coin', 'trash', 'bench', 'tree']) Zukan.record(type(id), true);
      out.claimRare = Zukan.claim('machi', 'rare');
      out.hasCrown = Accessories.has('goldcrown');
      out.specialHasRare = Zukan.pageStatus(Zukan.PAGES[3]).rareTotal;

      // --- UFO catcher ---
      Storage.setCoins(1000);
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 720;
      const wins = [];
      const ufo = new UfoCatcher(cv, { onWin: p => wins.push(p.id) });
      out.prizeCount = ufo.prizes.length;
      out.prizeIdsUfo = ufo.prizes.every(p => Accessories.LIST.find(a => a.id === p.id).source === 'ufo');
      // Aim exactly at a prize and force success.
      const realRand = Math.random;
      Math.random = () => 0.5; // grabs (needs < .75) but does not slip (needs < .3)
      const target = ufo.prizes[0];
      out.pressed = ufo.press();
      out.coinsAfterPress = Storage.getCoins();
      out.pressWhileBusy = ufo.press();
      for (let i = 0; i < 600 && ufo.claw.x < target.x; i++) ufo.update(1 / 60);
      ufo.claw.x = target.x;
      ufo.release();
      for (let i = 0; i < 60 * 15 && ufo.state !== 'idle'; i++) ufo.update(1 / 60);
      Math.random = realRand;
      ufo.draw();
      out.wins = wins;
      out.gotAcc = wins.length === 1 && Accessories.has(wins[0]);
      out.restocked = ufo.prizes.length;
      out.idle = ufo.state;
      // Miss far away: no prize, coins still spent.
      const c1 = Storage.getCoins();
      ufo.press(); ufo.claw.x = 300; ufo.prizes.forEach(p => { p.x = 120; p.homeX = 120; });
      ufo.release();
      for (let i = 0; i < 60 * 15 && ufo.state !== 'idle'; i++) ufo.update(1 / 60);
      out.missCost = c1 - Storage.getCoins();
      out.winsAfterMiss = wins.length;
      Storage.setCoins(50);
      out.canPlayPoor = ufo.canPlay;
      // 景品の棚:UFOの景品8つが全部並び、持っていない物は鍵つき
      Storage.setCoins(1000);
      g.openUfo();
      const ufoOwned = Accessories.LIST.filter(x => x.source === 'ufo' && Accessories.has(x.id)).length;
      out.shelfUfo = [...document.querySelectorAll('#ufo-owned .ufo-item')].length >= 8;
      out.shelfLocked = document.querySelectorAll('#ufo-owned .ufo-item.locked').length === 8 - ufoOwned;
      out.shelfCount = document.getElementById('ufo-count').textContent === `${ufoOwned}/8`;
      g.ufo.stop(); g.showTitle();

      // --- Wind ---
      const begin = id => {
        g.startGame(id); g.bug = null; g.player.setBug(null);
        g.stageIntroTimer = 0; g._updateStageIntro(0.01);
        Game.STAGES.find(s => s.id === id).targetScore = 1e12;
        g._getMoveInput = () => ({ active: false, dx: 0, dy: 0, ratio: 0 });
      };
      const run = sec => { for (let i = 0; i < sec * 60; i++) g._updatePlay(1 / 60, 1 / 60); };
      out.fans = [1, 2, 5, 9].map(id => (begin(id), g.wind.fans.length));
      begin(5);
      const f = g.wind.fans[0];
      const p = g.player;
      g.hazards && g.hazards.stop && (g.hazards.list = []);
      p.x = f.x + f.dx * 300; p.y = f.y + f.dy * 300;
      const px0 = p.x, py0 = p.y;
      run(0.5);
      out.playerPushed = (p.x - px0) * f.dx + (p.y - py0) * f.dy;
      out.fanAtOutside = g.wind.fanAt(f.x - f.dx * 200, f.y - f.dy * 200);

      // --- Bubbles ---
      begin(5); out.bubblesS5 = !!g.bubbles;
      begin(7);
      let bubbled = null;
      g.spawner.forEachActive(o => { if (!bubbled && o.bubble) bubbled = o; });
      out.bubbleCount = g.bubbles._count();
      out.canEatBubbled = g.canEat(bubbled, g.player, { x: bubbled.x, y: bubbled.y, r: 999 });
      g.player.x = bubbled.x; g.player.y = bubbled.y;
      g.bubbles.update(1 / 60);
      out.popped = !bubbled.bubble;
      out.dbg = { d: Math.hypot(g.player.x - bubbled.x, g.player.y - bubbled.y), px: g.player.x, bx: bubbled.x, active: bubbled.active, bub: !!g.bubbles };
      run(0.4);
      g.player.scale = 9;
      out.dbg2 = { ns: bubbled.noSuck, bub: !!bubbled.bubble, ramp: g.rampage, warp: g.warps && g.warps.active, ov: g.gimmick && g.gimmick.canEat(bubbled, g.player, { x: bubbled.x, y: bubbled.y, r: 999 }), st: bubbled.state };
      out.canEatAfter = bubbled.state !== 'idle' || g.canEat(bubbled, g.player, { x: bubbled.x, y: bubbled.y, r: 999 });
      g._render();
      return out;
    });

    assert.deepEqual(r.first, { id: 'flower', rare: false });
    assert.equal(r.again, null);
    assert.deepEqual(r.rare, { id: 'flower', rare: true });
    assert.equal(r.notListed, null);
    assert.equal(r.claimable, 1);
    assert.equal(r.coinsGained, 300);
    assert.equal(r.claimTwice, null);
    assert.equal(r.claimRareEarly, null);
    assert.deepEqual(r.claimRare, { accessory: 'goldcrown' });
    assert.equal(r.hasCrown, true);
    assert.equal(r.specialHasRare, 1, 'only the drone has a rare variant on the special page');

    assert.equal(r.prizeCount, UfoCatcher_SLOTS);
    assert.equal(r.prizeIdsUfo, true);
    assert.equal(r.pressed, true);
    assert.equal(r.coinsAfterPress, 900);
    assert.equal(r.pressWhileBusy, false);
    assert.equal(r.gotAcc, true, `wins ${JSON.stringify(r.wins)}`);
    assert.equal(r.restocked, UfoCatcher_SLOTS);
    assert.equal(r.shelfUfo, true);
    assert.equal(r.shelfLocked, true);
    assert.equal(r.shelfCount, true);
    assert.equal(r.idle, 'idle');
    assert.equal(r.missCost, 100);
    assert.equal(r.winsAfterMiss, 1);
    assert.equal(r.canPlayPoor, false);

    assert.deepEqual(r.fans, [1, 1, 2, 3]);
    assert.ok(r.playerPushed > 50, `pushed ${r.playerPushed}`);
    assert.equal(r.fanAtOutside, null);

    assert.equal(r.bubblesS5, false);
    assert.ok(r.bubbleCount >= 8, `bubbles ${r.bubbleCount}`);
    assert.equal(r.canEatBubbled, false);
    assert.equal(r.popped, true, JSON.stringify(r.dbg));
    assert.equal(r.canEatAfter, true, JSON.stringify(r.dbg2));
    assert.deepEqual(errors, []);
    console.log('features browser tests passed');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
const UfoCatcher_SLOTS = 6;
