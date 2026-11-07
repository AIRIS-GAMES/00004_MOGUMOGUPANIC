/* =========================================================
 * CosmiiFever.js - コスミーフィーバー(画面下のゲージ)
 *  - 食べるとゲージが溜まる(コンボが続くほど速い)
 *  - 満タンになると3つのアイコンが出る(時間はゆっくりにならない)。タップしたものが発動
 *      dash  : フリックダッシュ。はじいた方向へ突進して通り道を丸のみ(3回まで)
 *      mash  : 連打でふくらむ。たくさん叩くほどふくらみ、弾けて周りを一気に吸い込む
 *      clone : コスミー分身。自分より小さいミニコスミーが1体出て、勝手に食べてくれる。
 *              危険物(ビリビリ・とうがらし・炭酸)やギミックの物はよけて食べない
 *  元の「虹色アイテム(コスミーボーナス)」と自動発動のバキュームはこれに置き換えた。
 * ========================================================= */
class CosmiiFever {
  static KINDS = ['dash', 'mash', 'clone'];
  static SLOW_REAL = 2.5;        // 選んでいる間、時間がゆっくりになる長さ(実時間)
  static SLOW_SCALE = 0.25;

  static DASH_COUNT = 3;
  static DASH_WINDOW = 7;        // ダッシュを使える時間
  static DASH_TIME = 0.38;       // 1回の突進の長さ
  static MASH_TIME = 2.5;        // 連打の時間
  static POP_TIME = 1.3;         // 弾けて吸い込む時間
  static CLONE_TIME = 7;
  static CLONE_COUNT = 1;
  static CLONE_SIZE = 0.6;       // 分身の大きさ(本体に対する割合)
  static CLONE_AVOID = 150;      // 危険物をよける距離

  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.state = 'charge';       // charge | choose | dash | mash | pop | clone
    this.gauge = 0;
    this.t = 0;
    this.slowLeft = 0;
    this.dashesLeft = 0;
    this.dash = null;
    this.taps = 0;
    this.clones = [];
    this.hintShown = {};
    this._restorePlayer();
  }

  get active() { return this.state !== 'charge' && this.state !== 'choose'; }
  get choosing() { return this.state === 'choose'; }
  /** 時間の進み方(選んでいる間だけゆっくり) */
  /** 時間の進み方:選んでいる間もゆっくりにはしない(ずっと同じ速さ) */
  get timeScale() { return 1; }
  /** 移動の入力を止めるか(連打中はその場でふくらむ、突進中は勝手に進む) */
  get blocksMove() { return this.state === 'mash' || this.state === 'pop' || (this.state === 'dash' && !!this.dash); }

  /** 食べた時にゲージを溜める */
  charge(combo) {
    if (this.state !== 'charge') return;
    this.gauge = Math.min(1, this.gauge + 0.1 + 0.015 * Math.min(5, combo / 4));
    if (this.gauge >= 1) this._ready();
  }

  _ready() {
    const g = this.game, p = g.player;
    this.state = 'choose';
    this.slowLeft = CosmiiFever.SLOW_REAL;
    g.ui.showFeverChoice(true, p.skin.closedSrc, p.skin.openSrc);
    g.camera.shake(4);
    g.particles.ring(p.x, p.y, '#ffd24d', p.bodyR * 1.4);
    g.audio.button();
  }

  /** アイコンをタップした */
  pick(kind) {
    if (this.state !== 'choose' || !CosmiiFever.KINDS.includes(kind)) return;
    const g = this.game, p = g.player;
    g.ui.showFeverChoice(false);
    g.vacuumCount = (g.vacuumCount || 0) + 1;
    Analytics.design(`cosmiifever:${kind}`);
    g.audio.vacuum();
    g.camera.shake(8);
    for (let i = 0; i < 2; i++) g.particles.ring(p.x, p.y, ['#ff6b81', '#6cb9ff'][i], p.bodyR * (1.3 + i * 0.4));
    this.gauge = 1;
    if (kind === 'dash') {
      this.state = 'dash';
      this.dashesLeft = CosmiiFever.DASH_COUNT;
      this.t = CosmiiFever.DASH_WINDOW;
      this.dash = null;
      g.ui.showFeverHint('dash', !this.hintShown.dash);
    } else if (kind === 'mash') {
      this.state = 'mash';
      this.t = CosmiiFever.MASH_TIME;
      this.taps = 0;
      g.ui.showFeverHint('mash', true);
      g.ui.showMashLayer(true);
    } else {
      this.state = 'clone';
      this.t = CosmiiFever.CLONE_TIME;
      this._spawnClones();
    }
  }

  /* ---- 入力(Game から呼ばれる) ---- */

  /** 画面をはじいた/タップした。dx,dy は画面上の向き */
  flick(dx, dy) {
    if (this.state !== 'dash' || this.dash || this.dashesLeft <= 0) return false;
    const len = Math.hypot(dx, dy);
    if (len < 1) return false;
    const g = this.game, p = g.player;
    this.dash = { t: CosmiiFever.DASH_TIME, dx: dx / len, dy: dy / len };
    this.dashesLeft--;
    this.hintShown.dash = true;
    g.ui.showFeverHint('dash', false);
    p.dirX = this.dash.dx; p.dirY = this.dash.dy;
    p.mouthBoost = 2.4;
    p.powerEat = 1;
    g.camera.shake(6);
    g.audio.pop(6, true);
    return true;
  }

  /** 連打 */
  tap() {
    if (this.state !== 'mash') return;
    const g = this.game, p = g.player;
    this.taps++;
    p.pulse = 1;
    g.audio.pop(Math.min(20, this.taps), false);
    if (this.taps === 3) g.ui.showFeverHint('mash', false);
  }

  /* ---- 毎フレーム ---- */

  update(dt, real) {
    const g = this.game, p = g.player;
    if (this.state === 'choose') { this.slowLeft -= real; return; }
    if (this.state === 'charge') return;
    this.t -= dt;
    if (this.state === 'dash') this._updateDash(dt);
    else if (this.state === 'mash') {
      p.powerMul = 1 + Math.min(1.3, this.taps * 0.055) + Math.sin(g.time * 30) * 0.02;
      this.gauge = Math.max(0, this.t / CosmiiFever.MASH_TIME);
      if (this.t <= 0) this._pop();
    } else if (this.state === 'pop') {
      p.powerMul = Math.max(1, p.powerMul - dt * 6);
      if (this.t <= 0) this._finish();
    } else if (this.state === 'clone') {
      this._updateClones(dt);
      this.gauge = Math.max(0, this.t / CosmiiFever.CLONE_TIME);
      if (this.t <= 0) this._finish();
    }
  }

  _updateDash(dt) {
    const g = this.game, p = g.player, W = Game.WORLD;
    const d = this.dash;
    this.gauge = Math.max(0, (this.dashesLeft + (d ? d.t / CosmiiFever.DASH_TIME : 0)) / CosmiiFever.DASH_COUNT);
    if (d) {
      d.t -= dt;
      const sp = Math.max(1400, p.bodyR * 26) * (0.55 + 0.45 * Math.max(0, d.t / CosmiiFever.DASH_TIME));
      const m = p.bodyR * 0.6;
      p.x = Math.max(m, Math.min(W - m, p.x + d.dx * sp * dt));
      p.y = Math.max(m, Math.min(W - m, p.y + d.dy * sp * dt));
      p.moving = true;
      p.mouthOpen = 1;
      // 通り道の危険物ははじき飛ばす(食べない)
      g.spawner.forEachActive(obj => {
        if (!obj.hazard || obj.state !== 'idle') return;
        const dist = Math.hypot(obj.x - p.x, obj.y - p.y);
        if (dist < p.bodyR * 1.6 + obj.r) {
          obj.noSuck = Math.max(obj.noSuck || 0, 0.8);
          const nx = (obj.x - p.x) / (dist || 1), ny = (obj.y - p.y) / (dist || 1);
          obj.x = Math.max(80, Math.min(W - 80, obj.x + nx * 160));
          obj.y = Math.max(80, Math.min(W - 80, obj.y + ny * 160));
          obj.wobble = 0.5;
        }
      });
      // 残像
      if (Math.random() < 0.25) g.particles.ring(p.x - d.dx * p.bodyR * 0.8, p.y - d.dy * p.bodyR * 0.8, '#ffffff', p.bodyR * 0.45);
      if (d.t <= 0) {
        this.dash = null;
        p.mouthBoost = 1;
        p.powerEat = 0;
        if (this.dashesLeft <= 0) this._finish();
      }
    } else if (this.t <= 0) this._finish();
  }

  _pop() {
    const g = this.game, p = g.player;
    this.state = 'pop';
    this.t = CosmiiFever.POP_TIME;
    g.ui.showMashLayer(false);
    g.ui.showFeverHint('mash', false);
    // 叩いた回数ぶん、吸い込む範囲が広い
    p.mouthBoost = Math.min(8, 2.5 + this.taps * 0.18);
    p.powerEat = 2;
    p.mouthOpen = 1;
    p.mouthHold = CosmiiFever.POP_TIME;
    g.camera.shake(14);
    for (let i = 0; i < 4; i++) g.particles.ring(p.x, p.y, ['#ffd24d', '#ff6b81', '#6cb9ff', '#ffffff'][i], p.bodyR * (1.5 + i * 0.8));
    g.particles.burst(p.x, p.y, p.skin.color, g._activeEffect());
    g.audio.pop(20, true);
    Analytics.design('cosmiifever:mash_taps', this.taps);
  }

  /* ---- 分身 ---- */

  _spawnClones() {
    const g = this.game, p = g.player;
    // 本体はそのまま(少しだけ口が大きくなる)。分身は本体より小さい
    p.mouthBoost = 1.3;
    this.clones = [];
    for (let i = 0; i < CosmiiFever.CLONE_COUNT; i++) {
      const a = (i / CosmiiFever.CLONE_COUNT) * Math.PI * 2 + Math.PI / 2;
      const c = new Player(p.skin, p.images, p.x + Math.cos(a) * p.bodyR * 2, p.y + Math.sin(a) * p.bodyR * 2);
      c.scale = p.scale;
      c.powerMul = CosmiiFever.CLONE_SIZE;
      c.mouthBoost = 1.6;
      c.boostMul = 1.7;
      c.accessory = p.accessory;
      c.cloneOf = p;
      c.stun = 0;
      c.target = null;
      c.retarget = Math.random() * 0.3;
      c.spawnT = 0;
      this.clones.push(c);
      g.particles.ring(c.x, c.y, '#ffffff', c.bodyR * 1.4);
    }
  }

  _updateClones(dt) {
    const g = this.game, p = g.player;
    this.clones.forEach((c, idx) => {
      c.slot = idx;
      this._updateClone(c, dt);
    });
  }

  _updateClone(c, dt) {
    const g = this.game, p = g.player;
    {
      c.spawnT = Math.min(1, c.spawnT + dt * 4);
      c.scale = p.scale;
      if (c.stun > 0) {
        c.stun -= dt;
        c.update({ active: false, dx: 0, dy: 0, ratio: 0 }, dt, Game.WORLD, dt);
        return;
      }
      c.retarget -= dt;
      if (c.retarget <= 0 || !c.target || !c.target.active || c.target.state !== 'idle') {
        c.retarget = 0.5;
        c.target = this._pickTarget(c);
      }
      // 遠くへ行きすぎたら本体のところへ戻る
      const home = Math.hypot(c.x - p.x, c.y - p.y) > 380;
      // 食べる物がない時は、本体のまわりの自分の場所(三角形に並ぶ)へ
      const a = (c.slot / CosmiiFever.CLONE_COUNT) * Math.PI * 2 + Math.PI / 2 + g.time * 0.8;
      const sx = p.x + Math.cos(a) * p.bodyR * 2.2, sy = p.y + Math.sin(a) * p.bodyR * 2.2;
      const tx = home || !c.target ? sx : c.target.x;
      const ty = home || !c.target ? sy : c.target.y;
      let dx = tx - c.x, dy = ty - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      // 危険物からは離れるようによける
      const R = CosmiiFever.CLONE_AVOID + c.bodyR;
      g.spawner.forEachActive(obj => {
        if (!obj.hazard || obj.state !== 'idle') return;
        const ox = c.x - obj.x, oy = c.y - obj.y, d = Math.hypot(ox, oy);
        if (d > R || d < 1) return;
        const k = (1 - d / R) * 2.2;
        dx += ox / d * k; dy += oy / d * k;
      });
      const len = Math.hypot(dx, dy) || 1;
      c.update({ active: dist > 8, dx: dx / len, dy: dy / len, ratio: 1 }, dt, Game.WORLD, dt);
      // 口に触れたら食べる
      const m = c.getMouth();
      g.spawner.forEachActive(obj => {
        if (obj.state !== 'idle' || c.stun > 0) return;
        if (Math.hypot(obj.x - m.x, obj.y - m.y) > m.r + obj.r * 0.7) return;
        if (obj.hazard) this._nudgeAway(c, obj);  // 危険物は食べずに、そっと押しのける
        else if (this._cloneCanEat(obj)) {
          g._consume(obj, c);
          c.pulse = 1;
          c.mouthHold = 0.3;
        }
      });
    }
  }

  _cloneCanEat(obj) {
    const g = this.game;
    if (obj.noSuck > 0 || obj.bubble || obj.gimmick) return false;
    return g.player.eatScale >= obj.type.req;  // 本体と同じ大きさまで(分身ボーナスで+1)
  }

  _pickTarget(c, allowHazard = true) {
    const g = this.game;
    const wantHazard = false;  // 危険物はねらわない
    const p = g.player;
    let best = null, bd = Infinity;
    g.spawner.forEachActive(obj => {
      if (obj.state !== 'idle') return;
      // 本体の近く(画面の中)にある物だけを狙う
      if (Math.hypot(obj.x - p.x, obj.y - p.y) > 340) return;
      if (wantHazard ? !obj.hazard : (obj.hazard || !this._cloneCanEat(obj))) return;
      if (this.clones.some(o => o !== c && o.target === obj)) return;
      const d = Math.hypot(obj.x - c.x, obj.y - c.y);
      if (d < bd) { bd = d; best = obj; }
    });
    return best || (wantHazard ? this._pickTarget(c, false) : null);
  }

  /** 分身の口に危険物が当たった:食べずに押しのける */
  _nudgeAway(c, obj) {
    const W = Game.WORLD;
    const nx = obj.x - c.x, ny = obj.y - c.y, d = Math.hypot(nx, ny) || 1;
    obj.x = Math.max(80, Math.min(W - 80, obj.x + nx / d * 70));
    obj.y = Math.max(80, Math.min(W - 80, obj.y + ny / d * 70));
    obj.noSuck = Math.max(obj.noSuck || 0, 0.3);
    obj.wobble = 0.5;
  }

  /** (前の作り)分身が危険物を吸い込んだ:全員ビリビリ。今は使っていない */
  _cloneAteHazard(c, obj) {
    const g = this.game, p = g.player;
    g.spawner.kill(obj);
    if (g.hazards) g.hazards.respawn.push({ kind: obj.hazard, t: 2 });
    const secs = HazardField.SHOCK_SECONDS;
    for (const o of this.clones) o.stun = secs;
    g.stun(secs);
    g.shockTimer = secs;
    g.comboCount = 0;
    g.comboTimer = 0;
    g.camera.shake(10);
    for (const o of [p, ...this.clones]) g.particles.ring(o.x, o.y, '#ffd24d', o.bodyR * 1.2);
    Analytics.design('cosmiifever:clone_shock');
  }

  /* ---- 終わり ---- */

  _finish() {
    const g = this.game;
    for (const c of this.clones) g.particles.ring(c.x, c.y, '#ffffff', c.bodyR);
    this.clones = [];
    this._restorePlayer();
    g.ui.showMashLayer(false);
    g.ui.showFeverHint(null, false);
    this.state = 'charge';
    this.gauge = 0;
    this.dash = null;
  }

  /** フィーバーを途中でやめる(クリア・ゲーム終了・タイトルへ) */
  cancel() {
    if (this.state === 'charge') return;
    const keep = this.state === 'choose' ? this.gauge : 0;
    this._finish();
    this.game.ui.showFeverChoice(false);
    this.gauge = keep;
    if (keep >= 1) this.gauge = 0.99;
  }

  _restorePlayer() {
    const p = this.game && this.game.player;
    if (!p) return;
    p.powerMul = 1;
    p.mouthBoost = 1;
    p.powerEat = 0;
  }

  /* ---- 描画 ---- */

  /** 分身を描画リストへ */
  collectDraw(list) {
    for (const c of this.clones) list.push(this.game._renderEntry(c, 'clone', c.y + c.bodyR * 0.7));
  }

  drawClone(ctx, c) {
    const s = 0.3 + 0.7 * c.spawnT;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(s, s);
    ctx.translate(-c.x, -c.y);
    ctx.globalAlpha = 0.95;
    c.draw(ctx);
    ctx.restore();
    if (c.stun > 0) this.game._drawShock(ctx, c);
  }

  /** ダッシュの残り回数を、コスミーの頭の上に小さな丸で */
  drawTop(ctx) {
    const g = this.game, p = g.player;
    if (this.state !== 'dash') return;
    const n = this.dashesLeft;
    const r = Math.max(7, p.bodyR * 0.14);
    for (let i = 0; i < CosmiiFever.DASH_COUNT; i++) {
      const x = p.x + (i - 1) * r * 2.8, y = p.y - p.bodyR * 1.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i < n ? '#ffd24d' : 'rgba(255,255,255,0.5)';
      ctx.fill();
      ctx.lineWidth = r * 0.35;
      ctx.strokeStyle = '#4f3a40';
      ctx.stroke();
    }
  }
}
