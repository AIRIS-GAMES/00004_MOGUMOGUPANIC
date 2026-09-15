/* =========================================================
 * Camera - プレイヤー追従カメラ
 * なめらかな追従(指数補間)・ズーム・画面シェイクを担当。
 * プレイヤーが巨大化するほどズームアウトして視界を確保する。
 * ========================================================= */
class Camera {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.zoom = 1;
    // シェイク
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.offX = 0;
    this.offY = 0;
  }

  /** 目標位置・ズームへなめらかに追従する */
  follow(tx, ty, tzoom, dt) {
    // フレームレート非依存の指数補間
    const k = 1 - Math.pow(0.002, dt);
    const kz = 1 - Math.pow(0.05, dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.zoom += (tzoom - this.zoom) * kz;
  }

  /** 即座に位置合わせ(ゲーム開始時など) */
  snap(x, y, zoom) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
  }

  /** シェイクを加える(大きい方を採用) */
  shake(amp) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeTime = 0.25;
  }

  update(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeTime / 0.25);
      this.offX = (Math.random() * 2 - 1) * a;
      this.offY = (Math.random() * 2 - 1) * a;
      if (this.shakeTime <= 0) this.shakeAmp = 0;
    } else {
      this.offX = 0;
      this.offY = 0;
    }
  }

  /** ワールド座標系への変換を ctx に適用する(w/h は CSS px) */
  apply(ctx, w, h) {
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.offX, -this.y + this.offY);
  }

  /** 現在の視界のワールド座標範囲。pad で外側に広げられる */
  viewBounds(w, h, pad = 0) {
    const hw = w / 2 / this.zoom + pad;
    const hh = h / 2 / this.zoom + pad;
    return { l: this.x - hw, r: this.x + hw, t: this.y - hh, b: this.y + hh };
  }
}
