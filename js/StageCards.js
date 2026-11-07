/* =========================================================
 * StageCards.js - ステージ選択のカードに映す「動く街のジオラマ」
 *  その面の街(地面・道路・物)の中をコスミーが食べ歩き、
 *  その面のギミック(走る車・コンベア・停電・ニセコスミー…)も小さく動く
 * ========================================================= */
class StageDiorama {
  static SIZE = 300;

  constructor(canvas, stage, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.stage = stage;
    this.images = opts.images;          // スキンの絵 { [skinId]: {open, closed} }
    this.skin = opts.skin;
    this.kinds = opts.kinds || [];      // ギミック(組み合わせは複数)
    this.time = 0;
    this.eatAll = 0;                    // 選んだ時の「全部パクッ」
    let seed = stage.id * 7919 + 13;
    this.rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    this._build();
  }

  _build() {
    const S = StageDiorama.SIZE, rnd = this.rnd;
    const theme = Game.THEMES[this.stage.theme] || Game.THEMES.park;
    this.theme = theme;
    this.roadY = 90 + rnd() * 130;
    this.roadX = 80 + rnd() * 140;
    this.decor = Array.from({ length: 10 }, () => ({ x: rnd() * S, y: rnd() * S, r: 6 + rnd() * 12, c: theme.decor[Math.floor(rnd() * theme.decor.length)] }));
    const types = theme.objects.map(id => OBJECT_TYPES.find(t => t.id === id)).filter(Boolean);
    this.types = types;
    this.objs = [];
    for (let i = 0; i < 11; i++) this.objs.push(this._newObj(types[Math.floor(rnd() * types.length)]));
    const mark = this.stage.landmark && (GIMMICK_TYPES[this.stage.landmark] || OBJECT_TYPES.find(t => t.id === this.stage.landmark));
    this.landmark = mark ? { type: mark, x: S * (0.25 + rnd() * 0.5), y: S * (0.22 + rnd() * 0.2), s: 64 } : null;
    // 危険物(その面に出る種類だけ)
    const kinds = HazardField.kindCountFor(this.stage.id);
    this.hazards = ['zapper', 'chili', 'soda'].slice(0, kinds).map((id, i) => ({ type: GIMMICK_TYPES[id], x: 40 + rnd() * 220, y: 60 + rnd() * 200, a: rnd() * 6, i }));
    this.cosmii = { x: S / 2, y: S * 0.62, tx: S / 2, ty: S * 0.62, eat: 0, target: null };
    // ギミックの小道具
    this.cars = [0, 1].map(i => ({ x: rnd() * S, dir: i ? -1 : 1, lane: i }));
    this.rival = { x: 60, y: 80, tx: 60, ty: 80 };
    this.drop = { t: 0, x: 150, y: 150 };
  }

  _newObj(type) {
    const S = StageDiorama.SIZE, rnd = this.rnd;
    let x, y;
    for (let k = 0; k < 12; k++) {
      x = 24 + rnd() * (S - 48); y = 40 + rnd() * (S - 70);
      if (Math.abs(y - this.roadY) > 22 && Math.abs(x - this.roadX) > 22) break;
    }
    const s = Math.max(26, Math.min(58, type.r * 0.75));
    return { type, x, y, s, scale: 1, pop: 0, gone: 0, fly: 0 };
  }

  sprite(type, px) {
    const sp = GameObject.getSprite(type);
    return GameObject.lod(sp, px * 2);
  }

