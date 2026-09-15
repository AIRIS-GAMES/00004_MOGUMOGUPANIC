const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (name === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<button id="start">Audio test</button><script>const Storage={getSound:()=>true,setSound:()=>{}};</script><script src="/js/Audio.js"></script><script>const a=new AudioSys();document.querySelector("button").onclick=()=>a.unlock();</script>');
    return;
  }
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', file.endsWith('.wav') ? 'audio/wav' : file.endsWith('.mp3') ? 'audio/mpeg' : 'text/javascript; charset=utf-8');
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
    const simplified = await page.evaluate(() => {
      let starts = 0;
      const media = Object.values(a.sfx);
      const original = media.map(item => item.play.bind(item));
      media.forEach((item, i) => { item.play = () => { starts++; return original[i](); }; });
      a.grow(); a.vacuum();
      media.forEach((item, i) => { item.play = original[i]; });
      return { names: Object.keys(a.sfx).sort(), starts };
    });
    assert.deepEqual(simplified, { names: ['button', 'clear', 'pop-1', 'timeup'], starts: 0 });
    for (const name of await page.evaluate(() => Object.keys(a.sfx))) {
      await page.evaluate(name => a.playSfx(name), name);
      await page.waitForFunction(name => a.sfx[name].currentTime > 0 && !a.sfx[name].error, name);
      await page.waitForFunction(name => a.sfx[name].ended, name);
    }
    const hits = await page.evaluate(async () => {
      const pickups = Object.values(a.sfx).filter(media => media.isPickup);
      const originals = pickups.map(media => media.play.bind(media));
      const pauses = pickups.map(media => media.pause.bind(media));
      let starts = 0, interruptions = 0, endings = 0;
      const onEnded = () => { endings++; };
      pickups.forEach((media, i) => { media.play = () => { starts++; return originals[i](); }; });
      pickups.forEach((media, i) => {
        media.addEventListener('ended', onEnded);
        media.pause = () => {
          if (!media.paused && !media.ended) interruptions++;
          return pauses[i]();
        };
      });
      for (let i = 0; i < 12; i++) { a.pop(i + 1); await new Promise(resolve => setTimeout(resolve, 120)); }
      await new Promise(resolve => setTimeout(resolve, 300));
      const stopped = pickups.every(media => media.paused && !media.loop);
      pickups.forEach((media, i) => {
        media.play = originals[i]; media.pause = pauses[i];
        media.removeEventListener('ended', onEnded);
      });
      return { starts, stopped, interruptions, endings };
    });
    assert.ok(hits.starts > 0 && hits.starts < 12, JSON.stringify(hits));
    assert.equal(hits.stopped, true);
    assert.equal(hits.interruptions, 0, 'Consecutive pickups never pause active media');
    assert.equal(hits.endings, hits.starts, 'Every started hit plays to its natural end');
    const delayedPickup = await page.evaluate(async () => {
      const media = a.sfx['pop-1'], original = media.play.bind(media);
      let starts = 0, startedAt = null;
      media.play = async () => {
        starts++;
        await new Promise(resolve => setTimeout(resolve, 350));
        await original();
        startedAt = performance.now();
      };
      const stopped = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Delayed pickup did not finish')), 3000);
        const onPause = () => {
          if (startedAt === null) return;
          clearTimeout(timeout);
          media.removeEventListener('ended', onPause);
          resolve({ starts, elapsed: performance.now() - startedAt, played: media.currentTime });
        };
        media.addEventListener('ended', onPause);
      });
      a.pop(1);
      try { return await stopped; } finally { media.play = original; }
    });
    assert.equal(delayedPickup.starts, 1);
    assert.ok(delayedPickup.elapsed >= 135 && delayedPickup.elapsed < 1000, JSON.stringify(delayedPickup));
    assert.ok(delayedPickup.played >= .1, 'Delayed single pickup actually advances through its first pulse');
    await page.evaluate(() => { a.prepareBonusMusic(); a.setBonusMusic(true); });
    await page.waitForFunction(() => a.bonusBgm.currentTime > .1 && !a.bonusBgm.paused);
    assert.equal(await page.evaluate(() => a.bgm.paused), true);
    const bonusSilence = await page.evaluate(async () => {
      const pickup = a.sfx['pop-1'], before = pickup.currentTime;
      for (let i = 0; i < 40; i++) { a.pop(i, true); a.pop(i); }
      await new Promise(resolve => setTimeout(resolve, 250));
      return pickup.paused && pickup.currentTime === before && a.activePop === null;
    });
    assert.equal(bonusSilence, true);
    const position = await page.evaluate(() => { a.setMusicPaused(true); return a.bonusBgm.currentTime; });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => a.bonusBgm.paused && a.bgm.paused), true);
    await page.evaluate(() => a.setMusicPaused(false));
    await page.waitForFunction(position => a.bonusBgm.currentTime > position, position);
    await page.evaluate(() => a.setBackgroundPaused(true));
    assert.equal(await page.evaluate(() => a.bonusBgm.paused && a.bgm.paused), true);
    await page.evaluate(() => a.setBackgroundPaused(false));
    await page.waitForFunction(() => !a.bonusBgm.paused);
    await page.evaluate(() => a.setBonusMusic(false));
    await page.waitForFunction(() => a.bonusBgm.paused && !a.bgm.paused);
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
    for (const base of ['www', 'ios/App/App/public']) {
      assert.deepEqual(fs.readdirSync(path.join(root, base, 'public/audio')).sort(),
        fs.readdirSync(path.join(root, 'public/audio')).sort(), 'No obsolete effects remain in generated assets');
    }
    for (const file of ['js/Audio.js', 'main.js', 'public/ゲームショーのテーマ.wav', ...fs.readdirSync(path.join(root, 'public/audio')).map(x => 'public/audio/' + x)]) {
      assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(root, 'www', file))));
      assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(root, 'ios/App/App/public', file))));
    }
    console.log('PASS: Chromium BGM and all WAV files play; 3 recording modes, pause/resume, OFF, source/www/iOS byte parity.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
