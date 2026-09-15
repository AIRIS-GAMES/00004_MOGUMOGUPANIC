/* File-only audio. All playback uses HTMLAudioElement; synthesis is offline. */
class AudioSys {
  static SFX_INTERVAL = 80;    // Minimum gap before the same cue restarts [ms]
  static START_TIMEOUT = 1500; // A play() stuck this long may be replaced [ms]
  constructor() {
    this.enabled = Storage.getSound();
    this.unlocked = false;
    this.backgroundReasons = new Set(document.hidden ? ['visibility'] : []);
    this.bgm = new Audio('public/Neon%20Arcade.mp3');
    this.bgm.loop = true;
    this.bgm.preload = 'auto';
    this.bgm.volume = 0.20;
    this.bonusBgm = null;
    this.bonusMusicActive = false;
    this.musicPaused = false;
    this.musicPending = new Map();
    this.sfx = {};
    // Keep comparison cues unloaded, not merely muted: no extra media starts.
    const volumes = { button: .55, timeup: .7, clear: .7, 'pop-1': .7 };
    for (const [name, volume] of Object.entries(volumes)) {
      const file = name.startsWith('pop-') ? name.replace('pop-', 'suction-') : name;
      const audio = new Audio('public/audio/' + file + '.wav');
      audio.preload = 'auto';
      audio.volume = volume;
      audio.isPickup = name.startsWith('pop-');
      this.sfx[name] = audio;
    }
    this.voices = [];
    this.popFrame = null;
    this.activePop = null;
    this.pendingCombo = null;
    this.pendingPopAt = 0;
    this.pendingPlays = new Map();
    this.lastSfxAt = new Map();
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
    const music = this.bonusMusicActive ? this.bonusBgm : this.bgm;
    if (!this.ready || this.musicPaused || !music || !music.paused) return;
    if (this.bonusMusicActive && music.ended) return;
    const pending = this.musicPending.get(music);
    if (pending) { pending.retry = true; return; }
    const token = {};
    this.musicPending.set(music, token);
    try {
      Promise.resolve(music.play()).catch(() => {}).finally(() => {
        if (this.musicPending.get(music) === token) this.musicPending.delete(music);
        const selected = this.bonusMusicActive ? this.bonusBgm : this.bgm;
        if (!this.ready || this.musicPaused || music !== selected) music.pause();
        else if (token.retry) this.playBgm();
      });
    } catch (_) { this.musicPending.delete(music); }
  }
  prepareBonusMusic() {
    if (this.bonusBgm) return;
    this.bonusBgm = new Audio('public/' + encodeURIComponent('ゲームショーのテーマ.wav'));
    this.bonusBgm.preload = 'auto';
    this.bonusBgm.loop = false; // Theme is trimmed to the bonus duration.
    this.bonusBgm.volume = .20;
  }
  setBonusMusic(on) {
    on = Boolean(on);
    if (this.bonusMusicActive === on) return;
    this.stopPickup();
    this.bgm.pause();
    this.bonusBgm?.pause();
    this.bonusMusicActive = on;
    if (on) {
      this.prepareBonusMusic();
      try { this.bonusBgm.currentTime = 0; } catch (_) {}
    }
    this.playBgm();
  }
  setMusicPaused(paused) {
    this.musicPaused = Boolean(paused);
    if (this.musicPaused) { this.bgm.pause(); this.bonusBgm?.pause(); }
    else this.playBgm();
  }
  pauseAll() {
    this.stopPickup();
    this.bgm.pause();
    this.bonusBgm?.pause();
    for (const audio of Object.values(this.sfx)) {
      audio.pause();
      try { audio.currentTime = 0; } catch (_) {}
    }
    this.voices = [];
    this.pendingPlays.clear();
    this.lastSfxAt.clear();
  }
  setBackgroundPaused(paused, source = 'app') {
    if (paused) this.backgroundReasons.add(source);
    else this.backgroundReasons.delete(source);
    if (this.backgroundPaused) this.pauseAll();
    else this.playBgm();
  }
  isBusy(audio) {
    if (!audio) return false;
    // A media start that never settles must not silence a cue forever: after
    // START_TIMEOUT the lane is released and a later request may replace it.
    const pending = this.pendingPlays.get(audio);
    if (pending) return performance.now() - pending.at < AudioSys.START_TIMEOUT;
    return !audio.paused && !audio.ended;
  }
  playSfx(name) {
    if (!this.ready) return false;
    const audio = this.sfx[name];
    if (!audio || this.isBusy(audio)) return false;
    if (name !== 'clear' && this.isBusy(this.sfx.clear)) return false;
    const now = performance.now();
    if (now - (this.lastSfxAt.get(name) ?? -Infinity) < AudioSys.SFX_INTERVAL) return false;
    this.voices = this.voices.filter(item => this.isBusy(item));
    // Reserve one lane for pickups, one for other effects. Results explicitly
    // stop gameplay cues in finish(); ordinary effects never preempt pickups.
    if (!audio.isPickup) {
      const other = this.voices.find(item => !item.isPickup);
      if (other) return false;
    }
    if (this.voices.length >= 2) return false;
    audio.pause();
    const token = { at: now };
    try {
      audio.currentTime = 0;
      this.pendingPlays.set(audio, token);
      const promise = audio.play();
      Promise.resolve(promise).then(() => {
        // Always honour the current state: pauseAll()/finish() clear
        // pendingPlays, so a token check here would let a late resolve keep
        // playing after SOUND OFF or a background transition.
        if (this.pendingPlays.get(audio) === token) this.pendingPlays.delete(audio);
        if (!this.ready) audio.pause();
      }, () => {
        if (this.pendingPlays.get(audio) !== token) return;
        this.pendingPlays.delete(audio);
        if (audio === this.activePop) this.stopPickup();
      });
      this.lastSfxAt.set(name, now);
      this.voices.push(audio);
      return true;
    } catch (_) {
      this.pendingPlays.delete(audio);
      return false; // Retry blocked playback on a later user gesture.
    }
  }
  pop(combo = 1, bonus = false) {
    if (!this.ready) return;
    if (bonus || this.bonusMusicActive) return;
    if (this.pickupBusy()) return;
    this.pendingCombo = 1; // Fixed low pickup tone, independent of combo count.
    this.pendingPopAt = performance.now();
    this.queuePop();
  }
  pickupBusy() {
    // Let each hit finish, even if the combo count changes during playback.
    // isBusy() releases a start stuck past START_TIMEOUT to a later collection.
    return this.isBusy(this.activePop);
  }
  queuePop() {
    if (this.popFrame !== null) return;
    // One short hit per pickup frame; simultaneous collections share one hit.
    this.popFrame = requestAnimationFrame(() => {
      this.popFrame = null;
      const now = performance.now();
      if (!this.ready || this.bonusMusicActive || this.pendingCombo == null || now - this.pendingPopAt > 180) {
        this.stopPickup();
        return;
      }
      // Do not repeatedly abort a media start that has not completed yet.
      // Drop intervening hits rather than building a delayed sound backlog.
      if (this.pickupBusy()) {
        this.pendingCombo = null;
        return;
      }
      const name = 'pop-' + this.pendingCombo;
      const next = this.sfx[name];
      this.stopPickup();
      // Pitches outside the loaded set stay silent rather than throwing here.
      if (!next) return;
      // Only an idle/finished hit reaches here; never rewind a playing hit.
      next.loop = false;
      if (this.playSfx(name)) {
        this.activePop = next;
      }
      // Let the WAV end naturally, including when media startup was delayed.
    });
  }
  stopPickup() {
    if (this.popFrame !== null) cancelAnimationFrame(this.popFrame);
    this.popFrame = null;
    this.pendingCombo = null;
    if (this.activePop) {
      this.activePop.pause();
      this.activePop.loop = false;
      this.pendingPlays.delete(this.activePop);
      const index = this.voices.indexOf(this.activePop);
      if (index >= 0) this.voices.splice(index, 1);
      this.activePop = null;
    }
  }
  grow() {} // Temporarily disabled for iPhone audio-stutter comparison.
  button() { this.playSfx('button'); }
  vacuum() {} // Gameplay/visual activation remains unchanged.
  timeup() { this.finish('timeup'); }
  clear() { this.finish('clear'); }
  finish(name) {
    if (this.isBusy(this.sfx[name])) return;
    // Let the fanfare stand out; discard pickup sounds queued on the final frame.
    this.stopPickup();
    for (const audio of this.voices) audio.pause();
    this.voices = [];
    this.pendingPlays.clear();
    this.activePop = null;
    this.playSfx(name);
  }
}
