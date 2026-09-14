const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let saved = false;
class Media {
  constructor(src) { this.src = src; this.paused = true; this.log = []; this.ended = false; }
  pause() { this.log.push('pause'); this.paused = true; }
  set currentTime(v) { this.log.push('seek:' + v); }
  play() { this.log.push('play'); this.paused = false; return Promise.resolve(); }
}
const document = { hidden: false };
const ctx = vm.createContext({ Audio: Media, document, Storage: { getSound: () => saved, setSound: v => { saved = v; } } });
vm.runInContext(fs.readFileSync(path.join(root, 'js/Audio.js'), 'utf8'), ctx);
const AudioSys = vm.runInContext('AudioSys', ctx);
(async () => {
  const a = new AudioSys();
  a.unlock(); a.button();
  assert.equal(a.bgm.log.length, 0, 'Saved OFF must be respected');
  a.setEnabled(true);
  a.unlock(); a.unlock();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.bgm.log.filter(x => x === 'play').length, 1);
  a.button();
  assert.deepEqual(a.sfx.button.log, ['pause', 'seek:0', 'play']);
  a.pop(1); a.pop(14);
  assert.equal(a.sfx['pop-1'].paused, true);
  a.grow(); a.vacuum(); a.thud(); a.timeup();
  assert.ok(Object.values(a.sfx).filter(x => !x.paused).length <= 3);
  a.setBackgroundPaused(true, 'app');
  a.setBackgroundPaused(true, 'visibility');
  a.setBackgroundPaused(false, 'app');
  assert.equal(a.bgm.paused, true, 'One foreground signal cannot override another background signal');
  a.setBackgroundPaused(false, 'visibility');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.bgm.paused, false);
  assert.ok(Object.values(a.sfx).every(x => x.paused), 'No stale SFX on resume');
  a.setEnabled(false);
  a.setBackgroundPaused(true); a.setBackgroundPaused(false);
  assert.equal(a.bgm.paused, true);
  assert.equal(new AudioSys().enabled, false);
  for (const [name, audio] of Object.entries(a.sfx)) {
    assert.ok(audio.volume >= .3 && audio.volume <= .7);
    const wav = fs.readFileSync(path.join(root, 'public/audio', name + '.wav'));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(24), 44100);
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    assert.ok(peak >= 10485 && peak <= 10486, 'Audible, consistent file peak without clipping');
  }
  assert.equal(a.bgm.volume, .2);
  assert.ok(a.bgm.volume + 3 * .32 * Math.max(...Object.values(a.sfx).map(x => x.volume)) < .9);
  console.log('PASS: file audio, restart order, voice cap, BGM singleton, lifecycle, saved OFF, WAV peaks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
