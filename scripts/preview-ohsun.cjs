// Local-only collaboration preview. Run: node scripts/preview-ohsun.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lan = process.argv.includes('--lan');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
types['.wav'] = 'audio/wav';
types['.ttf'] = 'font/ttf';
// The first-party game recommendation is not an advertising SDK.
const allowed = /^\/(index\.html|style\.css|main\.js|js\/[^/]+\.js|collaborations\/ohsun\.(config\.js|js|css)|public\/(audio\/[a-z0-9-]+\.wav|opt\/[^/]+|Neon Arcade\.mp3|collaborations\/ohsun\/characters\/ohsun_\d+\.png))$/;
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, '.' + pathname);
  const fontFile = /^\/public\/fonts\/(MPLUSRounded1c-(Regular|Black)\.ttf|OFL\.txt)$/.test(pathname) || pathname === '/public/star-match-icon.jpg' || pathname === '/public/ゲームショーのテーマ.wav';
  if ((!allowed.test(pathname) && !fontFile) || !file.startsWith(root + path.sep)) {
    res.writeHead(404).end(); return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    // Explicit LAN preview only; production source/build remains date-gated.
    if (lan && pathname === '/index.html') data = Buffer.from(data.toString('utf8').replace('<script src="collaborations/ohsun.js">', '<script>window.OHSUN_COLLAB_PREVIEW = true;</script><script src="collaborations/ohsun.js">'));
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      const start = match ? Number(match[1]) : NaN;
      const end = match && match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
      if (!Number.isSafeInteger(start) || start < 0 || start > end) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${data.length}` }).end(); return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
      res.end(req.method === 'HEAD' ? undefined : data.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(4173, lan ? '0.0.0.0' : '127.0.0.1', () => console.log(lan ? 'LAN preview enabled on port 4173 (trusted network only).' : 'Preview: http://127.0.0.1:4173/?ohsun-preview=1'));
