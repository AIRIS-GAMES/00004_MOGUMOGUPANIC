/* =========================================================
 * Spawner - オブジェクトの生成・プーリング管理
 * 固定サイズのプールを使い回し、吸われたオブジェクトは
 * 一定時間後にカメラ外へ再配置(リスポーン)する。
 * ========================================================= */
class Spawner {
  /**
   * @param {number} worldSize  マップの一辺 [px]
   * @param {number} count      常時維持するオブジェクト数
   */
  constructor(worldSize, count = 220) {
    this.worldSize = worldSize;
    this.count = count;
    this.margin = 130; // マップ端からの最低距離

    // プール本体(count 個を使い回す)
    this.pool = Array.from({ length: count }, () => new GameObject());
    // リスポーン待ちタイマー [{t}] : t秒後に1体スポーン
    this.respawnQueue = [];
    this.types = OBJECT_TYPES;
  }

  setTypes(typeIds) {
    const selected = OBJECT_TYPES.filter(type => typeIds.includes(type.id));
    this.types = selected.length ? selected : OBJECT_TYPES;
  }

  /** ゲーム開始時の初期配置 */
  populate(centerX, centerY, clearRadius = 320) {
    this.respawnQueue.length = 0;
    for (const obj of this.pool) {
      const type = this._chooseType(1);
      const pos = this._randomPos(centerX, centerY, clearRadius);
      obj.reset(type, pos.x, pos.y);
    }
  }

  /** 毎フレーム更新。リスポーン処理のみ(オブジェクト自体の移動は Game 側) */
  update(dt, playerScale, camera, viewW, viewH) {
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      this.respawnQueue[i].t -= dt;
      if (this.respawnQueue[i].t <= 0) {
        this.respawnQueue.splice(i, 1);
        this._respawnOne(playerScale, camera, viewW, viewH);
      }
    }
  }

  /** 吸われた時に呼ぶ。プールへ返却し、リスポーンを予約 */
  kill(obj) {
    obj.active = false;
    obj.state = 'idle';
    this.respawnQueue.push({ t: 1 + Math.random() * 2.5 });
  }

  forEachActive(cb) {
    for (const obj of this.pool) {
      if (obj.active) cb(obj);
    }
  }

  /* ---- 内部処理 ---- */

  /** 非アクティブなオブジェクトを1体、画面外に再配置 */
  _respawnOne(playerScale, camera, viewW, viewH) {
    const obj = this.pool.find(o => !o.active);
    if (!obj) return;

    const type = this._chooseType(playerScale);
    const view = camera ? camera.viewBounds(viewW, viewH, 150) : null;

    // カメラ視界の外になる位置を探す(最大20回試行)
    let x, y;
    for (let i = 0; i < 20; i++) {
      x = this.margin + Math.random() * (this.worldSize - this.margin * 2);
      y = this.margin + Math.random() * (this.worldSize - this.margin * 2);
      if (!view || x < view.l || x > view.r || y < view.t || y > view.b) break;
    }
    obj.reset(type, x, y);
  }

  /**
   * 出現タイプの抽選。
   * プレイヤーが今〜もうすぐ吸えるサイズを優先して出す。
   */
  _chooseType(playerScale) {
    let total = 0;
    const weights = this.types.map(t => {
      let w = t.weight;
      if (t.req > playerScale + 2.5) w *= 0.15;      // まだ遠い → ほぼ出さない
      else if (t.req > playerScale) w *= 0.55;       // もうすぐ吸える → 少なめ
      total += w;
      return w;
    });
    let roll = Math.random() * total;
    for (let i = 0; i < this.types.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return this.types[i];
    }
    return this.types[0];
  }

  /** ランダム位置(開始地点の周囲 clearRadius は空けておく) */
  _randomPos(cx, cy, clearRadius) {
    for (let i = 0; i < 30; i++) {
      const x = this.margin + Math.random() * (this.worldSize - this.margin * 2);
      const y = this.margin + Math.random() * (this.worldSize - this.margin * 2);
      if (Math.hypot(x - cx, y - cy) > clearRadius) return { x, y };
    }
    return { x: cx + clearRadius, y: cy };
  }
}
