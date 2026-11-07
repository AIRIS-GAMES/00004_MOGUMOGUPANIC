/* =========================================================
 * UfoCatcher.js - ゲーセンのUFOキャッチャー
 *  - 1回100コイン。ボタンを押している間アームが右へ動き、離すと下りてつかむ
 *  - つかめたら左の取り出し口まで運ぶ。途中で落ちることもある
 *  - 失敗しても景品は少しずつ取り出し口へ寄っていく(「あと少し」で次も遊びたくなる)
 *  - 景品はまだ持っていないアクセサリー。全部そろったらコインのカプセル
 * ========================================================= */
class UfoCatcher {
  static COST = 100;
  static W = 320;
  static H = 360;
  static CHUTE = 64;        // 左の取り出し口の幅
  static FLOOR = 300;       // 景品が置かれている高さ
  static COIN_PRIZE = 150;

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

  /** 景品を3つ並べる(持っていないアクセサリーから) */
  _restock() {
    const owned = new Set(Accessories.owned());
    const pool = Accessories.LIST.filter(a => a.source === 'ufo' && !owned.has(a.id) && !this.prizes.some(p => p.id === a.id));
    const colors = ['#ff9ec6', '#9be0f7', '#ffd86b', '#b9f2c9', '#d3a8ff'];
    const slots = [130, 205, 275];
    for (const x of slots) {
      if (this.prizes.some(p => Math.abs(p.homeX - x) < 1)) continue;
      const pick = pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : null;
      this.prizes.push({ id: pick ? pick.id : 'coins', homeX: x, x, y: UfoCatcher.FLOOR, color: colors[Math.floor(Math.random() * colors.length)] });
    }
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
      case 'down':
        c.y += 170 * dt;
        if (c.y >= UfoCatcher.FLOOR - 44) { c.y = UfoCatcher.FLOOR - 44; this.state = 'grab'; this.t = 0; }
        break;
      case 'grab': {
        this.t += dt;
        c.open = Math.max(0, 1 - this.t * 2.5);
        if (this.t >= 0.5) {
          const target = this.prizes.reduce((best, p) => (!best || Math.abs(p.x - c.x) < Math.abs(best.x - c.x) ? p : best), null);
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
          if (Math.random() < 0.3) { this.dropping = this.held; this.held = null; this.state = 'return'; c.open = 1; }
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
      p.y = Math.min(UfoCatcher.FLOOR, p.y + 380 * dt);
      if (p.y >= UfoCatcher.FLOOR) {
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
    // 空いた所に新しい景品(元の位置に置き直す)
    const slots = [130, 205, 275];
    for (const x of slots) {
      if (!this.prizes.some(p => Math.abs(p.homeX - x) < 40)) {
        const owned = new Set(Accessories.owned());
        const pool = Accessories.LIST.filter(a => a.source === 'ufo' && !owned.has(a.id) && !this.prizes.some(p => p.id === a.id));
        const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        this.prizes.push({ id: pick ? pick.id : 'coins', homeX: x, x, y: UfoCatcher.FLOOR, color: prize.color });
        break;
      }
    }
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
        items.push({ type: types[Math.floor(rnd() * types.length)], x, y: UfoCatcher.FLOOR + 26 + row * 16 + rnd() * 4, size: 30 + rnd() * 8, rot: (rnd() - 0.5) * 0.9 });
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

    // 空
    const sky = g.createLinearGradient(0, 0, 0, F);
    sky.addColorStop(0, '#9be0f7');
    sky.addColorStop(1, '#d9f5ff');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // 雲
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, k] of [[88, 70, 1], [240, 110, 0.8], [160, 46, 0.6]]) {
      const dx = ((x + this.time * 6 * k) % (W + 80)) - 40;
      g.beginPath();
      g.arc(dx, y, 14 * k, 0, Math.PI * 2); g.arc(dx + 16 * k, y - 6 * k, 17 * k, 0, Math.PI * 2);
      g.arc(dx + 34 * k, y, 13 * k, 0, Math.PI * 2); g.rect(dx, y, 34 * k, 13 * k);
      g.fill();
    }
    // 遠くの街
    g.fillStyle = '#bfe6f2';
    for (const [x, w, h] of [[70, 34, 70], [104, 26, 46], [132, 40, 96], [176, 30, 58], [208, 44, 82], [256, 28, 50], [286, 40, 74]]) {
      g.beginPath(); g.roundRect(x, F - h + 10, w, h, [6, 6, 0, 0]); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (const [x, h] of [[132, 96], [208, 82], [70, 70]]) {
      for (let i = 0; i < 3; i++) g.fillRect(x + 8, F - h + 22 + i * 18, 8, 8);
    }
    // 草原
    const grass = g.createLinearGradient(0, F, 0, H);
    grass.addColorStop(0, '#b8e39b');
    grass.addColorStop(1, '#8fd16f');
    g.fillStyle = grass;
    g.beginPath(); g.moveTo(CH, F + 8); g.quadraticCurveTo(W * 0.6, F - 6, W, F + 6); g.lineTo(W, H); g.lineTo(CH, H); g.closePath(); g.fill();

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
    this._drawWarp(g, CH / 2, F + 26);

    // 景品
    for (const p of this.prizes) if (p !== this.held) this._drawPrize(g, p);

    // アーム(つかんでいる景品はアームの下に)
    if (this.held) this._drawPrize(g, this.held);
    this._drawClaw(g);

    // 取ったときの演出
    this._drawWin(g);

    // ガラスの反射
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath(); g.moveTo(W * 0.64, 0); g.lineTo(W * 0.76, 0); g.lineTo(W * 0.48, H); g.lineTo(W * 0.36, H); g.closePath(); g.fill();
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
    const r = 30;
    g.save();
    g.translate(p.x, p.y);
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
      if (coin) g.drawImage(coin, -17, -24, 34, 34);
    } else {
      Accessories.drawCentered(g, p.id, 48);
    }
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(-r + 2, -2, r * 2 - 4, 4);
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.ellipse(-11, -16, 7, 3.5, -0.7, 0, Math.PI * 2); g.fill();
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
      const kx = c.x + s * (34 + c.open * 10), ky = c.y + 20;
      const tx = c.x + s * (27 + c.open * 14), ty = c.y + 42;
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
