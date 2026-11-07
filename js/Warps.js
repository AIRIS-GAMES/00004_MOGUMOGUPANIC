/* =========================================================
 * Warps.js - ワープホール(コース上にランダム配置)
 *  - 入るとくるくる回りながら吸い込まれ、ほかのホールのどれかからランダムに出てくる
 *  - 物が多い場所に出れば得、危険物のそばに出たら損の運試し。囲まれた時の脱出にも
 *  - 出てきた穴からいったん離れるまでは、もう一度吸い込まれない
 *  - 初めての STAGE 1(チュートリアル)では出さない
 * ========================================================= */
class WarpField {
  static R = 62;            // ホールの半径
  static IN = 0.4;          // 吸い込まれる演出の秒数
  static OUT = 0.4;         // 出てくる演出の秒数

  /** 序盤2〜3個、後半4〜5個 */
  static countFor(stageId) { return Math.min(5, 2 + Math.floor(stageId / 3) + (Math.random() < 0.5 ? 1 : 0)); }

  constructor(game, stage) {
    this.game = game;
    this.stage = stage;
    this.holes = [];
    this.time = 0;
    this.warp = null;       // { phase: 'in' | 'out', t, to }
    this.lockedHole = null; // 出てきた穴(離れるまで無効)
  }

  start() {
    const W = Game.WORLD;
    const safe = this.game.safePoint || { x: W / 2, y: W / 2 };
    const n = WarpField.countFor(this.stage.id);
    for (let tries = 0; this.holes.length < n && tries < 400; tries++) {
      const x = 260 + Math.random() * (W - 520), y = 260 + Math.random() * (W - 520);
      if (Math.hypot(x - safe.x, y - safe.y) < 450) continue;            // スタート地点のすぐ横は避ける
      if (this.holes.some(h => Math.hypot(h.x - x, h.y - y) < 900)) continue; // 穴どうしは離す
      this.holes.push({ x, y, phase: Math.random() * 10 });
    }
  }

  stop() {
    this.holes = [];
    this.warp = null;
    const p = this.game.player;
    if (p) p.warpScale = 1;
  }

  get active() { return !!this.warp; }

  update(dt) {
    this.time += dt;
    const g = this.game, p = g.player;
    if (this.warp) {
      this.warp.t += dt;
      if (this.warp.phase === 'in') {
        const k = Math.min(1, this.warp.t / WarpField.IN);
        p.warpScale = 1 - k;
        p.warpSpin = k * Math.PI * 4;
        // 穴の中心へ引き寄せられる
        p.x += (this.warp.from.x - p.x) * Math.min(1, dt * 10);
        p.y += (this.warp.from.y - p.y) * Math.min(1, dt * 10);
        if (k >= 1) {
          p.x = this.warp.to.x;
          p.y = this.warp.to.y;
          g.camera.snap(p.x, p.y, g.camera.zoom);
          g.particles.ring(p.x, p.y, '#b388ff', WarpField.R * 1.4);
          this.lockedHole = this.warp.to;
          this.warp = { phase: 'out', t: 0, to: this.warp.to };
        }
      } else {
        const k = Math.min(1, this.warp.t / WarpField.OUT);
        p.warpScale = k;
        p.warpSpin = (1 - k) * Math.PI * 4;
        if (k >= 1) { this.warp = null; p.warpScale = 1; p.warpSpin = 0; }
      }
      return;
    }
    // 出てきた穴から離れたら、また使えるように
    if (this.lockedHole && Math.hypot(p.x - this.lockedHole.x, p.y - this.lockedHole.y) > WarpField.R * 1.6) {
      this.lockedHole = null;
    }
    for (const hole of this.holes) {
      if (hole === this.lockedHole || this.holes.length < 2) continue;
      if (Math.hypot(p.x - hole.x, p.y - hole.y) < WarpField.R * 0.7) {
        const others = this.holes.filter(h => h !== hole);
        const to = others[Math.floor(Math.random() * others.length)];
        this.warp = { phase: 'in', t: 0, from: hole, to };
        g.stun(WarpField.IN + WarpField.OUT);
        g.rampage = null;
        p.boostMul = 1;
        Analytics.design('warp:enter');
        break;
      }
    }
  }

  /** 地面に渦を描く(物より下) */
  drawGround(ctx) {
    const g = this.game;
    const view = g.camera.viewBounds(g.w, g.h, WarpField.R * 2);
    for (const hole of this.holes) {
      if (hole.x < view.l || hole.x > view.r || hole.y < view.t || hole.y > view.b) continue;
      const R = WarpField.R, t = this.time * 2.4 + hole.phase;
      const locked = hole === this.lockedHole;
      ctx.save();
      ctx.translate(hole.x, hole.y);
      ctx.globalAlpha = locked ? 0.55 : 1;
      // 穴
      const grad = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
      grad.addColorStop(0, '#1a1030');
      grad.addColorStop(0.55, '#5b3fa8');
      grad.addColorStop(1, 'rgba(120, 220, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2); ctx.fill();
      // 回る渦の腕
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i % 2 ? '#7ce8ff' : '#d3a8ff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let s = 0; s <= 1.0001; s += 0.08) {
          const a = t + i * (Math.PI * 2 / 3) + s * 3.2;
          const r = R * (0.95 - s * 0.8);
          const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.85;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 縁のきらきら
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const a = -t * 0.7 + i * Math.PI / 3;
        ctx.globalAlpha = (locked ? 0.4 : 0.9) * (0.5 + 0.5 * Math.sin(t * 3 + i));
        ctx.beginPath(); ctx.arc(Math.cos(a) * R * 1.02, Math.sin(a) * R * 0.88, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
}