  update(dt) {
    this.time += dt;
    const S = StageDiorama.SIZE, c = this.cosmii, t = this.time;
    // コスミー:近くの物をねらって食べる
    if (!c.target || c.target.gone > 0) {
      let best = null, bd = Infinity;
      for (const o of this.objs) {
        if (o.gone > 0) continue;
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < bd) { bd = d; best = o; }
      }
      c.target = best;
    }
    if (c.target) { c.tx = c.target.x; c.ty = c.target.y; }
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy) || 1;
    const sp = 55 * dt;
    if (d > 4) { c.x += dx / d * Math.min(sp, d); c.y += dy / d * Math.min(sp, d); }
    c.eat = Math.max(0, c.eat - dt * 3);
    for (const o of this.objs) {
      if (o.gone > 0) {
        o.gone -= dt;
        if (o.gone <= 0) Object.assign(o, this._newObj(this.types[Math.floor(this.rnd() * this.types.length)]));
        continue;
      }
      if (o.pop < 1) o.pop = Math.min(1, o.pop + dt * 3);
      if (Math.hypot(o.x - c.x, o.y - c.y) < 16) { o.gone = 1.6; c.eat = 1; }
    }
    // 傾く:物がすべって行ったり来たり
    if (this.kinds.includes('tilt')) {
      const k = Math.sin(t * 0.9) > 0.6 ? 1 : Math.sin(t * 0.9) < -0.6 ? -1 : 0;
      for (const o of this.objs) o.x = Math.max(20, Math.min(S - 20, o.x + k * 30 * dt));
    }
    // コンベア:ベルトの上の物が流れる
    if (this.kinds.includes('conveyor')) {
      for (const o of this.objs) if (Math.abs(o.y - this.roadY) < 40) o.x = (o.x + 40 * dt) % S;
    }
    // 車
    for (const car of this.cars) car.x = ((car.x + car.dir * 70 * dt) % (S + 80) + S + 80) % (S + 80);
    // ニセコスミーは本物の反対側をうろうろ
    const r = this.rival;
    if (Math.hypot(r.tx - r.x, r.ty - r.y) < 6) { r.tx = 30 + this.rnd() * 240; r.ty = 50 + this.rnd() * 220; }
    const rx = r.tx - r.x, ry = r.ty - r.y, rl = Math.hypot(rx, ry) || 1;
    r.x += rx / rl * 40 * dt; r.y += ry / rl * 40 * dt;
    // クレーンの落とし物
    this.drop.t += dt;
    if (this.drop.t > 2.4) { this.drop = { t: 0, x: 50 + this.rnd() * 200, y: 70 + this.rnd() * 180 }; }
    // 危険物はゆっくり歩く
    for (const h of this.hazards) { h.a += dt * 0.6; h.x += Math.cos(h.a) * 10 * dt; h.y += Math.sin(h.a * 1.3) * 10 * dt; }
    if (this.eatAll > 0) this.eatAll = Math.min(1, this.eatAll + dt * 1.6);
  }

  draw() {
    const g = this.ctx, S = StageDiorama.SIZE, th = this.theme, t = this.time;
    const scale = this.canvas.width / S;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    // 地面
    g.fillStyle = th.ground; g.fillRect(0, 0, S, S);
    for (const d of this.decor) { g.fillStyle = d.c; g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill(); }
    // 道路
    g.fillStyle = th.road;
    g.fillRect(0, this.roadY - 18, S, 36); g.fillRect(this.roadX - 18, 0, 36, S);
    g.fillStyle = th.line;
    for (let x = (t * 0) % 30; x < S; x += 30) g.fillRect(x, this.roadY - 2, 16, 4);
    for (let y = 0; y < S; y += 30) g.fillRect(this.roadX - 2, y, 4, 16);
    const has = k => this.kinds.includes(k) || (this.kinds.includes('mix') && ['traffic', 'sale', 'conveyor', 'crane'][Math.floor(t / 3) % 4] === k);
    // コンベア(道路の上をベルトに)
    if (has('conveyor')) {
      g.fillStyle = '#5b5f66'; g.fillRect(0, this.roadY - 20, S, 40);
      g.fillStyle = '#f5c443';
      for (let x = (t * 40) % 24 - 24; x < S; x += 24) { g.beginPath(); g.moveTo(x, this.roadY - 10); g.lineTo(x + 10, this.roadY); g.lineTo(x, this.roadY + 10); g.lineTo(x + 5, this.roadY); g.closePath(); g.fill(); }
    }
    // タイムセール
    if (has('sale')) {
      const zx = S * 0.7, zy = S * 0.3, zr = 54 + Math.sin(t * 4) * 4;
      g.fillStyle = 'rgba(255, 210, 77, 0.35)'; g.beginPath(); g.arc(zx, zy, zr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd24d'; g.lineWidth = 4; g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]);
    }
    // クレーンの影
    if (has('crane')) {
      const k = Math.min(1, this.drop.t / 1.6);
      g.fillStyle = `rgba(0,0,0,${0.15 + k * 0.25})`;
      g.beginPath(); g.ellipse(this.drop.x, this.drop.y, 10 + k * 18, 5 + k * 9, 0, 0, Math.PI * 2); g.fill();
    }
    // 物(y順)
    const list = [];
    for (const o of this.objs) if (o.gone <= 0) list.push({ y: o.y, f: () => this._drawObj(g, o) });
    if (this.landmark) list.push({ y: this.landmark.y, f: () => this._drawSprite(g, this.landmark.type, this.landmark.x, this.landmark.y, this.landmark.s, Math.sin(t * 2) * 0.05) });
    for (const h of this.hazards) list.push({ y: h.y, f: () => this._drawSprite(g, h.type, h.x, h.y, 24, Math.sin(t * 6 + h.i) * 0.15) });
    if (has('traffic')) {
      const car = OBJECT_TYPES.find(o => o.id === 'car');
      this.cars.forEach((c, i) => list.push({ y: this.roadY + (i ? 8 : -8), f: () => {
        g.save(); g.translate(c.x - 40, this.roadY + (i ? 8 : -8)); if (c.dir < 0) g.scale(-1, 1);
        g.drawImage(this.sprite(car, 40), -20, -20, 40, 40); g.restore();
      } }));
    }
    if (has('crane') && this.drop.t > 1.6) {
      const k = Math.min(1, (this.drop.t - 1.6) / 0.25), crate = OBJECT_TYPES.find(o => o.id === 'crate');
      list.push({ y: this.drop.y, f: () => this._drawSprite(g, crate, this.drop.x, this.drop.y - (1 - k) * 120, 34, 0) });
    }
    if (this.kinds.includes('clock')) list.push({ y: 200, f: () => this._drawSprite(g, GIMMICK_TYPES.clock, 230 + Math.cos(t) * 30, 200 + Math.sin(t * 1.3) * 20, 30, Math.sin(t * 8) * 0.2) });
    if (this.kinds.includes('flyaway')) {
      const k = (t % 3) / 3, suit = OBJECT_TYPES.find(o => o.id === 'suitcase');
      list.push({ y: 300, f: () => { g.save(); g.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; this._drawSprite(g, suit, 70, 230 - k * 140, 30, Math.sin(t * 6) * 0.2); g.restore(); } });
    }
    if (this.kinds.includes('boss')) {
      const big = this.types.slice().sort((a, b) => b.r - a.r)[0];
      list.push({ y: 120, f: () => {
        g.save(); g.filter = 'none';
        g.globalAlpha = 0.9;
        for (const [c, ox] of [['rgba(255,79,163,0.5)', 3], ['rgba(79,227,255,0.5)', -3]]) { g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.arc(225 + ox, 110, 52, 0, Math.PI * 2); g.stroke(); }
        g.restore();
        this._drawSprite(g, big, 225, 110, 100, Math.sin(t * 9) * 0.04);
      } });
    }
    if (this.kinds.includes('rival')) {
      // 後半はニセモノが何体も(赤・青・ピンク)
      const n = RivalGimmick.maxFor(this.stage.id);
      RivalGimmick.ORDER.slice(0, n).forEach((id, k) => {
        const fake = this.images[id] && FakeCosmii.images(this.images[id], id);
        if (!fake) return;
        const x = (this.rival.x + k * 90) % 260 + 20, y = (this.rival.y + k * 70) % 230 + 50;
        list.push({ y, f: () => this._drawCosmii(g, fake, x, y, 40, Math.sin(t * 5 + k) > 0) });
      });
    }
    list.push({ y: this.cosmii.y, f: () => this._drawCosmii(g, this.images[this.skin.id], this.cosmii.x, this.cosmii.y, 50 * (1 + this.eatAll * 2.2), this.cosmii.eat > 0.2 || this.eatAll > 0) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.f();
    // 増殖:ポンッと出る輪
    if (has('multiply')) {
      const k = (t * 0.8) % 1, o = this.objs[Math.floor(t * 0.8) % this.objs.length];
      g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 3;
      g.beginPath(); g.arc(o.x + 18, o.y, 8 + k * 18, 0, Math.PI * 2); g.stroke();
    }
    // 停電
    if (this.kinds.includes('blackout') && Math.sin(t * 0.8) > -0.2) {
      g.save();
      g.fillStyle = 'rgba(15, 12, 40, 0.78)';
      g.beginPath(); g.rect(0, 0, S, S); g.arc(this.cosmii.x, this.cosmii.y, 62, 0, Math.PI * 2, true); g.fill();
      g.restore();
    }
    // 傾く:矢印
    if (this.kinds.includes('tilt')) {
      const k = Math.sin(t * 0.9);
      if (Math.abs(k) > 0.45) {
        g.save(); g.globalAlpha = 0.8; g.fillStyle = '#ffd24d'; g.strokeStyle = '#4f3a40'; g.lineWidth = 3;
        const dir = k > 0 ? 1 : -1;
        for (const y of [60, 150, 240]) {
          const x = dir > 0 ? S - 26 : 26;
          g.beginPath(); g.moveTo(x + dir * 14, y); g.lineTo(x - dir * 6, y - 14); g.lineTo(x - dir * 6, y + 14); g.closePath(); g.fill(); g.stroke();
        }
        g.restore();
      }
    }
    // 選んだ瞬間:全部が真ん中へ吸い込まれていく白い渦
    if (this.eatAll > 0) {
      g.fillStyle = `rgba(255,255,255,${this.eatAll * 0.6})`;
      g.fillRect(0, 0, S, S);
    }
  }

  _drawObj(g, o) {
    const pull = this.eatAll;
    const x = o.x + (this.cosmii.x - o.x) * pull, y = o.y + (this.cosmii.y - o.y) * pull;
    this._drawSprite(g, o.type, x, y, o.s * (0.3 + 0.7 * o.pop) * (1 - pull * 0.8), 0);
  }

  _drawSprite(g, type, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.drawImage(this.sprite(type, s), -s / 2, -s / 2, s, s);
    g.restore();
  }

  _drawCosmii(g, imgs, x, y, s, open) {
    if (!imgs) return;
    const img = open ? imgs.open : imgs.closed;
    const h = s * img.height / img.width;
    const bob = Math.sin(this.time * 10) * 2;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.ellipse(x, y + h * 0.36, s * 0.38, s * 0.12, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(img, x - s / 2, y - h / 2 + bob, s, h);
  }
}
