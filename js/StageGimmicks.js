/* =========================================================
 * StageGimmicks.js - ステージごとの仕掛け
 *  2 カラフルタウン   : おもちゃが増える
 *  3 ドライブシティ   : 車が道路を走る(後ろからなら丸飲み/正面はドカン)
 *  4 ショッピング     : タイムセール(範囲内スコア3倍)
 *  5 オフィス         : 逃げる時計(食べると残り時間+3秒)
 *  6 ファクトリー     : ベルトコンベア(物も自分も運ばれる)
 *  7 ハーバー         : クレーンの落とし物(影→落下→中身が散らばる)
 *  8 エアポート       : 飛び立つ荷物(光った物は数秒で飛んでいく)
 *  9 ネオンフューチャー: 停電(自分の周りと光る物だけ見える)
 * 10 アーケード・ヘブン: 上の仕掛けが順番に切り替わる
 *
 * Game から呼ばれるフック:
 *   start() / stop() / update(dt)
 *   canEat(obj, player, mouth) → true/false/null(null=通常判定)
 *   onBump(obj, player, mouth) → true なら通常の押し返しをしない
 *   scoreMul(obj) / onConsume(obj)
 *   drawGround(ctx, view) / drawTop(ctx) / drawScreen(ctx)
 * ========================================================= */
