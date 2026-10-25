const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const args of [
  [path.join(__dirname, 'build-web.js')],
  [path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'ios'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
