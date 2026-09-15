// Desktop browser diagnosis only. No production code or saved user data is changed.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  let pathname;
  // A malformed percent-escape throws; answer 400 instead of killing the server.
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (_) { return res.writeHead(400).end(); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['off', 'bgm', 'sfx', 'both', 'both', 'sfx', 'bgm', 'off']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      await page.route('https://**/*', route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => window.__game?.state === 'title');
      await page.waitForFunction(() => Object.values(__game.audio.sfx).every(a => a.readyState >= 2));
      await page.evaluate(async mode => {
        const g = __game, a = g.audio;
        g.ui.closeLoginBonus();
        a.pauseAll();
        // Drain setup seek events before installing the measurement listeners.
        await new Promise(resolve => setTimeout(resolve, 100));
        const music = mode === 'bgm' || mode === 'both';
        const effects = mode === 'sfx' || mode === 'both';
        if (!music) a.playBgm = () => {};
        if (!effects) { a.pop = () => {}; a.playSfx = () => {}; }
        a.enabled = mode !== 'off'; a.unlocked = true;
        const stats = window.audioDiagnostic = { mode, play: {}, pause: 0, seeks: 0, seeking: 0,
          seeked: 0, waiting: 0, rejected: 0, overlapRestarts: 0, frame: [], update: [], render: [], mediaCPU: 0 };
        const timeProperty = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
        for (const [name, media] of Object.entries({ bgm: a.bgm, ...a.sfx })) {
          const play = media.play.bind(media), pause = media.pause.bind(media);
          media.play = () => {
            stats.play[name] = (stats.play[name] || 0) + 1;
            const t = performance.now(), promise = play();
            stats.mediaCPU += performance.now() - t;
            promise.catch(() => { stats.rejected++; });
            return promise;
          };
          media.pause = () => {
            stats.pause++;
            if (name !== 'bgm' && !media.paused && !media.ended) stats.overlapRestarts++;
            const t = performance.now(); pause(); stats.mediaCPU += performance.now() - t;
          };
          Object.defineProperty(media, 'currentTime', {
            get() { return timeProperty.get.call(this); },
            set(value) {
              stats.seeks++;
              const t = performance.now(); timeProperty.set.call(this, value); stats.mediaCPU += performance.now() - t;
            },
          });
          for (const event of ['seeking', 'seeked', 'waiting']) media.addEventListener(event, () => stats[event]++);
        }
        let seed = 1234;
        Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
        g.startGame(1, []);
        g.state = 'play'; g.ui.hideStageIntro(); g._lastT = performance.now();
        // Fixed starting setup stresses the reported bonus/mass-pickup case.
        g.player.scale = 4;
        g._checkTarget = () => false;
        g.collaboration.beginBonus();
        g._getMoveInput = () => {
          const m = g.player.getMouth(); let target = null, best = Infinity;
          g.spawner.forEachActive(o => {
            if (o.state !== 'idle' || o.type.req > g.player.scale || o.r > m.r * 1.05) return;
            const d = Math.hypot(o.x - m.x, o.y - m.y);
            if (d < best) { target = o; best = d; }
          });
          return target ? { active: true, dx: (target.x - m.x) / (best || 1), dy: (target.y - m.y) / (best || 1), ratio: .65 }
            : { active: false, dx: 0, dy: 0, ratio: 0 };
        };
        for (const [method, key] of [['_updatePlay', 'update'], ['_render', 'render']]) {
          const original = g[method];
          g[method] = function(...args) {
            const t = performance.now(); original.apply(this, args); stats[key].push(performance.now() - t);
          };
        }
        a.playBgm();
        let previous = performance.now();
        stats.start = previous;
        const sample = now => { stats.frame.push(now - previous); previous = now; stats.raf = requestAnimationFrame(sample); };
        stats.raf = requestAnimationFrame(sample);
      }, mode);
      await page.waitForTimeout(10000);
      const result = await page.evaluate(() => {
        const s = audioDiagnostic;
        cancelAnimationFrame(s.raf);
        const summarize = values => {
          const sorted = values.slice(2).sort((a, b) => a - b);
          if (!sorted.length) return { p50: null, p95: null, max: null, over33ms: 0, samples: 0 };
          return { p50: +sorted[Math.floor(sorted.length * .5)].toFixed(2), p95: +sorted[Math.floor(sorted.length * .95)].toFixed(2),
            max: +sorted.at(-1).toFixed(2), over33ms: sorted.filter(v => v > 33.4).length };
        };
        return { mode: s.mode, seconds: +((performance.now() - s.start) / 1000).toFixed(2),
          frame: summarize(s.frame), updateCPU: summarize(s.update), renderCPU: summarize(s.render),
          play: s.play, pause: s.pause, seeks: s.seeks, seeking: s.seeking, seeked: s.seeked, waiting: s.waiting,
          rejected: s.rejected, overlapRestarts: s.overlapRestarts, mediaCPU: +s.mediaCPU.toFixed(2),
          pickups: __game.suckedCount, score: __game.score };
      });
      console.log(JSON.stringify(result));
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
