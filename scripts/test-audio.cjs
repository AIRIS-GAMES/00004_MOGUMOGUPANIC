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
let clock = 0, frameId = 0;
const frames = new Map();
const flushFrame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(clock)); };
const ctx = vm.createContext({ Audio: Media, document,
  performance: { now: () => clock },
  requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
  cancelAnimationFrame: id => frames.delete(id),
  Storage: { getSound: () => saved, setSound: v => { saved = v; } } });
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
  for (let i = 1; i <= 100; i++) a.pop(i);
  assert.equal(frames.size, 1);
  flushFrame();
  assert.deepEqual(a.sfx['pop-14'].log, ['pause', 'seek:0', 'play']);
  assert.equal(a.sfx['pop-1'].log.length, 0);
  clock = 40; a.pop(1); flushFrame();
  assert.equal(a.sfx['pop-1'].log.length, 0, 'Enforce 80ms minimum interval');
  clock = 80; a.pop(1); flushFrame();
  assert.equal(a.sfx['pop-14'].paused, true);
  assert.equal(a.sfx['pop-1'].paused, false);
  a.setBackgroundPaused(true);
  a.setBackgroundPaused(false);
  assert.equal(a.sfx['pop-1'].paused, true);
  a.grow(); a.vacuum(); a.thud(); a.timeup();
  assert.ok(Object.values(a.sfx).filter(x => !x.paused).length <= 3);
  a.sfx.clear.log = [];
  a.pop(4); a.clear();
  assert.equal(frames.size, 0, 'Clear cancels pending pickup');
  assert.deepEqual(a.sfx.clear.log, ['pause', 'seek:0', 'play']);
  assert.equal(a.voices.length, 1, 'Clear fanfare replaces overlapping effects');
  a.setBackgroundPaused(true, 'app');
  a.setBackgroundPaused(true, 'visibility');
  a.setBackgroundPaused(false, 'app');
  assert.equal(a.bgm.paused, true, 'One foreground signal cannot override another background signal');
  a.setBackgroundPaused(false, 'visibility');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.bgm.paused, false);
  assert.ok(Object.values(a.sfx).every(x => x.paused), 'No stale SFX on resume');
  a.setEnabled(false);
  const beforeOff = Object.values(a.sfx).reduce((sum, media) => sum + media.log.length, 0);
  for (let i = 0; i < 100; i++) a.pop(i);
  flushFrame();
  assert.equal(Object.values(a.sfx).reduce((sum, media) => sum + media.log.length, 0), beforeOff, 'OFF performs no pickup media operations');
  a.setBackgroundPaused(true); a.setBackgroundPaused(false);
  assert.equal(a.bgm.paused, true);
  assert.equal(new AudioSys().enabled, false);
  a.setEnabled(true); a.pop(3); a.setBackgroundPaused(true);
  assert.equal(frames.size, 0, 'Background cancels pending pickup');
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
