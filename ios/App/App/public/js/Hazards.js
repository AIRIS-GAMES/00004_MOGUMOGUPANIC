/* =========================================================
 * Hazards.js - 吸い込んではいけない物
 *  zapper(ビリビリ)  : しびれて少しの間うごけない
 *  chili(激辛とうがらし): 口から火を吹いて勝手に爆走。操作がきかない
 *  soda(炭酸ボトル)   : ゲップで直前に食べた物を吐き出す。そのぶんスコアも減る
 *                       (吐き出した物はもう一度食べれば取り返せる)
 * 共通:スコア・成長なし、コンボも途切れる。文字は出さず、見た目で伝える。
 * 初めての STAGE 1(チュートリアル)では出さない。後の面ほど少し多い。
 * ========================================================= */
class HazardField {
  static SHOCK_SECONDS = 1.2;
  static RAMPAGE_SECONDS = 2.0;
  static RAMPAGE_SPEED = 1.7;
  static BURP_ITEMS = 5;
  static BURP_FREEZE = 0.45;

  static KINDS = ['zapper', 'chili', 'soda'];
  // 歩き回る速さ(px/秒)と、置かれた場所から離れる最大距離
  static WALK = { zapper: 42, chili: 55, soda: 34 };
  static LEASH = 140;
  static GROW = 0.22;     // プレイヤーの大きさ1ごとに危険物が大きくなる割合
  static MAX_GROW = 2.8;
  static WEIGHT = { zapper: 2, chili: 1, soda: 1 };
  static PATTERNS = ['scatter', 'clusters', 'rows'];

  /** その面に置く危険物の合計(序盤は少なく、後半ほど多い) */
  // 置きすぎると何に止められたか分かりにくいので控えめに(前は 12+4×面 → 約半分)。12面以降は増やさない
  static budgetFor(stageId) { return 8 + Math.min(stageId, 12) * 2; }

  /** その面で出る種類の数:序盤1種類、中盤2種類、終盤3種類 */
  static kindCountFor(stageId) { return stageId <= 3 ? 1 : stageId <= 6 ? 2 : 3; }

  /**
   * プレイごとにランダムな組み合わせを決める。
   * 例:{ zapper: { count: 20, pattern: 'rows' }, soda: { count: 10, pattern: 'clusters' } }
   */
  static planFor(stageId, random = Math.random, kinds = null) {
    const pool = [...HazardField.KINDS];
    const chosen = kinds ? [...kinds] : [];
    while (!kinds && chosen.length < HazardField.kindCountFor(stageId)) {
      chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    const total = chosen.reduce((sum, kind) => sum + HazardField.WEIGHT[kind], 0);
    const plan = {};
    for (const kind of chosen) {
      plan[kind] = {
        count: Math.round(HazardField.budgetFor(stageId) * HazardField.WEIGHT[kind] / total),
        pattern: HazardField.PATTERNS[Math.floor(random() * HazardField.PATTERNS.length)],
      };
    }
    return plan;
  }

  constructor(game, stage, kinds = null) {
    this.game = game;
    this.stage = stage;
    this.plan = HazardField.planFor(stage.id, Math.random, kinds);
    this.items = [];   // 危険物
    this.spat = [];    // 吐き出した物(食べ直せる)
    this.respawn = [];
    this.time = 0;
  }

  start() {
    for (const [kind, { count, pattern }] of Object.entries(this.plan)) {
      for (const [x, y] of this._layout(pattern, count)) this._spawn(kind, x, y);
    }
  }

  /** 置き方:ばらまき / かたまり(3〜5個) / 一列(道をふさぐように並ぶ) */
  _layout(pattern, count) {
    const W = Game.WORLD, out = [];
    // 空けておく場所:ふつうはスタート地点。エンドレスの途中切替では今いる場所
    const safe = this.game.safePoint || { x: W / 2, y: W / 2 };
    const clearOfStart = (x, y) => Math.hypot(x - safe.x, y - safe.y) > 360;
    const inside = (x, y) => x > 120 && x < W - 120 && y > 120 && y < W - 120;
    const randomPoint = () => {
      for (let k = 0; k < 30; k++) {
        const x = 150 + Math.random() * (W - 300), y = 150 + Math.random() * (W - 300);
        if (clearOfStart(x, y)) return [x, y];
      }
      return [150, 150];
    };
    while (out.length < count) {
      if (pattern === 'scatter') {
        out.push(randomPoint());
      } else if (pattern === 'clusters') {
        const [cx, cy] = randomPoint();
        const n = Math.min(count - out.length, 3 + Math.floor(Math.random() * 3));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = 55 + Math.random() * 40;
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
          if (inside(x, y) && clearOfStart(x, y)) out.push([x, y]);
          else out.push(randomPoint());
        }
      } else {
        const [sx, sy] = randomPoint();
        const a = Math.random() < 0.5 ? 0 : Math.PI / 2;
        const n = Math.min(count - out.length, 4 + Math.floor(Math.random() * 3));
        for (let i = 0; i < n; i++) {
          const x = sx + Math.cos(a) * i * 95, y = sy + Math.sin(a) * i * 95;
          if (inside(x, y) && clearOfStart(x, y)) out.push([x, y]);
          else out.push(randomPoint());
        }
      }
    }
    return out.slice(0, count);
  }

