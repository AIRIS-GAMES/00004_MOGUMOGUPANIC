/* =========================================================
 * HowTo.js - 「あそびかた」画面
 *  タイトルの「?」とポーズ画面から開く。タブで5ページ:
 *   きほん / たべもの / ちゅうい / ギミック / パワーアップ
 *  中身はゲームのデータ(物の種類・ギミック・バグ・ブースト)から作るので、
 *  ゲーム側を変えれば自動でそろう。絵もゲームと同じものを使う。
 * ========================================================= */
class HowTo {
  static NAMES = {
    flower: '花', coin: 'コイン', trash: 'ゴミ箱', barrel: 'ドラム缶', bench: 'ベンチ', tree: '木',
    signal: '信号', car: '車', house: '家', tower: 'ビル', shoppingBag: '買い物袋', officeChair: 'イス',
    crate: '木箱', buoy: 'ブイ', suitcase: 'スーツケース', drone: 'ドローン',
  };
  static TABS = [['basic', 'きほん'], ['food', 'たべもの'], ['care', 'ちゅうい'], ['gimmick', 'しかけ'], ['power', 'パワー']];

  constructor(game) {
    this.game = game;
    this.el = document.getElementById('howto');
    this.body = this.el.querySelector('.howto-body');
    this.tabs = this.el.querySelector('.howto-tabs');
    this.tab = 'basic';
    this.tabs.innerHTML = HowTo.TABS.map(([id, label]) => `<button type="button" class="howto-tab" data-tab="${id}">${label}</button>`).join('');
    this.tabs.addEventListener('click', e => {
      const b = e.target.closest('.howto-tab');
      if (!b) return;
      this.game.audio && this.game.audio.button && this.game.audio.button();
      this.show(b.dataset.tab);
    });
    this.el.querySelector('.howto-close').addEventListener('click', () => this.close());
  }

  open(tab = 'basic') {
    this.el.classList.remove('hidden');
    this.show(tab);
  }

  close() {
    this.game.audio && this.game.audio.button && this.game.audio.button();
    this.el.classList.add('hidden');
  }

  get isOpen() { return !this.el.classList.contains('hidden'); }

  show(tab) {
    this.tab = tab;
    for (const b of this.tabs.children) b.classList.toggle('on', b.dataset.tab === tab);
    this.body.innerHTML = this['_' + tab]();
    this.body.scrollTop = 0;
  }

  /* ---- 部品 ---- */

