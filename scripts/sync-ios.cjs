// Preserve the current collaboration preview mode unless explicitly changed.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const preview = process.argv.includes('--collab-preview');
const normal = process.argv.includes('--normal');
if (preview && normal) throw new Error('Choose one sync mode.');
const html = path.join(root, 'www/index.html');
const existingPreview = fs.existsSync(html) && fs.readFileSync(html, 'utf8').includes('window.OHSUN_COLLAB_PREVIEW = true');
const keepPreview = preview || (!normal && existingPreview);
console.log(keepPreview ? 'コラボ有効版を同期します（開催期間の制限なし）。' : '開催設定に従う通常ビルドを同期します。');
for (const args of [
  [path.join(__dirname, 'build-web.js'), ...(keepPreview ? ['--collab-preview'] : [])],
  [path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'ios'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
