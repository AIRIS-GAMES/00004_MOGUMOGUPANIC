const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (name === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<button id="start">Audio test</button><script>const Storage={getSound:()=>true,setSound:()=>{}};</script><script src="/js/Audio.js"></script><script>const a=new AudioSys();document.querySelector("button").onclick=()=>a.unlock();</script>');
    return;
  }
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', file.endsWith('.wav') ? 'audio/wav' : file.endsWith('.mp3') ? 'audio/mpeg' : 'text/javascript');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.click('#start');
    await page.waitForFunction(() => !a.bgm.paused && a.bgm.currentTime > 0);
    await page.waitForFunction(() => Object.values(a.sfx).every(x => x.readyState >= 2));
    for (const name of await page.evaluate(() => Object.keys(a.sfx))) {
      await page.evaluate(name => a.playSfx(name), name);
      await page.waitForFunction(name => a.sfx[name].currentTime > 0 && !a.sfx[name].error, name);
    }
    // Recording modes use only media mute flags: production UI and preferences stay unchanged.
    for (const [music, effects] of [[true, false], [false, true], [true, true]]) {
      const mode = await page.evaluate(([music, effects]) => {
        a.bgm.muted = !music;
        Object.values(a.sfx).forEach(x => { x.muted = !effects; });
        a.button();
        return [!a.bgm.muted, !a.sfx.button.muted];
      }, [music, effects]);
      assert.deepEqual(mode, [music, effects]);
    }
    await page.evaluate(() => a.setBackgroundPaused(true));
    assert.equal(await page.evaluate(() => a.bgm.paused && Object.values(a.sfx).every(x => x.paused)), true);
    await page.evaluate(() => a.setBackgroundPaused(false));
    await page.waitForFunction(() => !a.bgm.paused);
    await page.evaluate(() => a.setEnabled(false));
    assert.equal(await page.evaluate(() => a.bgm.paused), true);
    assert.deepEqual(errors, []);
    for (const file of ['js/Audio.js', 'main.js', ...fs.readdirSync(path.join(root, 'public/audio')).map(x => 'public/audio/' + x)]) {
      assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(root, 'www', file))));
      assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(root, 'ios/App/App/public', file))));
    }
    console.log('PASS: Chromium BGM and all WAV files play; 3 recording modes, pause/resume, OFF, source/www/iOS byte parity.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