  _sprite(type) {
    try {
      const s = GameObject.getSprite(type);
      const c = s && (s.canvas || s);
      return c && c.toDataURL ? c.toDataURL() : '';
    } catch (e) { return ''; }
  }
  _canvasSrc(c) { try { return c && c.toDataURL ? c.toDataURL() : (c && c.src) || ''; } catch (e) { return ''; } }
  _svg(inner) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`; }
  _card(pic, name, sub, cls = '') {
    return `<div class="ht-card ${cls}"><div class="ht-pic">${pic}</div><b>${name}</b><span>${sub}</span></div>`;
  }
  _img(src) { return src ? `<img src="${src}" alt="">` : ''; }
  _section(title, inner, note = '') {
    return `<section class="ht-sec"><h3>${title}</h3>${note ? `<p class="ht-note">${note}</p>` : ''}<div class="ht-grid">${inner}</div></section>`;
  }

  /* ---- ページ ---- */

  _basic() {
    const skin = (typeof SKINS !== 'undefined' && SKINS[0]) || null;
    const face = skin ? skin.openSrc : '';
    const step = (n, pic, title, text) => `<div class="ht-step"><i>${n}</i><div class="ht-step-pic">${pic}</div><div><b>${title}</b><span>${text}</span></div></div>`;
    const flag = '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6" fill="#ff6b81" stroke="#4f3a40" stroke-width="2" stroke-linejoin="round"/>';
    const hand = '<path d="M9 11V5a1.6 1.6 0 0 1 3.2 0v5l.2-1.5a1.6 1.6 0 0 1 3.1.4l-.1 1.6.4-.9a1.5 1.5 0 0 1 2.8 1L17 17a5 5 0 0 1-5 4h-.6a5 5 0 0 1-4.2-2.3L4.6 14.6a1.5 1.5 0 0 1 2.4-1.8z" fill="#fff" stroke="#4f3a40" stroke-width="1.8" stroke-linejoin="round"/>';
    const coin = this._sprite(OBJECT_TYPES.find(t => t.id === 'coin'));
    const house = this._sprite(OBJECT_TYPES.find(t => t.id === 'house'));
    return `<section class="ht-sec">
      ${step(1, this._svg(hand), 'ドラッグでうごく', '指をすべらせた方へコスミーが進む')}
      ${step(2, `<img src="${face}" alt="">`, '小さい物をすいこむ', '口に入る大きさの物だけ食べられる')}
      ${step(3, `<span class="ht-grow">${this._img(coin)}<em>→</em>${this._img(house)}</span>`, '食べて大きくなる', '大きくなるほど大物が食べられる')}
      ${step(4, this._svg(flag), '目標スコアでクリア', 'クリア後は時間が止まって食べ放題！')}
    </section>
    <section class="ht-sec"><h3>星3つの条件</h3><div class="ht-stars">
      <div><i>★</i>${this._svg(flag)}<span>クリア</span></div>
      <div><i>★</i><b>⏱</b><span>はやくクリア</span></div>
      <div><i>★</i><b>⏱</b><span>もっとはやく</span></div>
    </div><p class="ht-note">秒数はステージ選択のカードに出ているよ</p></section>`;
  }

  _food() {
    const cards = OBJECT_TYPES.map(t => this._card(this._img(this._sprite(t)), HowTo.NAMES[t.id] || t.id, `サイズ${t.req}〜・${t.score}点`)).join('');
    return this._section('たべもの', cards, 'ステージごとに出る物が変わるよ。たまに光る「色ちがい」は3倍の点数！');
  }

  _care() {
    const G = GIMMICK_TYPES;
    const good = this._card(this._img(this._sprite(G.clock)), '時計', '逃げる。食べると+3秒', 'good');
    const bad = [
      [G.zapper, 'ビリビリ', '1.2秒しびれる'],
      [G.chili, '激辛とうがらし', '火を吹いて爆走'],
      [G.soda, '炭酸ボトル', 'ゲップで吐き出す'],
    ].map(([t, n, s]) => this._card(this._img(this._sprite(t)), n, s, 'bad')).join('');
    const warp = '<circle cx="12" cy="12" r="10" fill="#3b2a5a"/><path d="M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a3.5 3.5 0 1 0-7 0a5.5 5.5 0 1 0 11 0a7.5 7.5 0 1 0-15 0" fill="none" stroke="#b388ff" stroke-width="2" stroke-linecap="round"/>';
    const fan = '<rect x="15" y="6" width="5" height="12" rx="1.5" fill="#9fb3c8" stroke="#4f3a40" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="3.2" ry="8" fill="#e8f6ff" stroke="#4f3a40" stroke-width="1.5"/><path d="M10 6 4 4M10 12H2M10 18l-6 2" stroke="#6cb9ff" stroke-width="2" stroke-linecap="round"/>';
    const bubble = '<circle cx="12" cy="12" r="9.5" fill="rgba(170,220,255,.35)" stroke="#8fd0ff" stroke-width="2"/><path d="M7.5 8a6 6 0 0 1 4-3" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="12" cy="13" r="3.5" fill="#ff9ec0"/>';
    const course = [
      [warp, 'ワープホール', '別の穴から出てくる'],
      [fan, '送風機', '風下へ流される'],
      [bubble, 'シャボン玉', '体当たりで割ると食べられる'],
    ].map(([i, n, s]) => this._card(this._svg(i), n, s)).join('');
    return this._section('いいもの', good) + this._section('食べちゃダメ', bad, '2面から出てくるよ。食べるとコンボも切れちゃう') + this._section('コースのしかけ', course);
  }

  _gimmick() {
    const K = ['multiply', 'traffic', 'sale', 'boss', 'conveyor', 'crane', 'flyaway', 'blackout', 'mix', 'tilt'];
    const cards = K.map(k => this._card(this._svg(StageGimmicks.ICON[k]), StageGimmicks.INFO_BY_KIND[k].name, StageGimmicks.SHORT[k])).join('');
    let fakes = '';
    const imgs = this.game.images || {};
    for (const id of RivalGimmick.ORDER) {
      const T = RivalGimmick.TYPES[id];
      let src = '';
      try { src = imgs[id] ? this._canvasSrc(FakeCosmii.images(imgs[id], id).closed) : ''; } catch (e) { src = ''; }
      fakes += this._card(this._img(src), T.name, `大きさ${T.need}で食べられる`, 'fake');
    }
    return this._section('ステージのしかけ', cards) +
      this._section('ニセコスミー(11面から)', fakes, '食べ物を横取りするニセモノ。頭の数字の大きさになったら食べられる');
  }

  _power() {
    const fever = [
      ['public/opt/chara2_sub.webp', 'ダッシュ', 'はじいた方へ突進×3'],
      ['public/opt/red.webp', '連打', 'たたくほどふくらむ'],
      ['public/opt/chara5_sub.webp', '分身', '小さい分身が手伝う'],
    ].map(([src, n, s]) => this._card(this._img(src), n, s)).join('');
    const bugs = BugRoulette.BUGS.map(b => this._card(`<span class="ht-bug" style="--c:${b.color}">${UI.bugIcon(b.id)}</span></span>`, b.short, b.description.split('！')[0] + '！')).join('');
    const boosts = Game.BOOSTS.map(b => this._card(this._svg(b.icon || ''), b.name, `${b.short}・${b.price}コイン`)).join('');
    return this._section('コスミーフィーバー', fever, '食べると下のゲージがたまる。満タンで3つから選べる') +
      this._section(`バグルーレット(${BugRoulette.DURATION}秒)`, bugs, `${BugRoulette.FROM_STAGE}面から、ステージの最初に回る。いいことも、こまることも`) +
      this._section('ブースト', boosts, 'ステージの前にコインで買える');
  }
}