  stop() {
    for (const obj of this.items) obj.active = false;
    for (const obj of this.spat) obj.active = false;
    this.items = [];
    this.spat = [];
    this.respawn = [];
    const g = this.game;
    g.rampage = null;
    if (g.player) g.player.boostMul = 1;
  }

  _own(list) {
    const pool = this.game.spawner.eventPool;
    let obj = list.find(item => !item.active);
    if (!obj) {
      obj = new GameObject();
      obj.gimmickOwned = true;
      list.push(obj);
    }
    if (!pool.includes(obj)) pool.push(obj);
    return obj;
  }

  _spawn(kind, x, y) {
    const obj = this._own(this.items);
    obj.reset(GIMMICK_TYPES[kind], x, y);
    obj.eventOnly = true;
    obj.hazard = kind;
    obj.phase = Math.random() * 10;
    obj.home = { x, y };
    obj.walkA = Math.random() * Math.PI * 2;
    obj.baseY = 0;
    return obj;
  }

  activeHazards(kind) {
    return this.items.filter(obj => obj.active && (!kind || obj.hazard === kind));
  }

  /** 吸い込んでしまった */
  onEaten(obj) {
    const g = this.game;
    g.comboCount = 0;
    g.comboTimer = 0;
    if (obj.hazard === 'chili') this._rampage();
    else if (obj.hazard === 'soda') this._burp();
    else this._shock();
    Analytics.design(`hazard:${obj.hazard}`);
    this.respawn.push({ kind: obj.hazard, t: 2 });
  }

  _shock() {
    const g = this.game, p = g.player;
    g.stun(HazardField.SHOCK_SECONDS, { type: GIMMICK_TYPES.zapper });
    g.shockTimer = HazardField.SHOCK_SECONDS;
    g.camera.shake(9);
    for (let i = 0; i < 3; i++) g.particles.ring(p.x, p.y, '#ffd24d', p.bodyR * (0.8 + i * 0.35));
  }

