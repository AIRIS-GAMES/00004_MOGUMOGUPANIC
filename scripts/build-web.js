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
// Tests may only target a freshly allocated temporary directory, never www.
const OUT = process.argv.includes('--test-build')
  ? fs.mkdtempSync(path.join(require('os').tmpdir(), 'mogu-build-test-'))
  : path.join(ROOT, 'www');
const collaboration = require('../collaborations/ohsun.config.js');
const preview = process.argv.includes('--collab-preview');
const startsAt = Date.parse(collaboration.startsAt);
const endsAt = Date.parse(collaboration.endsAt);
const scheduled = Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt < endsAt;
if (collaboration.enabled && !preview &&
    (collaboration.startsAt !== null || collaboration.endsAt !== null) && !scheduled) {
  throw new Error('コラボ開始・終了日時を正しく指定してください。');
}
const includeCollaboration = collaboration.enabled && (collaboration.manual === true || preview || (scheduled && Date.now() < endsAt));

/** コピー対象。ファイル or ディレクトリ(glob不要の単純指定) */
const FILES = ['index.html', 'style.css', 'main.js'];
const DIRS = [
  { from: 'public/fonts', to: 'public/fonts', match: /\.(ttf|txt)$/i },
  { from: 'public/audio', to: 'public/audio', match: /\.wav$/i },
  { from: 'js', to: 'js', match: /\.js$/ },
  { from: 'public/opt', to: 'public/opt', match: /\.(webp|png|jpg)$/i },
];
// public 直下で個別に必要なBGM
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
  const htmlPath = path.join(OUT, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (!includeCollaboration) {
    html = html.replace(/<!-- OHSUN_COLLAB_START -->[\s\S]*?<!-- OHSUN_COLLAB_END -->\s*/g, '');
  } else {
    copyDir('collaborations', 'collaborations', /^ohsun\.(config\.js|js|css)$/);
    // 原本PNGをバイト列のままコピー。source/review/READMEは配布しない。
    copyDir('public/collaborations/ohsun/characters', 'public/collaborations/ohsun/characters', /^ohsun_09\.png$/);
    if (preview) html = html.replace('<script src="collaborations/ohsun.js">', '<script>window.OHSUN_COLLAB_PREVIEW = true;</script>\n<script src="collaborations/ohsun.js">');
  }
  fs.writeFileSync(htmlPath, html);
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
  console.log(`${OUT} を生成しました (${count} ファイル)`);
  console.log(includeCollaboration ? (preview ? 'コラボ確認用：一般公開しないでください。' : collaboration.manual ? 'コラボ有効版：手動終了まで有効。' : 'コラボ期間設定を含むビルド') : '通常版：コラボ素材・専用コードは含まれません。');
}

main();
module.exports = { out: OUT };
