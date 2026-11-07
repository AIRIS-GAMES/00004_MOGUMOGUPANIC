// Stage gimmicks in a real browser (start `npm run serve` first).
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:8080/';
const HAZARD_LEASH_LIMIT = 140 + 60;

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
      const begin = id => {
        g.startGame(id); g.bug = null; g.player.setBug(null);
        g.stageIntroTimer = 0; g._updateStageIntro(0.01);
        Game.STAGES.find(s => s.id === id).targetScore = 1e12;
        g._getMoveInput = () => ({ active: false, dx: 0, dy: 0, ratio: 0 });
      };
      const run = sec => { for (let i = 0; i < sec * 60; i++) g._updatePlay(1 / 60, 1 / 60); };
      out.none1 = (begin(1), g.gimmick);

      // Every stage runs 25s of play with wandering input and renders without errors.
      for (let id = 2; id <= 10; id++) {
        begin(id);
        g._getMoveInput = () => ({ active: true, dx: Math.cos(g.time * 0.6), dy: Math.sin(g.time * 0.45), ratio: 0.7 });
        for (let i = 0; i < 25 * 60; i++) { g._updatePlay(1 / 60, 1 / 60); if (i % 30 === 0) g._render(); }
      }

      // 2: copies appear next to edible objects.
      begin(2); run(6);
      out.copies = g.gimmick.activeExtras().length;

      // 3: cars drive; eaten from behind, bump from the front stuns.
      begin(3); run(0.1);
      const car = g.gimmick.activeExtras(o => o.gimmick && o.gimmick.drive)[0];
      const x0 = car.x; run(0.5);
      out.carMoved = Math.abs(car.x - x0) > 40;
      const p = g.player;
      const behind = { x: car.x - car.gimmick.dir * car.r * 1.2, y: car.y, r: p.mouthRadius };
      const front = { x: car.x + car.gimmick.dir * car.r * 0.9, y: car.y, r: p.mouthRadius };
      out.eatBehind = g.canEat(car, p, behind);
      out.eatFront = g.canEat(car, p, front);
      p.x = front.x; p.y = front.y - p.bodyR * 0.34;
      g.gimmick.onBump(car, p, front);
      out.stunned = g.stunTimer > 0 && g._getMoveInput === g._getMoveInput && Game.prototype._getMoveInput.call(g).active === false;

      // 4: sale zone triples score inside.
      begin(4); run(3.2);
      const z = g.gimmick.zone;
      out.saleZone = !!z && g.gimmick.scoreMul({ x: z.x, y: z.y }) === 3 && g.gimmick.scoreMul({ x: z.x + z.r * 2, y: z.y }) === 1;

      // どのステージにも:普通の時計がときどき出る。食べると+3秒、しばらくしてまた出る
      begin(3); run(6.5);
      const clocksOf = () => g.clocks.activeExtras(o => o.gimmick && o.gimmick.clock);
      out.clockAppears = clocksOf().length;
      const t0 = g.timeLeft; g._consume(clocksOf()[0]);
      out.clockTime = Math.round((g.timeLeft - t0) * 10) / 10;
      run(14.5);
      out.clocksBack = clocksOf().length;
      out.noClock1 = (begin(1), g.clocks);

      // 5: 巨大エラー。ぶつかるたびに小さくなり、6回で食べられる
      begin(5); run(2.5);
      const boss = g.gimmick.boss;
      const big = boss.r;
      out.bossEatBefore = g.gimmick.canEat(boss, g.player);
      for (let i = 0; i < 6; i++) { boss.gimmick.cd = 0; g.gimmick.onBump(boss, g.player); }
      run(1);
      out.bossShrunk = boss.r < big * 0.5;
      out.bossEatAfter = g.gimmick.canEat(boss, g.player);

      // 6: the start belt carries the player and items along it.
      begin(6);
      const px = g.player.x; run(1);
      out.playerCarried = Math.round(g.player.x - px);

      // 7: a crate lands next to the player, stuns if underneath, and scatters loot.
      begin(7); run(2.1);
      const drop = g.gimmick.drops[0];
      g.player.x = drop.x; g.player.y = drop.y; g.stunTimer = 0;
      run(1.9);
      out.craneStun = g.stunTimer > 0;
      out.loot = g.gimmick.activeExtras(o => o.gimmick && o.gimmick.loot).length;

      // 8: glowing luggage flies away when ignored.
      begin(8);
      let glowing = [];
      for (let i = 0; i < 12 && !glowing.length; i++) {
        run(0.5);
        glowing = g.spawner.pool.filter(o => o.active && o.gimmick && o.gimmick.glow);
      }
      out.glowing = glowing.length;
      run(5);
      out.flewAway = glowing.every(o => !o.active || !o.gimmick);

      // 9: blackout darkens after the light phase.
      begin(9); run(8.5);
      out.dark = g.gimmick.darkness > 0.9 && g.gimmick.state === 'dark';

      // 10: gimmicks rotate and clean up their extras.
      begin(10); run(1);
      out.mix1 = g.gimmick.current.constructor.name;
      run(9.5);
      out.mix2 = g.gimmick.current.constructor.name;
      const extrasBefore = g.spawner.eventPool.filter(o => o.active && o.gimmickOwned).length;
      run(9);
      out.mix3 = g.gimmick.current.constructor.name;
      out.extrasBefore = extrasBefore;

      // Leaving the stage stops the gimmick.
      g.showTitle();
      out.cleared = g.gimmick === null;
      return out;
    });
    assert.equal(r.none1, null, 'STAGE 1 has no gimmick');
    assert.ok(r.copies >= 3, `copies ${r.copies}`);
    assert.equal(r.carMoved, true);
    assert.equal(r.eatBehind, true);
    assert.equal(r.eatFront, false);
    assert.equal(r.stunned, true);
    assert.equal(r.saleZone, true);
    assert.equal(r.clockAppears, 1);
    assert.equal(r.clockTime, 3);
    assert.equal(r.clocksBack, 1);
    assert.equal(r.noClock1, null);
    assert.deepEqual([r.bossEatBefore, r.bossShrunk, r.bossEatAfter], [false, true, true]);
    assert.ok(r.playerCarried > 150, `carried ${r.playerCarried}`);
    assert.equal(r.craneStun, true);
    assert.equal(r.loot, 7);
    assert.ok(r.glowing >= 1);
    assert.equal(r.flewAway, true);
    assert.equal(r.dark, true);
    assert.deepEqual([r.mix1, r.mix2, r.mix3], ['MultiplyGimmick', 'TrafficGimmick', 'SaleGimmick']);
    assert.ok(r.extrasBefore > 0);
    assert.equal(r.cleared, true);
    // Hazards: none in the STAGE 1 tutorial, present elsewhere; swallowing one shocks.
    const hz = await page.evaluate(() => {
      const g = window.__game;
      localStorage.removeItem('mogu.tutorialDone'); Storage.cache.delete('mogu.tutorialDone');
      Storage.set(Storage.KEYS.clearedStages, []);
      g.startGame(1);
      const tutorialHazards = g.hazards;
      Storage.set(Storage.KEYS.tutorialDone, true);
      Storage.set(Storage.KEYS.clearedStages, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      g.startGame(2); g.bug = null; g.player.setBug(null);
      g.stageIntroTimer = 0; g._updateStageIntro(0.01);
      // Random plan per run: early stages get one kind, late stages three; totals follow the budget.
      const plans = { s2: HazardField.planFor(2), s5: HazardField.planFor(5), s9: HazardField.planFor(9) };
      const planInfo = Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, {
        kinds: Object.keys(p).length,
        total: Object.values(p).reduce((a, b) => a + b.count, 0),
        patterns: Object.values(p).every(v => HazardField.PATTERNS.includes(v.pattern)),
      }]));
      const randomStart = g.hazards.items.filter(o => o.active).length;
      // Fixed mix of all three kinds for the behaviour checks below.
      g.hazards.stop();
      g.hazards = new HazardField(g, Game.STAGES[1], ['zapper', 'chili', 'soda']);
      g.hazards.start();
      const count = g.hazards.items.filter(o => o.active).length;
      const kinds = ['zapper', 'chili', 'soda'].map(k => g.hazards.activeHazards(k).length);
      const nearStart = g.hazards.items.some(o => Math.hypot(o.x - g.player.x, o.y - g.player.y) < 300);
      g.score = 500; g.comboCount = 7; g.comboTimer = 1;
      const eaten = g.suckedCount, size = g.player.scale;
      const h = g.hazards.activeHazards('zapper')[0];
      g._consume(h);
      const shocked = { stun: g.stunTimer > 1, score: g.score, combo: g.comboCount, eaten: g.suckedCount - eaten,
        grew: g.player.scale !== size, input: Game.prototype._getMoveInput.call(g).active };
      for (let i = 0; i < 2.5 * 60; i++) g._updatePlay(1 / 60, 1 / 60);
      const after = g.hazards.items.filter(o => o.active).length;

      // Chili: forced charge in the facing direction, input ignored, faster, ends after ~2s.
      // Park every other hazard in a far corner so the charge can't hit one by chance.
      const chiliHazard = g.hazards.activeHazards('chili')[0];
      const sodaHazard = g.hazards.activeHazards('soda')[0];
      for (const o of g.hazards.items) if (o !== chiliHazard && o !== sodaHazard) { o.x = 120; o.y = 120; }
      g.player.x = 900; g.player.y = 1750;
      g.stunTimer = 0; g.player.dirX = 1; g.player.dirY = 0;
      const speed0 = g.player.moveSpeed, x0 = g.player.x;
      g._consume(chiliHazard);
      const forced = Game.prototype._getMoveInput.call(g);
      const chili = { forced: forced.active && forced.dx === 1, faster: g.player.moveSpeed > speed0 * 1.5 };
      g._getMoveInput = Game.prototype._getMoveInput;
      for (let i = 0; i < 60; i++) g._updatePlay(1 / 60, 1 / 60);
      chili.moved = g.player.x - x0 > 200;
      for (let i = 0; i < 80; i++) g._updatePlay(1 / 60, 1 / 60);
      chili.ended = g.rampage === null && g.player.boostMul === 1;
      // Items in front of the flame get scorched; eating a scorched item lowers the score.
      g.player.x = 900; g.player.y = 1750; g.player.dirX = 1; g.player.dirY = 0;
      const victim = g.spawner.pool.find(o => o.active && !o.burnt);
      g.hazards._rampage();
      const mouth = g.player.getMouth();
      victim.x = mouth.x + g.player.bodyR * 0.9; victim.y = mouth.y; victim.state = 'idle';
      chili.cantEat = g.canEat(victim) === false;
      g.hazards._scorch();
      chili.scorched = victim.burnt === true;
      g.rampage = null; g.player.boostMul = 1; g.stunTimer = 0;
      g.score = 700;
      g._consume(victim);
      chili.burntScore = g.score === 700 - victim.type.score;

      // Soda: burp out the last 5 eaten items, score drops by their points, they can be eaten back later.
      g.score = 1000;
      g.recentEats = [];
      for (let i = 0; i < 7; i++) g.recentEats.push({ type: OBJECT_TYPES[0], points: 40 });
      g._consume(sodaHazard);
      const spat = g.hazards.spat.filter(o => o.active);
      const soda = { score: g.score, spat: spat.length, left: g.recentEats.length, blocked: !g.canEat(spat[0]) };
      for (let i = 0; i < 70; i++) g._updatePlay(1 / 60, 1 / 60);
      soda.edibleLater = spat.every(o => o.noSuck <= 0);
      return { tutorialHazards, planInfo, randomStart, count, kinds, nearStart, shocked, after, chili, soda };
    });
    assert.equal(hz.tutorialHazards, null, 'No hazards during the STAGE 1 tutorial');
    const HazardBudget9 = 8 + 9 * 2;  // 控えめにした数(8+2×面)
    assert.deepEqual(hz.planInfo, {
      s2: { kinds: 1, total: 12, patterns: true },
      s5: { kinds: 2, total: 18, patterns: true },
      s9: { kinds: 3, total: hz.planInfo.s9.total, patterns: true },
    });
    assert.ok(Math.abs(hz.planInfo.s9.total - HazardBudget9) <= 1, `s9 total ${hz.planInfo.s9.total}`);
    assert.equal(hz.randomStart, 12);
    assert.deepEqual(hz.kinds, [6, 3, 3]);
    assert.equal(hz.count, 12);
    assert.equal(hz.nearStart, false, 'Start area is kept clear');
    assert.deepEqual(hz.shocked, { stun: true, score: 500, combo: 0, eaten: 0, grew: false, input: false });
    assert.equal(hz.after, hz.count, 'Swallowed hazard respawns elsewhere');
    assert.deepEqual(hz.chili, { forced: true, faster: true, moved: true, ended: true, cantEat: true, scorched: true, burntScore: true });
    assert.deepEqual(hz.soda, { score: 800, spat: 5, left: 2, blocked: true, edibleLater: true });

    // Hazards wander a little but stay near where they were placed.
    const walk = await page.evaluate(() => {
      const g = window.__game;
      g.startGame(9); g.bug = null; g.player.setBug(null);
      g.stageIntroTimer = 0; g._updateStageIntro(0.01);
      g.gimmick.stop(); g.gimmick = null;
      g.player.x = 200; g.player.y = 3300;
      g._getMoveInput = () => ({ active: false, dx: 0, dy: 0, ratio: 0 });
      const start = g.hazards.items.filter(o => o.active).map(o => ({ o, x: o.x, y: o.y }));
      for (let i = 0; i < 6 * 60; i++) g._updatePlay(1 / 60, 1 / 60);
      const moved = start.filter(s => Math.hypot(s.o.x - s.x, s.o.y - s.y) > 30).length / start.length;
      const maxFromHome = Math.max(...start.map(s => Math.hypot(s.o.x - s.o.home.x, s.o.y - s.o.home.y)));
      delete g._getMoveInput;
      return { moved, maxFromHome };
    });
    assert.ok(walk.moved > 0.7, `most hazards walked (${walk.moved})`);
    assert.ok(walk.maxFromHome < HAZARD_LEASH_LIMIT, `stayed near home (${walk.maxFromHome})`);

    // Warp holes: placed away from the start, entering one sends you out of another; no eating mid-warp.
    const warp = await page.evaluate(() => {
      const g = window.__game;
      g.startGame(5); g.bug = null; g.player.setBug(null);
      g.stageIntroTimer = 0; g._updateStageIntro(0.01);
      g.gimmick.stop(); g.gimmick = null;
      g.hazards.stop(); g.hazards = null;
      g._getMoveInput = () => ({ active: false, dx: 0, dy: 0, ratio: 0 });
      const holes = g.warps.holes;
      const c = Game.WORLD / 2;
      const res = { count: holes.length, awayFromStart: holes.every(h => Math.hypot(h.x - c, h.y - c) >= 450) };
      const from = holes[0];
      g.player.x = from.x + 5; g.player.y = from.y;
      g._updatePlay(1 / 60, 1 / 60);
      res.warping = g.warps.active;
      res.noEat = g.canEat(g.spawner.pool.find(o => o.active)) === false;
      for (let i = 0; i < 60; i++) g._updatePlay(1 / 60, 1 / 60);
      const landed = holes.find(h => h !== from && Math.hypot(g.player.x - h.x, g.player.y - h.y) < 5);
      res.landedOnOther = !!landed;
      res.done = !g.warps.active && g.player.warpScale === 1;
      // Standing on the exit hole doesn't warp again until you step away.
      for (let i = 0; i < 30; i++) g._updatePlay(1 / 60, 1 / 60);
      res.noBounce = !g.warps.active;
      delete g._getMoveInput;
      return res;
    });
    assert.ok(warp.count >= 2 && warp.count <= 5, `holes ${warp.count}`);
    assert.deepEqual({ ...warp, count: 0 }, { count: 0, awayFromStart: true, warping: true, noEat: true, landedOnOther: true, done: true, noBounce: true });

    // Bug roulette wheel: spins after the intro, tap stops it, second tap starts play.
    const wheel = await page.evaluate(() => {
      const g = window.__game;
      g.startGame(2);
      g.bug = BugRoulette.get('confuse'); g.player.setBug(g.bug);
      g.stageIntroTimer = 0; g._updateStageIntro(0.01);
      const spinning = g.state;
      g._updateRoulette(0.5);
      return { spinning, visible: !document.getElementById('bug-wheel').classList.contains('hidden') };
    });
    assert.deepEqual(wheel, { spinning: 'roulette', visible: true });
    await page.locator('#bug-wheel').dispatchEvent('pointerdown');
    assert.equal(await page.locator('#wheel-result-name').textContent(), 'こんらんバグ');
    assert.equal(await page.locator('.wheel-seg.hit').getAttribute('data-index'), '2');
    await page.locator('#bug-wheel').dispatchEvent('pointerdown');
    assert.equal(await page.evaluate(() => window.__game.state), 'play');
    assert.equal(await page.locator('#bug-wheel').isHidden(), true);
    assert.match(await page.locator('#bug-badge').getAttribute('aria-label'), /こんらん/);
    assert.equal(await page.locator('#btn-pause').isDisabled(), false, 'Pause works after the roulette');
    // バグは15秒で切れて元に戻る(バッジも消える)
    const cure = await page.evaluate(() => {
      const g = window.__game;
      g._getMoveInput = () => ({ active: false, dx: 0, dy: 0, ratio: 0 });
      for (let i = 0; i < 14 * 60; i++) g._updatePlay(1 / 60, 1 / 60);
      const still = !!g.bug && !!g.player.bug;
      for (let i = 0; i < 2 * 60; i++) g._updatePlay(1 / 60, 1 / 60);
      delete g._getMoveInput;
      return { still, cured: !g.bug && !g.player.bug, badgeHidden: document.getElementById('bug-badge').classList.contains('hidden') };
    });
    assert.deepEqual(cure, { still: true, cured: true, badgeHidden: true });
    // ブースト:バグよけ=ルーレットなし、フィーバー=最初からゲージほぼ満タン、バリア=危険物を1回ふせぐ
    const boost = await page.evaluate(() => {
      const g = window.__game;
      g.startGame(4, ['nobug', 'fever', 'shield']);
      const nobug = g.bug === null;
      const gauge = g.power.gauge;
      g.stageIntroTimer = 0; g._updateStageIntro(0.01);
      if (g.state !== 'play') g._beginPlay();
      const zap = g.spawner.pool.find(o => o.active && o.hazard) || (() => { const o = g.spawner.pool.find(x => x.active); o.hazard = 'zapper'; return o; })();
      g._consume(zap);
      const blocked = g.shield === 0 && g.stunTimer <= 0;
      return { nobug, gauge: gauge >= 0.9, blocked, count: Game.BOOSTS.length };
    });
    assert.deepEqual(boost, { nobug: true, gauge: true, blocked: true, count: 6 });
    // あそびかた:5つのタブが開ける
    const howto = await page.evaluate(() => {
      const g = window.__game; g.howto.open();
      const tabs = [...document.querySelectorAll('.howto-tab')].map(b => b.dataset.tab);
      const sizes = tabs.map(t => { g.howto.show(t); return document.querySelectorAll('.howto-body .ht-card, .howto-body .ht-step').length; });
      g.howto.close();
      return { tabs: tabs.length, allFilled: sizes.every(n => n > 0), closed: document.getElementById('howto').classList.contains('hidden') };
    });
    assert.deepEqual(howto, { tabs: 5, allFilled: true, closed: true });
    // HUD: target pill counts down and turns into CLEAR!, sound button mirrors the setting.
    const hud = await page.evaluate(() => {
      const g = window.__game;
      g.ui.updateHUD(300, 1.2, 50, 2500);
      const before = document.getElementById('hud-target').textContent;
      g.ui.updateHUD(2600, 1.2, 50, 2500);
      const after = document.getElementById('hud-target').textContent;
      document.getElementById('btn-hud-sound').click();
      const off = document.getElementById('btn-hud-sound').classList.contains('is-off') === !g.audio.enabled;
      document.getElementById('btn-hud-sound').click();
      return { before, after, off };
    });
    assert.deepEqual(hud, { before: 'あと 2,200', after: 'CLEAR!', off: true });
    // Stage intro and stage select mention the gimmick.
    await page.evaluate(() => { const g = window.__game; g.startGame(3); });
    assert.match(await page.locator('#stage-intro-gimmick').textContent(), /車/);
    await page.evaluate(() => window.__game.openStages());
    assert.equal(await page.locator('.stage-card2').count(), await page.evaluate(() => Game.STAGES.length));
    // 開始前のローディング:出てから消えて、ステージが始まる。20面まである
    await page.evaluate(() => window.__game.startWithLoading(12, []));
    assert.equal(await page.locator('#loading-screen').isVisible(), true);
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => ({ state: window.__game.state, stage: window.__game.currentStageId, n: Game.STAGES.length }));
    assert.equal(await page.locator('#loading-screen').isVisible(), false);
    assert.deepEqual(after, { state: 'intro', stage: 12, n: 20 });
    // ニセコスミー:進むほど増えて最大3体(3種類)、本物より小さい、食べ物を横取り、必要サイズになったら吸い込める
    const rivals = await page.evaluate(async () => {
      const g = window.__game;
      g.startGame(16); g.bug = null; g.player.setBug(null);
      const rv = g.gimmick.parts.find(x => x.rivals);
      const first = rv.rivals.length;
      g.score = g.getStage(16).targetScore * 0.7;
      g.player.scale = 2;
      for (let i = 0; i < 1500; i++) rv.update(1 / 60);
      const n = rv.rivals.length, kinds = rv.rivals.map(r => r.kind).sort().join(',');
      const smaller = rv.rivals.every(r => r.scale < g.player.scale);
      const ate = rv.rivals.reduce((a, r) => a + r.eaten, 0) > 0;
      const r = rv.rivals.find(x => x.kind === 'blue');
      // まだ小さい:吸い込めない
      r.x = g.player.getMouth().x; r.y = g.player.getMouth().y; r.stun = 0;
      rv.update(1 / 60);
      const tooSmall = r.suck === 0;
      // 必要サイズになった:吸い込んでポイント
      g.player.scale = r.need; r.stun = 0;
      const before = g.score;
      for (let i = 0; i < 40; i++) { const m = g.player.getMouth(); if (rv.rivals.includes(r) && !r.suck) { r.x = m.x; r.y = m.y; } rv.update(1 / 60); }
      return { first, n, kinds, smaller, ate, tooSmall, sucked: !rv.rivals.includes(r) && g.score > before };
    });
    assert.deepEqual(rivals, { first: 2, n: 3, kinds: 'blue,pink,red', smaller: true, ate: true, tooSmall: true, sucked: true });
    assert.deepEqual(errors, []);
    console.log('PASS: 9 stage gimmicks (multiply, traffic, sale, boss, conveyor, crane, fly-away, blackout, mix), intro + stage select labels.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
