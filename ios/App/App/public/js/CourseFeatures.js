/* =========================================================
 * CourseFeatures.js - コースに置く仕掛け
 *  WindField   : 送風機。風の帯の中では物も自分も風下へ流される
 *                (全ステージ・チュートリアル以外。序盤1台〜後半3台)
 *  BubbleField : シャボン玉。物が閉じ込められてふわふわ漂う。体当たりで割ると食べられる
 *                (後半ステージ:6面以降)
 * ========================================================= */
class WindField {
  static LENGTH = 700;      // 風が届く長さ
  static WIDTH = 210;       // 風の帯の幅
  static PUSH_PLAYER = 170; // 自分が流される速さ(px/秒)
  static PUSH_ITEM = 130;   // 物が流される速さ

  // 後半(11面〜)はギミックとニセコスミーがいるので、送風機は1台だけ
  static countFor(stageId) { return stageId <= 3 ? 1 : stageId <= 6 ? 2 : stageId <= 10 ? 3 : 1; }

  constructor(game, stage) {
    this.game = game;
    this.stage = stage;
    this.fans = [];
    this.time = 0;
  }

  start() {
    const W = Game.WORLD;
    const safe = this.game.safePoint || { x: W / 2, y: W / 2 };
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let tries = 0; this.fans.length < WindField.countFor(this.stage.id) && tries < 300; tries++) {
      const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
      const x = 300 + Math.random() * (W - 600), y = 300 + Math.random() * (W - 600);
      const ex = x + dx * WindField.LENGTH, ey = y + dy * WindField.LENGTH;
      if (ex < 150 || ex > W - 150 || ey < 150 || ey > W - 150) continue;
      // スタート地点に風の帯がかからないように
      if (this._distToBand(safe.x, safe.y, { x, y, dx, dy }) < 380) continue;
      if (this.fans.some(f => Math.hypot(f.x - x, f.y - y) < 800)) continue;
      this.fans.push({ x, y, dx, dy });
    }
  }

  stop() { this.fans = []; }

  _distToBand(px, py, f) {
    const rx = px - f.x, ry = py - f.y;
    const along = Math.max(0, Math.min(WindField.LENGTH, rx * f.dx + ry * f.dy));
    const cx = f.x + f.dx * along, cy = f.y + f.dy * along;
    return Math.hypot(px - cx, py - cy);
  }

  /** その位置が風の帯の中なら、その送風機を返す */
  fanAt(x, y) {
    for (const f of this.fans) {
      const rx = x - f.x, ry = y - f.y;
      const along = rx * f.dx + ry * f.dy;
      const side = Math.abs(-rx * f.dy + ry * f.dx);
      if (along > 30 && along < WindField.LENGTH && side < WindField.WIDTH / 2) return f;
    }
    return null;
  }

  update(dt) {
    this.time += dt;
    const g = this.game, p = g.player, W = Game.WORLD;
    const pf = this.fanAt(p.x, p.y);
    if (pf && !(g.warps && g.warps.active) && !g.fever) {
      const m = p.bodyR * 0.6;
      p.x = Math.max(m, Math.min(W - m, p.x + pf.dx * WindField.PUSH_PLAYER * dt));
      p.y = Math.max(m, Math.min(W - m, p.y + pf.dy * WindField.PUSH_PLAYER * dt));
    }
    g.spawner.forEachActive(obj => {
      // 危険物は自分で歩くので風では流さない
      if (obj.state !== 'idle' || obj.rainbowCharge || obj.hazard || (obj.gimmick && obj.gimmick.drive)) return;
      const f = this.fanAt(obj.x, obj.y);
      if (!f) return;
      // 大きい物ほど流されにくい
      const k = WindField.PUSH_ITEM * Math.max(0.15, 1 - (obj.type.req - 1) * 0.25) * dt;
      obj.x = Math.max(80, Math.min(W - 80, obj.x + f.dx * k));
      obj.y = Math.max(80, Math.min(W - 80, obj.y + f.dy * k));
    });
  }

  /** 風の帯と流れる風の線(物より下) */
  drawGround(ctx, view) {
    for (const f of this.fans) {
      const L = WindField.LENGTH, Wd = WindField.WIDTH;
      const minX = Math.min(f.x, f.x + f.dx * L) - Wd, maxX = Math.max(f.x, f.x + f.dx * L) + Wd;
      const minY = Math.min(f.y, f.y + f.dy * L) - Wd, maxY = Math.max(f.y, f.y + f.dy * L) + Wd;
      if (maxX < view.l || minX > view.r || maxY < view.t || minY > view.b) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.atan2(f.dy, f.dx));
      // 帯(先にいくほど薄く)
      const grad = ctx.createLinearGradient(0, 0, L, 0);
      grad.addColorStop(0, 'rgba(225, 248, 255, 0.6)');
      grad.addColorStop(1, 'rgba(225, 248, 255, 0.08)');
      ctx.fillStyle = grad;
      ctx.fillRect(30, -Wd / 2, L - 30, Wd);
      // 流れる風の線
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const lane = (-0.4 + (i % 5) * 0.2) * Wd;
        const along = ((this.time * 300 + i * 113) % (L - 80)) + 50;
        ctx.globalAlpha = 0.95 * (1 - along / L);
        ctx.beginPath();
        ctx.moveTo(along, lane);
        ctx.quadraticCurveTo(along + 35, lane - 10, along + 75, lane);
        ctx.stroke();
      }
      // 向きが分かる矢印
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const along = 140 + i * 150 + ((this.time * 60) % 150);
        if (along > L - 40) continue;
        ctx.globalAlpha = 0.55 * (1 - along / L);
        ctx.beginPath();
        ctx.moveTo(along + 22, 0); ctx.lineTo(along - 8, -20); ctx.lineTo(along - 8, 20); ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** 送風機本体(物の上に描く) */
  drawTop(ctx, view) {
    for (const f of this.fans) {
      if (f.x < view.l - 80 || f.x > view.r + 80 || f.y < view.t - 80 || f.y > view.b + 80) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.atan2(f.dy, f.dx));
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3e4a5a';
      ctx.lineWidth = 5;
      // 台座
      ctx.fillStyle = '#9fb3c8';
      ctx.fillRect(-46, -18, 26, 36);
      ctx.strokeRect(-46, -18, 26, 36);
      // ファンのカバー
      ctx.fillStyle = '#e9f6ff';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 48, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // 回る羽根(横から見た形を伸び縮みで表現)
      ctx.fillStyle = '#58b4ee';
      for (let i = 0; i < 3; i++) {
        const a = this.time * 22 + i * (Math.PI * 2 / 3);
        ctx.save();
        ctx.scale(0.35, 1);
        ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, -22, 12, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#3e4a5a';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

class BubbleField {
  static fromStage = 6;

  /** シャボン玉の絵(1回だけ作って、大きさを変えて使い回す) */
  static sprite() {
    if (BubbleField.cached) return BubbleField.cached;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), r = 62;
    const grad = g.createRadialGradient(64 - r * 0.3, 64 - r * 0.35, r * 0.1, 64, 64, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.75, 'rgba(190, 235, 255, 0.18)');
    grad.addColorStop(0.92, 'rgba(255, 190, 245, 0.45)');
    grad.addColorStop(1, 'rgba(160, 220, 255, 0.7)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(64, 64, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 5;
    g.beginPath(); g.arc(64 - r * 0.15, 64 - r * 0.15, r * 0.72, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    BubbleField.cached = c;
    return c;
  }
  static countFor(stageId) { return 4 + Math.min(stageId, 12); }

  constructor(game, stage) {
    this.game = game;
    this.stage = stage;
    this.time = 0;
    this.refill = 0;
    this.popped = [];   // 割れた直後で、まだ吸い込めない物
  }

  start() {
    this._fill(BubbleField.countFor(this.stage.id), true);
  }

  stop() {
    this.game.spawner.forEachActive(obj => { obj.bubble = null; });
    for (const obj of this.popped) obj.noSuck = 0;
    this.popped = [];
  }

  _count() {
    let n = 0;
    this.game.spawner.forEachActive(obj => { if (obj.bubble) n++; });
    return n;
  }

  /** 食べられる大きさの物をシャボン玉に閉じ込める(画面外の物から選ぶ) */
  _fill(n, anywhere) {
    const g = this.game, p = g.player, view = g.camera.viewBounds(g.w, g.h, 100);
    const list = g.spawner.pool.filter(obj => obj.active && obj.state === 'idle' && !obj.bubble && !obj.rare &&
      obj.type.req <= 2 && Math.hypot(obj.x - p.x, obj.y - p.y) > 300 &&
      (anywhere || obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b));
    for (let i = 0; i < n && list.length; i++) {
      const obj = list.splice(Math.floor(Math.random() * list.length), 1)[0];
      obj.bubble = { phase: Math.random() * 10, vx: 0, vy: 0, a: Math.random() * Math.PI * 2 };
    }
  }

  update(dt) {
    this.time += dt;
    const g = this.game, p = g.player, W = Game.WORLD;
    g.spawner.forEachActive(obj => {
      const b = obj.bubble;
      if (!b) return;
      // ふわふわ漂う
      b.a += (Math.sin(this.time * 0.7 + b.phase) * 0.8) * dt;
      obj.x = Math.max(90, Math.min(W - 90, obj.x + Math.cos(b.a) * 28 * dt));
      obj.y = Math.max(90, Math.min(W - 90, obj.y + Math.sin(b.a) * 28 * dt + Math.sin(this.time * 2 + b.phase) * 0.3));
      // 体当たりで割れる
      const r = obj.r * 1.45;
      if (Math.hypot(p.x - obj.x, p.y - obj.y) < p.bodyR * 0.85 + r * 0.8) {
        obj.bubble = null;
        obj.wobble = 0.35;
        obj.noSuck = Math.max(obj.noSuck || 0, 0.25);
        g.particles.ring(obj.x, obj.y, '#bfefff', r * 1.2);
        g.particles.ring(obj.x, obj.y, '#ffffff', r * 0.8);
        this.popped.push(obj);
      }
    });
    // 割れてから少したったら吸い込めるようになる
    for (const obj of this.popped) if (obj.noSuck > 0) obj.noSuck = Math.max(0, obj.noSuck - dt);
    this.popped = this.popped.filter(obj => obj.active && obj.noSuck > 0);
    // 割れた分は時々補充(画面外で)
    this.refill -= dt;
    if (this.refill <= 0) {
      this.refill = 2.5;
      const missing = BubbleField.countFor(this.stage.id) - this._count();
      if (missing > 0) this._fill(Math.min(2, missing), false);
    }
  }

  drawTop(ctx, view) {
    this.game.spawner.forEachActive(obj => {
      if (!obj.bubble) return;
      if (obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b) return;
      const r = obj.r * 1.45 * (1 + Math.sin(this.time * 3 + obj.bubble.phase) * 0.04);
      ctx.drawImage(BubbleField.sprite(), obj.x - r, obj.y - r, r * 2, r * 2);
    });
  }
}