  /** 激辛:向いている方向へ勝手に突っ走る(通り道の物は食べられる) */
  _rampage() {
    const g = this.game, p = g.player;
    let dx = p.dirX, dy = p.dirY;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); }
    else { dx /= len; dy /= len; }
    g.rampage = { t: HazardField.RAMPAGE_SECONDS, dx, dy };
    p.boostMul = HazardField.RAMPAGE_SPEED;
    g.camera.shake(6);
  }

  /** 炭酸:ゲップで直前に食べた物を吐き出し、そのぶんスコアが減る */
  _burp() {
    const g = this.game, p = g.player;
    const back = (g.recentEats || []).splice(-HazardField.BURP_ITEMS);
    let lost = back.reduce((sum, item) => sum + item.points, 0);
    if (!back.length) lost = Math.min(g.score, 100);
    g.score = Math.max(0, g.score - lost);
    g.ui.flashScoreLoss();
    g.stun(HazardField.BURP_FREEZE, { type: GIMMICK_TYPES.soda });
    g.burpTimer = 0.6;
    g.camera.shake(7);
    const mouth = p.getMouth();
    back.forEach((item, i) => {
      const obj = this._own(this.spat);
      obj.reset(item.type, mouth.x, mouth.y);
      obj.eventOnly = true;
      const a = Math.atan2(p.dirY, p.dirX) + Math.PI + (i - (back.length - 1) / 2) * 0.55 + (Math.random() - 0.5) * 0.3;
      const speed = 420 + Math.random() * 160;
      obj.fly = { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t: 0.55 };
      obj.noSuck = 0.9;
    });
    for (let i = 0; i < 4; i++) g.particles.ring(mouth.x, mouth.y, '#9be7f5', p.bodyR * (0.5 + i * 0.3));
  }

  update(dt) {
    this.time += dt;
    const g = this.game, W = Game.WORLD;

    // 爆走中:壁で跳ね返る
    if (g.rampage) {
      g.rampage.t -= dt;
      const p = g.player, m = p.bodyR * 0.6 + 4;
      if ((p.x <= m && g.rampage.dx < 0) || (p.x >= W - m && g.rampage.dx > 0)) g.rampage.dx *= -1;
      if ((p.y <= m && g.rampage.dy < 0) || (p.y >= W - m && g.rampage.dy > 0)) g.rampage.dy *= -1;
      if (g.rampage && g.rampage.t <= 0) { g.rampage = null; p.boostMul = 1; }
      else this._scorch();
    }

    this._walk(dt);

    // 吐き出した物は少し飛んでから止まる。それまでは吸い込めない
    for (const obj of this.spat) {
      if (!obj.active) continue;
      if (obj.noSuck > 0) obj.noSuck -= dt;
      if (obj.fly && obj.fly.t > 0) {
        obj.fly.t -= dt;
        const k = Math.max(0, obj.fly.t / 0.55);
        obj.x = Math.max(60, Math.min(W - 60, obj.x + obj.fly.vx * k * dt));
        obj.y = Math.max(60, Math.min(W - 60, obj.y + obj.fly.vy * k * dt));
        obj.rot += dt * 9 * k;
      }
    }

    for (const r of this.respawn) r.t -= dt;
    const due = this.respawn.filter(r => r.t <= 0);
    this.respawn = this.respawn.filter(r => r.t > 0);
    if (!due.length) return;
    const view = g.camera.viewBounds(g.w, g.h, 150);
    for (const r of due) {
      let x, y;
      for (let k = 0; k < 20; k++) {
        x = 150 + Math.random() * (W - 300);
        y = 150 + Math.random() * (W - 300);
        if (x < view.l || x > view.r || y < view.t || y > view.b) break;
      }
      this._spawn(r.kind, x, y);
    }
  }

  /**
   * 危険物は置かれた場所のまわりをうろうろ歩く。
   * ビリビリはカクカク、とうがらしはぴょこぴょこ、炭酸はゆらゆら。
   */
  /** 危険物の大きさ。プレイヤーが大きくなるとついて大きくなり、見落とさないようにする */
  static sizeFor(scale) { return Math.min(HazardField.MAX_GROW, 1 + Math.max(0, scale - 1) * HazardField.GROW); }

  _walk(dt) {
    const W = Game.WORLD;
    const hs = HazardField.sizeFor(this.game.player ? this.game.player.scale : 1);
    for (const obj of this.items) {
      if (!obj.active || obj.state !== 'idle') continue;
      obj.sizeMul = hs;
      if (obj.noSuck > 0) obj.noSuck -= dt;  // 分身に押しのけられた直後
      const t = this.time + obj.phase;
      // 向きを少しずつ変える。離れすぎたら家の方へ戻る
      obj.walkA += (Math.sin(t * 0.9) * 0.9 + (Math.random() - 0.5) * 0.8) * dt;
      const hx = obj.home.x - obj.x, hy = obj.home.y - obj.y;
      if (Math.hypot(hx, hy) > HazardField.LEASH) {
        const back = Math.atan2(hy, hx);
        let diff = back - obj.walkA;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        obj.walkA += diff * Math.min(1, dt * 3);
      }
      let speed = HazardField.WALK[obj.hazard];
      if (obj.hazard === 'zapper') speed *= (Math.floor(t * 6) % 3 === 0) ? 0 : 1.5; // 小刻みに止まる
      if (obj.hazard === 'chili') speed *= Math.max(0, Math.sin(t * 7)) * 2;         // 跳ねた時だけ進む
      obj.x = Math.max(80, Math.min(W - 80, obj.x + Math.cos(obj.walkA) * speed * dt));
      obj.y = Math.max(80, Math.min(W - 80, obj.y + Math.sin(obj.walkA) * speed * dt));
      // 歩いている見た目
      obj.drawScale = hs;
      if (obj.hazard === 'zapper') obj.rot = (Math.floor(t * 12) % 2 ? 0.08 : -0.08);
      else if (obj.hazard === 'chili') { obj.rot = Math.sin(t * 7) * 0.18; obj.drawScale = hs * (1 + Math.max(0, Math.sin(t * 7)) * 0.08); }
      else obj.rot = Math.sin(t * 3) * 0.14;
    }
  }

  /** 爆走中、口の前の炎に入った物を焦がす(レインボーと危険物は焦げない) */
  _scorch() {
    const g = this.game, p = g.player, m = p.getMouth();
    const dx = g.rampage.dx, dy = g.rampage.dy;
    const reach = p.bodyR * 1.9, half = p.bodyR * 0.75;
    g.spawner.forEachActive(obj => {
      if (obj.burnt || obj.hazard || obj.rainbowCharge || obj.state !== 'idle') return;
      const rx = obj.x - m.x, ry = obj.y - m.y;
      const along = rx * dx + ry * dy;
      const side = Math.abs(-rx * dy + ry * dx);
      if (along > -obj.r * 0.5 && along < reach + obj.r && side < half + obj.r * 0.6) {
        obj.burnt = true;
        obj.wobble = 0.3;
        g.particles.ring(obj.x, obj.y, '#ff8a3d', obj.r);
      }
    });
  }

  /** 物の上に重ねる演出:ビリビリの火花、とうがらしの湯気、炭酸の泡、焦げた物の煙 */
  drawTop(ctx) {
    const g = this.game;
    const view = g.camera.viewBounds(g.w, g.h, 60);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    g.spawner.forEachActive(obj => {
      if (!obj.burnt || obj.state !== 'idle') return;
      if (obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b) return;
      this._smoke(ctx, obj, this.time + obj.x * 0.01);
    });
    for (const obj of this.items) {
      if (!obj.active || obj.state !== 'idle') continue;
      if (obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b) continue;
      const t = this.time + obj.phase;
      if (obj.hazard === 'zapper') this._sparks(ctx, obj, t);
      else if (obj.hazard === 'chili') this._heat(ctx, obj, t);
      else this._bubbles(ctx, obj, t);
    }
    ctx.restore();
  }

  _sparks(ctx, obj, time) {
    const t = time * 9;
    const flash = Math.sin(t * 0.7) > 0.6;
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    ctx.globalAlpha = flash ? 0.95 : 0.55;
    for (let i = 0; i < 3; i++) {
      const a = Math.floor(t + i * 2.1) * 1.7 + i;
      const r0 = obj.r * 1.05, r1 = obj.r * (flash ? 1.75 : 1.45);
      ctx.beginPath();
      ctx.moveTo(obj.x + Math.cos(a) * r0, obj.y + Math.sin(a) * r0);
      ctx.lineTo(obj.x + Math.cos(a + 0.25) * (r0 + r1) / 2, obj.y + Math.sin(a + 0.25) * (r0 + r1) / 2);
      ctx.lineTo(obj.x + Math.cos(a - 0.1) * r1, obj.y + Math.sin(a - 0.1) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _heat(ctx, obj, t) {
    ctx.strokeStyle = '#ff8a3d';
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.9 + i * 0.5) % 1);
      const x = obj.x + (i ? 8 : -8);
      const y = obj.y - obj.r * 0.9 - k * 26;
      ctx.globalAlpha = 0.8 * (1 - k);
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.quadraticCurveTo(x + 6, y + 5, x, y);
      ctx.quadraticCurveTo(x - 6, y - 5, x, y - 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _smoke(ctx, obj, t) {
    ctx.fillStyle = '#6b5a52';
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.6 + i * 0.5) % 1);
      ctx.globalAlpha = 0.45 * (1 - k);
      ctx.beginPath();
      ctx.arc(obj.x + Math.sin(t * 2 + i) * 6, obj.y - obj.r * 0.6 - k * 30, 5 + k * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _bubbles(ctx, obj, t) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.8 + i / 3) % 1);
      const x = obj.x + Math.sin(t * 3 + i * 2) * 6 + (i - 1) * 5;
      const y = obj.y - obj.r * 0.8 - k * 34;
      ctx.globalAlpha = 0.9 * (1 - k);
      ctx.beginPath();
      ctx.arc(x, y, 2.5 + i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
