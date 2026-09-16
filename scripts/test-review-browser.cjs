const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:8080/';
(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const accepted of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // Count SDK initialization locally, without sending review traffic.
      await page.route('**/js/GameAnalytics.min.js', route => route.fulfill({
        contentType: 'text/javascript', body: `window.sdkCalls = 0;
          window.gameanalytics = { GameAnalytics: {
            configureBuild() {}, configureAvailableResourceCurrencies() {},
            configureAvailableResourceItemTypes() {}, initialize() { window.sdkCalls++; }
          } };`,
      }));
      await page.goto(base);
      await page.waitForFunction(() => window.__game);
      assert.equal(await page.locator('#privacy-banner').isVisible(), true);
      assert.equal(await page.evaluate(() => window.sdkCalls), 0);
      assert.equal(await page.locator('#login-bonus').isVisible(), false);
      if (!accepted) {
        const screenshot = path.join(os.tmpdir(), 'mogu-privacy-review.png');
        await page.screenshot({ path: screenshot });
        console.log('Screenshot: ' + screenshot);
      }
      await page.locator(accepted ? '#btn-privacy-accept' : '#btn-privacy-close').click();
      assert.equal(await page.evaluate(() => Analytics.ready), accepted);
      assert.equal(await page.evaluate(() => window.sdkCalls), accepted ? 1 : 0);
      assert.equal(await page.locator('#login-bonus').isVisible(), true);
      await page.reload(); await page.waitForFunction(() => window.__game);
      assert.equal(await page.locator('#privacy-banner').isVisible(), false);
      assert.equal(await page.evaluate(() => window.sdkCalls), accepted ? 1 : 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage();
    await page.route('**/collaborations/ohsun.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto(base); await page.waitForFunction(() => window.__game);
    await page.locator('#btn-privacy-close').click();
    const result = await page.evaluate(() => {
      const g = window.__game;
      g.startGame(1); g.state = 'play'; g.pauseGame();
      const paused = g.audio.musicPaused;
      g.showTitle(); const homePaused = g.audio.musicPaused;
      g.startGame(1); g.state = 'play'; g.ui.hideStageIntro();
      g.player.startVacuum(); g.player.vacuumTimer = .001;
      g.ui.setGauge(.1, true); g._updatePlay(.01, .01);
      return { paused, homePaused, restartedPaused: g.audio.musicPaused,
        vacuumActive: g.player.vacuumActive, gaugeActive: g.ui.el.gaugeWrap.classList.contains('active'),
        gaugeWidth: g.ui.el.gaugeFill.style.width };
    });
    assert.deepEqual(result, { paused: true, homePaused: false, restartedPaused: false,
      vacuumActive: false, gaugeActive: false, gaugeWidth: '0%' });
    await page.close();
    console.log('PASS: consent accept/decline/persistence, bonus sequencing, normal-build music, vacuum expiry.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
