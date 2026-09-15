// Deterministic mobile-sized input simulation, not a substitute for human playtests.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('https://**/*', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.__game?.state === 'title');
    const rows = await page.evaluate(() => {
      window.requestAnimationFrame = () => 0;
      const g = __game, rows = [];
      g.audio.setEnabled(false);
      // Measure unrestricted score curves: target-triggered bonus is excluded.
      g._checkTarget = () => false;
      for (let stage = 1; stage <= 10; stage++) {
        for (let seed = 1; seed <= 3; seed++) {
          let random = seed * 101 + stage;
          Math.random = () => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 4294967296);
          g.startGame(stage, []); g.state = 'play';
          let input = { active: false, dx: 0, dy: 0, ratio: 0 };
          g._getMoveInput = () => input;
          const row = { stage, seed, target: g.getStage(stage, true).targetScore, reachedAt: null, scores: {} };
          for (let frame = 0; frame < 45 * 60; frame++) {
            // A simple collector reacts every 0.4s, choosing visible edible items.
            if (frame % 24 === 0) {
              const mouth = g.player.getMouth(), view = g.camera.viewBounds(g.w, g.h, 0);
              let chosen = null, best = Infinity;
              g.spawner.forEachActive(o => {
                if (o.state !== 'idle' || o.type.req > g.player.scale || o.r > mouth.r * 1.05 ||
                    o.x < view.l || o.x > view.r || o.y < view.t || o.y > view.b) return;
                const distance = Math.hypot(o.x - mouth.x, o.y - mouth.y);
                if (distance < best) { best = distance; chosen = o; }
              });
              if (chosen) {
                const dx = chosen.x - mouth.x, dy = chosen.y - mouth.y, d = Math.hypot(dx, dy) || 1;
                input = { active: true, dx: dx / d, dy: dy / d, ratio: .65 };
              } else input = { active: true, dx: Math.cos(frame / 180), dy: Math.sin(frame / 180), ratio: .65 };
            }
            g.time += 1 / 60;
            g._updatePlay(1 / 60);
            if (row.reachedAt === null && g.score >= row.target) row.reachedAt = +((frame + 1) / 60).toFixed(2);
            if ([20, 25, 30, 35, 40, 45].includes((frame + 1) / 60)) row.scores[(frame + 1) / 60] = g.score;
          }
          rows.push(row);
        }
      }
      return rows;
    });
    console.log(JSON.stringify(rows, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
