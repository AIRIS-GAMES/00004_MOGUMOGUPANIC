/* =========================================================
 * Object.js - 吸い込み対象オブジェクト
 *  - OBJECT_TYPES: 種類ごとの定義テーブル
 *  - GameObject:   プーリング前提のオブジェクトクラス
 * 見た目はベクター描画(Canvas)を一度オフスクリーンに
 * ベイクしてキャッシュし、毎フレーム drawImage するだけに
 * して高速化。絵文字と違い全端末で同じ鮮やかな発色になる。
 * ========================================================= */

/**
 * r            : 当たり判定(円)の半径 [px]
 * req          : 吸うのに必要なプレイヤーサイズ(requiredScale)
 * score        : 獲得スコア
 * weight       : 出現確率の重み
 */
const OBJECT_TYPES = [
  { id: 'flower', r: 18,  req: 1, score: 10,  weight: 3.0 },
  { id: 'coin',   r: 16,  req: 1, score: 15,  weight: 3.0 },
  { id: 'trash',  r: 26,  req: 2, score: 20,  weight: 2.2 },
  { id: 'barrel', r: 30,  req: 2, score: 25,  weight: 2.0 },
  { id: 'bench',  r: 38,  req: 2, score: 30,  weight: 1.8 },
  { id: 'tree',   r: 52,  req: 3, score: 50,  weight: 2.0 },
  { id: 'signal', r: 44,  req: 4, score: 70,  weight: 1.2 },
  { id: 'car',    r: 58,  req: 5, score: 100, weight: 1.4 },
  { id: 'house',  r: 105, req: 8, score: 300, weight: 0.8 },
  { id: 'shoppingBag', r: 24, req: 1, score: 25, weight: 2.5 },
  { id: 'officeChair', r: 38, req: 2, score: 45, weight: 2.0 },
  { id: 'crate', r: 34, req: 2, score: 40, weight: 2.2 },
  { id: 'buoy', r: 30, req: 2, score: 40, weight: 2.3 },
  { id: 'suitcase', r: 34, req: 2, score: 50, weight: 2.1 },
  { id: 'drone', r: 46, req: 4, score: 90, weight: 1.5 },
  { id: 'tower', r: 100, req: 8, score: 350, weight: 0.8 },
];

/** ステージギミック専用の物(通常の出現抽選には入らない) */
const GIMMICK_TYPES = {
  clock: { id: 'clock', r: 22, req: 1, score: 30, weight: 0 },
  zapper: { id: 'zapper', r: 24, req: 1, score: 0, weight: 0 },
  chili: { id: 'chili', r: 24, req: 1, score: 0, weight: 0 },
  soda: { id: 'soda', r: 26, req: 1, score: 0, weight: 0 },
};

/* ---------------------------------------------------------
 * 各オブジェクトのベクター描画関数
 * 座標系:中心(0,0)、u = 当たり判定半径(この円に収まるように描く)
 * ------------------------------------------------------- */
