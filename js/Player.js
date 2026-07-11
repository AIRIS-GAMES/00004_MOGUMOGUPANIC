/* =========================================================
 * Player.js - プレイヤーキャラクター
 *  - SKINS: 5種類のスキン定義(画像パス・固有能力)
 *  - Player: 移動・成長・口の開閉・バキュームモード
 * ========================================================= */

/**
 * スキン定義。
 * openSrc  : 口を大きく開けた画像
 * closedSrc: 通常(口を閉じた)画像
 * 固有能力は乗数として持ち、未指定は 1.0 扱い。
 */
const SKINS = [
  {
    id: 'red', name: 'RED', color: '#ff5a5a',
    openSrc: 'public/opt/red.webp', closedSrc: 'public/opt/chara4_sub.webp',
    ability: '吸い込み速度アップ', suckMul: 1.5, price: 0,
  },
  {
    id: 'blue', name: 'BLUE', color: '#6cb9ff',
    openSrc: 'public/opt/blue.webp', closedSrc: 'public/opt/chara2_sub.webp',
    ability: '移動速度アップ', moveMul: 1.25, price: 500,
  },
  {
    id: 'green', name: 'GREEN', color: '#8fd14f',
    openSrc: 'public/opt/green.webp', closedSrc: 'public/opt/chara3_sub.webp',
    ability: '成長しやすい', growMul: 1.4, price: 1000,
  },
  {
    id: 'pink', name: 'PINK', color: '#ff9ec6',
    openSrc: 'public/opt/pink.webp', closedSrc: 'public/opt/chara1_sub.webp',
    ability: '吸い込み範囲アップ', rangeMul: 1.25, price: 1500,
  },
  {
    id: 'purple', name: 'PURPLE', color: '#b388ff',
    openSrc: 'public/opt/purple.webp', closedSrc: 'public/opt/chara5_sub.webp',
    ability: 'バキューム時間延長', vacuumTimeMul: 1.6, price: 2000,
  },
];

class Player {
  static MAX_SCALE = 12;
  static BASE_BODY_R = 50;   // Scale=1 の時の体(円)の半径
  static BASE_MOUTH_R = 22;  // Scale=1 の時の口の吸い込み半径

  /**
   * @param {object} skin   SKINS の要素
   * @param {object} images { open, closed } 描画用キャンバス
   */
  constructor(skin, images, x, y) {
    this.skin = skin;
    this.images = images;
    this.x = x;
    this.y = y;

    this.scale = 1;              // 現在サイズ(SIZE表示・判定に使用)
    this.dirX = 0;               // 向き(正規化済み)
    this.dirY = 1;
    this.moving = false;
    this.speedRatio = 0;         // 入力の強さ 0..1

    this.mouthOpen = 0;          // 口の開き具合 0..1(アニメ用)
    this.mouthHold = 0;          // 吸い込み直後に口を開け続ける時間
    this.pulse = 0;              // 食べた瞬間の膨らみ 0..1
    this.growFlash = 0;          // 成長時の光る演出 0..1
    this.time = 0;               // 経過時間(ボブアニメ用)

    // バキュームモード
    this.vacuumGauge = 0;        // 0..1
    this.vacuumActive = false;
    this.vacuumTimer = 0;
    this.vacuumDuration = 5 * (skin.vacuumTimeMul || 1);
  }

  /* ---- 派生パラメータ ---- */

  /** 体の当たり判定半径 */
  get bodyR() {
    return Player.BASE_BODY_R * this.scale;
  }

  /** 口の吸い込み判定(mouthRadius)。ピンクは範囲UP、バキューム中は2倍 */
  get mouthRadius() {
    const vac = this.vacuumActive ? 2 : 1;
    // 初心者補正:scale 1.0 で +25% → 1.5 で 0% に逓減(序盤の空振り軽減)
    const rookie = 1 + 0.25 * Math.max(0, Math.min(1, (1.5 - this.scale) * 2));
    return (Player.BASE_MOUTH_R * this.scale * rookie * (this.skin.rangeMul || 1)) * vac + 4;
  }

  /** 口の中心(進行方向の少し前) */
  getMouth() {
    return {
      x: this.x + this.dirX * this.bodyR * 0.08,
      y: this.y + this.bodyR * 0.34 + this.dirY * this.bodyR * 0.04,
      r: this.mouthRadius,
    };
  }

  /** 吸い込み速度 [px/s]。赤は速度UP、バキューム中は2倍 */
  get suckSpeed() {
    const vac = this.vacuumActive ? 2 : 1;
    return (260 + 340 * Math.sqrt(this.scale)) * (this.skin.suckMul || 1) * vac;
  }

