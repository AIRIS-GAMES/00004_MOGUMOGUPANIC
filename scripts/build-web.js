/* =========================================================
 * build-web.js
 * Web/Capacitor 共通の配信フォルダ www/ を組み立てる。
 * ソース(index.html / js / public/opt など)から、配信に
 * 必要なファイルだけをコピーする。node_modules や元PNG、
 * 開発用ツールは含めない。
 *
 *   使い方: node scripts/build-web.js
 *   出力:   www/
 *   用途:   Netlify デプロイ / `cap sync` の webDir
 * ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');

/** コピー対象。ファイル or ディレクトリ(glob不要の単純指定) */
const FILES = ['index.html', 'style.css', 'main.js'];
const DIRS = [
  { from: 'js', to: 'js', match: /\.js$/ },
  { from: 'public/opt', to: 'public/opt', match: /\.(webp|png|jpg)$/i },
];
// public 直下で個別に必要なもの(BGM・クロスプロモ画像)
const PUBLIC_FILES = ['Neon Arcade.mp3', 'star-match-icon.jpg'];

function rimraf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(fromRel, toRel, match) {
  const fromDir = path.join(ROOT, fromRel);
  const toDir = path.join(OUT, toRel);
  if (!fs.existsSync(fromDir)) return;
  fs.mkdirSync(toDir, { recursive: true });
  for (const name of fs.readdirSync(fromDir)) {
    if (match && !match.test(name)) continue;
    const src = path.join(fromDir, name);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(toDir, name));
  }
}

function main() {
  rimraf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  for (const f of FILES) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  }
  for (const d of DIRS) copyDir(d.from, d.to, d.match);

  fs.mkdirSync(path.join(OUT, 'public'), { recursive: true });
  for (const f of PUBLIC_FILES) {
    const src = path.join(ROOT, 'public', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, 'public', f));
  }

  // GameAnalytics SDK は js/ 配下なので DIRS のコピーに含まれる
  let count = 0;
  (function walk(dir) {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n);
      if (fs.statSync(p).isDirectory()) walk(p);
      else count++;
    }
  })(OUT);
  console.log(`www/ を生成しました (${count} ファイル)`);
}

main();