const OBJECT_PAINTERS = {

  /** 角丸四角のパスを作るヘルパー */
  _rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  },

  /** 円を塗るヘルパー */
  _dot(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  },

  shoppingBag(g, u) {
    this._rr(g, -u * 0.7, -u * 0.45, u * 1.4, u * 1.25, u * 0.12);
    g.fillStyle = '#ff79a8'; g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = u * 0.12;
    g.beginPath(); g.arc(0, -u * 0.38, u * 0.38, Math.PI, 0); g.stroke();
    this._dot(g, 0, u * 0.15, u * 0.18, '#ffd24d');
  },

  officeChair(g, u) {
    this._rr(g, -u * 0.62, -u * 0.8, u * 1.24, u * 0.85, u * 0.22);
    g.fillStyle = '#4776c7'; g.fill();
    this._rr(g, -u * 0.72, -u * 0.05, u * 1.44, u * 0.48, u * 0.18);
    g.fillStyle = '#5b8de0'; g.fill();
    g.strokeStyle = '#535b66'; g.lineWidth = u * 0.12;
    g.beginPath(); g.moveTo(0, u * 0.42); g.lineTo(0, u * 0.78); g.stroke();
    for (const x of [-0.55, 0.55]) this._dot(g, u * x, u * 0.82, u * 0.13, '#303640');
  },

  crate(g, u) {
    g.fillStyle = '#c9883e'; g.fillRect(-u * 0.78, -u * 0.78, u * 1.56, u * 1.56);
    g.strokeStyle = '#8f5828'; g.lineWidth = u * 0.14;
    g.strokeRect(-u * 0.72, -u * 0.72, u * 1.44, u * 1.44);
    g.beginPath(); g.moveTo(-u * 0.65, -u * 0.65); g.lineTo(u * 0.65, u * 0.65);
    g.moveTo(u * 0.65, -u * 0.65); g.lineTo(-u * 0.65, u * 0.65); g.stroke();
  },

  buoy(g, u) {
    this._dot(g, 0, u * 0.1, u * 0.72, '#f04f55');
    g.fillStyle = '#fff'; g.fillRect(-u * 0.67, -u * 0.05, u * 1.34, u * 0.3);
    g.fillStyle = '#f04f55'; g.beginPath(); g.moveTo(-u * 0.35, -u * 0.5);
    g.lineTo(0, -u); g.lineTo(u * 0.35, -u * 0.5); g.closePath(); g.fill();
  },

  suitcase(g, u) {
    this._rr(g, -u * 0.82, -u * 0.55, u * 1.64, u * 1.25, u * 0.18);
    g.fillStyle = '#5db9a7'; g.fill();
    g.strokeStyle = '#277a6c'; g.lineWidth = u * 0.12;
    g.beginPath(); g.arc(0, -u * 0.52, u * 0.32, Math.PI, 0); g.stroke();
    g.fillStyle = '#d9fff7'; g.fillRect(-u * 0.08, -u * 0.48, u * 0.16, u * 1.08);
  },

  drone(g, u) {
    this._rr(g, -u * 0.48, -u * 0.28, u * 0.96, u * 0.56, u * 0.2);
    g.fillStyle = '#68758a'; g.fill();
    g.strokeStyle = '#465063'; g.lineWidth = u * 0.1;
    for (const x of [-0.7, 0.7]) {
      g.beginPath(); g.moveTo(x * u * 0.45, 0); g.lineTo(x * u, 0); g.stroke();
      g.beginPath(); g.ellipse(x * u, 0, u * 0.38, u * 0.1, 0, 0, Math.PI * 2); g.stroke();
    }
    this._dot(g, 0, 0, u * 0.12, '#62e8ff');
  },

  tower(g, u) {
    g.fillStyle = '#d7e3ef';
    g.beginPath(); g.moveTo(-u * 0.55, u * 0.85); g.lineTo(-u * 0.35, -u * 0.65);
    g.lineTo(u * 0.35, -u * 0.65); g.lineTo(u * 0.55, u * 0.85); g.closePath(); g.fill();
    g.fillStyle = '#59bfe8';
    for (let y = -0.45; y < 0.65; y += 0.3) g.fillRect(-u * 0.25, u * y, u * 0.5, u * 0.12);
    g.strokeStyle = '#ff5c69'; g.lineWidth = u * 0.08;
    g.beginPath(); g.moveTo(0, -u * 0.65); g.lineTo(0, -u); g.stroke();
  },

  flower(g, u) {
    // 5枚の花びら + 黄色い中心
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      this._dot(g, Math.cos(a) * u * 0.52, Math.sin(a) * u * 0.52, u * 0.42, '#ff7eb3');
    }
    this._dot(g, 0, 0, u * 0.34, '#ffd24d');
    this._dot(g, -u * 0.1, -u * 0.1, u * 0.1, '#fff3c2'); // ハイライト
  },

  coin(g, u) {
    this._dot(g, 0, 0, u, '#f7b731');
    this._dot(g, 0, 0, u * 0.78, '#ffd95e');
    // 中央の星
    g.fillStyle = '#e8960c';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? u * 0.42 : u * 0.19;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath();
    g.fill();
    // 光沢
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = u * 0.12;
    g.beginPath();
    g.arc(0, 0, u * 0.62, -Math.PI * 0.85, -Math.PI * 0.45);
    g.stroke();
  },

  trash(g, u) {
    // 本体(下すぼまり)
    g.fillStyle = '#7fd0e8';
    g.beginPath();
    g.moveTo(-u * 0.62, -u * 0.42);
    g.lineTo(u * 0.62, -u * 0.42);
    g.lineTo(u * 0.46, u * 0.85);
    g.lineTo(-u * 0.46, u * 0.85);
    g.closePath();
    g.fill();
    // 縦の溝
    g.strokeStyle = '#4faccb';
    g.lineWidth = u * 0.1;
    for (const dx of [-0.26, 0, 0.26]) {
      g.beginPath();
      g.moveTo(u * dx, -u * 0.22);
      g.lineTo(u * dx * 0.85, u * 0.62);
      g.stroke();
    }
    // フタと取っ手
    this._rr(g, -u * 0.72, -u * 0.66, u * 1.44, u * 0.28, u * 0.12);
    g.fillStyle = '#59b6d6';
    g.fill();
    this._rr(g, -u * 0.18, -u * 0.85, u * 0.36, u * 0.2, u * 0.08);
    g.fill();
  },

  barrel(g, u) {
    // 樽本体
    this._rr(g, -u * 0.7, -u * 0.85, u * 1.4, u * 1.7, u * 0.3);
    g.fillStyle = '#e0862f';
    g.fill();
    // 上下のフチ
    g.fillStyle = '#c96f1e';
    g.fillRect(-u * 0.7, -u * 0.62, u * 1.4, u * 0.16);
    g.fillRect(-u * 0.7, u * 0.46, u * 1.4, u * 0.16);
    // 帯(タガ)
    g.fillStyle = '#8a5a23';
    g.fillRect(-u * 0.7, -u * 0.1, u * 1.4, u * 0.2);
    // 縦のハイライト
    g.fillStyle = 'rgba(255,255,255,0.35)';
    this._rr(g, -u * 0.5, -u * 0.72, u * 0.22, u * 1.44, u * 0.11);
    g.fill();
  },

  bench(g, u) {
    g.lineCap = 'round';
    // 脚
    g.strokeStyle = '#7d5a34';
    g.lineWidth = u * 0.16;
    for (const dx of [-0.62, 0.62]) {
      g.beginPath();
      g.moveTo(u * dx, u * 0.05);
      g.lineTo(u * dx, u * 0.8);
      g.stroke();
    }
    // 座面(2枚板)
    for (const [dy, color] of [[0.0, '#d9a05b'], [0.24, '#c98f4e']]) {
      this._rr(g, -u * 0.85, u * (dy - 0.12), u * 1.7, u * 0.2, u * 0.1);
      g.fillStyle = color;
      g.fill();
    }
    // 背もたれ(2枚板)
    for (const dy of [-0.72, -0.44]) {
      this._rr(g, -u * 0.85, u * dy, u * 1.7, u * 0.18, u * 0.09);
      g.fillStyle = '#d9a05b';
      g.fill();
    }
  },

  tree(g, u) {
    // 幹
    this._rr(g, -u * 0.14, u * 0.1, u * 0.28, u * 0.8, u * 0.12);
    g.fillStyle = '#96633a';
    g.fill();
    // 葉(3つの円のもこもこ)
    this._dot(g, -u * 0.38, -u * 0.1, u * 0.42, '#4fc45e');
    this._dot(g, u * 0.38, -u * 0.1, u * 0.42, '#4fc45e');
    this._dot(g, 0, -u * 0.42, u * 0.5, '#5dd06c');
    // ハイライトと実
    this._dot(g, -u * 0.18, -u * 0.55, u * 0.16, '#8ee89a');
    this._dot(g, u * 0.3, -u * 0.32, u * 0.09, '#ff7eb3');
    this._dot(g, -u * 0.42, u * 0.05, u * 0.09, '#ffd24d');
  },

  signal(g, u) {
    g.lineCap = 'round';
    // ポール
    g.strokeStyle = '#8a929e';
    g.lineWidth = u * 0.16;
    g.beginPath();
    g.moveTo(0, -u * 0.2);
    g.lineTo(0, u * 0.9);
    g.stroke();
    // 灯体(横型3灯)
    this._rr(g, -u * 0.9, -u * 0.88, u * 1.8, u * 0.72, u * 0.22);
    g.fillStyle = '#3c4654';
    g.fill();
    const colors = ['#ff5a5a', '#ffd24d', '#4fc45e'];
    colors.forEach((color, i) => {
      const x = (i - 1) * u * 0.56;
      this._dot(g, x, -u * 0.52, u * 0.22, color);
      this._dot(g, x - u * 0.07, -u * 0.59, u * 0.06, 'rgba(255,255,255,0.8)');
    });
  },

  car(g, u) {
    // 車体
    this._rr(g, -u * 0.95, -u * 0.28, u * 1.9, u * 0.72, u * 0.24);
    g.fillStyle = '#ff6b6b';
    g.fill();
    // キャビン
    this._rr(g, -u * 0.52, -u * 0.72, u * 1.04, u * 0.58, u * 0.2);
    g.fillStyle = '#ff8c8c';
    g.fill();
    // 窓(2枚)
    g.fillStyle = '#bfe6ff';
    this._rr(g, -u * 0.42, -u * 0.62, u * 0.38, u * 0.36, u * 0.08);
    g.fill();
    this._rr(g, u * 0.06, -u * 0.62, u * 0.38, u * 0.36, u * 0.08);
    g.fill();
    // ライト
    this._dot(g, u * 0.85, -u * 0.05, u * 0.1, '#ffe066');
    this._dot(g, -u * 0.85, -u * 0.05, u * 0.09, '#ffb3ab');
    // タイヤ
    for (const dx of [-0.55, 0.55]) {
      this._dot(g, u * dx, u * 0.48, u * 0.24, '#3a3f47');
      this._dot(g, u * dx, u * 0.48, u * 0.11, '#aab2bd');
    }
  },

  house(g, u) {
    // 壁
    g.fillStyle = '#ffedc9';
    g.fillRect(-u * 0.7, -u * 0.15, u * 1.4, u * 0.95);
    // 屋根
    g.fillStyle = '#ff7a59';
    g.beginPath();
    g.moveTo(-u * 0.88, -u * 0.12);
    g.lineTo(0, -u * 0.85);
    g.lineTo(u * 0.88, -u * 0.12);
    g.closePath();
    g.fill();
    // 煙突
    g.fillStyle = '#e2604a';
    g.fillRect(u * 0.38, -u * 0.78, u * 0.2, u * 0.35);
    // ドア
    this._rr(g, -u * 0.2, u * 0.25, u * 0.4, u * 0.55, u * 0.12);
    g.fillStyle = '#b07845';
    g.fill();
    this._dot(g, u * 0.08, u * 0.55, u * 0.045, '#ffd24d');
    // 窓
    this._rr(g, u * 0.28, u * 0.05, u * 0.32, u * 0.32, u * 0.07);
    g.fillStyle = '#aee1ff';
    g.fill();
    this._rr(g, -u * 0.6, u * 0.05, u * 0.32, u * 0.32, u * 0.07);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = u * 0.04;
    for (const wx of [0.44, -0.44]) {
      g.beginPath();
      g.moveTo(u * wx, u * 0.05);
      g.lineTo(u * wx, u * 0.37);
      g.stroke();
    }
  },

  /** 吸い込んではいけない「ビリビリ」 */
  zapper(g, u) {
    this._dot(g, 0, 0, u * 0.98, '#2a2233');
    this._dot(g, 0, 0, u * 0.82, '#5b3f7a');
    // 黄色と黒の警告リング
    g.save();
    g.beginPath(); g.arc(0, 0, u * 0.82, 0, Math.PI * 2); g.clip();
    g.strokeStyle = '#ffd24d';
    g.lineWidth = u * 0.16;
    for (let i = -4; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * u * 0.32 - u, -u);
      g.lineTo(i * u * 0.32 + u, u);
      g.stroke();
    }
    g.restore();
    this._dot(g, 0, 0, u * 0.6, '#3b2f4a');
    // 稲妻
    g.fillStyle = '#ffe14d';
    g.strokeStyle = '#2a2233';
    g.lineWidth = u * 0.08;
    g.beginPath();
    g.moveTo(u * 0.12, -u * 0.5);
    g.lineTo(-u * 0.28, u * 0.06);
    g.lineTo(-u * 0.02, u * 0.06);
    g.lineTo(-u * 0.14, u * 0.5);
    g.lineTo(u * 0.3, -u * 0.08);
    g.lineTo(u * 0.04, -u * 0.08);
    g.closePath();
    g.fill(); g.stroke();
  },

  /** 吸い込んではいけない「激辛とうがらし」 */
  chili(g, u) {
    g.save();
    g.rotate(-0.5);
    g.lineJoin = 'round';
    g.strokeStyle = '#5a2a2a';
    g.lineWidth = u * 0.1;
    // 実
    g.fillStyle = '#ff3b3b';
    g.beginPath();
    g.moveTo(-u * 0.25, -u * 0.55);
    g.quadraticCurveTo(u * 0.55, -u * 0.5, u * 0.35, u * 0.25);
    g.quadraticCurveTo(u * 0.15, u * 0.85, -u * 0.05, u * 0.98);
    g.quadraticCurveTo(-u * 0.55, u * 0.2, -u * 0.25, -u * 0.55);
    g.closePath();
    g.fill(); g.stroke();
    // つや
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = u * 0.1;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(-u * 0.1, -u * 0.3); g.quadraticCurveTo(-u * 0.25, u * 0.15, -u * 0.08, u * 0.5); g.stroke();
    // ヘタ
    g.fillStyle = '#4caf50';
    g.strokeStyle = '#2e5a2e';
    g.lineWidth = u * 0.08;
    g.beginPath();
    g.ellipse(0, -u * 0.6, u * 0.36, u * 0.16, 0.1, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.lineWidth = u * 0.12;
    g.strokeStyle = '#3e8e41';
    g.beginPath(); g.moveTo(0.02 * u, -u * 0.7); g.quadraticCurveTo(u * 0.1, -u * 0.95, u * 0.32, -u * 0.95); g.stroke();
    g.restore();
  },

  /** 吸い込んではいけない「炭酸ボトル」 */
  soda(g, u) {
    g.lineJoin = 'round';
    g.strokeStyle = '#2f4f5a';
    g.lineWidth = u * 0.08;
    // ボトル
    g.fillStyle = '#7fe0ef';
    g.beginPath();
    g.moveTo(-u * 0.16, -u * 0.72);
    g.lineTo(u * 0.16, -u * 0.72);
    g.lineTo(u * 0.16, -u * 0.5);
    g.quadraticCurveTo(u * 0.48, -u * 0.38, u * 0.48, -u * 0.05);
    g.lineTo(u * 0.48, u * 0.82);
    g.quadraticCurveTo(u * 0.48, u * 0.98, u * 0.3, u * 0.98);
    g.lineTo(-u * 0.3, u * 0.98);
    g.quadraticCurveTo(-u * 0.48, u * 0.98, -u * 0.48, u * 0.82);
    g.lineTo(-u * 0.48, -u * 0.05);
    g.quadraticCurveTo(-u * 0.48, -u * 0.38, -u * 0.16, -u * 0.5);
    g.closePath();
    g.fill(); g.stroke();
    // ラベル
    g.fillStyle = '#ff6b9d';
    g.fillRect(-u * 0.46, u * 0.12, u * 0.92, u * 0.34);
    g.strokeRect(-u * 0.46, u * 0.12, u * 0.92, u * 0.34);
    // キャップ
    g.fillStyle = '#ff4f6d';
    g.beginPath();
    g.roundRect ? g.roundRect(-u * 0.22, -u * 0.92, u * 0.44, u * 0.24, u * 0.06) : g.rect(-u * 0.22, -u * 0.92, u * 0.44, u * 0.24);
    g.fill(); g.stroke();
    // 中の泡
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, r] of [[-0.2, -0.1, 0.07], [0.15, -0.25, 0.05], [0.05, 0.65, 0.06], [-0.22, 0.62, 0.04], [0.25, 0.7, 0.05]]) {
      this._dot(g, x * u, y * u, r * u, 'rgba(255,255,255,0.85)');
    }
  },

  /** 5面:逃げる時計 */
  clock(g, u) {
    this._dot(g, 0, 0, u * 0.95, '#5a3b3f');
    this._dot(g, 0, 0, u * 0.8, '#fffaf0');
    for (const side of [-1, 1]) this._dot(g, side * u * 0.62, -u * 0.78, u * 0.26, '#ff6b81');
    g.strokeStyle = '#5a3b3f';
    g.lineCap = 'round';
    g.lineWidth = u * 0.14;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -u * 0.5); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(u * 0.36, u * 0.14); g.stroke();
    this._dot(g, 0, 0, u * 0.1, '#ff6b81');
  },

  rainbowToken(g, u) {
    const colors = ['#ff627f', '#ffa447', '#ffe45e', '#68dca1', '#55cde7', '#6994ff', '#ad80ef', '#ef82cb'];
    g.lineWidth = u * 0.15;
    g.lineCap = 'round';
    for (let i = 0; i < colors.length; i++) {
      const angle = i * Math.PI / 4;
      g.strokeStyle = colors[i];
      g.beginPath();
      g.moveTo(Math.cos(angle) * u * 0.78, Math.sin(angle) * u * 0.78);
      g.lineTo(Math.cos(angle) * u * 1.1, Math.sin(angle) * u * 1.1);
      g.stroke();
    }
    this._dot(g, 0, 0, u * 0.69, '#ffffff');
    const rainbow = g.createLinearGradient(-u * 0.5, -u * 0.5, u * 0.5, u * 0.5);
    colors.forEach((color, i) => rainbow.addColorStop(i / (colors.length - 1), color));
    this._dot(g, 0, 0, u * 0.58, rainbow);
    this._dot(g, -u * 0.16, -u * 0.18, u * 0.14, '#ffffffbb');
  },
};

