const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:8080/';

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const scenario of ['normal', 'native-storage', 'blocked-load', 'storage-timeout', 'storage-error', 'missing-image', 'stalled-image', 'game-error']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (scenario === 'native-storage') {
        await page.addInitScript(() => {
          window.Capacitor = { isPluginAvailable: () => true, Plugins: {
            Preferences: { get: async ({ key }) => ({ value: key === 'mogu.coins' ? '432' : null }), set: async () => {} },
          } };
        });
      }
      if (scenario === 'storage-timeout') {
        await page.addInitScript(() => {
          window.Capacitor = { isPluginAvailable: () => true, Plugins: {
            Preferences: { get: () => new Promise(() => {}), set: () => { throw Error('must not overwrite saves'); } },
          } };
        });
      }
      if (scenario === 'storage-error') {
        await page.addInitScript(() => {
          localStorage.setItem('mogu.coins', '100');
          window.Capacitor = { isPluginAvailable: () => true, Plugins: {
            Preferences: { get: async () => { throw Error('read failed'); },
              set: () => { throw Error('must not overwrite saves'); } },
          } };
        });
      }
      if (scenario === 'blocked-load') {
        await page.route('**/public/star-match-icon.jpg', () => {});
      }
      if (scenario === 'missing-image') {
        await page.route('**/public/opt/red.webp', route => route.abort());
      }
      if (scenario === 'stalled-image') {
        await page.route('**/public/opt/red.webp', () => {});
      }
      if (scenario === 'game-error') {
        await page.route('**/js/Game.js', route => route.fulfill({
          contentType: 'text/javascript', body: 'class Game { constructor() { throw Error("test game failure"); } }',
        }));
      }
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      if (scenario === 'normal' || scenario === 'native-storage' || scenario === 'blocked-load') {
        await page.waitForFunction(() => Boolean(window.__game), { timeout: 10000 });
        assert.equal(await page.locator('#screen-title').evaluate(el => el.classList.contains('hidden')), false);
        await page.locator('#btn-privacy-close').click();
        // Existing native balance plus the first daily login bonus.
        if (scenario === 'native-storage') assert.equal(await page.locator('#title-coins').textContent(), '532');
      } else {
        await page.getByRole('button', { name: 'もう一度ためす' }).waitFor({ timeout: 20000 });
        assert.equal(await page.locator('#screen-loading').isVisible(), true);
        const message = await page.locator('.load-text').textContent();
        assert.match(message, scenario.startsWith('storage-') ? /保存データ/ : scenario === 'game-error' ? /ゲーム/ : /画像/);
        assert.equal(await page.evaluate(() => Boolean(window.__game)), false);
        if (scenario === 'missing-image') {
          await page.unroute('**/public/opt/red.webp');
          await page.getByRole('button', { name: 'もう一度ためす' }).click();
          await page.waitForFunction(() => Boolean(window.__game));
        }
      }
      assert.deepEqual(errors, [], 'No uncaught startup rejection');
      await page.close();
      console.log(`PASS: ${scenario}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
