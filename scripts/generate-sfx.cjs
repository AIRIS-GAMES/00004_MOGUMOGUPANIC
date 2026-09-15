// Offline PCM renderer. Never shipped or executed by the game.
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../public/audio');
fs.mkdirSync(out, { recursive: true });
const rate = 44100;
function render(name, duration, tones) {
  const data = new Float64Array(Math.ceil(duration * rate));
  for (const [wave, f0, f1, dur, vol, delay = 0, tail = .001, hold = 0] of tones) {
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
      const decay = Math.max(0, t - hold) / (dur - hold);
      const envelope = vol * Math.pow(tail / vol, decay) * Math.min(1, t / .003) * Math.min(1, (dur - t) / .005);
      const index = Math.round(delay * rate) + i;
      if (index < data.length) data[index] += v * envelope;
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
render('button', .09, [['square', 620, 880, .07, .25]]);
render('timeup', .88, [['triangle', 660, 660, .2, .5], ['triangle', 520, 520, .2, .5, .22], ['triangle', 392, 392, .42, .55, .44]]);
// Bright ascending C-major chimes, resolving into a high major chord.
render('clear', 1.5, [
  ['triangle', 523.25, 523.25, .28, .3],
  ['triangle', 659.25, 659.25, .28, .3, .12],
  ['triangle', 783.99, 783.99, .3, .3, .24],
  ['sine', 1046.5, 1046.5, 1.05, .4, .4],
  ['sine', 1318.51, 1318.51, .95, .22, .4],
  ['sine', 1567.98, 1567.98, .85, .18, .4],
]);
// Short, non-looping pickup hits. Keep the existing asset URLs for all clients.
for (const level of [1]) {
  const pitch = 380 * Math.pow(1.06, level);
  // Keep each pop present longer, with a short upper chime for definition on
  // phone speakers. Both layers are baked into ONE file, not extra media voices.
  // A 20 ms quiet tail and unchanged peak leave headroom for BGM and other cues.
  const tones = [
    ['triangle', pitch, pitch * 1.6, .12, .55, 0, .04, .012],
    ['sine', pitch * 2, pitch * 2.4, .035, .12],
  ];
  render('suction-' + level, .14, tones);
}
console.log('Generated 4 active mono PCM WAV files, 44.1 kHz / 16 bit, peak <= 0.32.');
