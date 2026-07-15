/* =========================================================
 * Game.js - ゲーム本体
 *  - Particles: 星・キラキラ等のエフェクト(プーリング)
 *  - Game:      状態管理・入力・メインループ・描画
 * ========================================================= */

/* ---------------------------------------------------------
 * パーティクル(星 / キラキラ / リング)
 * ------------------------------------------------------- */
class Particles {
  constructor(max = 240) {
    this.pool = Array.from({ length: max }, () => ({
      active: false, kind: 'spark',
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 6, color: '#fff',
      rot: 0, vr: 0,
    }));
  }

  _get() {
    return this.pool.find(p => !p.active);
  }

  _emit(props) {
    const p = this._get();
    if (!p) return;
    Object.assign(p, {
      active: true, vx: 0, vy: 0, rot: 0, vr: 0,
      maxLife: props.life,
    }, props);
  }

  /** 吸い込み成功時:星+キラキラを撒く */
  burst(x, y, color, effect = { kind: 'star', colors: ['#ffd24d', color] }) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 140 + Math.random() * 220;
      this._emit({
        kind: effect.kind || 'star', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: 0.5 + Math.random() * 0.3,
        size: 8 + Math.random() * 8,
        color: effect.colors[Math.floor(Math.random() * effect.colors.length)],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12,
      });
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 260;
      this._emit({
        kind: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.25 + Math.random() * 0.25,
        size: 3 + Math.random() * 4,
        color: '#ffffff',
      });
    }
  }

  /** 成長・バキューム発動時:広がるリング */
  ring(x, y, color, size = 60) {
    this._emit({ kind: 'ring', x, y, life: 0.45, size, color });
  }

  /** バキューム中:吸い寄せられるキラキラ */
  vacuumSpark(mx, my, radius, effect = { kind: 'spark', colors: ['#ffe680', '#ffffff'] }) {
    const a = Math.random() * Math.PI * 2;
    const x = mx + Math.cos(a) * radius;
    const y = my + Math.sin(a) * radius;
    this._emit({
      kind: effect.kind === 'bubble' ? 'bubble' : 'spark', x, y,
      vx: (mx - x) * 3.2, vy: (my - y) * 3.2,
      life: 0.3, size: 3 + Math.random() * 3,
      color: effect.colors[Math.floor(Math.random() * effect.colors.length)],
    });
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.rot += p.vr * dt;
      if (p.kind === 'star') p.vy += 240 * dt; // 星はふわっと落ちる
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - t * 0.6), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'star' || p.kind === 'heart' || p.kind === 'flame') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const size = p.size * (0.5 + t * 0.5);
        if (p.kind === 'heart') this._heartPath(ctx, size);
        else if (p.kind === 'flame') this._flamePath(ctx, size);
        else this._starPath(ctx, size);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'bubble') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.2 * t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.2 - t * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _starPath(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  _heartPath(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.85);
    ctx.bezierCurveTo(-r * 1.25, r * 0.1, -r, -r * 0.75, -r * 0.42, -r * 0.72);
    ctx.bezierCurveTo(0, -r * 0.7, 0, -r * 0.2, 0, -r * 0.08);
    ctx.bezierCurveTo(0, -r * 0.2, 0, -r * 0.7, r * 0.42, -r * 0.72);
    ctx.bezierCurveTo(r, -r * 0.75, r * 1.25, r * 0.1, 0, r * 0.85);
    ctx.closePath();
  }

  _flamePath(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.2, -r * 0.35, r, -r * 0.1, r * 0.55, r * 0.75);
    ctx.bezierCurveTo(r * 0.2, r * 1.15, -r * 0.55, r, -r * 0.65, r * 0.35);
    ctx.bezierCurveTo(-r * 0.75, -r * 0.2, -r * 0.15, -r * 0.38, 0, -r);
    ctx.closePath();
  }
}

/* ---------------------------------------------------------
 * ゲーム本体
 * ------------------------------------------------------- */
