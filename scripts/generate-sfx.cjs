// Offline PCM renderer. Never shipped or executed by the game.
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../public/audio');
fs.mkdirSync(out, { recursive: true });
const rate = 44100;
let seed = 123456;
function noise() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; }
function render(name, duration, tones, noises = []) {
  const data = new Float64Array(Math.ceil(duration * rate));
  for (const [wave, f0, f1, dur, vol, delay = 0] of tones) {
    let phase = 0;
    for (let i = 0; i < dur * rate; i++) {
      const t = i / rate, x = t / dur;
      phase += 2 * Math.PI * f0 * Math.pow((f1 || f0) / f0, x) / rate;
      let v = 0;
      // Band-limited additive approximations avoid sharp digital edges.
      for (let h = 1; h <= (wave === 'sine' ? 1 : 15); h++) {
        if ((wave === 'square' || wave === 'triangle') && h % 2 === 0) continue;
        const gain = wave === 'triangle' ? Math.pow(-1, (h - 1) / 2) / (h * h) : 1 / h;
        v += Math.sin(phase * h) * gain;
      }
      const envelope = vol * Math.pow(.001 / vol, x) * Math.min(1, t / .003) * Math.min(1, (dur - t) / .005);
      const index = Math.round(delay * rate) + i;
      if (index < data.length) data[index] += v * envelope;
    }
  }
  for (const [dur, vol, f0, f1 = f0, q = 1] of noises) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < dur * rate; i++) {
      const t = i / rate, w = 2 * Math.PI * f0 * Math.pow(f1 / f0, t / dur) / rate;
      const alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
      const x = noise(), y = (alpha * x - alpha * x2 + 2 * Math.cos(w) * y1 - (1 - alpha) * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      data[i] += y * vol * Math.pow(.001 / vol, t / dur) * Math.min(1, t / .003) * Math.min(1, (dur - t) / .005);
    }
  }
  const peak = data.reduce((v, x) => Math.max(v, Math.abs(x)), 0);
  const gain = .32 / (peak || 1);
  const wav = Buffer.alloc(44 + data.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => wav.writeInt16LE(Math.round(v * gain * 32767), 44 + i * 2));
  fs.writeFileSync(path.join(out, name + '.wav'), wav);
}
for (let i = 1; i <= 14; i++) {
  const pitch = 380 * Math.pow(1.06, i);
  render('pop-' + i, .14, [['triangle', pitch, pitch * 1.6, .12, .55]], [[.06, .18, 2500]]);
}
render('grow', .36, [['sine', 523, 523, .12, .4], ['sine', 659, 659, .12, .4, .07], ['sine', 784, 784, .2, .45, .14]]);
render('button', .09, [['square', 620, 880, .07, .25]]);
render('thud', .12, [['sine', 150, 70, .1, .3]]);
render('vacuum', .72, [['sawtooth', 180, 720, .55, .22]], [[.7, .35, 400, 3000, 2]]);
render('timeup', .88, [['triangle', 660, 660, .2, .5], ['triangle', 520, 520, .2, .5, .22], ['triangle', 392, 392, .42, .55, .44]]);
console.log('Generated 19 mono PCM WAV files, 44.1 kHz / 16 bit, peak <= 0.32.');