class GameObject {
  /** ベイク済みスプライトのキャッシュ(種類ごとに1枚) */
  static spriteCache = new Map();

  /** 画面上の1px あたりの倍率(Game が毎フレーム入れる:解像度×カメラのズーム) */
  static pixelScale = 2;

  /** 画面に映る大きさに合った解像度の絵(1/2, 1/4 を作って覚えておく) */
  static lod(sprite, screenPx) {
    const full = sprite.canvas;
    if (screenPx >= full.width * 0.45) return full;
    const level = screenPx >= full.width * 0.2 ? 1 : 2;
    sprite.mips = sprite.mips || [];
    let c = sprite.mips[level];
    if (!c) {
      const prev = level === 1 ? full : GameObject.lod(sprite, full.width * 0.3);
      c = document.createElement('canvas');
      c.width = Math.max(4, Math.round(prev.width / 2));
      c.height = Math.max(4, Math.round(prev.height / 2));
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(prev, 0, 0, c.width, c.height);
      sprite.mips[level] = c;
    }
    return c;
  }

  static getSprite(type) {
    let sprite = GameObject.spriteCache.get(type.id);
    if (sprite) return sprite;

    // 2倍解像度で描いておき、描画時に縮小してにじみを防ぐ
    const scale = 2;
    const pad = 1.35; // 影のはみ出し分の余白
    const size = Math.ceil(type.r * 2 * pad * scale);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');

    // 足元の影
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.beginPath();
    g.ellipse(size / 2, size * 0.82, type.r * scale * 0.85, type.r * scale * 0.3, 0, 0, Math.PI * 2);
    g.fill();

    // 本体(ベクター描画)
    g.save();
    g.translate(size / 2, size * 0.46);
    OBJECT_PAINTERS[type.id].call(OBJECT_PAINTERS, g, type.r * scale);
    g.restore();

    sprite = { canvas: c, drawSize: size / scale };
    GameObject.spriteCache.set(type.id, sprite);
    return sprite;
  }