class Game {
  static WORLD = 3500;       // マップの一辺 [px]
  static TIME_LIMIT = 60;    // 制限時間 [s]
  static DAILY_BONUS = 100;
  static EFFECTS = [
    { id: 'sparkle', name: 'SPARKLE', symbol: '★', description: '星のきらめき', price: 0, kind: 'star', color: '#ffd24d', colors: ['#ffd24d', '#ffffff'] },
    { id: 'heart', name: 'HEART', symbol: '♥', description: 'ハートが舞う', price: 800, kind: 'heart', color: '#ff5f91', colors: ['#ff5f91', '#ffb2ca'] },
    { id: 'bubble', name: 'BUBBLE', symbol: '○', description: '泡がはじける', price: 1200, kind: 'bubble', color: '#58cfee', colors: ['#58cfee', '#c5f7ff'] },
    { id: 'flame', name: 'FLAME', symbol: '▲', description: '炎が立ちのぼる', price: 1600, kind: 'flame', color: '#ff7438', colors: ['#ff7438', '#ffd24d'] },
  ];
  static BOOSTS = [
    { id: 'time', name: 'TIME +5', description: '制限時間を5秒追加', price: 200 },
    { id: 'size', name: 'START SIZE ×2', description: 'サイズ2.00でスタート', price: 300 },
    { id: 'score', name: 'SCORE ×2', description: '獲得スコアが2倍', price: 500 },
  ];
  static STAGES = [
    { id: 1, name: 'はじまりの街', theme: 'park', time: 60, targetScore: 800, rewardCoins: 100, story: '閉店後のゲームセンター。コスミーは、街のデータが増え続ける異常を見つけた。', clearText: '吸い込むと街が元に戻った。隣のゲーム機にもエラーが広がっている。' },
    { id: 2, name: 'カラフルタウン', theme: 'town', time: 60, targetScore: 2500, rewardCoins: 150, story: '子ども向けゲームの街で、かわいいオブジェクトが止まらず増殖している。', clearText: '街の色が戻った。だが、レースゲームから大きな警告音が聞こえる。' },
    { id: 3, name: 'ドライブシティ', theme: 'city', time: 60, targetScore: 5000, rewardCoins: 250, story: 'レースゲームの道路を、複製された車と信号が埋め尽くしていた。', clearText: '交通データの回収に成功。エラーは買い物ゲームへ逃げ込んだ。' },
    { id: 4, name: 'ショッピングパニック', theme: 'shopping', time: 60, targetScore: 6500, rewardCoins: 300, story: '買い物袋や商品データが大増殖。ゲームの出口まで塞がれそうだ。', clearText: '商品データは正常に戻った。管理システムにつながる手がかりを発見した。' },
    { id: 5, name: 'オフィスラッシュ', theme: 'office', time: 60, targetScore: 8000, rewardCoins: 350, story: '時間管理ゲームが暴走し、椅子や機械を無限に作り続けている。', clearText: '暴走は止まった。エラーの発生源は工場ゲームの奥にあるらしい。' },
    { id: 6, name: 'ファクトリーブレイク', theme: 'factory', time: 65, targetScore: 10000, rewardCoins: 400, story: '工場ゲームでは木箱とドラム缶が生産ラインからあふれ出していた。', clearText: '装置を止めたが、壊れたデータは港のゲームへ運び出されていた。' },
    { id: 7, name: 'ハーバーキャッチ', theme: 'port', time: 65, targetScore: 12500, rewardCoins: 500, story: '港湾クレーンゲームから、壊れたデータが別の筐体へ流出している。', clearText: '港を封鎖した。最後の荷物は空港ゲームへ運ばれている。' },
    { id: 8, name: 'エアポートダッシュ', theme: 'airport', time: 70, targetScore: 15000, rewardCoins: 600, story: '荷物データに紛れたエラーが、すべてのゲーム機へ飛び立とうとしている。', clearText: '拡散を阻止した。エラーの本体は古い未来都市ゲームに潜んでいる。' },
    { id: 9, name: 'ネオンフューチャー', theme: 'future', time: 70, targetScore: 18000, rewardCoins: 750, story: '遊ばれなくなった未来都市。その寂しさからエラーは生まれていた。', clearText: 'コスミーの声が届いた。しかし全データが中央筐体へ集まり始める。' },
    { id: 10, name: 'アーケード・ヘブン', theme: 'mega', time: 75, targetScore: 22000, rewardCoins: 1000, story: '10台のゲーム世界が融合した。朝が来る前に、最後のエラーを回収しよう。', clearText: 'ゲームセンターに朝が戻った。コスミーたちの秘密の夜は、これからも続く。' },
  ];
  static THEMES = {
    park: { ground: '#a4d977', road: '#9aa4b1', line: '#ffffff', border: '#5f8f3e', decor: ['#b3e087', '#8fcd69', '#d2ed9d'], objects: ['flower', 'coin', 'trash', 'bench', 'tree', 'house'] },
    town: { ground: '#bedb86', road: '#8e9ba8', line: '#fff4c2', border: '#729456', decor: ['#d6e6a0', '#91c66f', '#f2cf75'], objects: ['coin', 'trash', 'bench', 'signal', 'car', 'house'] },
    city: { ground: '#aab7bd', road: '#65727d', line: '#f4e884', border: '#4e5961', decor: ['#bac4c8', '#89989f', '#d1d8da'], objects: ['coin', 'trash', 'signal', 'car', 'house', 'tower'] },
    shopping: { ground: '#f4c9d8', road: '#927f92', line: '#fff7c7', border: '#b56d8b', decor: ['#f8dce6', '#e8a9c1', '#ffd17d'], objects: ['coin', 'shoppingBag', 'bench', 'car', 'house', 'tower'] },
    office: { ground: '#a8c9d5', road: '#586d7a', line: '#e8f6fa', border: '#49798a', decor: ['#c5dce4', '#7eb0c0', '#d4e8ed'], objects: ['coin', 'officeChair', 'trash', 'signal', 'car', 'tower'] },
    factory: { ground: '#b9aa8e', road: '#555a5c', line: '#f5c443', border: '#766650', decor: ['#cfbea0', '#988a72', '#dcbd76'], objects: ['coin', 'crate', 'barrel', 'signal', 'car', 'tower'] },
    port: { ground: '#7fc7c2', road: '#687a7d', line: '#f8f1c7', border: '#397e83', decor: ['#9bd8d2', '#5faeaa', '#d8cc80'], objects: ['coin', 'buoy', 'barrel', 'crate', 'car', 'tower'] },
    airport: { ground: '#c2d3d7', road: '#4c5863', line: '#ffffff', border: '#758b91', decor: ['#d7e2e4', '#9eb5bb', '#76b7d4'], objects: ['coin', 'suitcase', 'trash', 'car', 'drone', 'tower'] },
    future: { ground: '#89b8b0', road: '#37455a', line: '#68f4e1', border: '#286e74', decor: ['#a1d0c8', '#62a69e', '#7ce0cf'], objects: ['coin', 'drone', 'officeChair', 'signal', 'car', 'tower'] },
    mega: { ground: '#a68db7', road: '#3e3947', line: '#ffd85f', border: '#654c78', decor: ['#c1a7d0', '#806392', '#e0b85e'], objects: ['flower', 'coin', 'trash', 'barrel', 'bench', 'tree', 'signal', 'car', 'house', 'shoppingBag', 'officeChair', 'crate', 'buoy', 'suitcase', 'drone', 'tower'] },
  };
  static ROADS = [700, 1400, 2100, 2800]; // 道路の中心座標(縦横共通)
  static ROAD_W = 110;

