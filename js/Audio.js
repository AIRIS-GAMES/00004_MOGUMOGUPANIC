/* =========================================================
 * AudioSys - Web Audio API による効果音合成
 * 音声ファイルを使わず、すべてオシレーター+ノイズで生成する。
 * iOS/Android 対策として、最初のユーザー操作時に unlock() を
 * 呼んで AudioContext を再開する必要がある。
 * ========================================================= */
class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = Storage.getSound();
    this._noiseBuf = null;
    this.bgm = new Audio('public/Neon%20Arcade.mp3');
    this.bgm.loop = true;
    this.bgm.preload = 'auto';
    this.bgm.volume = 0.22;
    this.backgroundPaused = false;
  }

  /** 初回タップで呼ぶ。AudioContext の生成・再開 */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.playBgm(); return; }
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.playBgm();
  }

  setEnabled(on) {
    this.enabled = on;
    Storage.setSound(on);
    if (on) {
      this.unlock();
      this.playBgm();
    } else {
      this.bgm.pause();
    }
  }

  playBgm() {
    if (!this.enabled || this.backgroundPaused) return;
    const promise = this.bgm.play();
    if (promise) promise.catch(() => {});
  }

  setBackgroundPaused(paused) {
    this.backgroundPaused = paused;
    if (paused) this.bgm.pause();
    else this.playBgm();
  }

  get ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  /* ---- 低レベルヘルパー ---- */

  /** 単音を鳴らす。f1 を指定すると周波数スイープ */
  _tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.15, vol = 0.6, delay = 0 }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** ノイズを鳴らす(バンドパスで音色調整) */
  _noise({ dur = 0.2, vol = 0.3, freq = 1200, q = 1, delay = 0, sweepTo = null }) {
    if (!this.ready) return;
    if (!this._noiseBuf) {
      // 0.5秒分のホワイトノイズを使い回す
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---- ゲーム用効果音 ---- */

  /** 吸い込み成功(Pop音)。combo が上がるほどピッチも上がる */
  pop(combo = 1) {
    const pitch = 380 * Math.pow(1.06, Math.min(combo, 14));
    this._tone({ type: 'triangle', f0: pitch, f1: pitch * 1.6, dur: 0.12, vol: 0.55 });
    this._noise({ dur: 0.06, vol: 0.18, freq: 2500 });
  }

  /** 成長(サイズの整数値が上がった時) */
  grow() {
    this._tone({ type: 'sine', f0: 523, dur: 0.12, vol: 0.4 });
    this._tone({ type: 'sine', f0: 659, dur: 0.12, vol: 0.4, delay: 0.07 });
    this._tone({ type: 'sine', f0: 784, dur: 0.2, vol: 0.45, delay: 0.14 });
  }

  /** ボタン押下 */
  button() {
    this._tone({ type: 'square', f0: 620, f1: 880, dur: 0.07, vol: 0.25 });
  }

  /** サイズ不足で押し返した時の鈍い音 */
  thud() {
    this._tone({ type: 'sine', f0: 150, f1: 70, dur: 0.1, vol: 0.3 });
  }

  /** バキュームモード発動 */
  vacuum() {
    this._noise({ dur: 0.7, vol: 0.35, freq: 400, sweepTo: 3000, q: 2 });
    this._tone({ type: 'sawtooth', f0: 180, f1: 720, dur: 0.55, vol: 0.22 });
  }

  /** タイムアップ */
  timeup() {
    this._tone({ type: 'triangle', f0: 660, dur: 0.2, vol: 0.5 });
    this._tone({ type: 'triangle', f0: 520, dur: 0.2, vol: 0.5, delay: 0.22 });
    this._tone({ type: 'triangle', f0: 392, dur: 0.42, vol: 0.55, delay: 0.44 });
  }
}