class Gimmick {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.extras = [];
    this.texts = [];
  }

  start() {}
  stop() {
    for (const obj of this.extras) obj.active = false;
    this.extras = [];
    this.texts = [];
  }
  update(dt) {
    if (this._pendingToast && this.game.state === 'play') { this.game.ui.showGimmickToast(this._pendingToast); this._pendingToast = null; }
    this.time += dt;
    for (const t of this.texts) t.life -= dt;
    this.texts = this.texts.filter(t => t.life > 0);
  }
  canEat() { return null; }
  onBump() { return false; }
  scoreMul() { return 1; }
  onConsume() {}
  drawGround() {}
  drawTop(ctx) { this._drawTexts(ctx); }
  drawScreen() {}

  /* ---- 共通ヘルパー ---- */

  get player() { return this.game.player; }

  /** ギミック専用の物を出す(吸われてもリスポーンしない) */
  spawnExtra(type, x, y) {
    const pool = this.game.spawner.eventPool;
    let obj = this.extras.find(item => !item.active);
    if (!obj) {
      obj = new GameObject();
      obj.gimmickOwned = true;
      this.extras.push(obj);
    }
    if (!pool.includes(obj)) pool.push(obj);
    const W = Game.WORLD;
    obj.reset(type, Math.max(60, Math.min(W - 60, x)), Math.max(60, Math.min(W - 60, y)));
    obj.eventOnly = true;
    return obj;
  }

  activeExtras(filter = () => true) {
    return this.extras.filter(obj => obj.active && filter(obj));
  }

  /** ステージ紹介の間に出すと重なるので、プレイが始まってから出す */
  toast(text) {
    if (this.game.state !== 'play') { this._pendingToast = text; return; }
    this.game.ui.showGimmickToast(text);
  }

  floatText(x, y, text, color = '#fff') {
    this.texts.push({ x, y, text, color, life: 1.1 });
  }

  _drawTexts(ctx) {
    for (const t of this.texts) {
      const k = 1 - t.life / 1.1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `900 ${Math.round(30 / Math.max(0.4, this.game.camera.zoom))}px "M PLUS Rounded 1c", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6 / Math.max(0.4, this.game.camera.zoom);
      ctx.strokeStyle = 'rgba(60,40,45,0.85)';
      ctx.fillStyle = t.color;
      const y = t.y - k * 60;
      ctx.strokeText(t.text, t.x, y);
      ctx.fillText(t.text, t.x, y);
      ctx.restore();
    }
  }

  /** いま画面に見えているか */
  inView(x, y, pad = 0) {
    const v = this.game.camera.viewBounds(this.game.w, this.game.h, pad);
    return x > v.l && x < v.r && y > v.t && y < v.b;
  }

  /** 画面内のランダムな位置(HUD を避ける) */
  randomInView(margin = 80) {
    const g = this.game, cam = g.camera;
    const sx = margin + Math.random() * Math.max(1, g.w - margin * 2);
    const sy = 160 + Math.random() * Math.max(1, g.h - 260);
    return { x: cam.x + (sx - g.w / 2) / cam.zoom, y: cam.y + (sy - g.h / 2) / cam.zoom };
  }

  toScreen(x, y) {
    const cam = this.game.camera;
    return {
      x: (x - cam.x + cam.offX) * cam.zoom + this.game.w / 2,
      y: (y - cam.y + cam.offY) * cam.zoom + this.game.h / 2,
    };
  }

  /** 画面外にある目標へ向けて、画面の端に矢印を出す */
  drawEdgeArrow(ctx, x, y, color, label) {
    const g = this.game;
    const p = this.toScreen(x, y);
    if (p.x > 30 && p.x < g.w - 30 && p.y > 130 && p.y < g.h - 60) return;
    const cx = g.w / 2, cy = g.h / 2;
    const a = Math.atan2(p.y - cy, p.x - cx);
    const rx = g.w / 2 - 36, ry = g.h / 2 - 90;
    const k = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6));
    const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k + 20;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#5a3b3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.rotate(a);
    ctx.fillStyle = '#5a3b3f';
    ctx.beginPath();
    ctx.moveTo(30, 0); ctx.lineTo(18, -9); ctx.lineTo(18, 9); ctx.closePath();
    ctx.fill();
    ctx.rotate(-a);
    ctx.fillStyle = '#5a3b3f';
    ctx.font = '900 12px "M PLUS Rounded 1c", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  typeById(id) {
    return GIMMICK_TYPES[id] || OBJECT_TYPES.find(type => type.id === id);
  }
}

/* ---------- 2 カラフルタウン:おもちゃが増える ---------- */
class MultiplyGimmick extends Gimmick {
  update(dt) {
    super.update(dt);
    this.timer = (this.timer ?? 1.5) - dt;
    for (const obj of this.activeExtras(o => o.gimmick && o.gimmick.pop < 1)) {
      obj.gimmick.pop = Math.min(1, obj.gimmick.pop + dt * 4);
      const t = obj.gimmick.pop;
      obj.drawScale = 0.2 + 0.8 * (1 + 0.25 * Math.sin(t * Math.PI));
      if (t >= 1) obj.drawScale = 1;
    }
    if (this.timer > 0) return;
    this.timer = 0.9;
    if (this.activeExtras().length >= 45) return;
    // 画面内の、いま食べられる物のそばに同じ物を生む
    const player = this.player;
    const candidates = [];
    this.game.spawner.forEachActive(obj => {
      if (obj.state !== 'idle' || obj.rainbowCharge || obj.scoreOnly) return;
      if (obj.type.req > player.eatScale || !this.inView(obj.x, obj.y, 120)) return;
      candidates.push(obj);
    });
    if (!candidates.length) return;
    const parent = candidates[Math.floor(Math.random() * candidates.length)];
    const a = Math.random() * Math.PI * 2;
    const d = parent.r * 1.4 + 20 + Math.random() * 30;
    const copy = this.spawnExtra(parent.type, parent.x + Math.cos(a) * d, parent.y + Math.sin(a) * d);
    copy.gimmick = { pop: 0 };
    copy.drawScale = 0.2;
    this.game.particles.ring(copy.x, copy.y, '#ff9ec6', copy.r * 0.9);
  }
}

/* ---------- 3 ドライブシティ:車が道路を走る ---------- */
class TrafficGimmick extends Gimmick {
  static COUNT = 12;

  start() {
    this.carType = this.typeById('car');
    for (let i = 0; i < TrafficGimmick.COUNT; i++) this.spawnCar(true, i < 4);
    this.respawn = 0;
  }

  spawnCar(anywhere = false, nearStart = false) {
    const roads = nearStart ? [1400, 2100] : Game.ROADS;
    const road = roads[Math.floor(Math.random() * roads.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const W = Game.WORLD;
    // 右向きは道路の下側の車線、左向きは上側の車線
    const y = road + dir * 26;
    let x = anywhere ? 150 + Math.random() * (W - 300) : (dir > 0 ? 70 : W - 70);
    // 最初の数台はスタート地点の近く(ただし真横すぎない所)を走らせる
    if (nearStart) x = W / 2 + (Math.random() < 0.5 ? -1 : 1) * (380 + Math.random() * 300);
    const car = this.spawnExtra(this.carType, x, y);
    car.gimmick = { dir, speed: 150 + Math.random() * 90, drive: true };
    car.flipX = dir < 0;
    return car;
  }

  update(dt) {
    super.update(dt);
    const W = Game.WORLD;
    for (const car of this.activeExtras(o => o.gimmick && o.gimmick.drive)) {
      if (car.state !== 'idle') continue;
      car.x += car.gimmick.dir * car.gimmick.speed * dt;
      if (car.x > W - 60 || car.x < 60) car.x = car.gimmick.dir > 0 ? 70 : W - 70;
    }
    const alive = this.activeExtras(o => o.gimmick && o.gimmick.drive).length;
    if (alive < TrafficGimmick.COUNT) {
      this.respawn -= dt;
      if (this.respawn <= 0) { this.spawnCar(); this.respawn = 1.5; }
    }
  }

  /** 口が車の後ろ側にあるか */
  _behind(car, mouth) {
    return (mouth.x - car.x) * car.gimmick.dir < -car.r * 0.35;
  }

  canEat(obj, player, mouth) {
    if (!obj.gimmick || !obj.gimmick.drive) return null;
    return this._behind(obj, mouth);
  }

  onBump(obj, player, mouth) {
    if (!obj.gimmick || !obj.gimmick.drive) return false;
    const ahead = (mouth.x - obj.x) * obj.gimmick.dir > obj.r * 0.2;
    const close = Math.hypot(mouth.x - obj.x, mouth.y - obj.y) < obj.r + player.bodyR * 0.55;
    if (ahead && close && !(this.game.stunTimer > 0)) {
      // 正面衝突:はね飛ばされて、少し目が回る(コンボも途切れる)
      player.x += obj.gimmick.dir * 140;
      player.y += (player.y < obj.y ? -1 : 1) * 40;
      player.vx = player.vy = 0;
      this.game.stun(0.7, { type: obj.type });
      this.game.comboCount = 0;
      this.game.camera.shake(10);
      this.floatText(player.x, player.y - player.bodyR, 'ドカン！', '#ff6b6b');
    }
    return true;
  }

  scoreMul(obj) { return obj.gimmick && obj.gimmick.drive ? 1.5 : 1; }

  onConsume(obj) {
    if (obj.gimmick && obj.gimmick.drive) this.floatText(obj.x, obj.y - 30, 'まるのみ！', '#ffd24d');
  }

  drawGround(ctx) {
    // 車線の矢印(どっち向きに走るか分かるように)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const view = this.game.camera.viewBounds(this.game.w, this.game.h, 60);
    for (const road of Game.ROADS) {
      if (road < view.t - 60 || road > view.b + 60) continue;
      for (const dir of [1, -1]) {
        const y = road + dir * 26;
        const start = Math.floor(view.l / 260) * 260;
        for (let x = start; x < view.r; x += 260) {
          ctx.beginPath();
          ctx.moveTo(x + dir * 14, y);
          ctx.lineTo(x - dir * 8, y - 9);
          ctx.lineTo(x - dir * 8, y + 9);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}

/* ---------- 4 ショッピングパニック:タイムセール ---------- */
class SaleGimmick extends Gimmick {
  start() {
    this.zone = null;
    this.next = 3;
  }

  update(dt) {
    super.update(dt);
    if (this.zone) {
      this.zone.left -= dt;
      if (this.zone.left <= 0) { this.zone = null; this.next = 6; }
      return;
    }
    this.next -= dt;
    if (this.next > 0) return;
    const p = this.player, a = Math.random() * Math.PI * 2, d = 380 + Math.random() * 320;
    const W = Game.WORLD;
    this.zone = {
      x: Math.max(300, Math.min(W - 300, p.x + Math.cos(a) * d)),
      y: Math.max(300, Math.min(W - 300, p.y + Math.sin(a) * d)),
      r: 260, left: 8,
    };
    this.toast('タイムセール！ 光る場所は3倍');
  }

  inZone(obj) {
    const z = this.zone;
    return z && Math.hypot(obj.x - z.x, obj.y - z.y) < z.r;
  }

  scoreMul(obj) { return this.inZone(obj) ? 3 : 1; }

  drawGround(ctx) {
    const z = this.zone;
    if (!z) return;
    const blink = z.left < 2 ? 0.5 + 0.5 * Math.sin(this.time * 18) : 1;
    ctx.save();
    const grad = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
    grad.addColorStop(0, `rgba(255, 236, 140, ${0.55 * blink})`);
    grad.addColorStop(1, `rgba(255, 210, 77, ${0.25 * blink})`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([26, 18]);
    ctx.lineDashOffset = -this.time * 60;
    ctx.lineWidth = 8;
    ctx.strokeStyle = `rgba(255, 107, 129, ${blink})`;
    ctx.stroke();
    ctx.restore();
  }

  drawTop(ctx) {
    const z = this.zone;
    if (z) {
      ctx.save();
      ctx.font = '900 52px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#ff4f6d';
      const text = `SALE  ${Math.ceil(z.left)}`;
      ctx.strokeText(text, z.x, z.y - z.r - 14);
      ctx.fillText(text, z.x, z.y - z.r - 14);
      ctx.restore();
    }
    super.drawTop(ctx);
  }

  drawScreen(ctx) {
    if (this.zone) this.drawEdgeArrow(ctx, this.zone.x, this.zone.y, '#ffd24d', 'セール');
  }
}

/* ---------- 5 オフィスラッシュ:逃げる時計 ---------- */
class ClockGimmick extends Gimmick {
  static COUNT = 3;

  /** opts.count:同時に出る数 / opts.respawn:食べてから次が出るまで / opts.first:最初に出るまで / opts.normal:どのステージにも出る普通の時計 */
  constructor(game, opts = {}) {
    super(game);
    this.count = opts.count || ClockGimmick.COUNT;
    this.respawnTime = opts.respawn || 3;
    this.first = opts.first || 0;
    this.normal = !!opts.normal;
  }

  start() {
    this.clockType = this.typeById('clock');
    this.respawn = [];
    if (this.first > 0) { for (let i = 0; i < this.count; i++) this.respawn.push({ t: this.first }); return; }
    for (let i = 0; i < this.count; i++) this.spawnClock(true);
  }

  spawnClock(near = false) {
    const p = this.player, a = Math.random() * Math.PI * 2;
    const d = near ? 380 + Math.random() * 260 : 700 + Math.random() * 400;
    const clock = this.spawnExtra(this.clockType, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
    clock.gimmick = { clock: true, vx: 0, vy: 0, wander: Math.random() * 6 };
  }

  update(dt) {
    super.update(dt);
    const p = this.player, W = Game.WORLD;
    const runSpeed = 250;
    for (const c of this.activeExtras(o => o.gimmick && o.gimmick.clock)) {
      if (c.state !== 'idle') continue;
      const g = c.gimmick;
      g.wander += dt;
      const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1;
      let tx = Math.cos(g.wander * 0.7) * 70, ty = Math.sin(g.wander * 0.9) * 70;
      if (d < 300) { tx = dx / d * runSpeed; ty = dy / d * runSpeed; }
      // 壁際では壁沿いに逃げる(角に追い詰めれば捕まえられる)
      if (c.x < 120 && tx < 0) tx = 0;
      if (c.x > W - 120 && tx > 0) tx = 0;
      if (c.y < 120 && ty < 0) ty = 0;
      if (c.y > W - 120 && ty > 0) ty = 0;
      const k = 1 - Math.pow(0.02, dt);
      g.vx += (tx - g.vx) * k;
      g.vy += (ty - g.vy) * k;
      c.x = Math.max(60, Math.min(W - 60, c.x + g.vx * dt));
      c.y = Math.max(60, Math.min(W - 60, c.y + g.vy * dt));
      c.rot = Math.sin(this.time * 14 + g.wander) * (d < 300 ? 0.35 : 0.1);
    }
    for (const r of this.respawn) r.t -= dt;
    const ready = this.respawn.filter(r => r.t <= 0);
    this.respawn = this.respawn.filter(r => r.t > 0);
    for (let i = 0; i < ready.length; i++) this.spawnClock();
  }

  onConsume(obj) {
    if (!obj.gimmick || !obj.gimmick.clock) return;
    this.game.timeLeft += 3;
    this.game.runTimeLimit += 3;
    this.floatText(obj.x, obj.y - 30, '+3秒', '#58cfee');
    this.respawn.push({ t: this.respawnTime });
  }

  drawScreen(ctx) {
    // 一番近い時計の方向を示す(普通の時計は、残り時間が少ない時だけ)
    if (this.normal && this.game.timeLeft > 15) return;
    const p = this.player;
    let best = null, bd = Infinity;
    for (const c of this.activeExtras(o => o.gimmick && o.gimmick.clock)) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) this.drawEdgeArrow(ctx, best.x, best.y, '#c5f7ff', '+3秒');
  }
}

/* ---------- 6 ファクトリーブレイク:ベルトコンベア ---------- */
class ConveyorGimmick extends Gimmick {
  static SPEED = 190;
  static WIDTH = 150;

  start() {
    // 道路の間を通るベルト。スタート地点(中央)を横切る1本で、始めてすぐ流れを体験できる
    this.belts = [
      { axis: 'x', at: 1750, dir: 1 },
      { axis: 'x', at: 1050, dir: -1 },
      { axis: 'x', at: 2450, dir: -1 },
      { axis: 'y', at: 1050, dir: 1 },
      { axis: 'y', at: 2450, dir: -1 },
    ];
    // 最初からベルトの上に物を並べておく
    let placed = 0;
    for (const obj of this.game.spawner.pool) {
      if (placed >= 36 || !obj.active || obj.type.req > 2) continue;
      const belt = this.belts[placed % this.belts.length];
      const along = 150 + Math.random() * (Game.WORLD - 300);
      if (belt.axis === 'x') { obj.x = along; obj.y = belt.at + (Math.random() - 0.5) * 60; }
      else { obj.y = along; obj.x = belt.at + (Math.random() - 0.5) * 60; }
      placed++;
    }
  }

  beltAt(x, y) {
    const half = ConveyorGimmick.WIDTH / 2;
    for (const belt of this.belts) {
      const v = belt.axis === 'x' ? y : x;
      if (Math.abs(v - belt.at) < half) return belt;
    }
    return null;
  }

  update(dt) {
    super.update(dt);
    const W = Game.WORLD, sp = ConveyorGimmick.SPEED * dt;
    this.game.spawner.forEachActive(obj => {
      if (obj.state !== 'idle' || obj.rainbowCharge) return;
      const belt = this.beltAt(obj.x, obj.y);
      if (!belt) return;
      if (belt.axis === 'x') {
        obj.x += belt.dir * sp;
        if (obj.x > W - 70) obj.x = 80; else if (obj.x < 70) obj.x = W - 80;
      } else {
        obj.y += belt.dir * sp;
        if (obj.y > W - 70) obj.y = 80; else if (obj.y < 70) obj.y = W - 80;
      }
    });
    // 自分も運ばれる(流れに乗れば速く移動できる)
    const p = this.player, belt = this.beltAt(p.x, p.y);
    if (belt) {
      const m = p.bodyR * 0.6;
      if (belt.axis === 'x') p.x = Math.max(m, Math.min(W - m, p.x + belt.dir * sp));
      else p.y = Math.max(m, Math.min(W - m, p.y + belt.dir * sp));
    }
  }

  drawGround(ctx, view) {
    const half = ConveyorGimmick.WIDTH / 2, W = Game.WORLD;
    ctx.save();
    for (const belt of this.belts) {
      const horizontal = belt.axis === 'x';
      // ベルト本体
      ctx.fillStyle = '#4a4f55';
      if (horizontal) ctx.fillRect(0, belt.at - half, W, half * 2);
      else ctx.fillRect(belt.at - half, 0, half * 2, W);
      ctx.fillStyle = '#f5c443';
      if (horizontal) { ctx.fillRect(0, belt.at - half, W, 8); ctx.fillRect(0, belt.at + half - 8, W, 8); }
      else { ctx.fillRect(belt.at - half, 0, 8, W); ctx.fillRect(belt.at + half - 8, 0, 8, W); }
      // 流れる山形の模様
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      const gap = 90, offset = ((this.time * ConveyorGimmick.SPEED) % gap) * belt.dir;
      const from = horizontal ? view.l : view.t, to = horizontal ? view.r : view.b;
      for (let s = Math.floor(from / gap) * gap - gap; s < to + gap; s += gap) {
        const c = s + offset;
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(c - belt.dir * 18, belt.at - 34); ctx.lineTo(c + belt.dir * 14, belt.at); ctx.lineTo(c - belt.dir * 18, belt.at + 34);
        } else {
          ctx.moveTo(belt.at - 34, c - belt.dir * 18); ctx.lineTo(belt.at, c + belt.dir * 14); ctx.lineTo(belt.at + 34, c - belt.dir * 18);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ---------- 7 ハーバーキャッチ:クレーンの落とし物 ---------- */
class CraneGimmick extends Gimmick {
  static WARN = 1.6;
  static FALL = 0.35;

  start() {
    this.drops = [];
    this.next = 2;
    this.crate = this.typeById('crate');
    this.loot = ['coin', 'shoppingBag', 'flower'].map(id => this.typeById(id));
  }

  update(dt) {
    super.update(dt);
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 3.2;
      const p = this.player, a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 260;
      this.drops.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0, r: 95 });
    }
    for (const drop of this.drops) {
      drop.t += dt;
      if (!drop.landed && drop.t >= CraneGimmick.WARN + CraneGimmick.FALL) this.land(drop);
    }
    this.drops = this.drops.filter(drop => drop.t < CraneGimmick.WARN + CraneGimmick.FALL + 0.4);
  }

  land(drop) {
    drop.landed = true;
    const g = this.game, p = this.player;
    g.camera.shake(12);
    g.particles.ring(drop.x, drop.y, '#c9883e', drop.r);
    if (Math.hypot(p.x - drop.x, p.y - drop.y) < drop.r * 0.8 + p.bodyR * 0.4) {
      g.stun(0.9, { type: drop.type || this.typeById('crate') });
      g.comboCount = 0;
      this.floatText(p.x, p.y - p.bodyR, 'ゴツン！', '#ff9b5a');
    }
    // 箱が割れて中身が散らばる
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4, d = 50 + Math.random() * 90;
      const type = this.loot[Math.floor(Math.random() * this.loot.length)];
      const obj = this.spawnExtra(type, drop.x + Math.cos(a) * d, drop.y + Math.sin(a) * d);
      obj.gimmick = { loot: true };
    }
  }

  drawGround(ctx) {
    for (const drop of this.drops) {
      if (drop.landed) continue;
      const k = Math.min(1, drop.t / CraneGimmick.WARN);
      ctx.save();
      ctx.fillStyle = `rgba(30, 20, 25, ${0.12 + 0.3 * k})`;
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y, drop.r * (0.4 + 0.6 * k), drop.r * (0.25 + 0.35 * k), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 90, 90, ${0.4 + 0.5 * Math.abs(Math.sin(drop.t * 10))})`;
      ctx.lineWidth = 5;
      ctx.setLineDash([14, 10]);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawTop(ctx) {
    const view = this.game.camera.viewBounds(this.game.w, this.game.h, 0);
    for (const drop of this.drops) {
      if (drop.landed) continue;
      const fall = Math.max(0, (drop.t - CraneGimmick.WARN) / CraneGimmick.FALL);
      const top = view.t - 40;
      const y = drop.t < CraneGimmick.WARN ? top + 90 : top + 90 + (drop.y - top - 90) * fall * fall;
      ctx.save();
      // ロープとフック
      ctx.strokeStyle = '#5a3b3f';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(drop.x, top); ctx.lineTo(drop.x, y - 40); ctx.stroke();
      const sprite = GameObject.getSprite(this.crate);
      const size = sprite.drawSize * 1.9;
      ctx.drawImage(sprite.canvas, drop.x - size / 2, y - size / 2, size, size);
      ctx.restore();
    }
    super.drawTop(ctx);
  }
}

/* ---------- 8 エアポートダッシュ:飛び立つ荷物 ---------- */
class FlyAwayGimmick extends Gimmick {
  static GLOW = 4.5;

  start() {
    this.next = 1.5;
    this.flying = [];
  }

  update(dt) {
    super.update(dt);
    this.next -= dt;
    let glowing = 0;
    this.game.spawner.forEachActive(obj => { if (obj.gimmick && obj.gimmick.glow) glowing++; });
    if (this.next <= 0 && glowing < 3) {
      this.next = 1.6;
      const player = this.player, list = [];
      for (const obj of this.game.spawner.pool) {
        if (!obj.active || obj.state !== 'idle' || obj.gimmick) continue;
        if (obj.type.req > player.eatScale || !this.inView(obj.x, obj.y, 120)) continue;
        list.push(obj);
      }
      if (list.length) {
        const obj = list[Math.floor(Math.random() * list.length)];
        obj.gimmick = { glow: FlyAwayGimmick.GLOW };
      }
    }
    for (const obj of this.game.spawner.pool) {
      if (!obj.active || !obj.gimmick || !obj.gimmick.glow || obj.state !== 'idle') continue;
      obj.gimmick.glow -= dt;
      obj.y += Math.sin(this.time * 9 + obj.x) * 0.4;
      if (obj.gimmick.glow <= 0) {
        // 間に合わなかった:空へ飛んでいく
        this.flying.push({ type: obj.type, x: obj.x, y: obj.y, t: 0 });
        obj.gimmick = null;
        this.game.spawner.kill(obj);
      }
    }
    for (const f of this.flying) f.t += dt;
    this.flying = this.flying.filter(f => f.t < 0.9);
  }

  stop() {
    for (const obj of this.game.spawner.pool) if (obj.gimmick && obj.gimmick.glow) obj.gimmick = null;
    this.flying = [];
    super.stop();
  }

  scoreMul(obj) { return obj.gimmick && obj.gimmick.glow ? 3 : 1; }

  onConsume(obj) {
    if (obj.gimmick && obj.gimmick.glow) this.floatText(obj.x, obj.y - 24, 'キャッチ！', '#8fe6ff');
    obj.gimmick = null;
  }

  drawGround(ctx) {
    for (const obj of this.game.spawner.pool) {
      if (!obj.active || !obj.gimmick || !obj.gimmick.glow) continue;
      const left = obj.gimmick.glow / FlyAwayGimmick.GLOW;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(this.time * (left < 0.35 ? 16 : 6)));
      ctx.fillStyle = '#8fe6ff';
      ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.r * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.r * 1.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawTop(ctx) {
    for (const f of this.flying) {
      const sprite = GameObject.getSprite(f.type);
      const k = f.t / 0.9;
      const size = sprite.drawSize * (1 - k * 0.5);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(sprite.canvas, f.x - size / 2 + k * 60, f.y - size / 2 - k * k * 420, size, size);
      ctx.restore();
    }
    super.drawTop(ctx);
  }
}

/* ---------- 9 ネオンフューチャー:停電 ---------- */
class BlackoutGimmick extends Gimmick {
  /** ぼかしで光るネオンの輪(色ごとにキャッシュ) */
  static glowSprite(color) {
    BlackoutGimmick.glows = BlackoutGimmick.glows || new Map();
    let c = BlackoutGimmick.glows.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.stroke();
    g.stroke();
    BlackoutGimmick.glows.set(color, c);
    return c;
  }

  static CYCLE = [['light', 6], ['flicker', 1.2], ['dark', 6]];

  start() {
    this.phase = 0;
    this.left = BlackoutGimmick.CYCLE[0][1];
    this.darkness = 0;
    // ネオンで光る物(停電中も見える)
    this.neonColors = ['#68f4e1', '#ff6bd6', '#ffe14d', '#8ea2ff'];
    this.game.spawner.forEachActive(obj => this._markNeon(obj));
  }

  _markNeon(obj) {
    if (obj.neon === undefined || obj.neonFor !== this) {
      obj.neonFor = this;
      obj.neon = Math.random() < 0.4 ? this.neonColors[Math.floor(Math.random() * 4)] : null;
    }
  }

  get state() { return BlackoutGimmick.CYCLE[this.phase][0]; }

  update(dt) {
    super.update(dt);
    this.left -= dt;
    if (this.left <= 0) {
      this.phase = (this.phase + 1) % BlackoutGimmick.CYCLE.length;
      this.left = BlackoutGimmick.CYCLE[this.phase][1];
      if (this.state === 'dark') this.toast('真っ暗！ 光っている物をねらえ');
    }
    const target = this.state === 'dark' ? 1 : this.state === 'flicker' ? (Math.sin(this.time * 40) > 0 ? 0.8 : 0.1) : 0;
    this.darkness += (target - this.darkness) * (1 - Math.pow(0.001, dt));
    this.game.spawner.forEachActive(obj => this._markNeon(obj));
  }

  scoreMul(obj) { return this.darkness > 0.5 && obj.neon ? 2 : 1; }

  drawScreen(ctx) {
    if (this.darkness < 0.02) return;
    const g = this.game, p = this.toScreen(this.player.x, this.player.y);
    const r = Math.max(110, this.player.bodyR * g.camera.zoom * 2.4);
    ctx.save();
    const grad = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r * 1.35);
    grad.addColorStop(0, 'rgba(5, 8, 25, 0)');
    grad.addColorStop(1, `rgba(5, 8, 25, ${0.9 * this.darkness})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.w, g.h);
    // ネオンで光る物だけ暗闇の上に描き直す
    ctx.globalAlpha = this.darkness;
    ctx.translate(g.w / 2, g.h / 2);
    ctx.scale(g.camera.zoom, g.camera.zoom);
    ctx.translate(-g.camera.x + g.camera.offX, -g.camera.y + g.camera.offY);
    const view = g.camera.viewBounds(g.w, g.h, 60);
    g.spawner.forEachActive(obj => {
      if (!obj.neon || obj.state !== 'idle') return;
      if (obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b) return;
      // ネオンの輪(光るぼかしは色ごとに1回だけ作った絵を使い回す)
      const glow = BlackoutGimmick.glowSprite(obj.neon);
      const R = obj.r * 1.15 * 1.6;
      ctx.drawImage(glow, obj.x - R, obj.y - R, R * 2, R * 2);
      obj.draw(ctx);
    });
    ctx.restore();
  }
}

/* ---------- 10 アーケード・ヘブン:全部入り ---------- */
class MixGimmick extends Gimmick {
  static ORDER = [
    ['multiply', MultiplyGimmick], ['traffic', TrafficGimmick], ['sale', SaleGimmick],
    ['conveyor', ConveyorGimmick], ['crane', CraneGimmick],
    ['flyaway', FlyAwayGimmick], ['blackout', BlackoutGimmick],
  ];
  static SWITCH = 9;

  start() {
    this.index = -1;
    this.current = null;
    this.next = 0;
  }

  stop() {
    if (this.current) this.current.stop();
    this.current = null;
    super.stop();
  }

  update(dt) {
    super.update(dt);
    this.next -= dt;
    if (this.next <= 0) {
      if (this.current) this.current.stop();
      this.index = (this.index + 1) % MixGimmick.ORDER.length;
      const [id, Cls] = MixGimmick.ORDER[this.index];
      this.current = new Cls(this.game);
      this.current.start();
      this.next = MixGimmick.SWITCH;
      this.toast(`しかけチェンジ！ ${StageGimmicks.INFO_BY_KIND[id].name}`);
    }
    this.current.update(dt);
  }

  canEat(...args) { return this.current ? this.current.canEat(...args) : null; }
  onBump(...args) { return this.current ? this.current.onBump(...args) : false; }
  scoreMul(obj) { return this.current ? this.current.scoreMul(obj) : 1; }
  onConsume(obj) { if (this.current) this.current.onConsume(obj); }
  drawGround(ctx, view) { if (this.current) this.current.drawGround(ctx, view); }
  drawTop(ctx) { if (this.current) this.current.drawTop(ctx); }
  drawScreen(ctx) { if (this.current) this.current.drawScreen(ctx); }
}

/* ---------- ニセコスミーの絵:本物(赤・青・ピンク)をもとに、色と目をちょっと変にする ---------- */
class FakeCosmii {
  static SKINS = ['red', 'blue', 'pink'];
  /** 目の位置(それぞれの絵の中の割合) */
  static EYES = {
    red: { open: { y: 0.38, l: 0.37, r: 0.645, s: 0.055, cover: 1.32 }, closed: { y: 0.625, l: 0.37, r: 0.624, s: 0.064 } },
    blue: { open: { y: 0.43, l: 0.34, r: 0.65, s: 0.06, cover: 1.45 }, closed: { y: 0.58, l: 0.367, r: 0.62, s: 0.07, cover: 1.4 } },
    pink: { open: { y: 0.55, l: 0.37, r: 0.64, s: 0.058, cover: 1.4 }, closed: { y: 0.70, l: 0.34, r: 0.64, s: 0.066, cover: 1.6 } },
  };
  /** 体の色をどう変えるか(元の色相と、変えたあとの色の作り方) */
  static RECOLOR = {
    red: { hue: 0, to: l => [l * 0.9 + 40, l * 0.55, l * 1.15 + 40] },       // くすんだ紫
    blue: { hue: 210, to: l => [l * 0.62, l * 0.95 + 18, l * 0.42] },        // にごった緑
    pink: { hue: 335, sat: 0.12, minL: 150, range: 45, to: l => [l * 0.95 + 12, l * 0.8, l * 0.42] }, // くすんだからし色
  };

  static images(base, skinId = 'red') {
    FakeCosmii.cache = FakeCosmii.cache || new Map();
    const key = skinId;
    const hit = FakeCosmii.cache.get(key);
    if (hit && hit.base === base) return hit.imgs;
    const eyes = FakeCosmii.EYES[skinId] || FakeCosmii.EYES.red;
    const rc = FakeCosmii.RECOLOR[skinId] || FakeCosmii.RECOLOR.red;
    const imgs = { open: FakeCosmii._make(base.open, eyes.open, rc), closed: FakeCosmii._make(base.closed, eyes.closed, rc) };
    FakeCosmii.cache.set(key, { base, imgs });
    return imgs;
  }

  static _make(src, eyes, rc) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const r = d[i], gr = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, gr, b), mn = Math.min(r, gr, b), sat = mx ? (mx - mn) / mx : 0;
      let hue = 0;
      if (mx !== mn) {
        if (mx === r) hue = 60 * (((gr - b) / (mx - mn)) % 6);
        else if (mx === gr) hue = 60 * ((b - r) / (mx - mn) + 2);
        else hue = 60 * ((r - gr) / (mx - mn) + 4);
      }
      if (hue < 0) hue += 360;
      const dh = Math.min(Math.abs(hue - rc.hue), 360 - Math.abs(hue - rc.hue));
      if (sat > (rc.sat || 0.28) && dh < (rc.range || 38) && (r + gr + b) / 3 >= (rc.minL || 0)) {
        // 体の色 → ニセモノの色(明るさは保つ)
        const [nr, ng, nb] = rc.to((r + gr + b) / 3);
        d[i] = Math.min(255, nr); d[i + 1] = Math.min(255, ng); d[i + 2] = Math.min(255, nb);
      } else if (r > 200 && gr > 185 && b > 150 && r - b < 75) {
        // 肌色 → 少し緑がかった白
        d[i] = r * 0.86; d[i + 1] = gr * 0.97; d[i + 2] = b * 0.9;
      }
    }
    g.putImageData(img, 0, 0);
    // 目:左はギョロッと大きく黒目が上を向き、右は小さい点で下の方
    const W = c.width, ey = eyes.y * c.height, er = eyes.s * W;
    const at = (x, y) => { const k = (Math.round(y) * c.width + Math.round(x)) * 4; return [d[k], d[k + 1], d[k + 2]]; };
    const [fr, fg, fb] = at((eyes.l + eyes.r) / 2 * W, ey - er * 0.6);
    for (const ex of [eyes.l * W, eyes.r * W]) {
      g.fillStyle = `rgb(${fr},${fg},${fb})`;
      g.beginPath(); g.arc(ex, ey - er * 0.08, er * (eyes.cover || 1.12), 0, Math.PI * 2); g.fill();
    }
    const lx = eyes.l * W, rx = eyes.r * W;
    g.fillStyle = '#fff'; g.strokeStyle = '#2a2233'; g.lineWidth = er * 0.22;
    g.beginPath(); g.arc(lx, ey - er * 0.1, er * 1.15, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#2a2233';
    g.beginPath(); g.arc(lx + er * 0.35, ey - er * 0.55, er * 0.38, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(rx, ey + er * 0.35, er * 0.42, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(rx - er * 0.12, ey + er * 0.22, er * 0.12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(160, 90, 200, 0.6)'; g.lineWidth = er * 0.15;
    g.beginPath(); g.arc(rx + er * 1.3, ey + er * 1.4, er * 0.4, 0, Math.PI * 1.6); g.stroke();
    return c;
  }
}

/* ---------- 新:ニセコスミー(食べ物の取り合い)。後半は少しずつ増えて最大3体 ----------
 * 3種類それぞれに性格と強さがある。ニセモノは本物より小さく、大きくならない。
 * 本物が「need」のサイズになったら、口で吸い込める(ポイントも入る)。 */
class RivalGimmick extends Gimmick {
  static RESPAWN = 7;
  static TYPES = {
    pink: { name: 'すばしっこい', need: 3, size: 0.45, speed: 1.0, eatReq: 2, chew: 0.5, bonus: 600, bump: 0, flee: true, color: '#e0b25a' },
    red: { name: 'くいしんぼう', need: 4, size: 0.55, speed: 0.78, eatReq: 4, chew: 0.4, bonus: 1000, bump: 0.4, dash: true, color: '#9a5fd0' },
    blue: { name: 'すいこみ', need: 5, size: 0.65, speed: 0.55, eatReq: 5, chew: 0.9, bonus: 1500, bump: 0.6, vacuum: true, color: '#6fc35a' },
  };
  /** 出てくる順(弱い → 強い) */
  static ORDER = ['pink', 'red', 'blue'];

  /** そのステージで同時に出る最大数(11・12面は1体だけ、13面は2体、14面からは3体) */
  static maxFor(stageId) { return stageId >= 14 ? 3 : stageId >= 13 ? 2 : 1; }
  /** 最初から出ている数(13面からは2体、18面からは3体) */
  static startFor(stageId) { return stageId >= 18 ? 3 : stageId >= 13 ? 2 : 1; }
  /** 吸い込むのに必要なサイズ(17面からは1つ上がる) */
  static needFor(id, stageId) { return RivalGimmick.TYPES[id].need + (stageId >= 17 ? 1 : 0); }

  start() {
    this.rivals = [];
    this.respawn = 0;
    this.stageId = this.game.getStage(this.game.currentStageId).id;
    this.max = RivalGimmick.maxFor(this.stageId);
    this.startCount = RivalGimmick.startFor(this.stageId);
    for (let i = 0; i < this.startCount; i++) this.spawnRival();
  }

  /** 何体まで出してよいか:ステージが進む(スコアが目標に近づく)ほど増える */
  get allowed() {
    const g = this.game, stage = g.getStage(g.currentStageId);
    const progress = stage.targetScore > 0 ? g.score / stage.targetScore : 0;
    // 最初の数から、スコアが目標の半分に届くごとに1体ふえる
    return Math.min(this.max, this.startCount + Math.floor(progress / 0.5));
  }

  spawnRival() {
    const g = this.game, p = this.player;
    // まだフィールドにいない種類から、弱い順に出す
    const id = RivalGimmick.ORDER.find(k => !this.rivals.some(r => r.kind === k)) || 'pink';
    const T = RivalGimmick.TYPES[id];
    const base = SKINS.find(k => k.id === id) || p.skin;
    const skin = Object.assign({}, base, { color: T.color });
    const a = Math.random() * Math.PI * 2;
    const r = new Player(skin, FakeCosmii.images(g.images[base.id], id), p.x + Math.cos(a) * 700, p.y + Math.sin(a) * 700);
    r.x = Math.max(200, Math.min(Game.WORLD - 200, r.x));
    r.y = Math.max(200, Math.min(Game.WORLD - 200, r.y));
    r.kind = id;
    r.T = T;
    r.need = RivalGimmick.needFor(id, this.stageId);
    r.scale = Math.max(0.6, p.scale * T.size);
    r.boostMul = T.speed;
    r.eaten = 0;
    r.target = null;
    r.retarget = 0;
    r.stun = 0;
    r.appear = 0;
    r.bumpCd = 0;
    r.dashT = 0;
    r.dashCd = 2 + Math.random() * 2;
    r.suck = 0;           // >0 の間は本物に吸い込まれている途中
    r.glitchSeed = Math.random() * 10;
    this.rivals.push(r);
    this.toast(this.rivals.length > 1 && !this.time ? `ニセコスミーが${this.rivals.length}体いる！` : `ニセコスミー(${T.name})が来た！`);
  }

  update(dt) {
    super.update(dt);
    if (this.rivals.length < this.allowed) {
      this.respawn -= dt;
      if (this.respawn <= 0) { this.respawn = 2; this.spawnRival(); }
    }
    for (const r of [...this.rivals]) this._updateRival(r, dt);
  }

  /** 本物がこのニセモノを吸い込めるか */
  canSuck(r) { return this.player.eatScale >= r.need; }

  _updateRival(r, dt) {
    const g = this.game, p = this.player, T = r.T;
    r.appear = Math.min(1, r.appear + dt * 2);
    // 吸い込まれている途中:口へ引き寄せて小さくなる
    if (r.suck > 0) {
      const m = p.getMouth();
      r.suck += dt;
      const k = Math.min(1, dt * 10);
      r.x += (m.x - r.x) * k; r.y += (m.y - r.y) * k;
      if (r.suck > 0.4) this._eatRival(r);
      return;
    }
    // ニセモノは本物より小さいまま(大きくならない)
    r.scale = Math.max(0.6, p.scale * T.size);
    if (r.bumpCd > 0) r.bumpCd -= dt;
    // 本物の口に入った:大きければ吸い込む
    const m = p.getMouth();
    const dm = Math.hypot(m.x - r.x, m.y - r.y);
    if (this.canSuck(r) && dm < m.r + r.bodyR * 1.3) {
      r.suck = 0.001;
      p.mouthHold = 0.6; p.mouthOpen = Math.max(p.mouthOpen, 0.8);
      return;
    }
    if (r.stun > 0) { r.stun -= dt; r.update({ active: false, dx: 0, dy: 0, ratio: 0 }, dt, Game.WORLD, dt); return; }
    // 食べたあとは少しもぐもぐして止まる
    if (r.chew > 0) { r.chew -= dt; r.mouthHold = 0; r.update({ active: false, dx: 0, dy: 0, ratio: 0 }, dt, Game.WORLD, dt); return; }

    const dp = Math.hypot(p.x - r.x, p.y - r.y);
    let dx, dy;
    if (T.flee && this.canSuck(r) && dp < 480) {
      // すばしっこい:食べられそうになると逃げる(少し横にそれる)
      const ax = (r.x - p.x) / (dp || 1), ay = (r.y - p.y) / (dp || 1);
      const side = Math.sin(this.time * 1.7 + r.glitchSeed) * 0.6;
      dx = ax - ay * side; dy = ay + ax * side;
      r.target = null;
    } else {
      // いちばん近い食べられる物をねらう(ほかのニセモノと同じ物はねらわない)
      r.retarget -= dt;
      if (r.retarget <= 0 || !r.target || !r.target.active || r.target.state !== 'idle') {
        r.retarget = 0.6;
        let best = null, bd = Infinity;
        g.spawner.forEachActive(o => {
          if (!this._food(o, r)) return;
          if (this.rivals.some(x => x !== r && x.target === o)) return;
          const d = Math.hypot(o.x - r.x, o.y - r.y);
          if (d < bd) { bd = d; best = o; }
        });
        r.target = best;
      }
      const tx = r.target ? r.target.x : p.x, ty = r.target ? r.target.y : p.y;
      dx = tx - r.x; dy = ty - r.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    // くいしんぼう:ときどき食べ物へダッシュ
    if (T.dash) {
      if (r.dashT > 0) r.dashT -= dt;
      else if ((r.dashCd -= dt) <= 0 && r.target) { r.dashT = 0.7; r.dashCd = 3 + Math.random() * 2; }
      r.boostMul = r.dashT > 0 ? 1.7 : T.speed;
    }
    r.update({ active: true, dx: dx / len, dy: dy / len, ratio: 0.9 }, dt, Game.WORLD, dt);

    const rm = r.getMouth();
    // すいこみ:まわりの物を口へ引き寄せる
    if (T.vacuum) {
      const R = rm.r + 140;
      g.spawner.forEachActive(o => {
        if (!this._food(o, r)) return;
        const ddx = rm.x - o.x, ddy = rm.y - o.y, d = Math.hypot(ddx, ddy);
        if (d > R || d < 1) return;
        const f = 110 * dt * (1 - d / R * 0.5);
        o.x += ddx / d * f; o.y += ddy / d * f;
      });
    }
    // 口に入った物はニセコスミーのもの(スコアにならない)
    g.spawner.forEachActive(o => {
      if (!this._food(o, r)) return;
      if (Math.hypot(o.x - rm.x, o.y - rm.y) > rm.r + o.r * 0.6) return;
      g.spawner.kill(o);
      r.eaten += o.type.score;
      r.pulse = 1; r.chew = T.chew;
      // 取られたポイントを紫で見せる(出しすぎない)
      if (this.time - (r.lastFloat || 0) > 0.45) { r.lastFloat = this.time; this.floatText(o.x, o.y - 20, `+${o.type.score}`, '#b57cff'); }
    });
    // まだ吸い込めない大きさでぶつかると、はじかれる(強い子ほど痛い)
    if (dp < (p.bodyR + r.bodyR) * 0.8 && r.bumpCd <= 0) {
      r.bumpCd = 1;
      if (T.bump > 0) { g.stun(T.bump, { img: r.images.closed }); g.camera.shake(8); }
      r.stun = 0.5;
      const nx = (p.x - r.x) / (dp || 1), ny = (p.y - r.y) / (dp || 1);
      p.x += nx * 70; p.y += ny * 70;
      r.x -= nx * 50; r.y -= ny * 50;
    }
  }

  _food(o, r) {
    return o.state === 'idle' && !o.hazard && !o.gimmick && !o.bubble && o.type.req <= r.T.eatReq;
  }

  _eatRival(r) {
    const g = this.game;
    // 強さのボーナス+横取りされた分を取り返す(上限あり)
    const bonus = r.T.bonus + Math.min(3000, Math.floor(r.eaten));
    g.score += bonus * (g.scoreMultiplier || 1);
    this.floatText(r.x, r.y - 40, `ニセモノ ごちそうさま！ +${bonus}`, '#ffd24d');
    g.particles.ring(r.x, r.y, '#ffd24d', r.bodyR * 1.6);
    g.particles.burst(r.x, r.y, r.skin.color, g._activeEffect());
    g.camera.shake(10);
    if (g.audio && g.audio.grow) g.audio.grow();
    this.player.pulse = 1;
    this.rivals = this.rivals.filter(x => x !== r);
    this.respawn = RivalGimmick.RESPAWN;
    g._checkTarget();
  }

  /** (前の1体だけの作りとの互換用) */
  get rival() { return this.rivals ? this.rivals[0] || null : null; }

  drawGround(ctx) {
    // すいこみの吸引範囲
    for (const r of this.rivals) {
      if (!r.T.vacuum || r.suck > 0) continue;
      const m = r.getMouth(), R = m.r + 140;
      ctx.save();
      ctx.strokeStyle = 'rgba(111, 195, 90, 0.35)';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -this.time * 40;
      ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  drawTop(ctx) {
    for (const r of this.rivals) {
      ctx.save();
      const s = (0.3 + 0.7 * r.appear) * (r.suck > 0 ? Math.max(0.1, 1 - r.suck / 0.4) : 1);
      ctx.translate(r.x, r.y); ctx.scale(s, s); ctx.translate(-r.x, -r.y);
      // くいしんぼうのダッシュ中は線を引く
      if (r.dashT > 0) {
        ctx.strokeStyle = 'rgba(154, 95, 208, 0.5)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        const a = Math.atan2(r.dirY || 0, r.dirX || 1) + Math.PI;
        for (let i = -1; i <= 1; i++) {
          const ox = Math.cos(a + i * 0.35) * r.bodyR, oy = Math.sin(a + i * 0.35) * r.bodyR;
          ctx.beginPath(); ctx.moveTo(r.x + ox, r.y + oy); ctx.lineTo(r.x + ox * 1.8, r.y + oy * 1.8); ctx.stroke();
        }
      }
      // ときどきバグって、ずれて見える
      const t = this.time + r.glitchSeed;
      if (Math.sin(t * 2.3) > 0.85 || Math.sin(t * 5.1 + 1) > 0.97) {
        const off = r.bodyR * 0.12;
        ctx.globalAlpha = 0.45;
        ctx.translate(off, 0); r.draw(ctx);
        ctx.translate(-off * 2, 0); r.draw(ctx);
        ctx.translate(off, 0);
        ctx.globalAlpha = 1;
      }
      r.draw(ctx);
      ctx.restore();
      if (r.suck > 0) continue;
      this._drawBadge(ctx, r);
      if (r.stun > 0) this.game._drawShock(ctx, r);
    }
    super.drawTop(ctx);
  }

  /** 頭の上の印:吸い込めるなら緑で口のマーク、まだなら必要なサイズの数字 */
  _drawBadge(ctx, r) {
    const ok = this.canSuck(r);
    const R = Math.max(20, r.bodyR * 0.3);
    const bob = ok ? Math.sin(this.time * 8) * R * 0.2 : 0;
    const x = r.x, y = r.y - r.bodyR * 0.95 - R * 1.6 + bob;
    ctx.save();
    ctx.translate(x, y); ctx.scale(R / 20, R / 20);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4f3a40';
    ctx.fillStyle = ok ? '#8fd14f' : '#ff6b81';
    ctx.beginPath(); ctx.moveTo(-8, 15); ctx.lineTo(8, 15); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (ok) {
      // ぱくっと開いた口(今なら吸い込める)
      ctx.fillStyle = '#4f3a40';
      ctx.beginPath(); ctx.ellipse(0, 2, 10, 6 + Math.abs(Math.sin(this.time * 8)) * 4, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // 吸い込むのに必要なサイズ
      ctx.fillStyle = '#fff';
      ctx.font = '900 24px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(r.need), 0, 2);
    }
    ctx.restore();
  }

  drawScreen(ctx) {
    const g = this.game;
    for (const r of this.rivals) {
      // 体が少しでも画面に見えている間は矢印を出さない
      const q = this.toScreen(r.x, r.y);
      if (q.x > -20 && q.x < g.w + 20 && q.y > -20 && q.y < g.h + 20) continue;
      this.drawEdgeArrow(ctx, r.x, r.y, this.canSuck(r) ? '#8fd14f' : '#c89bff', 'ニセ');
    }
  }
}

/* ---------- 新:巨大エラー(体当たりでかけらを落とし、小さくして丸のみ) ---------- */
class BossGimmick extends Gimmick {
  static HITS = 6;

  start() {
    this.next = 2;
    this.boss = null;
  }

  spawnBoss() {
    const g = this.game, p = this.player;
    const theme = Game.THEMES[g.getStage(g.currentStageId).theme] || Game.THEMES.park;
    const big = theme.objects.map(id => this.typeById(id)).filter(Boolean).sort((a, b) => b.r - a.r)[0] || this.typeById('house');
    const a = Math.random() * Math.PI * 2, d = 300 + p.bodyR * 5;
    const obj = this.spawnExtra(big, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
    // 大きさは「いまの自分」が基準:最初は自分の約2倍、ぶつけきると自分より小さくなる(画面からはみ出さない)
    const bigMul = (p.bodyR * 1.9) / big.r, smallMul = (p.bodyR * 0.75) / big.r;
    obj.gimmick = { boss: true, hits: 0, cd: 0, bigMul, smallMul };
    obj.drawScale = bigMul;
    obj.sizeMul = bigMul;
    this.boss = obj;
    this.toast('大きすぎる物！ ぶつかって小さくしよう');
  }

  update(dt) {
    super.update(dt);
    const b = this.boss;
    if (!b || !b.active) {
      this.boss = null;
      this.next -= dt;
      if (this.next <= 0) { this.next = 14; this.spawnBoss(); }
      return;
    }
    const g = b.gimmick;
    if (g.cd > 0) g.cd -= dt;
    if (g.flash > 0) g.flash -= dt;
    if (g.pop > 0) g.pop = Math.max(0, g.pop - dt * 4);
    // ぶるぶる(たたかれた直後は大きくゆれる。食べられる時は止まる)
    const ready = g.hits >= BossGimmick.HITS;
    b.rot = ready ? Math.sin(this.time * 4) * 0.03 : Math.sin(this.time * 9) * 0.05 + (g.flash > 0 ? Math.sin(this.time * 60) * 0.12 : 0);
    const shrink = 1 - g.hits / BossGimmick.HITS;
    const target = g.smallMul + (g.bigMul - g.smallMul) * shrink;
    b.drawScale += (target - b.drawScale) * Math.min(1, dt * 6);
    b.sizeMul = b.drawScale;
  }

  canEat(obj, player) {
    if (!obj.gimmick || !obj.gimmick.boss) return null;
    // じゅうぶん小さくしたら、大きさに関係なく丸のみできる
    return obj.gimmick.hits >= BossGimmick.HITS;
  }

  onBump(obj, player) {
    if (!obj.gimmick || !obj.gimmick.boss) return false;
    const g = obj.gimmick, game = this.game;
    if (g.cd > 0 || g.hits >= BossGimmick.HITS) return true;
    g.cd = 0.35;
    g.hits++;
    game.camera.shake(7);
    game.particles.ring(obj.x, obj.y, '#ff4fa3', obj.r * 0.9);
    // かけらが飛び散る(食べられる)
    const theme = Game.THEMES[game.getStage(game.currentStageId).theme] || Game.THEMES.park;
    for (let i = 0; i < 4; i++) {
      const id = theme.objects[Math.floor(Math.random() * theme.objects.length)];
      const type = this.typeById(id);
      if (!type || type.req > player.eatScale) continue;
      const a = Math.random() * Math.PI * 2, d = obj.r + 60 + Math.random() * 80;
      const bit = this.spawnExtra(type, obj.x + Math.cos(a) * d, obj.y + Math.sin(a) * d);
      bit.wobble = 0.5;
    }
    // 体ははね返る
    const dx = player.x - obj.x, dy = player.y - obj.y, d = Math.hypot(dx, dy) || 1;
    player.x += dx / d * 50; player.y += dy / d * 50;
    // 文字は出さず、頭の数字がポンッとはねて減る
    if (g.hits >= BossGimmick.HITS) game.particles.ring(obj.x, obj.y, '#8fd14f', obj.r * 1.4);
    g.flash = 0.25;
    g.pop = 1;
    return true;
  }

  scoreMul(obj) { return obj.gimmick && obj.gimmick.boss ? 5 : 1; }  // ごちそう(コンボとかけ算になるので控えめに)

  onConsume(obj) {
    if (!obj.gimmick || !obj.gimmick.boss) return;
    this.floatText(obj.x, obj.y - 40, 'ごちそうさま！', '#ffd24d');
    this.game.camera.shake(12);
    this.boss = null;
  }

  drawGround(ctx) {
    const b = this.boss;
    if (!b || !b.active) return;
    const ready = b.gimmick.hits >= BossGimmick.HITS;
    ctx.save();
    ctx.lineWidth = 8;
    if (ready) {
      // 食べられる:緑の輪
      ctx.strokeStyle = 'rgba(143, 209, 79, 0.85)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.15 + Math.sin(this.time * 8) * 8, 0, Math.PI * 2); ctx.stroke();
    } else {
      // 足元の赤い警告の輪(色ずれでバグっぽく)
      for (const [c, ox] of [['rgba(255,79,163,0.6)', 4], ['rgba(79,227,255,0.6)', -4]]) {
        ctx.strokeStyle = c;
        ctx.beginPath(); ctx.arc(b.x + ox, b.y, b.r * 1.05 + Math.sin(this.time * 6) * 6, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawTop(ctx) {
    const b = this.boss;
    if (b && b.active) {
      const g = b.gimmick, left = BossGimmick.HITS - g.hits, ready = left <= 0;
      // たたかれた瞬間は白く光る
      if (g.flash > 0) {
        ctx.save();
        ctx.globalAlpha = g.flash * 2.4;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // 頭の上の印:あと何回ぶつかればいいか。0になったら口のマーク(食べられる)
      const R = Math.max(26, b.r * 0.22);
      const bob = ready ? Math.sin(this.time * 8) * R * 0.2 : 0;
      const x = b.x, y = b.y - b.r * 0.85 - R * 1.2 + bob;
      ctx.save();
      ctx.translate(x, y); const pop = 1 + (g.pop || 0) * 0.45;
      ctx.scale(R / 20 * pop, R / 20 * pop);
      ctx.lineWidth = 4; ctx.strokeStyle = '#4f3a40';
      ctx.fillStyle = ready ? '#8fd14f' : '#ff4fa3';
      ctx.beginPath(); ctx.moveTo(-8, 15); ctx.lineTo(8, 15); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (ready) {
        ctx.fillStyle = '#4f3a40';
        ctx.beginPath(); ctx.ellipse(0, 2, 10, 6 + Math.abs(Math.sin(this.time * 8)) * 4, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = '900 24px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(left), 0, 2);
        // 「ぶつかれ」の小さな衝撃マーク
        ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 3;
        for (const a of [-2.4, -0.7]) {
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.lineTo(Math.cos(a) * 33, Math.sin(a) * 33); ctx.stroke();
        }
      }
      ctx.restore();
    }
    super.drawTop(ctx);
  }

  drawScreen(ctx) {
    if (this.boss && this.boss.active && !this.inView(this.boss.x, this.boss.y, this.boss.r * 0.6)) this.drawEdgeArrow(ctx, this.boss.x, this.boss.y, this.boss.gimmick.hits >= BossGimmick.HITS ? '#8fd14f' : '#ff4fa3', 'でか');
  }
}

/* ---------- 新:街が傾く(ときどき全部がすべっていく) ---------- */
class TiltGimmick extends Gimmick {
  static WARN = 1.4;
  static TILT = 3.2;
  static PUSH_ITEM = 220;
  static PUSH_PLAYER = 120;

  start() {
    this.phase = 'wait';
    this.t = 5;
    this.dir = { x: 1, y: 0 };
  }

  update(dt) {
    super.update(dt);
    this.t -= dt;
    if (this.phase === 'wait' && this.t <= 0) {
      const a = Math.floor(Math.random() * 8) * Math.PI / 4;
      this.dir = { x: Math.cos(a), y: Math.sin(a) };
      this.phase = 'warn'; this.t = TiltGimmick.WARN;
    } else if (this.phase === 'warn' && this.t <= 0) {
      this.phase = 'tilt'; this.t = TiltGimmick.TILT;
      this.game.camera.shake(6);
    } else if (this.phase === 'tilt') {
      const g = this.game, p = this.player, W = Game.WORLD;
      const k = Math.sin(Math.min(1, (TiltGimmick.TILT - this.t) / 0.5) * Math.PI / 2);
      g.spawner.forEachActive(o => {
        if (o.state !== 'idle' || (o.gimmick && (o.gimmick.drive || o.gimmick.boss))) return;
        const push = TiltGimmick.PUSH_ITEM * k * dt * Math.max(0.3, 1 - (o.type.req - 1) * 0.15);
        o.x = Math.max(70, Math.min(W - 70, o.x + this.dir.x * push));
        o.y = Math.max(70, Math.min(W - 70, o.y + this.dir.y * push));
        o.rot += dt * 2 * k;
      });
      if (!(g.warps && g.warps.active) && !g.fever) {
        const m = p.bodyR * 0.6;
        p.x = Math.max(m, Math.min(W - m, p.x + this.dir.x * TiltGimmick.PUSH_PLAYER * k * dt));
        p.y = Math.max(m, Math.min(W - m, p.y + this.dir.y * TiltGimmick.PUSH_PLAYER * k * dt));
      }
      if (this.t <= 0) { this.phase = 'wait'; this.t = 6 + Math.random() * 3; }
    }
  }

  drawScreen(ctx) {
    if (this.phase === 'wait') return;
    const g = this.game, a = Math.atan2(this.dir.y, this.dir.x);
    ctx.save();
    // 画面のふちに、すべっていく向きの大きな矢印
    const blink = this.phase === 'warn' ? (Math.floor(this.time * 6) % 2 ? 0.95 : 0.35) : 0.55;
    ctx.globalAlpha = blink;
    ctx.translate(g.w / 2, g.h / 2);
    ctx.rotate(a);
    const R = Math.min(g.w, g.h) * 0.42;
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.translate(R, i * 70);
      ctx.fillStyle = '#ffd24d';
      ctx.strokeStyle = '#4f3a40';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(26, 0); ctx.lineTo(-8, -24); ctx.lineTo(-8, -10); ctx.lineTo(-30, -10);
      ctx.lineTo(-30, 10); ctx.lineTo(-8, 10); ctx.lineTo(-8, 24); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (this.phase === 'tilt') {
      // 流れる線
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const x = ((i * 97 + this.time * 500 * this.dir.x) % g.w + g.w) % g.w;
        const y = ((i * 151 + this.time * 500 * this.dir.y) % g.h + g.h) % g.h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - this.dir.x * 50, y - this.dir.y * 50); ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/* ---------- 2つのギミックを同時に ---------- */
class ComboGimmick extends Gimmick {
  constructor(game, kinds) {
    super(game);
    this.parts = kinds.map(k => new StageGimmicks.CLASSES[k](game));
  }
  start() { for (const p of this.parts) p.start(); }
  stop() { for (const p of this.parts) p.stop(); super.stop(); }
  update(dt) { super.update(dt); for (const p of this.parts) p.update(dt); }
  canEat(...a) { for (const p of this.parts) { const v = p.canEat(...a); if (v !== null && v !== undefined) return v; } return null; }
  onBump(...a) { return this.parts.some(p => p.onBump(...a)); }
  scoreMul(obj) { return this.parts.reduce((m, p) => m * p.scoreMul(obj), 1); }
  onConsume(obj) { for (const p of this.parts) p.onConsume(obj); }
  drawGround(ctx, view) { for (const p of this.parts) p.drawGround(ctx, view); }
  drawTop(ctx) { for (const p of this.parts) p.drawTop(ctx); }
  drawScreen(ctx) { for (const p of this.parts) p.drawScreen(ctx); }
}

/* ---------- ステージとの対応 ---------- */
class StageGimmicks {
  static INFO_BY_KIND = {
    multiply: { name: 'おもちゃが増える', description: '食べ残したおもちゃのそばに、同じ物がポンッと生まれる' },
    traffic: { name: '走る車', description: '車は後ろからなら丸飲みできる。正面からぶつかるとはね飛ばされる' },
    sale: { name: 'タイムセール', description: '光っている範囲の物はおいしい。矢印の方へ急げ' },
    clock: { name: '逃げる時計', description: '逃げ回る時計を食べると残り時間+3秒(どのステージにも出る)' },
    conveyor: { name: 'ベルトコンベア', description: 'ベルトの上は物も自分も運ばれる。流れに乗ると速い' },
    crane: { name: 'クレーンの落とし物', description: '影の場所に荷物が落ちてくる。真下は危ないけど、中身はごちそう' },
    flyaway: { name: '飛び立つ荷物', description: '光った物は数秒で飛んでいく。間に合えば高得点' },
    blackout: { name: '停電', description: 'ときどき真っ暗に。ネオンに光る物を食べると高得点' },
    mix: { name: '全部入り', description: 'これまでのしかけが次々に切り替わる' },
    rival: { name: 'ニセコスミー', description: '食べ物を横取りする3種類のニセモノ。頭の数字のサイズになったら吸い込める' },
    boss: { name: '大きすぎる物', description: 'ぶつかるたびに小さくなる。頭の数字が0になったら食べられる(5倍)' },
    tilt: { name: '街が傾く', description: '矢印が出たら、街ごと全部がすべっていく。流れてくる物をねらえ' },
  };

  /** ステージ紹介で出す「ここに注意！」のひと言(そのコースの特徴) */
  static TIPS = {
    1: '小さい物から食べて大きくなろう',
    2: '食べ残すと増えるよ！どんどん食べよう',
    3: '車は後ろから食べよう！前はキケン',
    4: '光る場所で食べると点数3倍！',
    5: '大きすぎる物はぶつかって小さく！',
    6: '矢印の道に乗ると速く進めるよ',
    7: '影に注意！上から荷物が落ちてくる',
    8: '光った荷物はすぐ飛んでいく！急げ',
    9: 'ときどき真っ暗！光る物をねらおう',
    10: 'しかけが次々に変わるよ',
    11: 'ニセモノのコスミーに取られるな！',
    12: '車は後ろから！光る場所は3倍',
    13: '大きすぎる物はぶつかって小さく！',
    14: '矢印が出たら街がすべるよ！',
    15: '矢印の道に乗って光る場所へ！',
    16: '影と、大きすぎる物に注意！',
    17: '街がすべる！光った荷物は急いで',
    18: '真っ暗でも食べ残すと増えるよ',
    19: '車と、すべる街に注意！',
    20: 'さいご！ぜんぶのしかけが出るよ',
  };

  /** ステージ紹介で使う、ひと言の説明 */
  static SHORT = {
    multiply: '食べ残すと増える', traffic: '後ろから食べよう', sale: '光る所は3倍',
    clock: 'つかまえて+3秒', conveyor: '乗ると速い', crane: '影の下にごちそう',
    flyaway: '光ったら急いで', blackout: '光る物が高得点', mix: '次々に切り替わる',
    rival: '頭の数字の大きさで食べられる', boss: 'ぶつかって小さく', tilt: '矢印の方へすべる',
  };

  /** ギミックのアイコン(24×24の SVG) */
  static ICON = {
    multiply: '<circle cx="9" cy="13" r="6" fill="#ff9ec0"/><circle cx="15" cy="11" r="6" fill="#ffd24d"/><path d="M15 8v6M12 11h6" stroke="#4f3a40" stroke-width="2.2" stroke-linecap="round"/>',
    traffic: '<rect x="3" y="9" width="18" height="8" rx="3" fill="#ff6b6b"/><rect x="7" y="5" width="10" height="6" rx="2" fill="#8fd0ff"/><circle cx="8" cy="18" r="2.4" fill="#4f3a40"/><circle cx="16" cy="18" r="2.4" fill="#4f3a40"/>',
    sale: '<path d="M3 12 12 3h8v8l-9 9z" fill="#ff6b81"/><circle cx="16" cy="7.5" r="1.8" fill="#fff"/><path d="M9 12l3 3M8.5 15.5l6-6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    clock: '<circle cx="12" cy="13" r="8" fill="#8fe3ff" stroke="#4f3a40" stroke-width="2"/><path d="M12 9v4l3 2" stroke="#4f3a40" stroke-width="2" stroke-linecap="round"/>',
    conveyor: '<rect x="2" y="13" width="20" height="6" rx="3" fill="#4f3a40"/><circle cx="6" cy="16" r="1.6" fill="#fff"/><circle cx="12" cy="16" r="1.6" fill="#fff"/><circle cx="18" cy="16" r="1.6" fill="#fff"/><path d="M5 8h12M14 5l3 3-3 3" stroke="#ff9a3c" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    crane: '<path d="M12 2v8" stroke="#4f3a40" stroke-width="2"/><path d="M12 10a3 3 0 1 1-3 3" stroke="#4f3a40" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="12" cy="21" rx="7" ry="2" fill="#4f3a40" opacity=".35"/>',
    flyaway: '<rect x="7" y="10" width="10" height="9" rx="2" fill="#d9a066"/><path d="M7 13 2 10M17 13l5-3" stroke="#8fd0ff" stroke-width="3" stroke-linecap="round"/><path d="M12 8V3M9.5 5.5 12 3l2.5 2.5" stroke="#4f3a40" stroke-width="2" fill="none" stroke-linecap="round"/>',
    blackout: '<path d="M15 3a9 9 0 1 0 6 13A7 7 0 0 1 15 3z" fill="#4f3a40"/><circle cx="17" cy="7" r="1.6" fill="#ff6bd6"/><circle cx="20" cy="11" r="1.2" fill="#9df59a"/>',
    mix: '<rect x="3" y="3" width="8" height="8" rx="2" fill="#ff6b81"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#ffd24d"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#8fd0ff"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#9df59a"/>',
    rival: '<circle cx="12" cy="13" r="9" fill="#9a5fd0"/><circle cx="12" cy="14" r="6" fill="#d6ecc8"/><circle cx="9.5" cy="12.5" r="2.6" fill="#fff" stroke="#4f3a40" stroke-width="1.2"/><circle cx="10.3" cy="11.6" r="1" fill="#4f3a40"/><circle cx="15" cy="14.5" r="1" fill="#4f3a40"/>',
    boss: '<rect x="4" y="4" width="16" height="16" rx="3" fill="#ff4fa3"/><rect x="7" y="7" width="10" height="10" rx="2" fill="#fff" opacity=".35"/><path d="M12 8v5M12 16v.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
    tilt: '<g transform="rotate(-14 12 12)"><rect x="3" y="7" width="18" height="12" rx="2" fill="#8fd0ff"/><path d="M6 10h4M14 16h4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g><path d="M8 3l4 3 4-3" stroke="#ffb300" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  /** ステージ紹介の札:アイコン+名前+ひと言。11面からはニセコスミーの数も */
  static chipsFor(stageId) {
    const kinds = StageGimmicks.kindsFor(stageId);
    return kinds.map(k => ({
      kind: k,
      name: StageGimmicks.INFO_BY_KIND[k].name,
      short: StageGimmicks.SHORT[k],
      icon: StageGimmicks.ICON[k],
      count: k === 'rival' ? RivalGimmick.maxFor(stageId) : 0,
    }));
  }

  static KIND_BY_STAGE = {
    2: 'multiply', 3: 'traffic', 4: 'sale', 5: 'boss', 6: 'conveyor',
    7: 'crane', 8: 'flyaway', 9: 'blackout', 10: 'mix',
    // ふたつめの夜:11面からはニセコスミーがずっといる。ギミックは2つずつ組み合わせる
    // (止められた時は頭の上のふきだしで原因が分かる)
    11: 'rival', 12: ['traffic', 'sale', 'rival'], 13: ['boss', 'multiply', 'rival'], 14: ['tilt', 'sale', 'rival'],
    15: ['conveyor', 'sale', 'rival'], 16: ['crane', 'boss', 'rival'], 17: ['flyaway', 'tilt', 'rival'], 18: ['blackout', 'multiply', 'rival'],
    19: ['traffic', 'tilt', 'rival'], 20: ['boss', 'mix', 'rival'],
  };

  static CLASSES = {
    multiply: MultiplyGimmick, traffic: TrafficGimmick, sale: SaleGimmick, clock: ClockGimmick,
    conveyor: ConveyorGimmick, crane: CraneGimmick, flyaway: FlyAwayGimmick, blackout: BlackoutGimmick,
    mix: MixGimmick, rival: RivalGimmick, boss: BossGimmick, tilt: TiltGimmick,
  };

  static infoFor(stageId) {
    const kind = StageGimmicks.KIND_BY_STAGE[stageId];
    if (!kind) return null;
    if (Array.isArray(kind)) {
      const infos = kind.filter(k => k !== 'rival' || kind.length === 1).map(k => StageGimmicks.INFO_BY_KIND[k]);
      return { name: infos.map(i => i.name).join(' ＋ '), description: infos.map(i => i.description).join(' / ') };
    }
    return StageGimmicks.INFO_BY_KIND[kind];
  }

  /** そのステージのギミックの種類(組み合わせなら配列) */
  static kindsFor(stageId) {
    const kind = StageGimmicks.KIND_BY_STAGE[stageId];
    return !kind ? [] : Array.isArray(kind) ? kind : [kind];
  }

  static create(stageId, game) {
    const kind = StageGimmicks.KIND_BY_STAGE[stageId];
    if (!kind) return null;
    if (Array.isArray(kind)) return new ComboGimmick(game, kind);
    return new StageGimmicks.CLASSES[kind](game);
  }
}