  /** 移動速度 [px/s]。水色は速度UP */
  get moveSpeed() {
    const vac = this.vacuumActive ? 1.1 : 1;
    return 280 * (0.75 + 0.45 * Math.sqrt(this.scale)) * (this.skin.moveMul || 1) * vac;
  }

  /* ---- 更新 ---- */

  /**
   * @param {object} input { active, dx, dy, ratio } 正規化済み入力
   * @param {number} worldSize マップの一辺
   */
  update(input, dt, worldSize) {
    this.time += dt;

    // 移動
    this.moving = input.active && input.ratio > 0.05;
    if (this.moving) {
      this.dirX = input.dx;
      this.dirY = input.dy;
      this.speedRatio = input.ratio;
      const sp = this.moveSpeed * input.ratio;
      this.x += this.dirX * sp * dt;
      this.y += this.dirY * sp * dt;
      // マップ外に出ない
      const m = this.bodyR * 0.6;
      this.x = Math.max(m, Math.min(worldSize - m, this.x));
      this.y = Math.max(m, Math.min(worldSize - m, this.y));
    } else {
      this.speedRatio = 0;
    }

    // 口の開閉:ドラッグ中 or 吸い込み直後は開く
    if (this.mouthHold > 0) this.mouthHold -= dt;
    const wantOpen = this.moving || this.mouthHold > 0 || this.vacuumActive;
    const k = 1 - Math.pow(wantOpen ? 0.0001 : 0.01, dt); // 開くのは素早く
    this.mouthOpen += ((wantOpen ? 1 : 0) - this.mouthOpen) * k;

    // 演出の減衰
    this.pulse = Math.max(0, this.pulse - dt * 3.5);
    this.growFlash = Math.max(0, this.growFlash - dt * 2);

    // バキュームモードのタイマー
    if (this.vacuumActive) {
      this.vacuumTimer -= dt;
      this.vacuumGauge = Math.max(0, this.vacuumTimer / this.vacuumDuration);
      if (this.vacuumTimer <= 0) {
        this.vacuumActive = false;
        this.vacuumGauge = 0;
      }
    }
  }

  /**
   * 成長。整数の壁(2,3,...)を超えたら true を返す(演出用)
   */
  grow(amount) {
    const before = Math.floor(this.scale);
    this.scale = Math.min(Player.MAX_SCALE, this.scale + amount * (this.skin.growMul || 1));
    return Math.floor(this.scale) > before;
  }

  /** ゲージを溜める。満タンになったら true(発動は Game 側) */
  chargeVacuum(amount) {
    if (this.vacuumActive) return false;
    this.vacuumGauge = Math.min(1, this.vacuumGauge + amount);
    return this.vacuumGauge >= 1;
  }

  startVacuum() {
    this.vacuumActive = true;
    this.vacuumTimer = this.vacuumDuration;
    this.vacuumGauge = 1;
  }

  /* ---- 描画 ---- */

  draw(ctx) {
    const r = this.bodyR;
    // 移動中は弾むように上下する
    const bob = this.moving ? Math.sin(this.time * 12) * r * 0.05 : Math.sin(this.time * 3) * r * 0.02;
    // 食べた瞬間ぷくっと膨らむ
    const puff = 1 + this.pulse * 0.12;

    // 足元の影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + r * 0.75, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // バキューム中のオーラ
    if (this.vacuumActive) {
      const auraR = this.mouthRadius * (1.15 + Math.sin(this.time * 10) * 0.08);
      const mouth = this.getMouth();
      const grad = ctx.createRadialGradient(mouth.x, mouth.y, auraR * 0.2, mouth.x, mouth.y, auraR);
      grad.addColorStop(0, 'rgba(255,255,255,0.0)');
      grad.addColorStop(0.7, this._rgba(this.skin.color, 0.22));
      grad.addColorStop(1, this._rgba(this.skin.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mouth.x, mouth.y, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 成長時に体が光る
    if (this.growFlash > 0) {
      ctx.fillStyle = `rgba(255, 240, 150, ${this.growFlash * 0.35})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * (1.2 + (1 - this.growFlash) * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // 本体スプライト(口の開閉で画像切り替え)
    const img = this.mouthOpen > 0.5 ? this.images.open : this.images.closed;
    const aspect = img.height / img.width;
    const w = r * 2.35 * puff;
    const h = w * aspect;
    const tilt = this.dirX * 0.14 * this.speedRatio; // 進行方向へ少し傾く

    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(tilt);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /** '#rrggbb' → 'rgba(...)' 変換 */
  _rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
}
