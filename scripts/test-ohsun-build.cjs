const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const configPath = require.resolve('../collaborations/ohsun.config.js');
const buildPath = require.resolve('./build-web.js');
const original = require(configPath);
const originalArgs = [...process.argv];
const args = [...originalArgs, '--test-build'];
function distributionSnapshot() {
  const crypto = require('node:crypto');
  const snapshot = {};
  for (const base of ['www', 'ios/App/App/public']) {
    const walk = directory => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else snapshot[file] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      }
    };
    walk(path.join(root, base));
  }
  return snapshot;
}
const distributionBefore = distributionSnapshot();
let output;
function build(config, preview = false) {
  require.cache[configPath].exports = config;
  process.argv = preview ? [...args, '--collab-preview'] : args;
  delete require.cache[buildPath];
  output = require(buildPath).out;
}
function normal() {
  assert.equal(fs.existsSync(path.join(output, 'collaborations')), false);
  assert.equal(fs.existsSync(path.join(output, 'public/collaborations')), false);
  assert.equal(fs.readFileSync(path.join(output, 'index.html'), 'utf8').includes('ohsun'), false);
}
try {
  build({ enabled: true, startsAt: null, endsAt: null }, true);
  for (let i = 7; i <= 13; i++) {
    const file = `public/collaborations/ohsun/characters/ohsun_${String(i).padStart(2, '0')}.png`;
    assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(output, file))), 'Original bytes preserved');
  }
  assert.deepEqual(fs.readdirSync(path.join(output, 'public/collaborations/ohsun')), ['characters']);
  build({ enabled: false, startsAt: null, endsAt: null }, true);
  normal();
  build({ enabled: true, startsAt: '2020-01-01T00:00:00+09:00', endsAt: '2020-02-01T00:00:00+09:00' });
  normal();
  build({ enabled: true, startsAt: '2090-01-01T00:00:00+09:00', endsAt: '2090-02-01T00:00:00+09:00' });
  assert.equal(fs.existsSync(path.join(output, 'public/collaborations/ohsun/characters')), true);
  assert.equal(fs.readFileSync(path.join(output, 'index.html'), 'utf8').includes('OHSUN_COLLAB_PREVIEW'), false);
  build({ enabled: true, startsAt: null, endsAt: null });
  normal();
  console.log('PASS: unchanged PNGs, allowlist, disabled preview, expired build, scheduled release, unset dates.');
} finally {
  require.cache[configPath].exports = original;
  process.argv = originalArgs;
  assert.deepEqual(distributionSnapshot(), distributionBefore, 'Build tests must preserve distribution and iOS assets');
}
