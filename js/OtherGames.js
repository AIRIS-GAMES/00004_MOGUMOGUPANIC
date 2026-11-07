/* =========================================================
 * OtherGames.js - 「ほかのゲーム」画面
 *  タイトルの「ゲーム」から開く。コスミーのなかまのゲームを並べ、
 *  タップすると App Store(または Roblox)のページを開く。
 *  一覧は https://airis-games.com/ に載っているもの(このゲーム自身はのぞく)。
 *  アイコンは App Store のアプリアイコン(public/othergames/<アプリID>.jpg)。
 * ========================================================= */
class OtherGames {
  static LIST = [
    { name: 'Cosmii Rescue', sub: 'コスミーをたすけだせ', art: 'public/othergames/6811575619.jpg', url: 'https://apps.apple.com/jp/app/cosmii-rescue/id6811575619', face: 'public/opt/chara4_sub.webp', color: '#ff8a8a' },
    { name: 'ころがれ！Cosmii', sub: 'ころころ転がるアクション', art: 'public/othergames/6829253493.jpg', url: 'https://apps.apple.com/jp/app/%E3%81%93%E3%82%8D%E3%81%8C%E3%82%8C-cosmii/id6829253493', face: 'public/opt/chara3_sub.webp', color: '#9fdc7a' },
    { name: 'Cosmii Catch', sub: 'おちてくるものをキャッチ', art: 'public/othergames/6828976380.jpg', url: 'https://apps.apple.com/jp/app/cosmii-catch/id6828976380', face: 'public/opt/chara1_sub.webp', color: '#ffb3cf' },
    { name: 'Cosmii Cannon', sub: 'たいほうでとびだせ', art: 'public/othergames/6809099787.jpg', url: 'https://apps.apple.com/jp/app/cosmii-cannon/id6809099787', face: 'public/opt/chara5_sub.webp', color: '#c9a7ff' },
    { name: 'Cosmii Sudoku', sub: '論理パズル', art: 'public/othergames/6797260932.jpg', url: 'https://apps.apple.com/jp/app/cosmii-sudoku-%E8%AB%96%E7%90%86%E3%83%91%E3%82%BA%E3%83%AB/id6797260932', face: 'public/opt/chara2_sub.webp', color: '#8fd0ff' },
    { name: 'Cosmii Rhythm Dash', sub: 'リズムにのってダッシュ', art: 'public/othergames/6792287027.jpg', url: 'https://apps.apple.com/jp/app/cosmii-beat-dash-%E3%82%B3%E3%82%B9%E3%83%9F%E3%83%BC-%E3%83%80%E3%83%83%E3%82%B7%E3%83%A5/id6792287027', face: 'public/opt/chara4_sub.webp', color: '#ffc95a' },
    { name: 'Cosmii 3マッチパズル', sub: '星をそろえて消す', art: 'public/othergames/6784988703.jpg', url: 'https://apps.apple.com/jp/app/arcade-heaven-star-match/id6784988703', face: 'public/opt/chara1_sub.webp', color: '#ffd24d' },
    { name: 'Cosmii Racing', sub: 'ほしぞらレース', art: 'public/othergames/6800162558.jpg', url: 'https://apps.apple.com/jp/app/cosmii-racing-%E3%81%BB%E3%81%97%E3%81%9E%E3%82%89%E3%83%AC%E3%83%BC%E3%82%B9/id6800162558', face: 'public/opt/chara2_sub.webp', color: '#7fd6c9' },
    { name: 'Cosmii Arcade', sub: 'ミニゲームがいっぱい', art: 'public/othergames/6790154239.jpg', url: 'https://apps.apple.com/jp/app/cosmii-arcade-%E3%82%B3%E3%82%B9%E3%83%9F%E3%83%BC-%E3%82%A2%E3%83%BC%E3%82%B1%E3%83%BC%E3%83%88/id6790154239', face: 'public/opt/chara3_sub.webp', color: '#ff9f7a' },
    { name: 'バグ猫 -マージ-', sub: 'ブロックパズル', art: 'public/othergames/6806795192.jpg', url: 'https://apps.apple.com/jp/app/%E3%83%90%E3%82%B0%E7%8C%AB%E3%83%9E%E3%83%BC%E3%82%B8-%E3%83%96%E3%83%AD%E3%83%83%E3%82%AF%E3%83%91%E3%82%BA%E3%83%AB/id6806795192', face: '', icon: '🐱', color: '#b9a6ff' },
    { name: 'Hatch Yourself!', sub: 'Roblox で遊べる', url: 'https://www.roblox.com/ja/games/75278360141943/Hatch-Yourself', face: '', icon: '🥚', color: '#9be0f7', store: 'Roblox' },
  ];

  constructor(game) {
    this.game = game;
    this.el = document.getElementById('games');
    this.list = this.el.querySelector('.games-list');
    this.el.querySelector('.games-close').addEventListener('click', () => this.close());
    this.list.innerHTML = OtherGames.LIST.map((g, i) => `
      <a class="game-row" href="${g.url}" target="_blank" rel="noopener noreferrer" data-i="${i}" style="--gc:${g.color}">
        <span class="game-icon${g.art ? ' is-art' : ''}">${g.art ? `<img src="${g.art}" alt="" loading="lazy">` : g.face ? `<img src="${g.face}" alt="">` : `<span class="game-emoji" aria-hidden="true">${g.icon || '★'}</span>`}</span>
        <span class="game-text"><b></b><small></small></span>
        <span class="game-get">${g.store === 'Roblox' ? 'あそぶ' : '入手'}</span>
      </a>`).join('');
    this.list.querySelectorAll('.game-row').forEach(a => {
      const g = OtherGames.LIST[Number(a.dataset.i)];
      a.querySelector('b').textContent = g.name;
      a.querySelector('small').textContent = g.sub;
      a.setAttribute('aria-label', `${g.name}(${g.store || 'App Store'}で見る)`);
      a.addEventListener('click', e => this._open(e, g));
    });
  }

  open() { this.el.classList.remove('hidden'); this.list.scrollTop = 0; }
  close() { this.game.audio && this.game.audio.button && this.game.audio.button(); this.el.classList.add('hidden'); }

  /** アプリの中(Capacitor)ではSafari/App Storeで開く。ブラウザではふつうのリンクのまま */
  _open(e, g) {
    try { if (typeof Analytics !== 'undefined') Analytics.design(`othergame:${g.name}`); } catch (err) { /* 計測できなくても開く */ }
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
      e.preventDefault();
      const browser = cap.Plugins && cap.Plugins.Browser;
      if (browser && browser.open) browser.open({ url: g.url });
      else window.open(g.url, '_system');
    }
  }
}