  constructor(canvas, images, ui, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = images; // { skinId: {open, closed} }
    this.ui = ui;
    this.audio = audio;
    this.state = 'title'; // 'title' | 'skin' | 'play' | 'pause' | 'result'
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0;
    this.h = 0;

    const center = Game.WORLD / 2;
    this.camera = new Camera(center, center);
    this.spawner = new Spawner(Game.WORLD, 300);
    this.particles = new Particles();
    this.player = null;

    // スコア関連
    this.score = 0;
    this.timeLeft = Game.TIME_LIMIT;
    this.suckedCount = 0;
    this.maxScale = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this._lastThud = 0;
    this.time = 0;
    this.currentStageId = 1;
    this.stageIntroTimer = 0;
    this.activeBoosts = new Set();
    this.scoreMultiplier = 1;
    this.pendingStageId = 1;
    this._pendingBonusCoins = 0; // 未計測のデイリーボーナス額(GET!タップ時に送信)
    this.boostBackTarget = 'title';

    // タイトル画面を歩き回るキャラクター
    this.walkers = SKINS.map((skin, i) => ({
      skin,
      x: center + Math.cos((i / SKINS.length) * Math.PI * 2) * 400,
      y: center + Math.sin((i / SKINS.length) * Math.PI * 2) * 400,
      tx: center, ty: center,
      phase: Math.random() * 10,
      openTimer: Math.random() * 4,
    }));

    // 街の飾り(草むら)。道路を避けて配置
    this.decor = [];
    for (let i = 0; i < 160; i++) {
      const x = 100 + Math.random() * (Game.WORLD - 200);
      const y = 100 + Math.random() * (Game.WORLD - 200);
      if (this._onRoad(x) || this._onRoad(y)) continue;
      this.decor.push({
        x, y,
        r: 14 + Math.random() * 26,
        tone: Math.floor(Math.random() * 3),
      });
    }

    this._setupInput();
    this._setupUI();

    window.addEventListener('resize', () => this._resize());
    this._resize();

    // タブが隠れたら自動ポーズ
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.pauseGame();
    });

    // メインループ開始
    this._lastT = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  /* ================= 入力(Pointer Events + キーボード) ================= */

  _setupInput() {
    // 仮想ジョイスティック:ドラッグ開始点からの方向で移動
    this.input = {
      active: false, id: null,
      anchorX: 0, anchorY: 0, curX: 0, curY: 0,
      maxLen: 70,
    };
    this.keys = new Set();

    const pos = (e) => ({ x: e.clientX, y: e.clientY });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.input.active) return; // 最初の指のみ追跡
      const p = pos(e);
      this.input.active = true;
      this.input.id = e.pointerId;
      this.input.anchorX = p.x;
      this.input.anchorY = p.y;
      this.input.curX = p.x;
      this.input.curY = p.y;
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.input.active || e.pointerId !== this.input.id) return;
      const p = pos(e);
      this.input.curX = p.x;
      this.input.curY = p.y;
      // 指が離れすぎたらアンカーを引きずる(方向転換しやすくする)
      const dx = p.x - this.input.anchorX;
      const dy = p.y - this.input.anchorY;
      const len = Math.hypot(dx, dy);
      if (len > this.input.maxLen) {
        const over = (len - this.input.maxLen) / len;
        this.input.anchorX += dx * over;
        this.input.anchorY += dy * over;
      }
    });

    const end = (e) => {
      if (e.pointerId !== this.input.id) return;
      this.input.active = false;
      this.input.id = null;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);

    // PC 用キーボード操作(WASD / 矢印)
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** 正規化した移動入力を返す { active, dx, dy, ratio } */
  _getMoveInput() {
    // キーボード優先(押されていれば)
    let kx = 0, ky = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) kx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) kx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) ky -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) ky += 1;
    if (kx || ky) {
      const len = Math.hypot(kx, ky);
      return { active: true, dx: kx / len, dy: ky / len, ratio: 1 };
    }

    if (!this.input.active) return { active: false, dx: 0, dy: 0, ratio: 0 };
    const dx = this.input.curX - this.input.anchorX;
    const dy = this.input.curY - this.input.anchorY;
    const len = Math.hypot(dx, dy);
    if (len < 8) return { active: true, dx: 0, dy: 0, ratio: 0 }; // デッドゾーン
    return {
      active: true,
      dx: dx / len,
      dy: dy / len,
      ratio: Math.min(1, len / this.input.maxLen),
    };
  }

  /* ================= UI イベント ================= */

  _setupUI() {
    this.ui.setSoundLabel(this.audio.enabled);
    this.ui.bind({
      onStart: () => {
        this._btn();
        this.openBoosts(Math.min(Storage.getUnlockedStage(), Game.STAGES.length), 'title');
      },
      onStageSelect: () => { this._btn(); this.openStages(); },
      onStageBack: () => { this._btn(); this.showTitle(); },
      onSkinOpen: () => { this._btn(); this.openSkin(); },
      onSkinBack: () => { this._btn(); this.showTitle(); },
      onShopSkins: () => { this._btn(); this.ui.showShopTab('skins'); },
      onShopEffects: () => { this._btn(); this.ui.showShopTab('effects'); },
      onBoostBack: () => { this._btn(); this.backFromBoosts(); },
      onBoostStart: (ids) => { this._btn(); this.buyBoostsAndStart(ids); },
      onSoundToggle: () => {
        this.audio.setEnabled(!this.audio.enabled);
        this.ui.setSoundLabel(this.audio.enabled);
        this._btn();
      },
      onPause: () => { this._btn(); this.pauseGame(); },
      onResume: () => { this._btn(); this.resumeGame(); },
      onHome: () => { this._btn(); this.showTitle(); },
      onAgain: () => { this._btn(); this.openBoosts(this.currentStageId, 'result'); },
      onNextStage: () => {
        if (this.currentStageId >= Game.STAGES.length) return;
        this._btn();
        this.openBoosts(this.currentStageId + 1, 'result');
      },
      onLoginBonusClose: () => {
        this._btn();
        // GET!タップ時に計測(この時点なら同意直後でもSDK初期化が完了している)
        if (this._pendingBonusCoins > 0) {
          Analytics.coinSource(this._pendingBonusCoins, 'daily_bonus', 'login');
          this._pendingBonusCoins = 0;
        }
        this.ui.closeLoginBonus();
      },
    });
  }

  _btn() { this.audio.button(); }

  /* ================= 状態遷移 ================= */

  showTitle() {
    this.state = 'title';
    this.player = null;
    const center = Game.WORLD / 2;
    this.spawner.populate(center, center, 0);
    this.camera.snap(center, center, 0.8);
    this.ui.updateCoins(Storage.getCoins());
    this.ui.updateContinueStage(Math.min(Storage.getUnlockedStage(), Game.STAGES.length));
    this.ui.showScreen('title');

    this.checkDailyBonus();
  }

  /**
   * デイリーボーナスの判定・表示。
   * タイトル表示中かつバナーが閉じられている時だけ実行する
   * (プレイ中のタブ復帰などで割り込まないようにガード。
   *  受け取っていない分は次にタイトルへ戻った時に付与される)
   */
  checkDailyBonus() {
    if (this.state !== 'title') return;
    const total = Storage.claimDailyBonus(Game.DAILY_BONUS);
    if (total !== null) {
      this.ui.updateCoins(total);
      this.ui.showLoginBonus(Game.DAILY_BONUS);
      // 計測は GET! タップ時まで保留(同意直後の初期化前ドロップを回避)
      this._pendingBonusCoins = Game.DAILY_BONUS;
    }
  }

  openStages() {
    this.state = 'stage';
    this.ui.buildStageGrid(
      Game.STAGES,
      Math.min(Storage.getUnlockedStage(), Game.STAGES.length),
      Storage.getClearedStages(),
      (stageId) => { this._btn(); this.openBoosts(stageId, 'stage'); }
    );
    this.ui.showScreen('stage');
  }

  openSkin() {
    this.state = 'skin';
    this.ui.showShopNotice();
    this.renderShop();
    this.ui.showShopTab('skins');
    this.ui.showScreen('skin');
  }

  renderShop() {
    const coins = Storage.getCoins();
    this.ui.buildSkinGrid(SKINS, Storage.getSkin(), Storage.getOwnedSkins(), coins, (id) => {
      this._btn();
      const skin = SKINS.find(item => item.id === id);
      if (!skin) return;
      if (!Storage.ownsSkin(id)) {
        if (Storage.getCoins() < skin.price) {
          this.ui.showShopNotice(`あと${(skin.price - Storage.getCoins()).toLocaleString()}コイン必要です`, true);
          return;
        }
        Storage.setCoins(Storage.getCoins() - skin.price);
        Storage.unlockSkin(id);
        Storage.setSkin(id);
        Analytics.coinSink(skin.price, 'skin', id);
        Analytics.design(`skin:equip:${id}`);
        this.renderShop();
        this.ui.showShopNotice(`${skin.name}を購入して装備しました`);
        return;
      }
      Storage.setSkin(id);
      Analytics.design(`skin:equip:${id}`);
      this.renderShop();
      this.ui.showShopNotice(`${skin.name}を装備しました`);
    });
    this.ui.buildEffectGrid(Game.EFFECTS, Storage.getEffect(), Storage.getOwnedEffects(), Storage.getCoins(), (id) => {
      this._btn();
      const effect = Game.EFFECTS.find(item => item.id === id);
      if (!effect) return;
      if (!Storage.ownsEffect(id)) {
        if (Storage.getCoins() < effect.price) {
          this.ui.showShopNotice(`あと${(effect.price - Storage.getCoins()).toLocaleString()}コイン必要です`, true);
          return;
        }
        Storage.setCoins(Storage.getCoins() - effect.price);
        Storage.unlockEffect(id);
        Storage.setEffect(id);
        Analytics.coinSink(effect.price, 'effect', id);
        Analytics.design(`effect:equip:${id}`);
        this.renderShop();
        this.ui.showShopTab('effects');
        this.ui.showShopNotice(`${effect.name}を購入して装備しました`);
        return;
      }
      Storage.setEffect(id);
      Analytics.design(`effect:equip:${id}`);
      this.renderShop();
      this.ui.showShopTab('effects');
      this.ui.showShopNotice(`${effect.name}を装備しました`);
    });
  }

  openBoosts(stageId, backTarget) {
    const stage = Game.STAGES.find(item => item.id === stageId) || Game.STAGES[0];
    this.pendingStageId = stage.id;
    this.boostBackTarget = backTarget;
    this.state = 'boost';
    this.ui.showBoosts(stage, Game.BOOSTS, Storage.getCoins());
  }

  backFromBoosts() {
    if (this.boostBackTarget === 'stage') this.openStages();
    else if (this.boostBackTarget === 'result') {
      this.state = 'result';
      this.ui.showScreen('hud', 'result');
    } else this.showTitle();
  }

  buyBoostsAndStart(ids) {
    const selected = Game.BOOSTS.filter(item => ids.includes(item.id));
    const total = selected.reduce((sum, item) => sum + item.price, 0);
    const coins = Storage.getCoins();
    if (total > coins) return;
    Storage.setCoins(coins - total);
    for (const item of selected) Analytics.coinSink(item.price, 'boost', item.id);
    this.startGame(this.pendingStageId, selected.map(item => item.id));
  }

  startGame(stageId = this.currentStageId, boostIds = []) {
    const stage = Game.STAGES.find(item => item.id === stageId) || Game.STAGES[0];
    this.currentStageId = stage.id;
    const skinId = Storage.getSkin();
    const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
    const center = Game.WORLD / 2;

    this.player = new Player(skin, this.images[skin.id], center, center);
    this.activeBoosts = new Set(boostIds);
    this.scoreMultiplier = this.activeBoosts.has('score') ? 2 : 1;
    if (this.activeBoosts.has('size')) this.player.scale = 2;
    this.spawner.setTypes(Game.THEMES[stage.theme].objects);
    this.spawner.populate(center, center, 180);

    this.score = 0;
    this.timeLeft = stage.time + (this.activeBoosts.has('time') ? 5 : 0);
    this.suckedCount = 0;
    this.maxScale = this.player.scale;
    this.comboCount = 0;
    this.comboTimer = 0;
    for (const p of this.particles.pool) p.active = false;

    this.camera.snap(center, center, this._targetZoom());
    this.ui.updateHUD(0, this.player.scale, this.timeLeft, stage.targetScore);
    this.ui.setGauge(0, false);
    this.ui.showScreen('hud');
    this.ui.showStageIntro(stage);
    this.stageIntroTimer = 3.5;
    this.state = 'intro';
    this.input.active = false;
    Analytics.stageStart(stage.id);
  }

  pauseGame() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.input.active = false;
    this.ui.showScreen('hud', 'pause');
  }

  resumeGame() {
    if (this.state !== 'pause') return;
    this.state = 'play';
    this._lastT = performance.now(); // ポーズ中の経過時間を捨てる
    this.ui.showScreen('hud');
  }

  endGame() {
    this.state = 'result';
    this.input.active = false;
    this.audio.timeup();

    const stage = Game.STAGES.find(item => item.id === this.currentStageId) || Game.STAGES[0];

    // NEW RECORD はこのステージの「前回記録(>0)を上回った時」だけ表示する。
    // ・ステージ間で目標が異なるため全体ベストでは判定しない(失敗時の誤表示を回避)
    // ・初挑戦(前回0)は記録更新でも祝福しない(TRY AGAIN と同時に出ると不自然なため)
    const prevStageBest = Storage.getStageBest(stage.id);
    const isNewBest = this.score > prevStageBest && prevStageBest > 0;
    if (this.score > prevStageBest) Storage.setStageBest(stage.id, this.score);
    // 全体ベスト(生涯ハイスコア)は別途更新し続ける
    if (this.score > Storage.getBest()) Storage.setBest(this.score);

    const cleared = this.score >= stage.targetScore;
    // 報酬:初回クリアは満額、再クリアは25%(コイン経済のインフレ防止)
    const firstClear = cleared && !Storage.hasClearedStage(stage.id);
    const reward = cleared
      ? (firstClear ? stage.rewardCoins : Math.ceil(stage.rewardCoins * 0.25))
      : 0;
    if (cleared) {
      if (firstClear) Storage.markStageCleared(stage.id);
      Storage.addCoins(reward);
    }
    if (cleared && stage.id < Game.STAGES.length) {
      Storage.setUnlockedStage(Math.max(Storage.getUnlockedStage(), stage.id + 1));
    }

    // 計測:ステージ結果・報酬・到達サイズ
    if (cleared) {
      Analytics.stageComplete(stage.id, this.score);
      Analytics.coinSource(reward, 'stage_reward', `stage_${String(stage.id).padStart(2, '0')}`);
    } else {
      Analytics.stageFail(stage.id, this.score);
    }
    Analytics.design('run:maxsize', Math.round(this.maxScale * 100));

    this.ui.showResult({
      score: this.score,
      best: Math.max(prevStageBest, this.score),
      isNewBest,
      count: this.suckedCount,
      maxSize: this.maxScale,
      cleared,
      reward,
      hasNext: cleared && stage.id < Game.STAGES.length,
      stage,
    });
  }

  /* ================= メインループ ================= */

  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    let dt = (now - this._lastT) / 1000;
    this._lastT = now;
    dt = Math.min(dt, 0.05); // タブ復帰時などの巨大 dt を防ぐ
    this.time += dt;

    if (this.state === 'intro') this._updateStageIntro(dt);
    else if (this.state === 'play') this._updatePlay(dt);
    else if (this.state === 'title' || this.state === 'skin') this._updateTitle(dt);

    this._render();
  }

  _updateStageIntro(dt) {
    this.stageIntroTimer -= dt;
    if (this.stageIntroTimer > 0) return;
    this.ui.hideStageIntro();
    this.state = 'play';
    this._lastT = performance.now();
  }

  /** プレイヤーサイズに応じたズーム(大きいほど引く) */
  _targetZoom() {
    const s = this.player ? this.player.scale : 1;
    return Math.max(0.3, Math.min(1.15, 1.15 / Math.pow(s, 0.5)));
  }

  /* ---- プレイ中の更新 ---- */
  _updatePlay(dt) {
    const player = this.player;

    player.update(this._getMoveInput(), dt, Game.WORLD);
    this._updateSuction(dt);
    this.spawner.update(dt, player.scale, this.camera, this.w, this.h);
    this.particles.update(dt);

    // コンボ猶予時間
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // バキューム中の常時エフェクト
    if (player.vacuumActive) {
      const m = player.getMouth();
      this.particles.vacuumSpark(m.x, m.y, m.r * 1.1, this._activeEffect());
      this.ui.setGauge(player.vacuumGauge, true);
    }

    // カメラ追従
    this.camera.follow(player.x, player.y, this._targetZoom(), dt);
    this.camera.update(dt);

    // 制限時間
    this.timeLeft -= dt;
    const stage = Game.STAGES.find(item => item.id === this.currentStageId) || Game.STAGES[0];
    this.ui.updateHUD(this.score, player.scale, this.timeLeft, stage.targetScore);
    if (this.timeLeft <= 0) this.endGame();
  }

  /** 吸い込み判定と吸引の進行 */
  _updateSuction(dt) {
    const player = this.player;
    const mouth = player.getMouth();

    this.spawner.forEachActive((obj) => {
      const dx = mouth.x - obj.x;
      const dy = mouth.y - obj.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      if (obj.state === 'idle') {
        if (obj.wobble > 0) obj.wobble -= dt;
        const catchRadius = mouth.r + obj.r * 1.45;
        if (dist < catchRadius) {
          const fitsMouth = obj.r <= mouth.r * 1.05;
          if (player.scale >= obj.type.req && fitsMouth) {
            // 吸い込み開始
            obj.state = 'suck';
            obj.suckStartDist = dist;
            obj.suckTime = 0;
            player.mouthHold = 0.6;
            player.mouthOpen = Math.max(player.mouthOpen, 0.65);
          } else {
            // サイズ不足 → 少し押し返すだけ
            const push = Math.max(0, mouth.r + obj.r - dist) * 0.5;
            obj.x -= (dx / dist) * push;
            obj.y -= (dy / dist) * push;
            if (obj.wobble <= 0) {
              obj.wobble = 0.5;
              if (this.time - this._lastThud > 0.25) {
                this._lastThud = this.time;
                this.audio.thud();
              }
            }
          }
        }
      } else if (obj.state === 'suck') {
        // 口へ引き寄せた後、開口部の奥へ落としていく
        player.mouthHold = Math.max(player.mouthHold, 0.12);
        player.mouthOpen = Math.max(player.mouthOpen, 0.65);
        obj.suckTime += dt;
        const speed = player.suckSpeed * 0.56 + obj.r * 1.15;
        const newDist = dist - speed * dt * (1 + (1 - dist / obj.suckStartDist) * 0.65);
        const distanceProgress = Math.max(0, Math.min(1, 1 - newDist / obj.suckStartDist));
        const timeProgress = Math.min(1, obj.suckTime / 0.9);
        const progress = Math.max(distanceProgress, timeProgress);
        const sink = this._smoothstep(Math.max(0, Math.min(1, (progress - 0.28) / 0.72)));
        obj.sinkProgress = sink;
        obj.rot += (3.5 + sink * 4.5) * dt;
        obj.drawScale = Math.max(0.06, 1 - progress * 0.16 - sink * 0.7);
        obj.drawAlpha = Math.max(0.15, 1 - Math.max(0, (sink - 0.68) / 0.32) * 0.85);

        if (newDist < Math.max(3, obj.r * 0.08) || sink > 0.96 || obj.suckTime > 1.25) {
          this._consume(obj);
        } else {
          const ratio = newDist / dist;
          const pullX = mouth.x - dx * ratio;
          const pullY = mouth.y - dy * ratio;
          obj.x = pullX + (mouth.x - pullX) * sink * 0.9;
          obj.y = pullY + mouth.r * (0.16 + sink * 0.42) * sink;
        }
      }
    });
  }

  _smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  /** 吸い込み完了(スコア・成長・コンボ・演出) */
  _consume(obj) {
    const player = this.player;
    const mouth = player.getMouth();

    this.spawner.kill(obj);
    this.suckedCount++;

    // コンボ:2.0秒以内に連続で吸うと倍率アップ(×2 → ×3 → ×4)
    this.comboCount++;
    this.comboTimer = 2.0;
    const mult = Math.min(4, this.comboCount);
    if (mult >= 2) this.ui.showCombo(mult);

    this.score += obj.type.score * mult * this.scoreMultiplier;

    // 成長:大きいオブジェクトほどよく育つ(基本 +0.01)
    const grew = player.grow(0.01 + obj.type.req * 0.012);
    if (grew) {
      this.audio.grow();
      player.growFlash = 1;
      this.particles.ring(player.x, player.y, '#ffe066', player.bodyR);
      this.camera.shake(4);
    }
    this.maxScale = Math.max(this.maxScale, player.scale);

    // バキュームゲージ
    if (player.chargeVacuum(0.13)) {
      player.startVacuum();
      Analytics.design('vacuum:activate');
      this.audio.vacuum();
      this.particles.ring(player.x, player.y, player.skin.color, player.bodyR * 1.5);
      this.camera.shake(6);
    }
    this.ui.setGauge(player.vacuumGauge, player.vacuumActive);

    // 演出:膨らみ・星・シェイク・Pop音
    player.pulse = 1;
    player.mouthHold = 0.3;
    this.particles.burst(mouth.x, mouth.y, player.skin.color, this._activeEffect());
    if (obj.type.req >= 3) this.camera.shake(Math.min(10, obj.r * 0.1));
    this.audio.pop(this.comboCount);
  }

  _activeEffect() {
    return Game.EFFECTS.find(item => item.id === Storage.getEffect()) || Game.EFFECTS[0];
  }

  /* ---- タイトル画面の更新(キャラが歩き回る) ---- */
  _updateTitle(dt) {
    const center = Game.WORLD / 2;
    for (const wk of this.walkers) {
      wk.phase += dt;
      // 目的地へ歩く。近づいたら新しい目的地を選ぶ
      const dx = wk.tx - wk.x;
      const dy = wk.ty - wk.y;
      const d = Math.hypot(dx, dy);
      if (d < 30) {
        wk.tx = center + (Math.random() - 0.5) * 1300;
        wk.ty = center + (Math.random() - 0.5) * 1300;
      } else {
        wk.x += (dx / d) * 70 * dt;
        wk.y += (dy / d) * 70 * dt;
      }
      // ときどき口を開ける
      wk.openTimer -= dt;
      if (wk.openTimer < -0.7) wk.openTimer = 2 + Math.random() * 4;
    }
    // カメラはゆっくり旋回
    const t = this.time * 0.12;
    this.camera.follow(center + Math.cos(t) * 260, center + Math.sin(t) * 260, 0.8, dt);
    this.particles.update(dt);
  }

  /* ================= 描画 ================= */

  _resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  _render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    ctx.save();
    this.camera.apply(ctx, this.w, this.h);

    const view = this.camera.viewBounds(this.w, this.h, 160);
    this._drawBackground(ctx, view);

    // 描画物を y 座標でソートして奥行き感を出す
    const drawList = [];
    const suckingList = [];
    this.spawner.forEachActive((obj) => {
      if (obj.x + obj.r < view.l || obj.x - obj.r > view.r ||
          obj.y + obj.r < view.t || obj.y - obj.r > view.b) return;
      const entry = { y: obj.y + obj.r * 0.5, draw: () => obj.draw(ctx) };
      if (obj.state === 'suck' && this.player && this.player.mouthOpen > 0.55) suckingList.push(entry);
      else drawList.push(entry);
    });

    if (this.player) {
      const p = this.player;
      drawList.push({ y: p.y + p.bodyR * 0.7, draw: () => p.draw(ctx) });
    } else {
      for (const wk of this.walkers) {
        drawList.push({ y: wk.y + 60, draw: () => this._drawWalker(ctx, wk) });
      }
    }

    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) d.draw();
    suckingList.sort((a, b) => a.y - b.y);
    for (const d of suckingList) d.draw();

    // バキューム中のスピードライン
    if (this.player && this.player.vacuumActive) this._drawSpeedLines(ctx);

    this.particles.draw(ctx);
    ctx.restore();

    // 画面座標系:仮想ジョイスティック
    if (this.state === 'play' && this.input.active) this._drawJoystick(ctx);
  }

  _onRoad(v) {
    return Game.ROADS.some(r => Math.abs(v - r) < Game.ROAD_W / 2 + 40);
  }

  /** 街の背景(芝生・道路・飾り・外周) */
  _drawBackground(ctx, view) {
    const stage = Game.STAGES.find(item => item.id === this.currentStageId) || Game.STAGES[0];
    const theme = stage.id === Game.STAGES.length ? this._finalStageTheme() : Game.THEMES[stage.theme];
    // 芝生
    ctx.fillStyle = theme.ground;
    ctx.fillRect(view.l, view.t, view.r - view.l, view.b - view.t);

    // 道路(視界内のみ)
    ctx.fillStyle = theme.road;
    for (const r of Game.ROADS) {
      if (r + Game.ROAD_W / 2 > view.l && r - Game.ROAD_W / 2 < view.r) {
        ctx.fillRect(r - Game.ROAD_W / 2, view.t, Game.ROAD_W, view.b - view.t);
      }
      if (r + Game.ROAD_W / 2 > view.t && r - Game.ROAD_W / 2 < view.b) {
        ctx.fillRect(view.l, r - Game.ROAD_W / 2, view.r - view.l, Game.ROAD_W);
      }
    }
    // 道路の白線
    ctx.fillStyle = theme.line;
    const dash = 46, gap = 44;
    for (const r of Game.ROADS) {
      if (r > view.l - 60 && r < view.r + 60) {
        const startY = Math.floor(view.t / (dash + gap)) * (dash + gap);
        for (let y = startY; y < view.b; y += dash + gap) ctx.fillRect(r - 4, y, 8, dash);
      }
      if (r > view.t - 60 && r < view.b + 60) {
        const startX = Math.floor(view.l / (dash + gap)) * (dash + gap);
        for (let x = startX; x < view.r; x += dash + gap) ctx.fillRect(x, r - 4, dash, 8);
      }
    }

    // 草むらの飾り
    for (const d of this.decor) {
      if (d.x < view.l - 40 || d.x > view.r + 40 || d.y < view.t - 40 || d.y > view.b + 40) continue;
      ctx.fillStyle = theme.decor[d.tone % theme.decor.length];
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // マップ外周
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 24;
    ctx.strokeRect(0, 0, Game.WORLD, Game.WORLD);
  }

  _finalStageTheme() {
    const keys = ['shopping', 'factory', 'port', 'future', 'mega'];
    const phase = this.time / 4;
    const index = Math.floor(phase) % keys.length;
    const next = (index + 1) % keys.length;
    const t = this._smoothstep(phase - Math.floor(phase));
    const a = Game.THEMES[keys[index]];
    const b = Game.THEMES[keys[next]];
    return {
      ground: this._mixColor(a.ground, b.ground, t),
      road: this._mixColor(a.road, b.road, t),
      line: this._mixColor(a.line, b.line, t),
      border: this._mixColor(a.border, b.border, t),
      decor: a.decor.map((color, i) => this._mixColor(color, b.decor[i % b.decor.length], t)),
    };
  }

  _mixColor(a, b, t) {
    const av = parseInt(a.slice(1), 16);
    const bv = parseInt(b.slice(1), 16);
    const channel = (shift) => Math.round(((av >> shift) & 255) * (1 - t) + ((bv >> shift) & 255) * t);
    return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
  }

  /** タイトル画面を歩くキャラクター */
  _drawWalker(ctx, wk) {
    const img = wk.openTimer < 0
      ? this.images[wk.skin.id].open
      : this.images[wk.skin.id].closed;
    const w = 150;
    const h = w * (img.height / img.width);
    const bob = Math.sin(wk.phase * 8) * 5;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(wk.x, wk.y + 52, 55, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, wk.x - w / 2, wk.y - h / 2 + bob, w, h);
  }

  /** バキューム中の放射状スピードライン */
  _drawSpeedLines(ctx) {
    const m = this.player.getMouth();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + this.time * 2.4;
      const r0 = m.r * 1.5;
      const r1 = m.r * (1.15 + Math.sin(this.time * 14 + i) * 0.06);
      ctx.moveTo(m.x + Math.cos(a) * r0, m.y + Math.sin(a) * r0);
      ctx.lineTo(m.x + Math.cos(a) * r1, m.y + Math.sin(a) * r1);
    }
    ctx.stroke();
  }

  /** 仮想ジョイスティックの表示 */
  _drawJoystick(ctx) {
    const inp = this.input;
    const dx = inp.curX - inp.anchorX;
    const dy = inp.curY - inp.anchorY;
    const len = Math.hypot(dx, dy);
    const kx = inp.anchorX + (len > inp.maxLen ? dx / len * inp.maxLen : dx);
    const ky = inp.anchorY + (len > inp.maxLen ? dy / len * inp.maxLen : dy);

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(inp.anchorX, inp.anchorY, inp.maxLen * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(kx, ky, 20, 0, Math.PI * 2);
    ctx.fill();
  }
}
