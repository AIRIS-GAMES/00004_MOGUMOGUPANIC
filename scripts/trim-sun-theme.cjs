// Offline asset preparation. Never shipped; preserves PCM quality and channels.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const source = path.resolve(__dirname, '../public/ゲームショーのテーマ.wav');
const input = fs.readFileSync(source);
assert.equal(input.toString('ascii', 0, 4), 'RIFF');
assert.equal(input.toString('ascii', 8, 12), 'WAVE');
let fmt, pcm;
for (let offset = 12; offset + 8 <= input.length;) {
  const name = input.toString('ascii', offset, offset + 4);
  const length = input.readUInt32LE(offset + 4);
  assert.ok(offset + 8 + length <= input.length, 'Valid WAV chunk');
  if (name === 'fmt ') fmt = input.subarray(offset + 8, offset + 8 + length);
  if (name === 'data') pcm = input.subarray(offset + 8, offset + 8 + length);
  offset += 8 + length + length % 2;
}
assert.ok(fmt && pcm);
assert.equal(fmt.readUInt16LE(0), 1, 'Uncompressed PCM only');
assert.equal(fmt.readUInt16LE(14), 16, '16-bit samples only');
const channels = fmt.readUInt16LE(2), rate = fmt.readUInt32LE(4);
const frameBytes = fmt.readUInt16LE(12);
assert.equal(frameBytes, channels * 2);
const frames = Math.round(rate * 8.65); // Entry .65 s + active bonus 8 s.
if (pcm.length <= frames * frameBytes) {
  console.log('Theme already fits the bonus; no change.');
  process.exit(0);
}
const output = Buffer.alloc(44 + frames * frameBytes);
output.write('RIFF'); output.writeUInt32LE(output.length - 8, 4);
output.write('WAVEfmt ', 8); output.writeUInt32LE(16, 16);
fmt.copy(output, 20, 0, 16);
output.write('data', 36); output.writeUInt32LE(frames * frameBytes, 40);
pcm.copy(output, 44, 0, frames * frameBytes);
const fadeFrames = Math.round(rate * .15);
for (let frame = frames - fadeFrames; frame < frames; frame++) {
  const gain = (frames - 1 - frame) / (fadeFrames - 1);
  for (let channel = 0; channel < channels; channel++) {
    const offset = 44 + frame * frameBytes + channel * 2;
    output.writeInt16LE(Math.round(output.readInt16LE(offset) * gain), offset);
  }
}
assert.ok(output.subarray(44, 44 + (frames - fadeFrames) * frameBytes)
  .equals(pcm.subarray(0, (frames - fadeFrames) * frameBytes)), 'Audio before fade is unchanged');
for (let channel = 0; channel < channels; channel++) {
  assert.equal(output.readInt16LE(44 + (frames - 1) * frameBytes + channel * 2), 0);
}
// Recovery copy outside the repository/build; do not ship the long original.
const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mogu-theme-original-')), path.basename(source));
fs.copyFileSync(source, backup);
fs.writeFileSync(source, output);
assert.ok(fs.readFileSync(source).equals(output));
console.log(JSON.stringify({ seconds: frames / rate, beforeBytes: input.length, afterBytes: output.length, backup }));