  constructor() {
    this.active = false;
    this.type = OBJECT_TYPES[0];
    this.x = 0;
    this.y = 0;
    this.rot = 0;        // 描画回転角
    this.drawScale = 1;  // 吸い込み中の縮小率
    this.drawAlpha = 1;
    this.sinkProgress = 0;
    this.suckTime = 0;
    this.state = 'idle'; // 'idle' | 'suck'
    this.suckStartDist = 1; // 吸い込み開始時の口までの距離
    this.wobble = 0;     // サイズ不足で押された時の揺れ残り時間
  }

  /** プールから取り出す時の初期化 */
  reset(type, x, y) {
    this.active = true;
    this.scoreOnly = false;
    this.type = type;
    this.x = x;
    this.y = y;
    this.rot = 0;
    this.drawScale = 1;
    this.drawAlpha = 1;
    this.sinkProgress = 0;
    this.suckTime = 0;
    this.state = 'idle';
    this.suckStartDist = 1;
    this.wobble = 0;
    this.flipX = false;  // 左向きに描く(走る車など)
    this.gimmick = null; // ステージギミックが付ける状態(走行・光る など)
    this.hazard = false; // 吸い込んではいけない物の種類(zapper / chili / soda)
    this.fly = null;     // 吐き出されて飛んでいる途中
    this.burnt = false;  // とうがらしの火で焦げた(食べるとスコアが減る)
    this.bubble = null;  // シャボン玉に閉じ込められている(割るまで食べられない)
    this.rare = false;   // 色違いのレア(ずかん)
    this.noSuck = 0;     // しばらく吸い込めない(吐き出した直後)
    this.sizeMul = 1;    // 当たり判定の大きさの倍率(巨大エラー用)
  }

