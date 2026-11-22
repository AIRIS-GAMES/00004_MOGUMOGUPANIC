/* =========================================================
 * UfoCatcher.js - ゲーセンのUFOキャッチャー
 *  - 1回100コイン。ボタンを押している間アームが右へ動き、離すと下りてつかむ
 *  - つかめたら左の取り出し口まで運ぶ。途中で落ちることもある
 *  - 失敗しても景品は少しずつ取り出し口へ寄っていく(「あと少し」で次も遊びたくなる)
 *  - 景品はまだ持っていないアクセサリー。全部そろったらコインのカプセル
 *  - 景品は前後2列に6つ。めずらしい景品(RARE)はカプセルが金色に光る
 * ========================================================= */
class UfoCatcher {
  static COST = 100;
  static W = 320;
  static H = 300;
  static CHUTE = 64;        // 左の取り出し口の幅
  static FLOOR = 236;       // 景品が置かれている高さ(前の列はこれより少し下)
  static COIN_PRIZE = 150;
  static R = 33;            // カプセルの半径
  // 景品の置き場所:奥の列3つ、手前の列3つ(手前は少し右にずらして山に見せる)
  static SLOTS = [
    { x: 112, y: UfoCatcher.FLOOR - 16 }, { x: 182, y: UfoCatcher.FLOOR - 16 }, { x: 252, y: UfoCatcher.FLOOR - 16 },
    { x: 146, y: UfoCatcher.FLOOR + 14 }, { x: 216, y: UfoCatcher.FLOOR + 14 }, { x: 276, y: UfoCatcher.FLOOR + 14 },
  ];
  static RARE = ['halo', 'starglasses'];
  // 夜空の星 [x, y, 位相]
  static STARS = [[20, 20, 0], [52, 46, 1.3], [96, 14, 2.1], [150, 34, 0.7], [186, 12, 2.8], [230, 50, 1.9], [320 - 12, 86, 0.4], [124, 70, 3.3], [252, 18, 1.1], [30, 92, 2.4]];
  // 窓のあかり [x, 床からの高さ, 位相]
  static WINDOWS = (() => {
    const w = [];
    const towers = [[66, 28, 70], [92, 22, 52], [118, 24, 92], [176, 26, 60], [206, 40, 104], [262, 30, 78], [292, 30, 54]];
    let n = 0;
    for (const [x, tw, h] of towers) {
      for (let y = 38; y < h - 4; y += 9) {
        for (let xx = x + 4; xx < x + tw - 5; xx += 7) { n++; if ((n * 7) % 5 < 3) w.push([xx, y, n * 0.37]); }
      }
    }
    return w;
  })();
  static COLORS = ['#ff9ec6', '#9be0f7', '#b9f2c9', '#d3a8ff', '#ffc59e'];

  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;     // { onWin(prize), onSpend(), onChange() }
    this.state = 'idle';    // idle | move | down | grab | up | carry | drop | win
    this.claw = { x: 56, y: 40, open: 1 };
    this.prizes = [];
    this.message = '';
    this.time = 0;
    this.raf = null;
    this._restock();
  }

  /** 空いている置き場所に景品を置く(持っていないアクセサリーから。なければコイン) */
  _restock(limit = Infinity) {
    const owned = new Set(Accessories.owned());
    const pool = Accessories.LIST.filter(a => a.source === 'ufo' && !owned.has(a.id) && !this.prizes.some(p => p.id === a.id));
    UfoCatcher.SLOTS.forEach((slot, i) => {
      if (limit <= 0 || this.prizes.some(p => p.slot === i)) return;
      limit--;
      const pick = pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : null;
      const id = pick ? pick.id : 'coins';
      const color = id === 'coins' || UfoCatcher.RARE.includes(id) ? '#ffd86b' : UfoCatcher.COLORS[Math.floor(Math.random() * UfoCatcher.COLORS.length)];
      this.prizes.push({ id, slot: i, homeX: slot.x, homeY: slot.y, x: slot.x, y: slot.y, color, rare: UfoCatcher.RARE.includes(id) });
    });
    // 手前の列を後から描く
    this.prizes.sort((a, b) => a.homeY - b.homeY);
  }

  get canPlay() { return this.state === 'idle' && Storage.getCoins() >= UfoCatcher.COST; }

  /** ボタンを押した:コインを払ってアームが動き出す */
  press() {
    if (!this.canPlay) return false;
    Storage.setCoins(Storage.getCoins() - UfoCatcher.COST);
    this.hooks.onSpend && this.hooks.onSpend();
    this.state = 'move';
    this.claw = { x: 56, y: 40, open: 1 };
    this.held = null;
    return true;
  }

  /** ボタンを離した:アームが下りる */
  release() {
    if (this.state === 'move') this.state = 'down';
  }

  start() {
    if (this.raf) return;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  update(dt) {
    this.time += dt;
    const c = this.claw;
    switch (this.state) {
      case 'move':
        c.x = Math.min(UfoCatcher.W - 44, c.x + 120 * dt);
        if (c.x >= UfoCatcher.W - 44) this.state = 'down';
        break;
      case 'down': {
        // 真下に景品があれば、その高さで止まる
        const under = this._nearest(c.x);
        const stop = (under && Math.abs(under.x - c.x) < 40 ? under.y : UfoCatcher.FLOOR) - 44;
        c.y += 170 * dt;
        if (c.y >= stop) { c.y = stop; this.state = 'grab'; this.t = 0; }
        break;
      }
      case 'grab': {
        this.t += dt;
        c.open = Math.max(0, 1 - this.t * 2.5);
        if (this.t >= 0.5) {
          const target = this._nearest(c.x);
          const off = target ? Math.abs(target.x - c.x) : 999;
          // 真ん中に近いほどつかみやすい
          const chance = off < 10 ? 0.75 : off < 22 ? 0.45 : off < 32 ? 0.18 : 0;
          if (target && Math.random() < chance) this.held = target;
          else if (target && off < 40) target.x = Math.max(UfoCatcher.CHUTE + 10, target.x - (16 + Math.random() * 10)); // かすって寄る
          this.state = 'up';
        }
        break;
      }
      case 'up':
        c.y = Math.max(40, c.y - 150 * dt);
        if (this.held) { this.held.x = c.x; this.held.y = c.y + 44; }
        if (c.y <= 40) this.state = this.held ? 'carry' : 'return';
        break;
      case 'carry':
        c.x -= 110 * dt;
        this.held.x = c.x; this.held.y = c.y + 44 + Math.sin(this.time * 18) * 2;
        // 途中でポロッと落ちることがある(取り出し口の手前ほど落ちにくい)
        if (!this.slipChecked && c.x < this.held.homeX - 30) {
          this.slipChecked = true;
          if (Math.random() < 0.3) { this.dropping = this.held; this.held = null; this.state = 'return'; c.open = 1; this.oshii = this.time; }
        }
        if (this.held && c.x <= UfoCatcher.CHUTE / 2) { this._win(this.held); this.held = null; c.open = 1; this.state = 'return'; }
        break;
      case 'return':
        c.open = 1;
        c.x = Math.max(56, c.x - 140 * dt);
        if (c.x <= 56) { this.state = 'idle'; this.slipChecked = false; this.hooks.onChange && this.hooks.onChange(); }
        break;
      default:
        break;
    }
    // 落ちた景品は床まで落ちる(少し取り出し口寄りに)
    if (this.dropping) {
      const p = this.dropping;
      p.y = Math.min(p.homeY, p.y + 380 * dt);
      if (p.y >= p.homeY) {
        p.x = Math.max(UfoCatcher.CHUTE + 10, p.x);
        p.homeX = Math.min(p.homeX, p.x);
        this.dropping = null;
      }
    }
    // 取り出し口のふちまで寄った景品は、そのまま落ちて獲得
    for (const p of [...this.prizes]) {
      if (p !== this.held && p !== this.dropping && p.x <= UfoCatcher.CHUTE + 12) this._win(p);
    }
  }

  _win(prize) {
    this.prizes = this.prizes.filter(p => p !== prize);
    if (prize.id === 'coins') Storage.addCoins(UfoCatcher.COIN_PRIZE);
    else Accessories.give(prize.id);
    this.lastWin = { id: prize.id, t: this.time };
    this.hooks.onWin && this.hooks.onWin(prize);
    // 空いた所に新しい景品を1つ
    this._restock(1);
  }

  /** アームの真下にいちばん近い景品 */
  _nearest(x) {
    return this.prizes.reduce((best, p) => (p === this.dropping ? best : !best || Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best), null);
  }

  /* ---- 描画 ---- */

  /** 操縦しているコスミー(いま着ているスキン)の絵 */
  _cosmiiImage(open) {
    const skin = (typeof SKINS !== 'undefined' && SKINS.find(k => k.id === Storage.getSkin())) || null;
    if (!skin) return null;
    const src = open ? skin.openSrc : skin.closedSrc;
    UfoCatcher.images = UfoCatcher.images || new Map();
    let img = UfoCatcher.images.get(src);
    if (!img) { img = new Image(); img.src = src; UfoCatcher.images.set(src, img); }
    return img.complete && img.naturalWidth ? img : null;
  }

  /** 床に積もったエラーの山(毎回同じ並び) */
  _pile() {
    if (this.pileItems) return this.pileItems;
    const ids = ['flower', 'coin', 'trash', 'bench', 'tree', 'crate', 'barrel', 'buoy', 'shoppingBag', 'suitcase', 'signal'];
    const types = ids.map(id => OBJECT_TYPES.find(t => t.id === id)).filter(Boolean);
    let seed = 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const items = [];
    for (let row = 0; row < 2; row++) {
      for (let x = UfoCatcher.CHUTE + 22 + row * 12; x < UfoCatcher.W + 10; x += 24 + rnd() * 8) {
        items.push({ type: types[Math.floor(rnd() * types.length)], x, y: UfoCatcher.FLOOR + 34 + row * 16 + rnd() * 4, size: 30 + rnd() * 8, rot: (rnd() - 0.5) * 0.9 });
      }
    }
    this.pileItems = items;
    return items;
  }

  draw() {
    const g = this.ctx, W = UfoCatcher.W, H = UfoCatcher.H, dpr = this.canvas.width / W;
    const CH = UfoCatcher.CHUTE, F = UfoCatcher.FLOOR;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    // 夜空(ニューヨークの夜)
    const sky = g.createLinearGradient(0, 0, 0, F);
    sky.addColorStop(0, '#120a35');
    sky.addColorStop(0.55, '#3a1f6e');
    sky.addColorStop(1, '#c0508f');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // またたく星
    for (const [x, y, ph] of UfoCatcher.STARS) {
      g.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(this.time * 1.6 + ph));
      g.fillStyle = '#fff6d6';
      g.fillRect(x, y, 2, 2);
    }
    g.globalAlpha = 1;
    // お月さま
    g.fillStyle = 'rgba(255,240,200,0.18)';
    g.beginPath(); g.arc(282, 40, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff1c4';
    g.beginPath(); g.arc(282, 40, 13, 0, Math.PI * 2); g.fill();
    // サーチライト
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const [bx, sp, ph] of [[110, 0.5, 0], [250, 0.4, 2]]) {
      const a = -Math.PI / 2 + Math.sin(this.time * sp + ph) * 0.45;
      const beam = g.createLinearGradient(bx, F, bx + Math.cos(a) * 220, F + Math.sin(a) * 220);
      beam.addColorStop(0, 'rgba(255,220,255,0.22)');
      beam.addColorStop(1, 'rgba(255,220,255,0)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(bx, F - 40);
      g.lineTo(bx + Math.cos(a - 0.07) * 240, F - 40 + Math.sin(a - 0.07) * 240);
      g.lineTo(bx + Math.cos(a + 0.07) * 240, F - 40 + Math.sin(a + 0.07) * 240);
      g.closePath(); g.fill();
    }
    g.restore();
    // 遠くのビル(エンパイア・ステートとクライスラーっぽいシルエット)
    g.fillStyle = '#3b2266';
    for (const [x, w, h] of [[66, 28, 70], [92, 22, 52], [176, 26, 60], [262, 30, 78], [292, 30, 54]]) {
      g.fillRect(x, F - h, w, h);
    }
    // とんがり屋根のビル
    g.beginPath();
    g.moveTo(118, F); g.lineTo(118, F - 92); g.lineTo(126, F - 104); g.lineTo(130, F - 132); g.lineTo(134, F - 104);
    g.lineTo(142, F - 92); g.lineTo(142, F); g.closePath(); g.fill();
    // 階段状の塔とアンテナ
    g.fillRect(206, F - 104, 40, 104);
    g.fillRect(212, F - 120, 28, 18);
    g.fillRect(218, F - 132, 16, 14);
    g.fillRect(224, F - 152, 4, 22);
    // アンテナの赤いランプ
    g.fillStyle = Math.sin(this.time * 4) > 0 ? '#ff4d6d' : 'rgba(255,77,109,0.3)';
    g.beginPath(); g.arc(226, F - 153, 2.4, 0, Math.PI * 2); g.fill();
    // 窓のあかり(たまに消えたりつく)
    for (const [x, y, ph] of UfoCatcher.WINDOWS) {
      const on = Math.sin(this.time * 0.7 + ph * 9) > -0.6;
      g.fillStyle = on ? '#ffd86b' : '#4d3080';
      g.fillRect(x, F - y, 3, 4);
    }
    // 手前の街並み(屋上の給水タンク)
    g.fillStyle = '#24143f';
    for (const [x, w, h] of [[64, 40, 30], [104, 30, 20], [134, 46, 34], [180, 34, 24], [214, 44, 30], [258, 28, 18], [286, 34, 28]]) {
      g.fillRect(x, F - h, w, h);
    }
    for (const x of [78, 150, 232, 298]) {
      const y = { 78: 30, 150: 34, 232: 30, 298: 28 }[x];
      g.fillRect(x, F - y - 10, 10, 8);
      g.beginPath(); g.moveTo(x - 1, F - y - 10); g.lineTo(x + 5, F - y - 16); g.lineTo(x + 11, F - y - 10); g.fill();
      g.fillRect(x + 1, F - y - 2, 1.5, 2); g.fillRect(x + 7.5, F - y - 2, 1.5, 2);
    }
    // ゆか:ネオンのステージ
    const floor = g.createLinearGradient(0, F, 0, H);
    floor.addColorStop(0, '#5a2a8a');
    floor.addColorStop(1, '#2a144a');
    g.fillStyle = floor;
    g.beginPath(); g.moveTo(CH, F - 8); g.lineTo(W, F - 8); g.lineTo(W, H); g.lineTo(CH, H); g.closePath(); g.fill();
    // ゆかのふち(シアンのネオン管)
    g.save();
    g.shadowColor = '#2be3ff'; g.shadowBlur = 10;
    g.strokeStyle = '#bff6ff'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(CH + 2, F - 8); g.lineTo(W, F - 8); g.stroke();
    g.restore();
    // ゆかのチェック模様
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let yy = 0; yy < 3; yy++) {
      for (let xx = 0; xx < 12; xx++) {
        if ((xx + yy) % 2) g.fillRect(CH + xx * 22, F - 6 + yy * 22, 22, 22);
      }
    }

    // エラーの山
    for (const it of this._pile()) {
      const sp = GameObject.getSprite(it.type);
      g.save();
      g.translate(it.x, it.y);
      g.rotate(it.rot);
      const k = it.size / sp.drawSize;
      g.drawImage(sp.canvas, -sp.drawSize * k / 2, -sp.drawSize * k / 2, sp.drawSize * k, sp.drawSize * k);
      g.restore();
    }

    // 取り出し口:ワープホール
    this._drawWarp(g, CH / 2, F + 30);
    // 取り出し口のふち
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.roundRect(CH - 4, F - 30, 6, H - F + 30, 3); g.fill();

    // 景品
    for (const p of this.prizes) if (p !== this.held) this._drawPrize(g, p);

    // アーム(つかんでいる景品はアームの下に)
    if (this.held) this._drawPrize(g, this.held);
    this._drawClaw(g);

    // 取ったときの演出
    this._drawWin(g);
    this._drawOshii(g);

  }

  /** 運んでいる途中で落ちたら「おしい！」 */
  _drawOshii(g) {
    if (this.oshii == null) return;
    const t = this.time - this.oshii;
    if (t > 1.1) return;
    g.save();
    g.globalAlpha = t > 0.8 ? 1 - (t - 0.8) / 0.3 : 1;
    g.translate(UfoCatcher.W / 2, 120 - t * 14);
    const s = Math.min(1, t / 0.15);
    g.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s);
    g.font = '900 30px "M PLUS Rounded 1c", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#6a4ce0'; g.strokeText('おしい！', 0, 0);
    g.fillStyle = '#ffffff'; g.fillText('おしい！', 0, 0);
    g.restore();
  }

  _drawWarp(g, x, y) {
    const R = 26, t = this.time * 2.4;
    g.save();
    g.translate(x, y);
    const grad = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    grad.addColorStop(0, '#1a1030');
    grad.addColorStop(0.55, '#5b3fa8');
    grad.addColorStop(1, 'rgba(120, 220, 255, 0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(0, 0, R * 1.2, R * 0.75, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = i % 2 ? '#7ce8ff' : '#d3a8ff';
      g.beginPath();
      for (let s = 0; s <= 1.0001; s += 0.08) {
        const a = t + i * (Math.PI * 2 / 3) + s * 3.2;
        const r = R * (0.95 - s * 0.8);
        const px = Math.cos(a) * r * 1.1, py = Math.sin(a) * r * 0.62;
        if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const a = -t * 0.7 + i * Math.PI * 0.4;
      g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i);
      g.beginPath(); g.arc(Math.cos(a) * R * 1.1, Math.sin(a) * R * 0.68, 2.2, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  _drawPrize(g, p) {
    const r = UfoCatcher.R;
    g.save();
    g.translate(p.x, p.y);
    // めずらしい景品は後ろが光る
    if (p.rare) {
      const glow = 0.55 + 0.35 * Math.sin(this.time * 4 + p.homeX);
      const grad = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.7);
      grad.addColorStop(0, `rgba(255, 236, 140, ${glow})`);
      grad.addColorStop(1, 'rgba(255, 236, 140, 0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, r * 1.7, 0, Math.PI * 2); g.fill();
      g.save();
      g.rotate(this.time * 1.5);
      g.fillStyle = '#fff6b0';
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        const k = 0.6 + 0.4 * Math.sin(this.time * 6 + i);
        g.beginPath(); g.moveTo(0, -r * 1.25 - 7 * k); g.lineTo(2.5, -r * 1.25); g.lineTo(0, -r * 1.25 + 7 * k); g.lineTo(-2.5, -r * 1.25); g.closePath(); g.fill();
      }
      g.restore();
    }
    // 床の影
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath(); g.ellipse(0, r * 0.92, r * 0.8, r * 0.18, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(74, 59, 50, 0.55)';
    g.lineWidth = 2.5;
    // 下半分(色)
    g.fillStyle = p.color;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI); g.closePath(); g.fill();
    // 上半分(透明)
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.arc(0, 0, r, Math.PI, Math.PI * 2); g.closePath(); g.fill();
    // 中身
    if (p.id === 'coins') {
      const coin = this._coinImage();
      if (coin) g.drawImage(coin, -19, -26, 38, 38);
    } else {
      Accessories.drawCentered(g, p.id, 54);
    }
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(-r + 2, -2, r * 2 - 4, 4);
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.ellipse(-r * 0.37, -r * 0.53, 7, 3.5, -0.7, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  _coinImage() {
    if (!this.coinImg) { this.coinImg = new Image(); this.coinImg.src = 'public/opt/cosmo-coin.webp'; }
    return this.coinImg.complete && this.coinImg.naturalWidth ? this.coinImg : null;
  }

  _drawClaw(g) {
    const c = this.claw, W = UfoCatcher.W;
    const ink = '#4a3b32';
    // レール
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(-4, 10, W + 8, 8, 4); g.fill();
    g.fillStyle = 'rgba(74,59,50,0.12)';
    g.fillRect(0, 16, W, 2);
    // 台車
    g.fillStyle = '#ff8a9b';
    g.beginPath(); g.roundRect(c.x - 14, 6, 28, 16, 6); g.fill();
    // ワイヤー
    g.strokeStyle = 'rgba(74,59,50,0.6)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(c.x, 22); g.lineTo(c.x, c.y - 40); g.stroke();

    // ツメ(閉じるとカプセルの両わきをはさむ)
    for (const s of [-1, 1]) {
      const jx = c.x + s * 16, jy = c.y + 2;
      const kx = c.x + s * (37 + c.open * 10), ky = c.y + 20;
      const tx = c.x + s * (30 + c.open * 14), ty = c.y + 44;
      g.strokeStyle = '#c3ced8';
      g.lineWidth = 7;
      g.beginPath(); g.moveTo(jx, jy); g.lineTo(kx, ky); g.lineTo(tx, ty); g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(jx, jy); g.lineTo(kx, ky); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = '#ff8a9b';
      g.beginPath(); g.arc(tx, ty, 4.5, 0, Math.PI * 2); g.fill();
    }

    // ドームの中のコスミー
    const busy = this.state === 'grab' || (this.lastWin && this.time - this.lastWin.t < 1.2);
    const img = this._cosmiiImage(busy);
    g.save();
    const dome = () => { g.beginPath(); g.ellipse(c.x, c.y - 4, 24, 38, 0, Math.PI, 0); g.closePath(); };
    dome(); g.clip();
    g.fillStyle = 'rgba(210, 244, 255, 0.85)';
    g.fillRect(c.x - 26, c.y - 44, 52, 42);
    if (img) {
      const bob = Math.sin(this.time * 4) * 1.5;
      g.drawImage(img, c.x - 23, c.y - 49 + bob, 46, 46);
    }
    g.restore();
    // ドームのガラス
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 2.5;
    dome(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.ellipse(c.x - 13, c.y - 28, 3, 7, 0.4, 0, Math.PI * 2); g.fill();
    // 円盤
    const disc = g.createLinearGradient(0, c.y - 14, 0, c.y + 4);
    disc.addColorStop(0, '#ffffff'); disc.addColorStop(1, '#ffc2cf');
    g.fillStyle = disc;
    g.beginPath(); g.ellipse(c.x, c.y - 3, 36, 10, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(225, 78, 102, 0.6)';
    g.lineWidth = 2;
    g.stroke();
    // まわりのライト(順番に光る)
    const lights = ['#ff6b81', '#ffd24d', '#6cb9ff', '#8fd14f', '#c89bff'];
    for (let i = 0; i < 5; i++) {
      const lx = c.x - 24 + i * 12;
      const on = (Math.floor(this.time * 8) + i) % 5 < 2 || this.state === 'move';
      g.fillStyle = on ? lights[i] : 'rgba(74,59,50,0.18)';
      g.beginPath(); g.arc(lx, c.y - 1, 2.6, 0, Math.PI * 2); g.fill();
    }
  }

  _drawWin(g) {
    if (!this.lastWin) return;
    const t = this.time - this.lastWin.t;
    if (t > 1.6) return;
    const W = UfoCatcher.W, H = UfoCatcher.H, dpr = this.canvas.width / W;
    const cx = W / 2, cy = H * 0.42;
    const pop = Math.min(1, t / 0.25);
    const scale = 0.4 + 0.6 * (1 - Math.pow(1 - pop, 3)) + (t > 0.25 ? Math.sin((t - 0.25) * 8) * 0.03 : 0);
    const fade = t > 1.3 ? 1 - (t - 1.3) / 0.3 : 1;
    g.save();
    g.globalAlpha = fade;
    g.translate(cx, cy);
    g.rotate(t * 0.8);
    g.fillStyle = 'rgba(255, 246, 176, 0.6)';
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, -190); g.lineTo(14, -190); g.closePath(); g.fill();
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = fade;
    g.translate(cx, cy);
    g.scale(scale, scale);
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.15)';
    g.shadowOffsetY = 4;
    g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent';
    if (this.lastWin.id === 'coins') {
      const coin = this._coinImage();
      if (coin) g.drawImage(coin, -26, -26, 52, 52);
    } else {
      Accessories.drawCentered(g, this.lastWin.id, 66);
    }
    // GET!(タイトルロゴと同じ白+ピンクふち)
    g.font = '900 36px "M PLUS Rounded 1c", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#e14e66';
    g.fillText('GET!', 0, 75);
    g.lineWidth = 4;
    g.strokeStyle = '#ff6b81';
    g.strokeText('GET!', 0, 72);
    g.fillStyle = '#ffffff';
    g.fillText('GET!', 0, 72);
    g.restore();
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39, sp = 90 + (i % 5) * 25;
      const x = cx + Math.cos(a) * sp * t, y = cy + Math.sin(a) * sp * t + 120 * t * t;
      g.save();
      g.globalAlpha = fade;
      g.fillStyle = ['#ff6b81', '#ffd24d', '#6cb9ff', '#8fd14f'][i % 4];
      g.translate(x, y); g.rotate(t * 6 + i);
      g.fillRect(-4, -2, 8, 4);
      g.restore();
    }
  }
}
