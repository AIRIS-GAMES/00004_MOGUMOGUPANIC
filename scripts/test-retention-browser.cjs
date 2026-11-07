// End-to-end check of the retention UI in a real browser (start `npm run serve` first).
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
      window.__notify = [];
      window.Capacitor = { isPluginAvailable: name => name === 'LocalNotifications', Plugins: { LocalNotifications: {
        cancel: async o => window.__notify.push(['cancel', o]),
        checkPermissions: async () => ({ display: window.__granted ? 'granted' : 'prompt' }),
        requestPermissions: async () => { window.__granted = true; return { display: 'granted' }; },
        schedule: async o => window.__notify.push(['schedule', o]),
      } } };
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__game);

    // Day 1 login bonus shows the 7-day calendar.
    assert.equal(await page.locator('#login-bonus').isVisible(), true);
    assert.equal(await page.locator('#login-bonus-day').textContent(), '連続ログイン 1日目');
    assert.equal(await page.locator('#login-streak li').count(), 7);
    await page.locator('#btn-login-bonus').click();
    assert.equal(await page.locator('#title-stars').textContent(), '0');

    // First play of stage 1 shows the tutorial after the intro, and it advances on movement.
    await page.evaluate(() => { const g = window.__game; g.startGame(1); g.stageIntroTimer = 0; g._updateStageIntro(0.01); });
    assert.equal(await page.locator('#tutorial').isVisible(), true);
    await page.evaluate(() => {
      const g = window.__game;
      g._getMoveInput = () => ({ active: true, dx: 1, dy: 0, ratio: 1 });
      for (let i = 0; i < 60; i++) g._updatePlay(1 / 60, 1 / 60);
      delete g._getMoveInput;
    });
    assert.match(await page.locator('#tutorial-text').textContent(), /すいこもう/);

    // Clear stage 1 in 12s: three stars, star bonus, notification prompt.
    await page.evaluate(() => {
      const g = window.__game;
      g.score = 900; g.suckedCount = 30; g.maxCombo = 16; g.timeLeft = g.runTimeLimit - 12; g.endGame();
    });
    assert.equal(await page.locator('#tutorial').isVisible(), false);
    assert.equal(await page.locator('#res-stars span.on').count(), 3);
    assert.match(await page.locator('#res-star-hint').textContent(), /★\+90/, 'Star bonus chip');
    assert.match(await page.locator('#res-reward').textContent(), /\+190/, 'Stage reward plus star bonus');
    await page.locator('#notify-prompt').waitFor({ state: 'visible', timeout: 4000 });
    await page.locator('#btn-notify-accept').click();
    await page.waitForFunction(() => window.__notify.some(c => c[0] === 'schedule'));
    const at = await page.evaluate(() => window.__notify.find(c => c[0] === 'schedule')[1].notifications.map(n => {
      const d = new Date(n.schedule.at), days = [3, 7][n.id - 3101], e = new Date();
      e.setDate(e.getDate() + days);
      return d.getHours() === 22 && d.getMinutes() === 0 && d.toDateString() === e.toDateString();
    }));
    assert.deepEqual(at, [true, true], '3 and 7 days later at 22:00 local');

    // Back home: stars and mission badge update; claim a mission from the list.
    await page.locator('#btn-result-home').click();
    assert.equal(await page.locator('#title-stars').textContent(), '3');
    assert.equal(await page.evaluate(() => Retention.tutorialDone()), true);
    await page.evaluate(() => {
      const s = Retention.missionState(); s.ids = ['play3', 'combo15', 'star3'];
      Storage.set(Storage.KEYS.missions, s);
      Retention.recordRun({ plays: 3, maxCombo: 16, stars: 3 });
      window.__game.showTitle();
    });
    assert.equal(await page.locator('#mission-badge').isVisible(), true);
    const before = Number((await page.locator('#title-coins').textContent()).replace(/,/g, ''));
    await page.locator('#btn-mission').click();
    await page.locator('.mission-claim:not([disabled])').first().click();
    assert.equal(await page.locator('.mission-card.claimed').count(), 1);
    await page.locator('#btn-mission-back').click();
    const after = Number((await page.locator('#title-coins').textContent()).replace(/,/g, ''));
    assert.equal(after - before, 80);

    // Stage select shows stars per stage.
    await page.locator('#btn-start').click();
    assert.equal(await page.locator('.stage-card2[aria-label^="STAGE 1 "]').locator('.stage-stars i.on').count(), 3);
    assert.deepEqual(errors, []);
    console.log('PASS: streak calendar, tutorial, star result/bonus, notification opt-in + schedule, missions, stage stars.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