  get r() { return this.type.r * (this.sizeMul || 1); }  // 巨大エラーなどは大きさが変わる

  /** 焦げた見た目(元の絵を黒っぽく塗り重ねたもの)。種類ごとに1回だけ作る */
  static getBurntSprite(type) {
    const key = `${type.id}:burnt`;
    let sprite = GameObject.spriteCache.get(key);
    if (sprite) return sprite;
    const base = GameObject.getSprite(type);
    const c = document.createElement('canvas');
    c.width = base.canvas.width;
    c.height = base.canvas.height;
    const g = c.getContext('2d');
    g.drawImage(base.canvas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(45, 28, 22, 0.72)';
    g.fillRect(0, 0, c.width, c.height);
    // こげ跡のまだら
    g.fillStyle = 'rgba(15, 8, 6, 0.55)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(c.width * (0.3 + ((i * 37) % 40) / 100), c.height * (0.25 + ((i * 53) % 45) / 100), c.width * 0.07, 0, Math.PI * 2);
      g.fill();
    }
    sprite = { canvas: c, drawSize: base.drawSize };
    GameObject.spriteCache.set(key, sprite);
    return sprite;
  }

  draw(ctx) {
    const sprite = this.burnt ? GameObject.getBurntSprite(this.type)
      : this.rare && typeof Zukan !== 'undefined' ? Zukan.rareSprite(this.type)
      : GameObject.getSprite(this.type);
    const size = sprite.drawSize * this.drawScale;
    // 引いて小さく映る時は、小さく作り直した絵を使う(大きな絵を毎回縮めるのは重い)
    const src = GameObject.lod(sprite, size * GameObject.pixelScale);
    // 押し返された時にプルプル揺れる
    const wobbleRot = this.wobble > 0 ? Math.sin(this.wobble * 40) * 0.18 : 0;
    ctx.save();
    ctx.globalAlpha *= this.drawAlpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot + wobbleRot);
    if (this.flipX) ctx.scale(-1, 1);
    ctx.drawImage(src, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}
