// Serve the web build over the LAN so a phone can open the current working tree.
// Development only: no caching, no TLS, bound to every interface on purpose.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp',
};
const server = http.createServer((req, res) => {
  let pathname;
  // A malformed percent-escape throws; answer 400 instead of killing the server.
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (_) { return res.writeHead(400).end(); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.resolve(root, '.' + pathname);
  // Keep every request inside the repository, '..' segments included.
  if (file !== root && !file.startsWith(root + path.sep)) return res.writeHead(403).end();
  // The repo root holds more than the game: never hand out .git, .claude,
  // editor state or dependencies just because they sit next to index.html.
  const segments = path.relative(root, file).split(path.sep);
  if (segments.some(part => part.startsWith('.') || part === 'node_modules')) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + pathname);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // Always re-fetch: the phone must see the latest edit, not a stale copy.
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});
server.listen(port, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces()).flat()
    .filter(a => a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log('MOGU MOGU PANIC - スマホから下の URL を開いてください');
  console.log('  PC:    http://localhost:' + port + '/');
  for (const address of addresses) console.log('  スマホ: http://' + address + ':' + port + '/');
  if (!addresses.length) console.log('  (LAN アドレスが見つかりません: Wi-Fi 接続を確認してください)');
  console.log('停止するには Ctrl+C');
});
