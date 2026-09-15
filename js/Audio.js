/* File-only audio. All playback uses HTMLAudioElement; synthesis is offline. */
class AudioSys {
  constructor() {
    this.enabled = Storage.getSound();
    this.unlocked = false;
    this.backgroundReasons = new Set(document.hidden ? ['visibility'] : []);
    this.bgm = new Audio('public/Neon%20Arcade.mp3');
    this.bgm.loop = true;
    this.bgm.preload = 'auto';
    this.bgm.volume = 0.20;
    this.sfx = {};
    const volumes = { button: .55, thud: .55, grow: .7, vacuum: .6, timeup: .7, clear: .7 };
    for (let i = 1; i <= 14; i++) volumes['pop-' + i] = .7;
    for (const [name, volume] of Object.entries(volumes)) {
      const audio = new Audio('public/audio/' + name + '.wav');
      audio.preload = 'auto';
      audio.volume = volume;
      this.sfx[name] = audio;
    }
    this.voices = [];
    this.bgmPending = false;
    this.popFrame = null;
    this.lastPopAt = -Infinity;
    this.activePop = null;
  }
  get backgroundPaused() { return this.backgroundReasons.size > 0 || document.hidden; }
  get ready() { return this.enabled && this.unlocked && !this.backgroundPaused; }
  unlock() { this.unlocked = true; this.playBgm(); }
  setEnabled(on) {
    this.enabled = Boolean(on);
    Storage.setSound(this.enabled);
    if (this.enabled) this.unlock();
    else this.pauseAll();
  }
  playBgm() {
    if (!this.ready || !this.bgm.paused) return;
    if (this.bgmPending) { this.bgmRetry = true; return; }
    this.bgmPending = true;
    try {
      Promise.resolve(this.bgm.play()).catch(() => {}).finally(() => {
        this.bgmPending = false;
        if (!this.ready) this.bgm.pause();
        const retry = this.bgmRetry;
        this.bgmRetry = false;
        if (retry && this.ready) this.playBgm();
      });
    } catch (_) { this.bgmPending = false; }
  }
  pauseAll() {
    if (this.popFrame !== null) cancelAnimationFrame(this.popFrame);
    this.popFrame = null;
    this.activePop = null;
    this.lastPopAt = -Infinity;
    this.bgm.pause();
    for (const audio of Object.values(this.sfx)) {
      audio.pause();
      try { audio.currentTime = 0; } catch (_) {}
    }
    this.voices = [];
  }
  setBackgroundPaused(paused, source = 'app') {
    if (paused) this.backgroundReasons.add(source);
    else this.backgroundReasons.delete(source);
    if (this.backgroundPaused) this.pauseAll();
    else this.playBgm();
  }
  playSfx(name) {
    if (!this.ready) return;
    const audio = this.sfx[name];
    if (!audio) return;
    this.voices = this.voices.filter(item => item !== audio && !item.paused && !item.ended);
    while (this.voices.length >= 3) this.voices.shift().pause();
    audio.pause();
    try {
      audio.currentTime = 0;
      const promise = audio.play();
      if (promise) promise.then(() => { if (!this.ready) audio.pause(); }, () => {});
      this.voices.push(audio);
    } catch (_) { /* Retry blocked playback on a later user gesture. */ }
  }
  pop(combo = 1) {
    if (!this.ready) return;
    this.pendingCombo = Math.max(1, Math.min(14, Math.floor(combo)));
    if (this.popFrame !== null) return;
    // Coalesce one frame's pickups; never queue a backlog of obsolete sounds.
    this.popFrame = requestAnimationFrame(() => {
      this.popFrame = null;
      const now = performance.now();
      if (!this.ready || now - this.lastPopAt < 80) return;
      const name = 'pop-' + this.pendingCombo;
      const next = this.sfx[name];
      if (this.activePop && this.activePop !== next && !this.activePop.paused) this.activePop.pause();
      this.playSfx(name);
      this.activePop = next;
      this.lastPopAt = now;
    });
  }
  grow() { this.playSfx('grow'); }
  button() { this.playSfx('button'); }
  thud() { this.playSfx('thud'); }
  vacuum() { this.playSfx('vacuum'); }
  timeup() { this.playSfx('timeup'); }
  clear() {
    // Let the fanfare stand out; discard pickup sounds queued on the final frame.
    if (this.popFrame !== null) cancelAnimationFrame(this.popFrame);
    this.popFrame = null;
    for (const audio of this.voices) audio.pause();
    this.voices = [];
    this.activePop = null;
    this.playSfx('clear');
  }
}
