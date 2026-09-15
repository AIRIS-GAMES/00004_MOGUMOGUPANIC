const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
assert.deepEqual(fs.readdirSync(path.join(root, 'public/audio')).sort(),
  ['button.wav', 'clear.wav', 'suction-1.wav', 'timeup.wav'], 'Only active SFX assets remain');
let saved = false;
class Media {
  constructor(src) { this.src = src; this.paused = true; this.log = []; this.ended = false; }
  pause() { this.log.push('pause'); this.paused = true; }
  set currentTime(v) { this.log.push('seek:' + v); }
  play() { this.log.push('play'); this.paused = false; this.ended = false; return Promise.resolve(); }
  end() { this.paused = true; this.ended = true; }
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
  assert.deepEqual(a.sfx['pop-1'].log, ['pause', 'seek:0', 'play']);
  assert.deepEqual(Object.keys(a.sfx).filter(n => n.startsWith('pop-')), ['pop-1']);
  await new Promise(resolve => setImmediate(resolve));
  for (const count of [1, 5, 9, 14, 100]) {
    clock += 20; a.pop(count); flushFrame();
    assert.deepEqual(a.sfx['pop-1'].log, ['pause', 'seek:0', 'play'], 'Combo changes never restart a playing hit');
  }
  assert.equal(frames.size, 0);
  a.sfx['pop-1'].end();
  clock = 320; flushFrame();
  assert.equal(a.sfx['pop-1'].log.length, 3, 'No backlog after end');
  clock = 330; a.pop(1); flushFrame();
  assert.equal(a.sfx['pop-1'].paused, false);
  a.setBackgroundPaused(true);
  a.setBackgroundPaused(false);
  assert.equal(a.sfx['pop-1'].paused, true);
  a.grow(); a.vacuum(); a.timeup();
  assert.ok(Object.values(a.sfx).filter(x => !x.paused).length <= 2);
  a.sfx.clear.log = [];
  a.pop(4); a.clear();
  assert.equal(frames.size, 0, 'Clear cancels pending pickup');
  assert.deepEqual(a.sfx.clear.log, ['pause', 'seek:0', 'play']);
  assert.equal(a.voices.length, 1, 'Clear fanfare replaces overlapping effects');
  const clearLog = a.sfx.clear.log.length;
  a.clear(); a.grow(); a.pop(10); flushFrame();
  assert.equal(a.sfx.clear.log.length, clearLog, 'Clear fanfare is neither restarted nor interrupted');
  assert.equal(a.voices.length, 1);
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
  a.setBackgroundPaused(false);
  clock = 1000;
  assert.equal(a.sfx.grow, undefined, 'Growth cue is not loaded');
  assert.equal(a.sfx.vacuum, undefined, 'Vacuum cue is not loaded');
  assert.equal(Object.keys(a.sfx).length, 4, 'Only four SFX media elements plus music');
  const beforeDisabled = Object.values(a.sfx).map(media => media.log.length);
  for (let i = 0; i < 100; i++) { a.grow(); a.vacuum(); }
  assert.deepEqual(Object.values(a.sfx).map(media => media.log.length), beforeDisabled, 'Disabled cues perform no media operations');
  assert.equal(a.playSfx('grow'), false);
  assert.equal(a.playSfx('vacuum'), false);
  let rejectPending;
  const pending = a.sfx.button;
  pending.play = () => new Promise((_resolve, reject) => { rejectPending = reject; });
  clock = 2000; a.button();
  const pendingLog = pending.log.length;
  clock = 2400; a.button();
  assert.equal(pending.log.length, pendingLog, 'Unresolved playback is also busy');
  rejectPending(Error('blocked'));
  await new Promise(resolve => setImmediate(resolve));
  a.button();
  assert.equal(pending.log.length, pendingLog + 2, 'Rejected playback may retry');
  rejectPending(Error('blocked'));
  await new Promise(resolve => setImmediate(resolve));
  for (const [name, audio] of Object.entries(a.sfx)) {
    assert.ok(audio.volume >= .3 && audio.volume <= .7);
    const wav = fs.readFileSync(path.join(root, audio.src));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(24), 44100);
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    assert.ok(peak >= 10485 && peak <= 10486, 'Audible, consistent file peak without clipping');
    if (name.startsWith('pop-')) {
      const samples = (wav.length - 44) / 2;
      assert.equal(samples, Math.ceil(44100 * .14), 'One short 140 ms pickup hit');
      let energy = 0;
      for (let i = 0; i < samples; i++) energy += (wav.readInt16LE(44 + i * 2) / 32768) ** 2;
      const rms = Math.sqrt(energy / samples);
      assert.ok(rms > .08 && rms < .10, 'Fuller pickup body with bounded average level');
      for (let i = Math.round(.121 * 44100); i < samples; i++) {
        assert.equal(wav.readInt16LE(44 + i * 2), 0, 'A quiet tail keeps pops distinct and the loop seam silent');
      }
    }
  }
  assert.equal(a.bgm.volume, .2);
  const capped = new AudioSys(); capped.unlock();
  capped.button(); capped.pop(8); flushFrame();
  await new Promise(resolve => setImmediate(resolve));
  const beforeCap = capped.voices.map(media => media.log.length);
  assert.equal(capped.voices.length, 2);
  assert.equal(capped.playSfx('timeup'), false);
  assert.deepEqual(capped.voices.map(media => media.log.length), beforeCap, 'Other effects do not interrupt playing voices');
  capped.grow(); capped.vacuum();
  assert.deepEqual(capped.voices.map(media => media.log.length), beforeCap, 'Disabled cues never interrupt pickups');
  assert.equal(capped.sfx.thud, undefined);
  assert.equal(capped.sfx['pop-1'].paused, false);
  capped.pauseAll();
  const pitches = [];
  capped.playSfx = name => { pitches.push(name); return true; };
  for (const combo of [1, 4, 5, 8, 9, 13, 14, 100]) { capped.stopPickup(); clock += 200; capped.pop(combo); flushFrame(); }
  assert.deepEqual(pitches, Array(8).fill('pop-1'), 'All combo counts use one low tone');
  capped.stopPickup();
  const tail = new AudioSys(); tail.unlock();
  clock = 5000; tail.pop(1); flushFrame();
  await new Promise(resolve => setImmediate(resolve));
  clock = 5050; tail.pop(5); tail.pop(14); flushFrame();
  assert.equal(frames.size, 0, 'Only pickup events schedule audio work');
  clock = 5150; flushFrame();
  assert.equal(tail.sfx['pop-1'].paused, false, 'Intervening pickups do not cut off the hit');
  assert.equal(tail.sfx['pop-14'], undefined);
  assert.equal(tail.sfx['pop-5'], undefined);
  await new Promise(resolve => setImmediate(resolve));
  tail.sfx['pop-1'].end();
  clock = 5160; tail.pop(5); flushFrame();
  clock = 5400; flushFrame();
  assert.equal(tail.sfx['pop-1'].paused, false);
  assert.equal(frames.size, 0, 'No queued backlog after hits');
  assert.equal(tail.sfx['pop-1'].log.filter(x => x === 'play').length, 2);
  tail.pauseAll();
  const delayed = new AudioSys(); delayed.unlock();
  const pickup = delayed.sfx['pop-1'];
  let startPlayback, rejectPlayback;
  pickup.play = () => {
    pickup.log.push('play');
    return new Promise((resolve, reject) => {
      startPlayback = () => { pickup.paused = false; resolve(); };
      rejectPlayback = reject;
    });
  };
  clock = 6000; delayed.pop(1); flushFrame();
  clock = 6350; flushFrame();
  assert.equal(delayed.activePop, pickup, 'Do not cancel delayed playback at the 180 ms pickup deadline');
  delayed.pop(5); flushFrame();
  assert.equal(pickup.log.filter(x => x === 'play').length, 1, 'Waiting never retries play');
  assert.equal(delayed.sfx['pop-1'].log.filter(x => x === 'play').length, 1, 'Do not abort a pending media start or queue missed hits');
  startPlayback(); await new Promise(resolve => setImmediate(resolve));
  clock = 6480; flushFrame();
  assert.equal(pickup.paused, false, 'A delayed single pickup gets a complete first pulse');
  clock = 6490; flushFrame();
  assert.equal(pickup.paused, false, 'No timer cuts playback short; media ends naturally');
  assert.equal(frames.size, 0);
  pickup.end();
  clock = 7000; delayed.pop(1); flushFrame();
  const rejectStuck = rejectPlayback;
  clock = 8500; delayed.pop(1); flushFrame();
  const currentToken = delayed.pendingPlays.get(pickup);
  rejectStuck(Error('cancelled')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(delayed.pendingPlays.get(pickup), currentToken, 'A new pickup can replace a stuck start; old rejection cannot cancel the new start');
  rejectPlayback(Error('blocked')); await new Promise(resolve => setImmediate(resolve));
  clock = 9000; delayed.pop(1); flushFrame();
  rejectPlayback(Error('blocked')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(frames.size, 0, 'Rejected pickup is not retried every frame');
  assert.equal(delayed.activePop, null);
  clock = 10000; delayed.pop(1); flushFrame();
  const settleOld = startPlayback;
  delayed.stopPickup();
  // Resolve the cancelled request without simulating an impossible native restart.
  const oldPause = pickup.paused;
  settleOld(); pickup.paused = oldPause;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(delayed.activePop, null, 'Late completion cannot revive a cancelled pickup');
  for (const stop of [() => delayed.setEnabled(false), () => delayed.setBackgroundPaused(true), () => delayed.clear()]) {
    delayed.setEnabled(true); delayed.setBackgroundPaused(false);
    clock += 2000; delayed.pop(1); flushFrame();
    stop();
    assert.equal(delayed.activePop, null, 'OFF, background and results override minimum playback');
    rejectPlayback(Error('cancelled')); await new Promise(resolve => setImmediate(resolve));
  }
  delayed.pauseAll();
  const continuous = new AudioSys(); continuous.unlock();
  clock = 20000; continuous.pop(1); flushFrame();
  await new Promise(resolve => setImmediate(resolve));
  for (let count = 2; count <= 20; count++) {
    clock += 160;
    continuous.activePop.end();
    continuous.pop(count); flushFrame();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(continuous.activePop.paused, false);
    assert.equal(continuous.activePop.loop, false);
    assert.ok(continuous.voices.length <= 2);
  }
  const starts = () => Object.values(continuous.sfx).reduce((n, media) => n + media.log.filter(x => x === 'play').length, 0);
  assert.equal(starts(), 20, 'Each separately completed pickup frame starts a short hit');
  for (let i = 0; i < 10; i++) { clock += 100; flushFrame(); }
  assert.equal(starts(), 20, 'A lingering combo never restarts the pickup track');
  assert.equal(frames.size, 0);
  continuous.pauseAll();
  const dense = new AudioSys(); dense.unlock();
  clock = 25000; dense.pop(1); flushFrame();
  await new Promise(resolve => setImmediate(resolve));
  const denseTrack = dense.activePop;
  for (let i = 1; i <= 100; i++) { clock++; dense.pop(i); flushFrame(); }
  assert.deepEqual(denseTrack.log, ['pause', 'seek:0', 'play'], '100 collections do not restart the playing hit');
  assert.equal(frames.size, 0);
  denseTrack.end();
  clock += 100; flushFrame();
  assert.equal(denseTrack.log.length, 3, 'End does not replay skipped pickups');
  dense.pop(20); flushFrame();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dense.sfx['pop-1'].log.filter(x => x === 'play').length, 2, 'Fresh post-end collection uses the same low tone');
  dense.activePop.end();
  clock += 200; dense.pop(20); flushFrame();
  assert.equal(dense.sfx['pop-1'].log.filter(x => x === 'play').length, 3, 'Same pitch can play again after ending');
  dense.pauseAll();
  const bonusAudio = new AudioSys(); bonusAudio.unlock();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bonusAudio.bonusBgm, null, 'Normal builds do not load collaboration music');
  bonusAudio.prepareBonusMusic();
  const theme = bonusAudio.bonusBgm;
  assert.equal(theme.volume, .2);
  assert.equal(theme.loop, false, 'Trimmed theme must not loop at the bonus boundary');
  const themeWav = fs.readFileSync(path.join(root, decodeURIComponent(theme.src)));
  assert.equal(themeWav.readUInt16LE(22), 2);
  assert.equal(themeWav.readUInt32LE(24), 48000);
  assert.equal(themeWav.readUInt16LE(34), 16);
  assert.equal(themeWav.readUInt32LE(40) / themeWav.readUInt32LE(28), 8.65);
  assert.equal(themeWav.readInt16LE(themeWav.length - 4), 0);
  assert.equal(themeWav.readInt16LE(themeWav.length - 2), 0);
  assert.ok(decodeURIComponent(theme.src).endsWith('ゲームショーのテーマ.wav'));
  bonusAudio.pop(1); flushFrame();
  bonusAudio.setBonusMusic(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bonusAudio.activePop, null, 'Bonus entry immediately cancels pickups');
  assert.equal(bonusAudio.bgm.paused, true);
  assert.equal(theme.paused, false);
  const themeStarts = () => theme.log.filter(x => x === 'play').length;
  bonusAudio.setBonusMusic(true); bonusAudio.unlock();
  assert.equal(themeStarts(), 1, 'Repeated bonus/unlock never duplicates music');
  theme.end(); bonusAudio.unlock();
  assert.equal(themeStarts(), 1, 'A tap at the end of the trimmed theme cannot restart it');
  theme.ended = false; // Restore the in-progress state for pause/resume checks.
  const logs = Object.values(bonusAudio.sfx).map(x => x.log.length);
  for (let i = 0; i < 100; i++) { clock += 100; bonusAudio.pop(i, true); bonusAudio.pop(i); flushFrame(); }
  assert.deepEqual(Object.values(bonusAudio.sfx).map(x => x.log.length), logs, 'No pickup audio during bonus music');
  bonusAudio.setMusicPaused(true);
  assert.equal(theme.paused, true);
  const seeks = theme.log.filter(x => x.startsWith('seek:')).length;
  bonusAudio.setMusicPaused(false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(theme.log.filter(x => x.startsWith('seek:')).length, seeks, 'Pause resumes without rewinding');
  bonusAudio.setBackgroundPaused(true);
  assert.equal(theme.paused, true);
  bonusAudio.setBackgroundPaused(false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(theme.paused, false);
  assert.equal(bonusAudio.bgm.paused, true);
  bonusAudio.setEnabled(false); bonusAudio.setBonusMusic(false);
  assert.equal(theme.paused, true);
  assert.equal(bonusAudio.bgm.paused, true, 'Bonus end respects saved OFF');
  bonusAudio.setEnabled(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bonusAudio.bgm.paused, false);
  bonusAudio.setBonusMusic(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(theme.log.filter(x => x.startsWith('seek:')).length, seeks + 1, 'Next bonus restarts the song');
  bonusAudio.setBonusMusic(false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(theme.paused, true);
  assert.equal(bonusAudio.bgm.paused, false);
  bonusAudio.pop(1); flushFrame();
  assert.ok(bonusAudio.activePop, 'Normal pickup returns after bonus');
  bonusAudio.pauseAll();
  // pauseAll() clears pendingPlays, so the safety pause on resolve must not be
  // conditional on the token: a start that lands after OFF/background stays off.
  const late = new AudioSys(); late.unlock();
  const lateMedia = late.sfx.button;
  let settleLate;
  lateMedia.play = () => {
    lateMedia.log.push('play');
    return new Promise(resolve => { settleLate = () => { lateMedia.paused = false; resolve(); }; });
  };
  clock = 50000;
  for (const [stop, resume, label] of [
    [() => late.setBackgroundPaused(true), () => late.setBackgroundPaused(false), 'background'],
    [() => late.setEnabled(false), () => late.setEnabled(true), 'SOUND OFF'],
  ]) {
    clock += 1000; late.button();
    assert.equal(lateMedia.paused, true, 'Mock start has not completed yet');
    stop();
    settleLate();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lateMedia.paused, true, 'A late play() resolve cannot escape ' + label);
    resume();
  }
  late.pauseAll();
  // A start that never settles must not silence every cue for the rest of the
  // session: the fanfare gate releases once it is older than START_TIMEOUT.
  const stuck = new AudioSys(); stuck.unlock();
  const stuckClear = stuck.sfx.clear;
  stuckClear.play = () => { stuckClear.log.push('play'); return new Promise(() => {}); };
  clock = 60000; stuck.clear();
  assert.equal(stuckClear.log.filter(x => x === 'play').length, 1);
  clock = 60100; stuck.pop(1); flushFrame();
  assert.equal(stuck.sfx['pop-1'].log.length, 0, 'A fanfare still starting holds the lane');
  clock = 60000 + AudioSys.START_TIMEOUT; stuck.pop(1); flushFrame();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stuck.sfx['pop-1'].log.filter(x => x === 'play').length, 1,
    'A start stuck past START_TIMEOUT never silences the game permanently');
  stuck.pauseAll();
  // Restoring combo pitches before their media elements exist must stay silent.
  const missing = new AudioSys(); missing.unlock();
  clock = 70000; missing.pop(1); missing.pendingCombo = 7; flushFrame();
  assert.equal(missing.activePop, null, 'An unloaded pitch stays silent instead of throwing');
  assert.equal(frames.size, 0);
  missing.pauseAll();
  assert.ok(a.bgm.volume + 2 * .32 * Math.max(...Object.values(a.sfx).map(x => x.volume)) < .9);
  console.log('PASS: file audio, restart order, voice cap, BGM singleton, lifecycle, saved OFF, WAV peaks, late/stuck starts.');
})().catch(error => { console.error(error); process.exitCode = 1; });
