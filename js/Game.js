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

  activeCount() {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  /** 吸い込み成功時:星+キラキラを撒く */
  burst(x, y, color, effect = { kind: 'star', colors: ['#ffd24d', color] }) {
    // 一度にたくさん食べている時は、粒の数をしぼる(見た目はほぼ同じで描く量が減る)
    const busy = this.activeCount() > 120;
    for (let i = 0; i < (busy ? 2 : 5); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 140 + Math.random() * 220;
      this._emit({
        kind: effect.kind || 'star', x, y,
        vx: Math.cos(a) * sp * (effect.kind === 'flame' ? 0.6 : 1),
        vy: Math.sin(a) * sp * (effect.kind === 'flame' ? 0.4 : 1) - (effect.kind === 'flame' ? 160 : 80),
        life: 0.5 + Math.random() * 0.3,
        size: 8 + Math.random() * 8,
        color: effect.colors[Math.floor(Math.random() * effect.colors.length)],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12,
      });
    }
    for (let i = 0; i < (busy ? 2 : 6); i++) {
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
      if (p.kind === 'flame') { p.vy -= 260 * dt; p.rot = Math.sin((p.maxLife - p.life) * 18 + p.vr) * 0.25; } // 炎は上へ立ちのぼり、ゆらゆら
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
        else if (p.kind === 'flame') {
          // 外側の炎+内側の明るい芯。先に消える芯で「燃え尽きる」感じを出す
          const flick = 1 + Math.sin((p.maxLife - p.life) * 40 + p.vr * 3) * 0.08;
          ctx.scale(1, flick);
          this._flamePath(ctx, size * 1.15);
          ctx.fill();
          if (t > 0.35) {
            ctx.fillStyle = '#fff1a8';
            ctx.translate(0, size * 0.3);
            this._flamePath(ctx, size * 0.55);
          }
        }
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
    // しずく形の炎(先が上)。少しだけ左右非対称にして揺れて見えるように
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.bezierCurveTo(r * 0.25, -r * 0.6, r * 0.85, -r * 0.2, r * 0.7, r * 0.35);
    ctx.bezierCurveTo(r * 0.6, r * 0.85, r * 0.2, r, 0, r);
    ctx.bezierCurveTo(-r * 0.25, r, -r * 0.72, r * 0.8, -r * 0.7, r * 0.3);
    ctx.bezierCurveTo(-r * 0.7, -r * 0.15, -r * 0.2, -r * 0.45, 0, -r * 1.25);
    ctx.closePath();
  }
}

/* ---------------------------------------------------------
 * ゲーム本体
 * ------------------------------------------------------- */
class Game {
  static WORLD = 3500;       // マップの一辺 [px]
  static TIME_LIMIT = 60;    // 制限時間 [s]
  static FEVER_TIME = 5;     // クリア後の食べ放題 [s]
  static CLEAR_HOLD = 0.8;   // クリアの瞬間、スローになって「STAGE CLEAR!」を見せる時間 [s]
  static CLEAR_SLOW = 0.15;  // その間のゲームの速さ
  static OUTRO_TIME = 1.2;   // 食べ放題のあと「ごちそうさま」してリザルトへ移るまで [s]
  static HAZARD_GRACE = 2.5; // 危険物に当たった後、次の危険物をはじく時間 [s]
  static HAZARD_CATCH = 0.6; // 危険物は口の半径のこの割合より内側に来た時だけ入る
  static SMALL_FROM = 11;    // この面から「小さい物は点が少ない」
  static SMALL_FREE = 0.5;   // 自分よりこの段階までは小さくても満点
  static FEVER_SIZE = 2.2;   // 食べ放題中の大きさ(見た目と口の倍率)
  /** 食べ放題でもらえるコインの上限(序盤の面を回して稼ぎすぎないように) */
  static feverCoinCap(stageId) { return 20 + stageId * 8; }
  static DAILY_BONUS = 100; // 旧仕様の固定額(互換用)。現在は Retention.STREAK_REWARDS を使う
  static EFFECTS = [
    { id: 'sparkle', name: 'SPARKLE', symbol: '★', description: '星のきらめき', price: 0, kind: 'star', color: '#ffd24d', colors: ['#ffd24d', '#ffffff'] },
    { id: 'heart', name: 'HEART', symbol: '♥', description: 'ハートが舞う', price: 800, kind: 'heart', color: '#ff5f91', colors: ['#ff5f91', '#ffb2ca'] },
    { id: 'bubble', name: 'BUBBLE', symbol: '○', description: '泡がはじける', price: 1200, kind: 'bubble', color: '#58cfee', colors: ['#58cfee', '#c5f7ff'] },
    { id: 'flame', name: 'FLAME', symbol: '▲', description: '炎が立ちのぼる', price: 1600, kind: 'flame', color: '#ff7438', colors: ['#ff7438', '#ffd24d'] },
  ];
  /** ステージ前のブースト(コインで買う)。icon は 24×24 の SVG */
  static BOOSTS = [
    { id: 'time', name: 'じかん+5', short: '5秒長く遊べる', price: 200, color: '#58cfee',
      icon: '<circle cx="12" cy="13" r="8.5" fill="#fff" stroke="#4f3a40" stroke-width="2"/><path d="M12 8.5V13l3 2" stroke="#4f3a40" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="6" cy="4.5" r="2.4" fill="#ff6b81"/><circle cx="18" cy="4.5" r="2.4" fill="#ff6b81"/>' },
    { id: 'size', name: 'でっかく', short: 'サイズ2で始まる', price: 300, color: '#ff9a3c',
      icon: '<path d="M12 3c5 0 8.5 3.6 8.5 8.6 0 5.3-3.8 9.4-8.5 9.4s-8.5-4.1-8.5-9.4C3.5 6.6 7 3 12 3z" fill="#ff5a5a"/><ellipse cx="12" cy="14" rx="5.6" ry="5" fill="#fff3e2"/><circle cx="9.8" cy="13.3" r="1.3" fill="#4f3a40"/><circle cx="14.2" cy="13.3" r="1.3" fill="#4f3a40"/><path d="M19 2.5l3 0 0 3M22 2.5l-3.5 3.5" stroke="#4f3a40" stroke-width="1.8" stroke-linecap="round" fill="none"/>' },
    { id: 'score', name: 'スコア×2', short: '点数がぜんぶ2倍', price: 500, color: '#ffc531',
      icon: '<path d="M12 2.5l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 2.9 1.1-6.3L2.9 9.2l6.3-.9z" fill="#ffd24d" stroke="#4f3a40" stroke-width="1.6" stroke-linejoin="round"/><text x="12" y="14.5" text-anchor="middle" font-size="7" font-weight="900" fill="#4f3a40" font-family="sans-serif">×2</text>' },
    { id: 'fever', name: 'フィーバー', short: 'ゲージ満タン', price: 250, color: '#b388ff',
      icon: '<rect x="2.5" y="9" width="19" height="7" rx="3.5" fill="#fff" stroke="#4f3a40" stroke-width="1.8"/><rect x="4.3" y="10.8" width="15.4" height="3.4" rx="1.7" fill="url(#bst-rb)"/><defs><linearGradient id="bst-rb"><stop offset="0" stop-color="#ff6b81"/><stop offset=".5" stop-color="#ffd24d"/><stop offset="1" stop-color="#6cb9ff"/></linearGradient></defs><path d="M12 2v3M6 4l1.5 2.2M18 4l-1.5 2.2" stroke="#ffd24d" stroke-width="2" stroke-linecap="round"/>' },
    { id: 'shield', name: 'バリア', short: '危険物を1回ガード', price: 200, color: '#6fc3ff',
      icon: '<circle cx="12" cy="12" r="9.5" fill="rgba(140,210,255,.35)" stroke="#6cb9ff" stroke-width="2"/><path d="M7.5 7.5a6 6 0 0 1 5-2.5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="12" cy="13.5" r="3.6" fill="#2f2a3a"/><path d="M12.6 11l-1.7 2.8h1.9l-1.2 2.4" stroke="#ffd24d" stroke-width="1.3" fill="none" stroke-linejoin="round"/>' },
    { id: 'nobug', name: 'バグよけ', short: 'ルーレットなし', price: 150, color: '#8fd14f',
      icon: '<ellipse cx="12" cy="13.5" rx="5" ry="6.5" fill="#b388ff" stroke="#4f3a40" stroke-width="1.6"/><path d="M12 7v13M7 11H4M7 16H4M17 11h3M17 16h3M9.5 7.5 8 4.5M14.5 7.5 16 4.5" stroke="#4f3a40" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#ff5a6e" stroke-width="2.4"/><path d="M4.6 19.4 19.4 4.6" stroke="#ff5a6e" stroke-width="2.4"/>' },
  ];
  static STAGES = [
    { id: 1, name: 'はじまりの街', theme: 'park', landmark: 'tree', time: 60, targetScore: 800, starTimes: [30, 15], rewardCoins: 100, story: '閉店後のゲームセンター。コスミーは、街のデータが増え続ける異常を見つけた。', clearText: '吸い込むと街が元に戻った。隣のゲーム機にもエラーが広がっている。' },
    { id: 2, name: 'カラフルタウン', theme: 'town', landmark: 'house', time: 60, targetScore: 2500, starTimes: [36, 18], rewardCoins: 150, story: '子ども向けゲームの街で、かわいいオブジェクトが止まらず増殖している。', clearText: '街の色が戻った。だが、レースゲームから大きな警告音が聞こえる。' },
    { id: 3, name: 'ドライブシティ', theme: 'city', landmark: 'car', time: 60, targetScore: 5000, starTimes: [40, 20], rewardCoins: 250, story: 'レースゲームの道路を、複製された車と信号が埋め尽くしていた。', clearText: '交通データの回収に成功。エラーは買い物ゲームへ逃げ込んだ。' },
    { id: 4, name: 'ショッピングパニック', theme: 'shopping', landmark: 'shoppingBag', time: 60, targetScore: 6500, starTimes: [44, 22], rewardCoins: 300, story: '買い物袋や商品データが大増殖。ゲームの出口まで塞がれそうだ。', clearText: '商品データは正常に戻った。管理システムにつながる手がかりを発見した。' },
    { id: 5, name: 'オフィスラッシュ', theme: 'office', landmark: 'clock', time: 60, targetScore: 8000, starTimes: [48, 24], rewardCoins: 350, story: '時間管理ゲームが暴走し、椅子や機械を無限に作り続けている。', clearText: '暴走は止まった。エラーの発生源は工場ゲームの奥にあるらしい。' },
    { id: 6, name: 'ファクトリーブレイク', theme: 'factory', landmark: 'crate', time: 65, targetScore: 10000, starTimes: [52, 26], rewardCoins: 400, story: '工場ゲームでは木箱とドラム缶が生産ラインからあふれ出していた。', clearText: '装置を止めたが、壊れたデータは港のゲームへ運び出されていた。' },
    { id: 7, name: 'ハーバーキャッチ', theme: 'port', landmark: 'buoy', time: 65, targetScore: 12500, starTimes: [55, 30], rewardCoins: 500, story: '港湾クレーンゲームから、壊れたデータが別の筐体へ流出している。', clearText: '港を封鎖した。最後の荷物は空港ゲームへ運ばれている。' },
    { id: 8, name: 'エアポートダッシュ', theme: 'airport', landmark: 'suitcase', time: 70, targetScore: 15000, starTimes: [62, 38], rewardCoins: 600, story: '荷物データに紛れたエラーが、すべてのゲーム機へ飛び立とうとしている。', clearText: '拡散を阻止した。エラーの本体は古い未来都市ゲームに潜んでいる。' },
    { id: 9, name: 'ネオンフューチャー', theme: 'future', landmark: 'drone', time: 70, targetScore: 18000, starTimes: [65, 42], rewardCoins: 750, story: '遊ばれなくなった未来都市。その寂しさからエラーは生まれていた。', clearText: 'コスミーの声が届いた。しかし全データが中央筐体へ集まり始める。' },
    { id: 10, name: 'アーケード・ヘブン', theme: 'mega', landmark: 'tower', time: 75, targetScore: 22000, starTimes: [70, 55], rewardCoins: 1000, story: '10台のゲーム世界が融合した。朝が来る前に、最後のエラーを回収しよう。', clearText: 'ゲームセンターに朝が戻った。…と思ったら、新しい筐体が運びこまれてきた。' },
    // ---- ふたつめの夜(11〜20) ----
    { id: 11, name: 'ナイトパーク', theme: 'night', landmark: 'signal', time: 75, targetScore: 22000, starTimes: [68, 45], rewardCoins: 1050, story: 'ふたつめの夜。新しい筐体の中の公園で、街灯がエラーを生み続けている。', clearText: '公園は静かになった。奥の海辺から、にぎやかな音がする。' },
    { id: 12, name: 'サンセットビーチ', theme: 'beach', landmark: 'buoy', time: 75, targetScore: 23000, starTimes: [72, 50], rewardCoins: 1100, story: '夕焼けの海辺で、浮き輪とスーツケースが波のように押し寄せる。', clearText: '海辺の片付けは完了。次はあまいにおいの国へ。' },
    { id: 13, name: 'キャンディランド', theme: 'candy', landmark: 'shoppingBag', time: 80, targetScore: 25500, starTimes: [72, 48], rewardCoins: 1150, story: 'お菓子の国のゲーム。紙袋とお店が、とけたアメみたいに増えていく。', clearText: 'あまい街は元通り。でも外は雪がふりはじめた。' },
    { id: 14, name: 'スノータウン', theme: 'snow', landmark: 'clock', time: 80, targetScore: 30000, starTimes: [72, 50], rewardCoins: 1200, story: '雪の街のゲームで、時計がこおって時間がぐちゃぐちゃに。', clearText: '雪どけ。次のゲームは、深いジャングルの中。' },
    { id: 15, name: 'ジャングルワールド', theme: 'jungle', landmark: 'drone', time: 80, targetScore: 28000, starTimes: [75, 45], rewardCoins: 1300, story: 'ジャングルの工場跡で、ベルトコンベアがドローンを運び続けている。', clearText: 'ジャングルが静かになった。砂ぼこりの向こうにクレーンが見える。' },
    { id: 16, name: 'サンドラリー', theme: 'desert', landmark: 'barrel', time: 85, targetScore: 36000, starTimes: [78, 48], rewardCoins: 1400, story: '砂漠のラリーゲーム。クレーンが木箱とドラム缶をばらまいている。', clearText: 'ラリーは終わった。空の上の庭から、何かが落ちてくる。' },
    { id: 17, name: 'スカイガーデン', theme: 'sky', landmark: 'flower', time: 85, targetScore: 32000, starTimes: [78, 48], rewardCoins: 1500, story: '雲の上の庭。食べようとすると、エラーがふわっと空へ逃げていく。', clearText: '空の庭を取り戻した。夜の街のネオンがチカチカしている。' },
    { id: 18, name: 'ネオンナイト', theme: 'neon', landmark: 'officeChair', time: 85, targetScore: 33000, starTimes: [80, 52], rewardCoins: 1600, story: '夜の繁華街ゲームが停電寸前。ネオンだけがたよりだ。', clearText: '灯りが戻った。いちばん古い筐体が、ひとりでに動き出す。' },
    { id: 19, name: 'レトロアーケード', theme: 'retro', landmark: 'car', time: 90, targetScore: 37000, starTimes: [85, 55], rewardCoins: 1800, story: 'いちばん古いゲーム機の世界。これまでのギミックがごちゃまぜに暴れている。', clearText: 'すべての筐体がつながった。最後のエラーが目をさます。' },
    { id: 20, name: 'ラストエラー', theme: 'final', landmark: 'tower', time: 90, targetScore: 47000, starTimes: [85, 55], rewardCoins: 2500, story: '20台のゲーム世界がひとつに。夜明けまでに、すべてを食べつくそう！', clearText: 'ほんとうの朝が来た。コスミーたちは、ゲームセンターの英雄になった。' },
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
    night: { ground: '#8d94cf', road: '#4b4f7a', line: '#ffe98a', border: '#5b5f99', decor: ['#a3a9dd', '#7279b8', '#ffe98a'], objects: ['flower', 'coin', 'bench', 'tree', 'signal', 'house'] },
    beach: { ground: '#f2d59b', road: '#c99f66', line: '#ffffff', border: '#d1a45c', decor: ['#f8e2b3', '#7fd3e0', '#ffffff'], objects: ['coin', 'buoy', 'suitcase', 'barrel', 'tree', 'house'] },
    candy: { ground: '#ffd1e8', road: '#c98bb5', line: '#fff7c7', border: '#e79cc5', decor: ['#ffe3f1', '#b9f2e2', '#fff1a8'], objects: ['flower', 'coin', 'shoppingBag', 'bench', 'house', 'tower'] },
    snow: { ground: '#e8f2fb', road: '#9fb3c8', line: '#ffffff', border: '#a9c3db', decor: ['#ffffff', '#cfe2f3', '#b7d3ec'], objects: ['coin', 'trash', 'bench', 'tree', 'car', 'house'] },
    jungle: { ground: '#78c46a', road: '#6b5a44', line: '#e9d27a', border: '#4c8a43', decor: ['#5fae55', '#9bd67d', '#3f8f3b'], objects: ['flower', 'tree', 'barrel', 'crate', 'drone', 'tower'] },
    desert: { ground: '#ecc882', road: '#a8875a', line: '#fff3d0', border: '#c99d55', decor: ['#f3d9a3', '#d9b06a', '#c08f4b'], objects: ['coin', 'crate', 'barrel', 'car', 'signal', 'suitcase', 'tower'] },
    sky: { ground: '#c4e8ff', road: '#9cc3e6', line: '#ffffff', border: '#8fbbe0', decor: ['#ffffff', '#e1f3ff', '#ffd9ef'], objects: ['flower', 'coin', 'drone', 'bench', 'house', 'tower'] },
    neon: { ground: '#4a4d80', road: '#26284a', line: '#ff6bd6', border: '#33356a', decor: ['#5c60a0', '#6a5aa8', '#4f7fb0'], objects: ['coin', 'signal', 'car', 'drone', 'officeChair', 'tower'] },
    retro: { ground: '#c9b0e8', road: '#5b4a75', line: '#9df59a', border: '#8a6fb5', decor: ['#dccbf2', '#a98bd6', '#9df59a'], objects: ['coin', 'trash', 'bench', 'car', 'crate', 'house', 'drone', 'tower'] },
    final: { ground: '#a68db7', road: '#3e3947', line: '#ffd85f', border: '#654c78', decor: ['#c1a7d0', '#806392', '#e0b85e'], objects: ['flower', 'coin', 'trash', 'barrel', 'bench', 'tree', 'signal', 'car', 'house', 'shoppingBag', 'officeChair', 'crate', 'buoy', 'suitcase', 'drone', 'tower'] },
    mega: { ground: '#a68db7', road: '#3e3947', line: '#ffd85f', border: '#654c78', decor: ['#c1a7d0', '#806392', '#e0b85e'], objects: ['flower', 'coin', 'trash', 'barrel', 'bench', 'tree', 'signal', 'car', 'house', 'shoppingBag', 'officeChair', 'crate', 'buoy', 'suitcase', 'drone', 'tower'] },
  };
  static ROADS = [700, 1400, 2100, 2800]; // 道路の中心座標(縦横共通)
  static ROAD_W = 110;

  constructor(canvas, images, ui, audio, privacy = null) {
    this.canvas = canvas;
    // 背景は毎フレーム全面を塗るので、透明度のないキャンバスにして合成を軽くする
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.images = images; // { skinId: {open, closed} }
    this.ui = ui;
    this.audio = audio;
    this.privacy = privacy; // プライバシーバナー状態(main.js から注入)

    this.state = 'title'; // 'title' | 'skin' | 'play' | 'pause' | 'result'
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0;
    this.h = 0;

    const center = Game.WORLD / 2;
    this.camera = new Camera(center, center);
    this.spawner = new Spawner(Game.WORLD, 300);
    this.particles = new Particles();
    this.player = null;
    // 虹色アイテム(コスミーボーナス)は使わない。開始しないので出てこない(enabled=false のまま)
    this.cosmiiAbility = new CosmiiAbility(this);
    // 画面下のゲージは「コスミーフィーバー」
    this.power = new CosmiiFever(this);
    // あそびかた(タイトルの「?」とポーズ画面から)
    this.howto = new HowTo(this);
    document.getElementById('btn-howto').addEventListener('click', () => { this._btn(); this.howto.open(); });
    // ほかのゲーム(タイトルの「ゲーム」)
    this.otherGames = new OtherGames(this);
    document.getElementById('btn-games').addEventListener('click', () => { this._btn(); this.otherGames.open(); });
    document.getElementById('btn-pause-howto').addEventListener('click', () => { this._btn(); this.howto.open(); });
    this.ui.bindFeverChoice(kind => { if (this.state === 'play') this.power.pick(kind); }, () => { if (this.state === 'play') this.power.tap(); });
    // バグ表示は上部のステータスに
    const status = document.querySelector('.hud-status');
    const bugBadge = document.getElementById('bug-badge');
    if (status && bugBadge) status.append(bugBadge);

    // スコア関連
    this.score = 0;
    this.timeLeft = Game.TIME_LIMIT;
    this.suckedCount = 0;
    this.maxScale = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
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
      this._resetInput();
      this._lastT = performance.now();
      if (document.hidden && this.state === 'play') this.pauseGame();
    });
    window.addEventListener('blur', () => {
      this._resetInput();
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
      if (this.state !== 'play') return;
      // コスミーフィーバー:ダッシュははじく向きを測る
      this.flickStart = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
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

    const flickEnd = (e) => {
      const f = this.flickStart;
      if (!f || f.id !== e.pointerId || this.state !== 'play' || !this.power || this.power.state !== 'dash') return;
      this.flickStart = null;
      const dx = e.clientX - f.x, dy = e.clientY - f.y, dist = Math.hypot(dx, dy);
      if (performance.now() - f.t > 450) return;
      if (dist > 24) this.power.flick(dx, dy);
      else {
        // タップ:コスミー(画面のまん中あたり)からタップした所へ
        const rect = this.canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        this.power.flick(e.clientX - cx, e.clientY - cy);
      }
    };
    this.canvas.addEventListener('pointerup', flickEnd);

    const end = (e) => {
      if (e.pointerId !== this.input.id) return;
      this.input.active = false;
      this.input.id = null;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('lostpointercapture', end);

    // PC 用キーボード操作(WASD / 矢印)
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.state !== 'play' || !['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key)) return;
      e.preventDefault();
      this.keys.add(key);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const wheel = document.getElementById('bug-wheel');
    if (wheel) wheel.addEventListener('pointerdown', (e) => { e.preventDefault(); this.skipRoulette(); });
  }

  /** 正規化した移動入力を返す { active, dx, dy, ratio } */
  _resetInput() {
    this.keys.clear();
    const id = this.input.id;
    this.input.active = false;
    this.input.id = null;
    try {
      if (id !== null && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    } catch (_) { /* Capture may already have been released by the browser. */ }
  }

  /** 目が回って少しの間うごけない(車にぶつかる・荷物が落ちてくる) */
  /** 動けなくする。cause = { type } か { img } を渡すと、頭の上に「何のせいか」の絵が出る */
  stun(seconds, cause = null) {
    if (this.fever) return; // 食べ放題中は何も効かない
    this.stunTimer = Math.max(this.stunTimer || 0, seconds);
    if (cause) { this.stunCause = cause; this.stunCauseT = Math.max(seconds, 0.8); }
    this._resetInput();
  }

  /** 止められた理由を、頭の上のふきだしに絵で出す(激辛で爆走中はとうがらし) */
  _drawStunCause(ctx) {
    const p = this.player;
    let cause = null;
    if (this.rampage) cause = { type: GIMMICK_TYPES.chili };
    else if (this.stunCauseT > 0 && this.stunCause) cause = this.stunCause;
    if (!cause) return;
    let src = cause.img || null;
    if (!src && cause.type) { const sp = GameObject.getSprite(cause.type); src = sp && (sp.canvas || sp); }
    if (!src) return;
    const zoom = this.camera.zoom || 1;
    const R = Math.max(p.bodyR * 0.42, 30 / zoom);
    const x = p.x + p.bodyR * 0.85, y = p.y - p.bodyR * 1.15 - R * 0.4 + Math.sin(this.time * 9) * R * 0.06;
    ctx.save();
    ctx.lineWidth = Math.max(2, R * 0.12);
    ctx.strokeStyle = '#4f3a40';
    ctx.fillStyle = '#fff';
    // しっぽ
    ctx.beginPath(); ctx.moveTo(x - R * 0.55, y + R * 0.7); ctx.lineTo(x - R * 1.05, y + R * 1.35); ctx.lineTo(x - R * 0.1, y + R * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 絵(縦横比を保って丸の中へ)
    const iw = src.width || 1, ih = src.height || 1, k = (R * 1.45) / Math.max(iw, ih);
    ctx.drawImage(src, x - iw * k / 2, y - ih * k / 2, iw * k, ih * k);
    // 赤い「!」
    ctx.fillStyle = '#ff5a6e';
    ctx.beginPath(); ctx.arc(x + R * 0.78, y - R * 0.72, R * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.round(R * 0.5)}px "M PLUS Rounded 1c", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x + R * 0.78, y - R * 0.7);
    ctx.restore();
  }

  _getMoveInput() {
    if (this.stunTimer > 0) return { active: false, dx: 0, dy: 0, ratio: 0 };
    // 激辛で爆走中は操作がきかない
    if (this.rampage) return { active: true, dx: this.rampage.dx, dy: this.rampage.dy, ratio: 1 };
    if (this.power && this.power.blocksMove) return { active: false, dx: 0, dy: 0, ratio: 0 };
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
      // タイトルの大きいボタンはステージ選択へ(ステージカードから遊ぶ)
      onStart: () => { this._btn(); this.openStages(); },
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
      onAgain: () => {
        this._btn();
        if (this.currentStageId === 'endless') this.startEndless();
        else this.openBoosts(this.currentStageId, 'result');
      },
      onEndless: () => {
        this._btn();
        if (!Endless.unlocked()) { this.ui.shakeButton(this.ui.buttons.endless); return; }
        this.startEndless();
      },
      onRanking: () => { this._btn(); GameCenter.showLeaderboard(Endless.LEADERBOARD); },
      onNextStage: () => {
        if (this.currentStageId === 'endless' || this.currentStageId >= Game.STAGES.length) return;
        this._btn();
        this.openBoosts(this.currentStageId + 1, 'result');
      },
      onMissionOpen: () => { this._btn(); this.openMissions(); },
      onZukanOpen: () => { this._btn(); this.openZukan(0); },
      onUfoOpen: () => { this._btn(); this.openUfo(); },
      onUfoBack: () => { this._btn(); if (this.ufo) this.ufo.stop(); this.showTitle(); },
      onMissionBack: () => { this._btn(); this.showTitle(); },
      onNotifyAccept: () => {
        this._btn();
        this.ui.hideNotifyPrompt();
        Notifier.accept(this.notifyContext());
      },
      onNotifyLater: () => {
        this._btn();
        this.ui.hideNotifyPrompt();
        Notifier.decline();
      },
      onLoginBonusClose: () => {
        this._btn();
        // GET!タップ時に計測(この時点なら同意直後でもSDK初期化が完了している)
        if (this._pendingBonusCoins > 0) {
          Analytics.coinSource(this._pendingBonusCoins, 'daily_bonus', `login_day${this._pendingBonusDay || 1}`);
          this._pendingBonusCoins = 0;
        }
        this.ui.closeLoginBonus();
      },
    });
  }

  _btn() { this.audio.button(); }

  /* ================= 状態遷移 ================= */

  showTitle() {
    this._resetInput();
    this.cosmiiAbility?.leave();
    this.power?.cancel();
    this.power?.reset();
    this.audio.setMusicPaused(false);
    this.state = 'title';
    this.player = null;
    this.bug = null;
    this.roulette = null;
    this.ui.hideWheel();
    if (this.hazards) this.hazards.stop();
    this.hazards = null;
    if (this.warps) this.warps.stop();
    this.warps = null;
    if (this.wind) this.wind.stop();
    this.wind = null;
    if (this.bubbles) this.bubbles.stop();
    this.bubbles = null;
    if (this.gimmick) this.gimmick.stop();
    this.gimmick = null;
    if (this.clocks) this.clocks.stop();
    this.clocks = null;
    this.ui.hideBugBadge();
    const center = Game.WORLD / 2;
    this.spawner.populate(center, center, 0);
    this.camera.snap(center, center, 0.8);
    this.ui.updateCoins(Storage.getCoins());
    this.ui.updateContinueStage(Math.min(Storage.getUnlockedStage(), Game.STAGES.length));
    this.ui.updateEndless(Endless.unlocked(), Endless.best().score, Endless.UNLOCK_STAGE);
    this.refreshRetentionBadges();
    this.ui.showScreen('title');

    // ダイアログの直列化:バナー未対応ならまずバナーだけ表示し、
    // 閉じられてからログインボーナスを判定する
    if (this.privacy && this.privacy.pending) {
      this.privacy.onDismiss = () => this.checkDailyBonus();
      this.privacy.show();
    } else {
      this.checkDailyBonus();
    }
  }

  /**
   * デイリーボーナスの判定・表示。
   * タイトル表示中かつバナーが閉じられている時だけ実行する
   * (プレイ中のタブ復帰などで割り込まないようにガード。
   *  受け取っていない分は次にタイトルへ戻った時に付与される)
   */
  checkDailyBonus() {
    if (this.state !== 'title') return;
    if (this.privacy && this.privacy.pending) return;
    const claim = Storage.claimDailyBonus(Retention.STREAK_REWARDS);
    if (claim !== null) {
      this.ui.updateCoins(claim.total);
      this.ui.showLoginBonus(claim.amount, claim.day, Retention.STREAK_REWARDS);
      // 計測は GET! タップ時まで保留(同意直後の初期化前ドロップを回避)
      this._pendingBonusCoins = claim.amount;
      this._pendingBonusDay = claim.day;
    }
    // 日付が変わっていればミッションも入れ替わるのでバッジを更新
    this.refreshRetentionBadges();
  }

  /** タイトルの★合計とミッションのバッジ */
  refreshRetentionBadges() {
    this.ui.updateStars(Retention.totalStars(Game.STAGES), Game.STAGES.length * 3);
    this.ui.setMissionBadge(Retention.claimableCount());
    if (this.ui.setZukanBadge && typeof Zukan !== 'undefined') this.ui.setZukanBadge(Zukan.claimableCount());
  }

  /** 通知文面用:次に遊ぶべきステージ(全クリアなら null) */
  notifyContext() {
    const next = Game.STAGES.find(stage => !Storage.hasClearedStage(stage.id));
    return { nextStage: next ? { id: next.id, name: next.name } : null };
  }

  openZukan(pageIndex = 0) {
    this._leaveTitle();
    this.state = 'zukan';
    this.zukanPage = pageIndex;
    const render = () => this.ui.buildZukan(this.zukanPage, (i) => { this._btn(); this.zukanPage = i; render(); }, (pageId, kind) => {
      this._btn();
      const got = Zukan.claim(pageId, kind);
      if (got && got.coins) { Analytics.coinSource(got.coins, 'zukan', pageId); this.ui.updateCoins(Storage.getCoins()); }
      if (got && got.accessory) Analytics.design(`zukan:accessory:${got.accessory}`);
      render();
    });
    render();
    this.ui.showScreen('zukan');
  }

  openUfo() {
    this._leaveTitle();
    this.state = 'ufo';
    const cabinet = document.getElementById('ufo-cabinet');
    const refresh = (newId = null) => {
      this.ui.setUfoCoins(Storage.getCoins(), this.ufo.canPlay);
      this.ui.updateCoins(Storage.getCoins());
      this.ui.buildUfoOwned((id) => { this._btn(); Accessories.equip(id); refresh(); }, newId);
    };
    if (!this.ufo) {
      const canvas = document.getElementById('ufo-canvas');
      this.ufo = new UfoCatcher(canvas, {
        onSpend: () => { Analytics.coinSink(UfoCatcher.COST, 'ufo', 'play'); refresh(); },
        onWin: (prize) => {
          this.audio.playSfx('clear');
          Analytics.design(`ufo:win:${prize.id}`);
          // 初めて取ったアクセサリーは自動でつける
          if (prize.id !== 'coins' && !Accessories.equipped()) Accessories.equip(prize.id);
          // 台の電球がチカチカして、少しゆれる
          cabinet?.classList.add('is-win');
          clearTimeout(this._ufoWinTimer);
          this._ufoWinTimer = setTimeout(() => cabinet?.classList.remove('is-win'), 1600);
          refresh(prize.id !== 'coins' ? prize.id : null);
        },
        onChange: () => { cabinet?.classList.remove('is-playing'); refresh(); },
      });
      const play = this.ui.el.ufoPlay;
      const down = (e) => {
        e.preventDefault();
        play.classList.add('is-down');
        try { play.setPointerCapture(e.pointerId); } catch (_) { /* 古いWebView */ }
        if (this.ufo.press()) { this.audio.button(); cabinet?.classList.add('is-playing'); }
        refresh();
      };
      const up = (e) => { e.preventDefault(); play.classList.remove('is-down'); this.ufo.release(); };
      play.addEventListener('pointerdown', down);
      play.addEventListener('pointerup', up);
      play.addEventListener('pointercancel', up);
      play.addEventListener('pointerleave', up);
    }
    this.ufo.ufoRefresh = refresh;
    refresh();
    this.ufo.start();
    this.ui.showScreen('ufo');
  }

  openMissions() {
    this._leaveTitle();
    this.state = 'mission';
    this.renderMissions();
    this.ui.showScreen('mission');
  }

  renderMissions() {
    this.ui.buildMissionList(Retention.missions(), (id) => {
      this._btn();
      const coins = Retention.claimMission(id);
      if (coins > 0) {
        Analytics.coinSource(coins, 'mission', id);
        this.ui.updateCoins(Storage.getCoins());
      }
      this.renderMissions();
    });
  }

  /** タイトルから別画面へ移る時の共通処理(バナーを一旦しまう) */
  _leaveTitle() {
    this._resetInput();
    if (this.privacy && this.privacy.pending) this.privacy.hide();
  }

  openStages() {
    this._leaveTitle();
    this.state = 'stage';
    // 先に画面を出してから作る(マップの幅を測るため)
    this.ui.showScreen('stage');
    const skin = SKINS.find(s => s.id === Storage.getSkin()) || SKINS[0];
    this.ui.buildStageGrid(
      Game.STAGES,
      Math.min(Storage.getUnlockedStage(), Game.STAGES.length),
      Storage.getClearedStages(),
      (stageId) => { this._btn(); this.openBoosts(stageId, 'stage'); },
      (stage) => Retention.stageStars(stage),
      { images: this.images, skin }
    );
    this.ui.setMapBadges(Retention.totalStars(Game.STAGES), Game.STAGES.length * 3, Storage.getCoins());
  }

  openSkin() {
    this._leaveTitle();
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
    this._leaveTitle();
    const stage = this.getStage(stageId);
    this.pendingStageId = stage.id;
    this.boostBackTarget = backTarget;
    this.state = 'boost';
    const skin = SKINS.find(k => k.id === Storage.getSkin()) || SKINS[0];
    // バグよけは、ルーレットがあるステージ(4面〜)だけ
    const boosts = Game.BOOSTS.filter(b => b.id !== 'nobug' || BugRoulette.enabledFor(stage.id));
    this.ui.showBoosts(stage, boosts, Storage.getCoins(), skin.closedSrc);
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
    this.startWithLoading(this.pendingStageId, selected.map(item => item.id));
  }

  startGame(stageId = this.currentStageId, boostIds = [], opts = {}) {
    this._resetInput();
    // エンドレス:エリア1から。ブーストは使えない(ランキングを公平にする)
    this.endlessRun = opts.endless ? { area: 1, areaT: 0 } : null;
    this.endlessStage = opts.endless ? Endless.stageFor(1) : null;
    if (opts.endless) boostIds = [];
    this.safePoint = null;
    const stage = opts.endless ? this.endlessStage : this.getStage(stageId);
    this.currentStageId = opts.endless ? 'endless' : stage.id;
    const skinId = Storage.getSkin();
    const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
    const center = Game.WORLD / 2;

    this.player = new Player(skin, this.images[skin.id], center, center);
    if (this.endlessRun) this.player.maxScale = Endless.scaleCap(1);
    this.player.accessory = typeof Accessories !== 'undefined' ? Accessories.equipped() : null;
    this.ui.setHudFace(skin.closedSrc);
    this.activeBoosts = new Set(boostIds);
    this.scoreMultiplier = this.activeBoosts.has('score') ? 2 : 1;
    // バグルーレット:このプレイ中ずっと続く異常を1つ決める
    this.bug = !this.activeBoosts.has('nobug') && (this.endlessRun || BugRoulette.enabledFor(stage.id)) ? BugRoulette.pick() : null;
    this.player.setBug(this.bug);
    if (this.activeBoosts.has('size')) this.player.scale = 2;
    this.spawner.setTypes(Game.THEMES[stage.theme].objects);
    this.spawner.populate(center, center, 180);

    this.score = 0;
    this.timeLeft = stage.time + (this.activeBoosts.has('time') ? 5 : 0);
    this.runTimeLimit = this.timeLeft;
    this.clearTime = null;
    this.suckedCount = 0;
    this.maxScale = this.player.scale;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.vacuumCount = 0;
    for (const p of this.particles.pool) p.active = false;
    // 初回だけ STAGE 1 で操作ガイドを出す(ステージ紹介の後に表示)
    this.tutorialStep = !this.endlessRun && stage.id === 1 && !Retention.tutorialDone() && !Storage.hasClearedStage(1) ? 1 : 0;
    this.tutorialMoved = 0;
    this.tutorialEaten = 0;
    this.ui.hideTutorial();

    this.camera.snap(center, center, this._targetZoom());
    this.ui.updateHUD(0, this.player.scale, this.timeLeft, stage.targetScore, this._hudLabel());
    this.ui.setGauge(0, false);
    this.ui.setEndlessHud(!!this.endlessRun);
    this.ui.showScreen('hud');
    this.ui.showStageIntro(this.endlessRun ? Endless.introStage() : stage, 3.5, this.endlessRun ? null : { tip: StageGimmicks.TIPS[stage.id] });
    this.stageIntroTimer = 3.5;
    this.roulette = null;
    if (this.bug) Analytics.design(`bug:${this.bug.id}`);
    this.state = 'intro';
    this.input.active = false;
    this.power.reset();
    // ブースト:フィーバーは最初の1口でゲージ満タン、バリアは危険物を1回だけふせぐ
    if (this.activeBoosts.has('fever')) this.power.gauge = 0.95;
    this.shield = this.activeBoosts.has('shield') ? 1 : 0;
    this.ui.setGauge(0, false);
    // ステージギミック(レインボーの準備の後に始める:eventPool を共有するため)
    this.stunTimer = 0;
    this.stunCause = null; this.stunCauseT = 0;
    if (this.gimmick) this.gimmick.stop();
    this.gimmick = StageGimmicks.create(this.endlessRun ? Endless.gimmickStage(1) : stage.id, this);
    if (this.gimmick) this.gimmick.start();
    // +3秒の時計:2面からどのステージにもときどき出る普通の物
    if (this.clocks) this.clocks.stop();
    this.clocks = this.endlessRun || stage.id >= 2 ? new ClockGimmick(this, { count: 1, respawn: 14, first: 6, normal: true }) : null;
    if (this.clocks) this.clocks.start();
    // 吸い込んではいけない「ビリビリ」(初めての STAGE 1 のチュートリアル中は出さない)
    if (this.hazards) this.hazards.stop();
    this.hazards = this.tutorialStep ? null : new HazardField(this, stage);
    if (this.hazards) this.hazards.start();
    // ワープホール・送風機(チュートリアル中は出さない)。シャボン玉は後半の面だけ
    this.warps = this.tutorialStep ? null : new WarpField(this, stage);
    if (this.warps) this.warps.start();
    if (this.wind) this.wind.stop();
    this.wind = this.tutorialStep ? null : new WindField(this, stage);
    if (this.wind) this.wind.start();
    if (this.bubbles) this.bubbles.stop();
    this.bubbles = stage.id >= BubbleField.fromStage ? new BubbleField(this, stage) : null;
    if (this.bubbles) this.bubbles.start();
    this.shockTimer = 0;
    this.smallHintShown = false;
    this.hazardGrace = 0;
    this.burpTimer = 0;
    this.rampage = null;
    this.flames = [];
    this.fever = null;
    this.feverCoins = 0;
    this.feverEaten = 0;
    this.ui.showFever(false);
    this.recentEats = [];
    this.clearHold = 0;
    this.feverOutro = null;
    this.ui.showClearBanner(false, true);
    this.popTexts = [];
    if (this.endlessRun) Analytics.design('endless:start');
    else Analytics.stageStart(stage.id);
  }

  pauseGame() {
    if (this.state !== 'play') return;
    this.audio?.stopPickup();
    this.audio?.setMusicPaused(true);
    this._resetInput();
    this.state = 'pause';
    this.input.active = false;
    this.ui.showScreen('hud', 'pause');
  }

  resumeGame() {
    if (this.state !== 'pause') return;
    this.audio?.setMusicPaused(false);
    this._resetInput();
    this.state = 'play';
    this._lastT = performance.now(); // ポーズ中の経過時間を捨てる
    this.ui.showScreen('hud');
  }

  endGame() {
    if (this.state !== 'play') return;
    this._resetInput();
    this.clearHold = 0;
    this.feverOutro = null;
    if (this.player) { this.player.spin = 0; this.player.hop = 0; }
    this.ui.showClearBanner(false, true);
    this.state = 'result';
    this.input.active = false;

    this.cosmiiAbility.leave();
    this.power.cancel();
    if (this.gimmick) this.gimmick.stop();
    this.gimmick = null;
    if (this.clocks) this.clocks.stop();
    this.clocks = null;
    if (this.hazards) this.hazards.stop();
    this.hazards = null;
    if (this.warps) this.warps.stop();
    this.warps = null;
    if (this.wind) this.wind.stop();
    this.wind = null;
    if (this.bubbles) this.bubbles.stop();
    this.bubbles = null;
    this.stunTimer = 0;
    this.stunCause = null; this.stunCauseT = 0;
    this.shockTimer = 0;
    this.hazardGrace = 0;
    this.ui.hideTutorial();
    if (this.currentStageId === 1 && !Retention.tutorialDone()) {
      Retention.markTutorialDone();
    }
    this.tutorialStep = 0;
    if (this.endlessRun) { this._endEndless(); return; }

    const stage = this.getStage(this.currentStageId);

    // Preserve score history; the record badge now celebrates faster clears.
    const prevStageBest = Storage.getStageBest(stage.id);
    let isNewBest = false;
    if (this.score > prevStageBest) Storage.setStageBest(stage.id, this.score);
    // 全体ベスト(生涯ハイスコア)は別途更新し続ける
    if (this.score > Storage.getBest()) Storage.setBest(this.score);

    const cleared = this.score >= stage.targetScore;
    if (cleared) this.audio.clear();
    else this.audio.timeup();
    const previousTime = Storage.getClearTime(stage.id);
    if (cleared && this.clearTime == null) this.clearTime = Math.max(0, this.runTimeLimit - this.timeLeft);
    if (cleared && (previousTime === null || this.clearTime < previousTime)) {
      Storage.setClearTime(stage.id, this.clearTime);
      isNewBest = previousTime !== null;
    }
    // 報酬:初回クリアは満額、再クリアは25%(コイン経済のインフレ防止)
    const firstClear = cleared && !Storage.hasClearedStage(stage.id);
    const reward = cleared
      ? (firstClear ? stage.rewardCoins : Math.ceil(stage.rewardCoins * 0.25))
      : 0;
    // 食べ放題で集めたコイン
    const feverCoins = cleared ? (this.feverCoins || 0) : 0;
    if (cleared) {
      if (firstClear) Storage.markStageCleared(stage.id);
      Storage.addCoins(reward + feverCoins);
      if (feverCoins > 0) Analytics.coinSource(feverCoins, 'fever', `stage_${String(stage.id).padStart(2, '0')}`);
    }
    if (cleared && stage.id < Game.STAGES.length) {
      Storage.setUnlockedStage(Math.max(Storage.getUnlockedStage(), stage.id + 1));
    }

    // ★評価(今回のクリアタイム)と、新しく届いた★段階のボーナス
    const runStars = Retention.starsFor(stage, cleared, this.clearTime);
    const starBonus = cleared ? Retention.awardStarBonus(stage, runStars) : 0;
    const feverHint = cleared && this.feverCoins > 0 ? `FEVER +${this.feverCoins}` : '';
    const starHint = [this._starHint(stage, cleared, runStars, starBonus), feverHint].filter(Boolean).join('  ・  ');
    if (cleared) Analytics.design(`stage:stars:${String(stage.id).padStart(2, '0')}`, runStars);
    if (starBonus > 0) Analytics.coinSource(starBonus, 'star_bonus', `stage_${String(stage.id).padStart(2, '0')}`);

    // デイリーミッション
    const missions = Retention.recordRun({
      plays: 1, clears: cleared ? 1 : 0, eaten: this.suckedCount,
      vacuums: this.vacuumCount || 0, maxCombo: this.maxCombo || 0, stars: runStars,
    });
    for (const m of missions) Analytics.design(`mission:complete:${m.id}`);

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
      bestLabel: 'BEST',
      isNewBest,
      clearTime: cleared ? this.clearTime : null,
      bestTime: Storage.getClearTime(stage.id),
      count: this.suckedCount,
      maxSize: this.maxScale,
      cleared,
      reward: reward + starBonus + feverCoins,
      feverCoins,
      hasNext: cleared && stage.id < Game.STAGES.length,
      stage,
      stars: runStars,
      starHint,
      starBonus,
      firstClear,
      nextStar: cleared && runStars < 3 && stage.starTimes ? runStars + 1 : null,
      nextStarLimit: cleared && runStars < 3 && stage.starTimes ? (runStars === 1 ? stage.starTimes[0] : stage.starTimes[1]) : null,
      missions,
      bug: this.bug,
    });
    this.ui.updateCoins(Storage.getCoins());
    this.refreshRetentionBadges();

    // 初クリアの気持ちいい瞬間に、通知の説明を出す(OSダイアログはその後)
    if (Notifier.shouldOffer(stage.id, firstClear)) {
      clearTimeout(this._notifyTimer);
      this._notifyTimer = setTimeout(() => {
        if (this.state === 'result') this.ui.showNotifyPrompt();
      }, 1400);
    }
  }

  /** リザルトに出す★の一言(次の★までの目安 or ボーナス獲得) */
  _starHint(stage, cleared, stars, bonus) {
    if (!cleared || !stage.starTimes) return '';
    if (bonus > 0) return `★${stars} ボーナス +${bonus.toLocaleString()}`;
    if (stars >= 3) return '★3 クリア！';
    const limit = stars === 1 ? stage.starTimes[0] : stage.starTimes[1];
    return `★${stars + 1}は ${limit}秒以内`;
  }

  /* ================= メインループ ================= */

  /** プレイ中のフレーム時間を見て、遅ければ解像度を一段下げる(2 → 1.6 → 1.3) */
  _watchPerformance(elapsed) {
    if (this.state !== 'play' || elapsed <= 0 || elapsed > 0.25) return;
    const pm = this.perfMon || (this.perfMon = { t: 0, n: 0, slow: 0 });
    pm.t += elapsed; pm.n++;
    if (elapsed > 1 / 40) pm.slow++;
    if (pm.t < 3) return;
    const slowRatio = pm.slow / pm.n;
    this.perfMon = { t: 0, n: 0, slow: 0 };
    const cap = this.dprCap || 2;
    if (slowRatio > 0.25 && cap > 1.3 && (window.devicePixelRatio || 1) > 1.3) {
      this.dprCap = cap > 1.6 ? 1.6 : 1.3;
      this._resize();
      Analytics.design('perf:dpr', Math.round(this.dprCap * 10));
    }
  }

  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    const elapsed = Math.max(0, (now - this._lastT) / 1000);
    this._watchPerformance(elapsed);
    this._lastT = now;
    if (document.hidden) return;
    const dt = Math.min(elapsed, 0.05); // Limit physics steps, not game clocks.
    this.time += dt;

    if (this.state === 'intro') this._updateStageIntro(elapsed);
    else if (this.state === 'roulette') this._updateRoulette(elapsed);
    else if (this.state === 'play') this._updatePlay(dt, elapsed);
    else if (this.state === 'title' || this.state === 'skin') this._updateTitle(dt);

    this._render();
  }

  _updateStageIntro(dt) {
    this.stageIntroTimer -= dt;
    if (this.stageIntroTimer > 0) return;
    this.ui.hideStageIntro();
    if (this.bug) this._startRoulette();
    else this._beginPlay();
  }

  /** ステージ紹介の後、バグルーレットの円盤を回す */
  _startRoulette() {
    this.state = 'roulette';
    this.roulette = { plan: BugRoulette.wheelPlan(this.bug), t: 0, landed: false };
    this.ui.showWheel(BugRoulette.BUGS, this.roulette.plan.start);
    this.audio.rouletteSpin();
  }

  _updateRoulette(elapsed) {
    const r = this.roulette;
    r.t += elapsed;
    this.ui.setWheelAngle(BugRoulette.wheelAngle(r.plan, r.t));
    if (!r.landed && r.t >= BugRoulette.SPIN) {
      r.landed = true;
      this.ui.setWheelAngle(r.plan.final);
      this.ui.landWheel(this.bug, r.plan.index);
      this.audio.rouletteStop();
      this.camera.shake(6);
    }
    if (r.t >= BugRoulette.SPIN + BugRoulette.REVEAL) {
      this.ui.hideWheel();
      this._beginPlay();
    }
  }

  /** 円盤をタップ:回転中なら即停止、止まった後ならすぐ開始 */
  skipRoulette() {
    if (this.state !== 'roulette' || !this.roulette) return;
    const r = this.roulette;
    r.t = r.landed ? BugRoulette.SPIN + BugRoulette.REVEAL : BugRoulette.SPIN;
    this._updateRoulette(0);
  }

  /** バリア(ブースト):コスミーを包むシャボンの膜 */
  _drawShield(ctx) {
    const p = this.player, r = p.bodyR * 1.25 + Math.sin(this.time * 4) * p.bodyR * 0.04;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.85)';
    ctx.lineWidth = Math.max(3, p.bodyR * 0.06);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.86, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.restore();
  }

  /** バグが切れた:ポンッと光って普通に戻る */
  _cureBug() {
    const p = this.player;
    this.bug = null;
    this.bugLeft = 0;
    p.setBug(null);
    this.ui.hideBugBadge();
    this.particles.ring(p.x, p.y, '#ffffff', p.bodyR * 1.3);
    this.particles.ring(p.x, p.y, '#8fd14f', p.bodyR * 1.8);
    p.pulse = 1;
    this.audio.button();
  }

  _beginPlay() {
    // 「なにもなし」に止まった:バグはかからない
    if (this.bug && this.bug.none) { this.bug = null; this.player.setBug(null); }
    this.bugLeft = this.bug ? BugRoulette.DURATION : 0;
    this.ui.showBugBadge(this.bug);
    this.ui.buttons.pause.disabled = false;
    this.state = 'play';
    this.roulette = null;
    this._lastT = performance.now();
    if (this.tutorialStep === 1) {
      this.ui.showTutorial('指でドラッグして うごかそう');
      Analytics.design('tutorial:start');
    }
  }

  /** 操作ガイドの進行:動いたら次の説明、少し食べたら消す */
  _updateTutorial(dt) {
    if (!this.tutorialStep) return;
    if (this.tutorialStep === 1 && this.player.moving) {
      this.tutorialMoved += this.player.moveSpeed * this.player.speedRatio * dt;
      if (this.tutorialMoved > 160) {
        this.tutorialStep = 2;
        this.ui.showTutorial('小さいものから すいこもう！ TARGETのスコアでクリア', false);
      }
    } else if (this.tutorialStep === 2 && this.tutorialEaten >= 6) {
      this.tutorialStep = 0;
      this.ui.hideTutorial();
      Analytics.design('tutorial:complete');
    }
  }

  /** プレイヤーサイズに応じたズーム(大きいほど引く) */
  _targetZoom() {
    // バグの大きさ倍率はズームに含めない(画面上でも大きく/小さく見えるように)
    // 食べ放題中は大きくなった以上にカメラを引く(街がミニチュアに見えるように)
    let s = this.player ? this.player.scale * Math.pow(this.player.feverMul || 1, 2.4) : 1;
    // 分身中は少し引いて、仲間がみんな見えるように
    if (this.power && this.power.state === 'clone') s *= 2.2;
    return Math.max(this.fever ? 0.2 : 0.3, Math.min(1.15, 1.15 / Math.pow(s, 0.5)));
  }

  /* ---- プレイ中の更新 ---- */
  _updatePlay(dt, elapsed = dt) {
    const player = this.player;
    if (this.feverOutro) { this._updateFeverOutro(dt, elapsed); return; }
    // クリアの瞬間はスロー
    if (this.clearHold > 0) {
      this.clearHold -= elapsed;
      if (this.clearHold > 0) { dt *= Game.CLEAR_SLOW; elapsed *= Game.CLEAR_SLOW; }
      else this._endClearHold();
    }
    // コスミーフィーバーを選んでいる間は時間がゆっくり
    const real = elapsed;
    const slow = this.power ? this.power.timeScale : 1;
    dt *= slow;
    elapsed *= slow;
    if (this.power) this.power.update(dt, real);
    if (this.stunCauseT > 0) this.stunCauseT -= dt;
    // バグは15秒で切れて元に戻る
    if (this.bug && this.bugLeft > 0) {
      this.bugLeft -= dt;
      this.ui.updateBugBadge(Math.max(0, this.bugLeft) / BugRoulette.DURATION);
      if (this.bugLeft <= 0) this._cureBug();
    }
    const drain = this.endlessRun ? Endless.drain(this.endlessRun.area) : 1;
    // エンドレス:最近ふえた時間はゆっくり忘れる(一気にたくさん食べても時間は増えすぎない)
    if (this.endlessRun && this.endlessRun.recent > 0) this.endlessRun.recent *= Math.pow(0.5, elapsed / Endless.RECENT_HALF);
    if (this.endlessRun && !this.fever) {
      this.endlessRun.areaT += elapsed;
      if (this.endlessRun.areaT >= Endless.AREA_TIME) this._advanceArea();
    }
    if (this.fever) {
      // 食べ放題中は時間が止まる
      if (this._updateFever(elapsed)) return;
    } else this.timeLeft = Math.max(0, this.timeLeft - elapsed * drain);
    if (this.timeLeft <= 0 && !this.fever && !this.cosmiiAbility.isRunning) {
      const stage = this.getStage(this.currentStageId);
      this.ui.updateHUD(this.score, player.scale, 0, stage.targetScore, this._hudLabel());
      this.endGame();
      return;
    }

    // コンボ猶予時間
    if (this.comboTimer > 0) {
      this.comboTimer -= elapsed;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.shockTimer > 0) this.shockTimer = Math.max(0, this.shockTimer - dt);
    if (this.hazardGrace > 0) this.hazardGrace = Math.max(0, this.hazardGrace - dt);
    if (this.player) this.player.grace = this.stunTimer > 0 ? 0 : this.hazardGrace;
    if (this.burpTimer > 0) this.burpTimer = Math.max(0, this.burpTimer - dt);
    if (this.hazards) this.hazards.update(dt);
    this._updateFlames(dt);
    if (this.warps && !this.fever) this.warps.update(dt);
    if (this.wind) this.wind.update(dt);
    if (this.bubbles) this.bubbles.update(dt);
    if (this.popTexts && this.popTexts.length) {
      for (const t of this.popTexts) t.life -= dt;
      this.popTexts = this.popTexts.filter(t => t.life > 0);
    }
    player.update(this._getMoveInput(), dt, Game.WORLD, elapsed);
    this._updateTutorial(dt);
    if (this.gimmick) this.gimmick.update(dt);
    if (this.clocks) this.clocks.update(dt);
    this.cosmiiAbility.update(dt, elapsed);
    if (this._checkTarget()) return;
    this._updateSuction(dt);
    if (this.state !== 'play') return;
    this.spawner.update(dt, player.eatScale, this.camera, this.w, this.h);
    this.particles.update(dt);

    // バキューム中の常時エフェクト
    if (player.vacuumActive) {
      const m = player.getMouth();
      this.particles.vacuumSpark(m.x, m.y, m.r * 1.1, this._activeEffect());
    }
    if (this.fever || !this.power) this.ui.setGauge(player.vacuumGauge, player.vacuumActive);
    else this.ui.setGauge(this.power.gauge, this.power.active || this.power.choosing);

    // カメラ追従
    this.camera.follow(player.x, player.y, this._targetZoom(), dt);
    this.camera.update(dt);

    // 制限時間
    const stage = this.getStage(this.currentStageId);
    this.ui.updateHUD(this.score, player.scale, this.timeLeft, stage.targetScore, this._hudLabel(), this._hudProgress());
    if (this.timeLeft <= 0 && !this.fever && !this.cosmiiAbility.isRunning) this.endGame();
  }

  /* ---- 開始前のローディング ---- */

  /**
   * 軽いローディング画面を出して、その間にこの面で使う絵を先に作っておく
   * (遊び始めてから初めて絵を作ると、その一瞬カクッとするため)
   */
  startWithLoading(stageId, boostIds = [], opts = {}) {
    if (this.loading) return;
    this.loading = true;
    const skin = SKINS.find(s => s.id === Storage.getSkin()) || SKINS[0];
    const stage = opts.endless ? Endless.stageFor(1) : this.getStage(stageId);
    this.ui.showLoading(true, skin.openSrc, opts.endless ? '∞' : String(stage.id));
    const started = performance.now();
    // 画面にローディングが出てから重い準備を始める
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { this._prewarm(stage); } catch (_) { /* 準備に失敗しても遊べるように */ }
      const wait = Math.max(0, 550 - (performance.now() - started));
      setTimeout(() => {
        this.loading = false;
        this.ui.showLoading(false);
        this.startGame(stageId, boostIds, opts);
      }, wait);
    }));
  }

  _prewarm(stage) {
    const theme = Game.THEMES[stage.theme] || Game.THEMES.park;
    const ids = new Set(theme.objects);
    if (stage.endless) Game.THEMES.mega.objects.forEach(id => ids.add(id));
    for (const type of OBJECT_TYPES) {
      if (!ids.has(type.id)) continue;
      const sprite = GameObject.getSprite(type);
      GameObject.getBurntSprite(type);
      // 引いた時に使う小さい絵も作っておく
      GameObject.lod(sprite, sprite.canvas.width * 0.3);
      GameObject.lod(sprite, sprite.canvas.width * 0.1);
    }
    for (const type of Object.values(GIMMICK_TYPES)) GameObject.getSprite(type);
    if (typeof BubbleField !== 'undefined') BubbleField.sprite();
    for (const c of ['rgb(255,190,80)']) Game.flameSprite(c);
  }

  /* ---- エンドレス ---- */

  startEndless() {
    if (!Endless.unlocked()) return;
    if (GameCenter.available() && !GameCenter.signedIn) GameCenter.signIn();
    this.startWithLoading(1, [], { endless: true });
  }

  /** エンドレスのバーは「次のエリアまでの時間」 */
  _hudProgress() {
    return this.endlessRun ? Math.min(1, this.endlessRun.areaT / Endless.AREA_TIME) : null;
  }

  _hudLabel() {
    return this.endlessRun ? `AREA ${this.endlessRun.area}` : '';
  }

  /** 40秒たった:次のエリアへ(見た目・しかけ・危険物を入れ替え、大きくなれる上限も上がる) */
  _advanceArea() {
    const run = this.endlessRun;
    run.area++;
    run.areaT = 0;
    this.player.maxScale = Endless.scaleCap(run.area);
    const stage = Endless.stageFor(run.area);
    this.endlessStage = stage;
    this.timeLeft = Math.min(Endless.MAX_TIME, this.timeLeft + Endless.areaBonus(run.area));
    // 新しい仕掛けは今いる場所を避けて置く
    this.safePoint = { x: this.player.x, y: this.player.y };
    this.spawner.setTypes(Game.THEMES[stage.theme].objects);
    this.spawner.retheme(this.player.eatScale, this.camera, this.w, this.h);
    if (this.gimmick) this.gimmick.stop();
    this.gimmick = StageGimmicks.create(Endless.gimmickStage(run.area), this);
    if (this.gimmick) this.gimmick.start();
    if (this.hazards) this.hazards.stop();
    this.hazards = new HazardField(this, stage);
    this.hazards.start();
    if (this.warps) this.warps.stop();
    this.warps = new WarpField(this, stage);
    this.warps.start();
    if (this.wind) this.wind.stop();
    this.wind = new WindField(this, stage);
    this.wind.start();
    if (this.bubbles) this.bubbles.stop();
    this.bubbles = stage.id >= BubbleField.fromStage ? new BubbleField(this, stage) : null;
    if (this.bubbles) this.bubbles.start();
    this.safePoint = null;
    const info = StageGimmicks.infoFor(Endless.gimmickStage(run.area));
    this.ui.showAreaBanner(run.area, stage.name, info ? info.name : '');
    this.audio.clear();
    this.camera.shake(6);
    this.particles.ring(this.player.x, this.player.y, '#ffffff', this.player.bodyR * 2.2);
    Analytics.design('endless:area', run.area);
  }

  _endEndless() {
    const area = this.endlessRun.area;
    const prev = Endless.best();
    const isNewBest = Endless.record(this.score, area);
    if (this.score > Storage.getBest()) Storage.setBest(this.score);
    this.audio.timeup();
    const reward = Endless.coinsFor(area);
    if (reward > 0) {
      Storage.addCoins(reward);
      Analytics.coinSource(reward, 'endless_reward', `area_${area}`);
    }
    const missions = Retention.recordRun({
      plays: 1, clears: 0, eaten: this.suckedCount,
      vacuums: this.vacuumCount || 0, maxCombo: this.maxCombo || 0, stars: 0,
    });
    for (const m of missions) Analytics.design(`mission:complete:${m.id}`);
    Analytics.design('endless:score', this.score);
    GameCenter.submitScore(Endless.LEADERBOARD, this.score);
    this.ui.showEndlessResult({
      score: this.score,
      best: Math.max(prev.score, this.score),
      isNewBest,
      area,
      count: this.suckedCount,
      maxSize: this.maxScale,
      reward,
      missions,
      bug: this.bug,
      ranking: GameCenter.available(),
    });
    this.ui.updateCoins(Storage.getCoins());
    this.refreshRetentionBadges();
  }

  getStage(stageId) {
    if (stageId === 'endless' && this.endlessStage) return this.endlessStage;
    return Game.STAGES.find(item => item.id === stageId) || Game.STAGES[0];
  }

  _checkTarget() {
    const stage = this.getStage(this.currentStageId);
    if (this.score < stage.targetScore) return false;
    if (this.endlessRun) { this._advanceArea(); return false; }
    const played = Math.max(0, this.runTimeLimit - this.timeLeft);
    if (this.clearTime == null) this.clearTime = played;
    if (this.cosmiiAbility.isRunning || this.fever) return false;
    this.ui.updateHUD(this.score, this.player.scale, this.timeLeft, stage.targetScore);
    this._startFever();
    return true;
  }

  /* ---- クリア後の食べ放題フィーバー ---- */

  _startFever() {
    const p = this.player;
    this.power.cancel();
    this.fever = { t: Game.FEVER_TIME, coins: 0, eaten: 0, cap: Game.feverCoinCap(this.currentStageId) };
    this.rampage = null;
    p.boostMul = 1;
    this.stunTimer = 0;
    this.stunCause = null; this.stunCauseT = 0;
    this.shockTimer = 0;
    this.hazardGrace = 0;
    this.burpTimer = 0;
    p.startVacuum();
    this.audio.clear();
    this.audio.vacuum();
    this.camera.shake(10);
    for (let i = 0; i < 3; i++) this.particles.ring(p.x, p.y, ['#ffd24d', '#ff6b81', '#6cb9ff'][i], p.bodyR * (1.2 + i * 0.5));
    // まずスローにして「STAGE CLEAR!」。食べ放題の表示はそのあと
    this.clearHold = Game.CLEAR_HOLD;
    this.ui.showClearBanner(true);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      this.particles.burst(p.x + Math.cos(a) * p.bodyR * 1.4, p.y + Math.sin(a) * p.bodyR * 1.4, ['#ffd24d', '#ff6b81', '#6cb9ff', '#8fd14f', '#c89bff', '#ffffff'][i], { kind: 'star', colors: ['#ffd24d', '#ffffff'] });
    }
    Analytics.design(`fever:start:${String(this.currentStageId).padStart(2, '0')}`);
  }

  /** 食べ放題の進行。終わったら true(リザルトへ) */
  _updateFever(elapsed) {
    const f = this.fever, p = this.player;
    f.t -= elapsed;
    const since = Game.FEVER_TIME - f.t;
    // 0.5秒でぐーんと大きくなり、最後の0.4秒でもとに戻る
    const up = Math.min(1, since / 0.5), down = Math.min(1, Math.max(0, f.t) / 0.4);
    const ease = 1 - Math.pow(1 - Math.min(up, down), 3);
    p.feverMul = 1 + (Game.FEVER_SIZE - 1) * ease;
    // ずっとバキューム
    p.vacuumActive = true;
    p.vacuumTimer = Math.max(p.vacuumTimer, 0.5);
    this.ui.updateFever(Math.max(0, f.t) / Game.FEVER_TIME, f.coins, f.coins >= f.cap);
    if (f.t > 0) return false;
    p.feverMul = 1;
    p.vacuumActive = false;
    p.vacuumGauge = 0;
    this.feverCoins = f.coins;
    this.feverEaten = f.eaten;
    this.fever = null;
    this.ui.showFever(false);
    this._startFeverOutro();
    return true;
  }

  /** スローが終わったら、食べ放題の表示を出す */
  _endClearHold() {
    this.clearHold = 0;
    this.ui.showClearBanner(false);
    if (!this.fever) return;
    this.ui.showFever(true);
    this.ui.updateFever(Math.max(0, this.fever.t) / Game.FEVER_TIME, this.fever.coins);
    this.camera.shake(6);
  }

  /** 食べ放題のあと:口を閉じて、ゲップして、くるっと一回転「ごちそうさま！」 */
  _startFeverOutro() {
    const p = this.player;
    this.feverOutro = { t: Game.OUTRO_TIME, flash: false };
    p.spin = 0;
    p.hop = 0;
    p.vacuumActive = false;
    p.vacuumTimer = 0;
    p.moving = false;
    p.mouthHold = 0;
    p.mouthOpen = 0;
    this.burpTimer = 0.6;
    this.gimmickText(p.x, p.y - p.bodyR * 1.35, 'ごちそうさま！', '#ff6b81');
    this.ui.setGauge(0, false);
  }

  _updateFeverOutro(dt, elapsed) {
    const o = this.feverOutro, p = this.player;
    o.t -= elapsed;
    const k = 1 - Math.max(0, o.t) / Game.OUTRO_TIME;
    // 0.2〜0.7の間に、ぴょんと跳ねながら一回転
    const s = Math.min(1, Math.max(0, (k - 0.2) / 0.5));
    p.spin = (1 - Math.pow(1 - s, 3)) * Math.PI * 2;
    p.hop = Math.sin(s * Math.PI) * p.bodyR * 0.45;
    p.mouthOpen = 0;
    if (this.burpTimer > 0) this.burpTimer = Math.max(0, this.burpTimer - dt);
    if (this.popTexts && this.popTexts.length) {
      for (const t of this.popTexts) t.life -= dt;
      this.popTexts = this.popTexts.filter(t => t.life > 0);
    }
    this.particles.update(dt);
    this.camera.follow(p.x, p.y, this._targetZoom(), dt);
    this.camera.update(dt);
    // 最後は画面がふわっと白くなって、リザルトへ
    if (!o.flash && o.t < 0.35) { o.flash = true; this.ui.flashWhite(); }
    if (o.t > 0) return;
    this.feverOutro = null;
    p.spin = 0; p.hop = 0;
    this.endGame();
  }

  _updateSuction(dt) {
    const player = this.player;
    const mouth = player.getMouth();

    this.spawner.forEachActive((obj) => {
      if (this.state !== 'play') return;
      const dx = mouth.x - obj.x;
      const dy = mouth.y - obj.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      if (obj.state === 'idle') {
        if (obj.wobble > 0) obj.wobble -= dt;
        // 危険物は口のまん中に来た時だけ入る(大きくなっても、よけられる)。
        // 1回当たった後はしばらく(hazardGrace)危険物を食べず、はじき返す
        const hz = obj.hazard && !this.fever;
        const catchRadius = hz ? mouth.r * Game.HAZARD_CATCH + obj.r : mouth.r + obj.r * 1.45;
        if (hz && this.hazardGrace > 0 && dist < mouth.r + obj.r) {
          const push = Math.min(40, Math.max(0, mouth.r + obj.r - dist) * 0.6 + 4);
          obj.x = Math.max(80, Math.min(Game.WORLD - 80, obj.x - (dx / dist) * push));
          obj.y = Math.max(80, Math.min(Game.WORLD - 80, obj.y - (dy / dist) * push));
          obj.wobble = 0.3;
        } else if (dist < catchRadius) {
          if (this.canEat(obj, player, mouth)) {
            // 吸い込み開始
            obj.state = 'suck';
            obj.suckStartDist = dist;
            obj.suckTime = 0;
            player.mouthHold = 0.6;
            player.mouthOpen = Math.max(player.mouthOpen, 0.65);
          } else if (!obj.bubble && !(this.gimmick && this.gimmick.onBump(obj, player, mouth))) {
            // サイズ不足 → 少し押し返すだけ
            const push = Math.max(0, mouth.r + obj.r - dist) * 0.5;
            obj.x -= (dx / dist) * push;
            obj.y -= (dy / dist) * push;
            if (obj.wobble <= 0) {
              obj.wobble = 0.5;
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

  /** 今この物を吸い込めるか(ギミックが上書きすることがある:走る車は後ろからなら丸飲み) */
  canEat(obj, player = this.player, mouth = player.getMouth()) {
    if (obj.noSuck > 0) return false;
    // 食べ放題:シャボン玉ごと、ギミックも関係なく何でも食べられる
    if (this.fever) return !(this.warps && this.warps.active);
    // 激辛で火を吹いている間は食べられない(前の物は焦げる)
    if (this.rampage) return false;
    // シャボン玉に入っている物は、割るまで食べられない
    if (obj.bubble) return false;
    // ワープ中(穴に吸い込まれている間)も食べられない
    if (this.warps && this.warps.active) return false;
    const override = this.gimmick ? this.gimmick.canEat(obj, player, mouth) : null;
    if (override !== null && override !== undefined) return override;
    return player.eatScale >= obj.type.req && obj.r <= mouth.r * 1.05;
  }

  _smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  static comboMultiplier(count) {
    return Math.min(4, Math.max(1, count)) + Math.floor(Math.max(0, count) / 10);
  }

  /**
   * 後半の面(11面〜)では、自分よりずっと小さい物の点数が減る。
   * 大きくなっても小物を吸い続けるだけでは勝てず、大きい物やしかけを狙うようにする。
   * 1を返すと変化なし。面が進むほど強く減る。
   */
  _smallItemFactor(obj) {
    if (obj.gimmick || obj.rare || obj.scoreOnly || !this.player) return 1;
    const level = this.endlessRun ? Math.min(20, this.endlessRun.area + 4) : (typeof this.currentStageId === 'number' ? this.currentStageId : 0);
    if (level < Game.SMALL_FROM) return 1;
    const gap = this.player.scale - obj.type.req - Game.SMALL_FREE;   // 何段階小さいか(半段階までは減らない)
    if (gap <= 0) return 1;
    const t = Math.min(1, (level - Game.SMALL_FROM) / 9);          // 11面→0, 20面→1
    const step = 0.1 + 0.2 * t;                                      // 1段階ごとに減る割合
    const floor = 0.45 - 0.33 * t;                                   // これより下には減らない
    return Math.max(floor, 1 - gap * step);
  }

  /** 吸い込み完了(スコア・成長・コンボ・演出) */
  _consume(obj, eater = null) {
    const player = this.player;
    const mouth = (eater || player).getMouth();

    this.spawner.kill(obj);
    // ずかんに登録(新しく埋まったら小さく知らせる)
    const found = typeof Zukan !== 'undefined' ? Zukan.record(obj.type, obj.rare && !obj.burnt) : null;
    if (found) {
      this.ui.showZukanNew(found);
      Analytics.design(`zukan:new:${found.id}${found.rare ? ':rare' : ''}`);
    }
    if (this.fever && (obj.hazard || obj.burnt)) {
      // 食べ放題中は危険物も焦げた物もただのおやつ
      this.particles.ring(obj.x, obj.y, '#ffd24d', obj.r);
      this.fever.eaten++;
      this.fever.coins = Math.min(this.fever.cap, this.fever.coins + 1);
      return;
    }
    if (obj.hazard && this.shield > 0) {
      // バリアが1回だけ守ってくれる(パチンと割れる)
      this.shield--;
      this.hazardGrace = Game.HAZARD_GRACE;
      const p = this.player;
      this.particles.ring(p.x, p.y, '#8fd8ff', p.bodyR * 1.5);
      this.particles.ring(p.x, p.y, '#ffffff', p.bodyR * 1.9);
      this.camera.shake(4);
      if (this.hazards) this.hazards.respawn.push({ kind: obj.hazard, t: 2 });
      return;
    }
    if (obj.hazard) {
      // 吸い込んではいけない物:しびれる・爆走・ゲップ。スコア・成長・ゲージなし
      if (this.hazardGrace > 0) { if (this.hazards) this.hazards.respawn.push({ kind: obj.hazard, t: 2 }); return; }
      if (this.hazards) this.hazards.onEaten(obj);
      // しびれ・爆走が終わってからも少しの間は平気(続けてビリビリしない)
      this.hazardGrace = Math.max(Game.HAZARD_GRACE, (this.stunTimer || 0) + 1.5, this.rampage ? this.rampage.t + 1.5 : 0);
      return;
    }
    if (obj.burnt) {
      // 焦げた物:食べられるけどスコアが減る(成長・ゲージなし、コンボも途切れる)
      this.score = Math.max(0, this.score - obj.type.score);
      this.comboCount = 0;
      this.comboTimer = 0;
      this.ui.flashScoreLoss();
      this.particles.ring(obj.x, obj.y, '#5a463c', obj.r * 1.2);
      return;
    }
    this.suckedCount++;

    // 2秒以内の連続取得。4個まで毎回、その後は10個ごとに倍率+1。
    this.comboCount++;
    this.comboTimer = 2.0;
    this.maxCombo = Math.max(this.maxCombo || 0, this.comboCount);
    this.tutorialEaten = (this.tutorialEaten || 0) + 1;
    const mult = Game.comboMultiplier(this.comboCount);
    if (mult >= 2) this.ui.showCombo(mult, this.comboCount);

    const itemScoreMultiplier = (obj.scoreOnly ? 0.5 : 1) * (this.gimmick ? this.gimmick.scoreMul(obj) : 1) * (obj.rare && typeof Zukan !== 'undefined' ? Zukan.RARE_SCORE : 1);
    if (this.gimmick) this.gimmick.onConsume(obj);
    if (this.clocks) this.clocks.onConsume(obj);
    const small = this._smallItemFactor(obj);
    if (small < 0.6 && !this.smallHintShown) {
      this.smallHintShown = true;
      this.ui.showGimmickToast('小さい物は点が少ない！ 大きい物をねらおう');
    }
    const gained = Math.max(1, Math.floor(obj.type.score * itemScoreMultiplier * small * mult * this.scoreMultiplier * this.cosmiiAbility.scoreMultiplier * ((this.bug && this.bug.scoreMul) || 1)));
    this.score += gained;
    if (this.fever) {
      this.fever.eaten++;
      this.fever.coins = Math.min(this.fever.cap, this.fever.coins + (obj.type.req >= 4 ? 3 : obj.type.req >= 2 ? 2 : 1));
    }
    // エンドレス:食べると時間が少し増える
    if (this.endlessRun && !obj.scoreOnly) {
      const run = this.endlessRun;
      const gain = Endless.timeGain(obj.type, run.area, this.player.scale) / (1 + (run.recent || 0) / Endless.recentK(this.player.scale));
      run.recent = (run.recent || 0) + gain;
      this.timeLeft = Math.min(Endless.MAX_TIME, this.timeLeft + gain);
      this.ui.flashTimeGain();
    }
    // 炭酸のゲップで吐き出す候補(直前に食べた物)
    if (this.recentEats && !obj.rainbowCharge) {
      this.recentEats.push({ type: obj.type, points: gained });
      if (this.recentEats.length > 8) this.recentEats.shift();
    }
    this.cosmiiAbility.onConsume(obj);

    // 成長:大きいオブジェクトほどよく育つ(基本 +0.01)
    const grew = !obj.scoreOnly && player.grow(0.01 + obj.type.req * 0.012);
    if (grew) {
      this.audio.grow();
      player.growFlash = 1;
      this.particles.ring(player.x, player.y, '#ffe066', player.bodyR);
      this.camera.shake(4);
    }
    this.maxScale = Math.max(this.maxScale, player.scale);

    // コスミーフィーバーのゲージ(コンボが続くほど早く溜まる)
    if (!obj.scoreOnly && !this.fever && this.power) this.power.charge(this.comboCount);

    // 演出:膨らみ・星・シェイク・Pop音
    player.pulse = 1;
    player.mouthHold = 0.3;
    this.particles.burst(mouth.x, mouth.y, player.skin.color, this._activeEffect());
    if (obj.type.req >= 3) this.camera.shake(Math.min(10, obj.r * 0.1));
    this.audio.pop(this.comboCount, this.cosmiiAbility.isRunning);
    this._checkTarget();
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
    // 重い端末では描画の解像度を自動で少し下げる(見た目はほぼ同じで、塗る量が大きく減る)
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap || 2);
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
    if (typeof GameObject !== 'undefined') GameObject.pixelScale = (this.dpr || 1) * this.camera.zoom;
    this._drawBackground(ctx, view);
    if (this.gimmick && this.player) this.gimmick.drawGround(ctx, view);
    if (this.warps && this.player) this.warps.drawGround(ctx);
    if (this.wind && this.player) this.wind.drawGround(ctx, view);

    // 描画物を y 座標でソートして奥行き感を出す
    const drawList = this.drawList || (this.drawList = []);
    const suckingList = this.suckingList || (this.suckingList = []);
    drawList.length = suckingList.length = 0;
    for (let poolIndex = 0; poolIndex < 2; poolIndex++) {
      const pool = poolIndex === 0 ? this.spawner.pool : this.spawner.eventPool;
      for (const obj of pool) {
        if (!obj.active) continue;
        if (obj.x + obj.r < view.l || obj.x - obj.r > view.r ||
            obj.y + obj.r < view.t || obj.y - obj.r > view.b) continue;
        const entry = this._renderEntry(obj, 'item', obj.y + obj.r * 0.5);
        if (obj.state === 'suck' && this.player && this.player.mouthOpen > 0.55) suckingList.push(entry);
        else drawList.push(entry);
      }
    }

    if (this.player) {
      const p = this.player;
      drawList.push(this._renderEntry(p, 'player', p.y + p.bodyR * 0.7));
      if (this.power) this.power.collectDraw(drawList);
    } else {
      for (const wk of this.walkers) {
        drawList.push(this._renderEntry(wk, 'walker', wk.y + 60));
      }
    }

    drawList.sort(Game.compareDrawEntries);
    for (const d of drawList) this._drawEntry(ctx, d);
    suckingList.sort(Game.compareDrawEntries);
    for (const d of suckingList) this._drawEntry(ctx, d);

    // バキューム中のスピードライン
    if (this.player && (this.player.vacuumActive || (this.power && this.power.dash))) this._drawSpeedLines(ctx);

    this.particles.draw(ctx);
    if (this.gimmick && this.player) this.gimmick.drawTop(ctx);
    if (this.clocks && this.player) this.clocks.drawTop(ctx);
    if (this.shield > 0 && this.player && this.state === 'play') this._drawShield(ctx);
    if (this.hazards && this.player) this.hazards.drawTop(ctx);
    if (this.bubbles && this.player) this.bubbles.drawTop(ctx, view);
    if (this.player && typeof Zukan !== 'undefined') Zukan.drawSparkles(ctx, this, view, this.time);
    if (this.wind && this.player) this.wind.drawTop(ctx, view);
    if (this.player && this.rampage) this._drawRampage(ctx);
    if (this.player) this._drawFlames(ctx);
    if (this.player && this.power && this.state === 'play') this.power.drawTop(ctx);
    if (this.player && this.burpTimer > 0) this._drawBurp(ctx);
    if (this.player && this.shockTimer > 0) this._drawShock(ctx);
    if (this.player && this.state === 'play') this._drawStunCause(ctx);
    else if (this.player && this.stunTimer > 0 && !(this.burpTimer > 0) && !(this.warps && this.warps.active)) this._drawStun(ctx);
    if (this.player) this._drawPopTexts(ctx);
    ctx.restore();
    // ステージ紹介の間は画面の端の矢印を出さない
    if (this.state === 'play') {
      if (this.gimmick && this.player) this.gimmick.drawScreen(ctx);
      if (this.clocks && this.player) this.clocks.drawScreen(ctx);
    }

    // 画面座標系:仮想ジョイスティック
    if (this.state === 'play' && this.input.active) this._drawJoystick(ctx);
  }

  static compareDrawEntries(a, b) { return a.y - b.y; }

  _renderEntry(object, kind, y) {
    if (!this.renderEntries) this.renderEntries = new WeakMap();
    let entry = this.renderEntries.get(object);
    if (!entry) {
      entry = { object, kind, y };
      this.renderEntries.set(object, entry);
    }
    entry.y = y;
    return entry;
  }

  _drawEntry(ctx, entry) {
    if (entry.kind === 'walker') this._drawWalker(ctx, entry.object);
    else if (entry.kind === 'item' && this.cosmiiAbility) this.cosmiiAbility.drawItem(ctx, entry.object);
    else if (entry.kind === 'clone') this.power.drawClone(ctx, entry.object);
    else if (entry.kind === 'player' && entry.object.warpScale !== undefined && entry.object.warpScale < 1) {
      // ワープ中:くるくる回りながら小さくなる/大きくなる
      const p = entry.object;
      if (p.warpScale <= 0.01) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.warpSpin || 0);
      ctx.scale(p.warpScale, p.warpScale);
      ctx.translate(-p.x, -p.y);
      p.draw(ctx);
      ctx.restore();
    } else entry.object.draw(ctx);
  }

  _onRoad(v) {
    return Game.ROADS.some(r => Math.abs(v - r) < Game.ROAD_W / 2 + 40);
  }

  /** 街の背景(芝生・道路・飾り・外周) */
  _drawBackground(ctx, view) {
    const stage = this.getStage(this.currentStageId);
    const theme = stage.theme === 'mega' || stage.theme === 'final' ? this._finalStageTheme(stage.theme) : Game.THEMES[stage.theme];
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

  _finalStageTheme(kind = 'mega') {
    // 最後の面は街の色がゆっくり移り変わる(10面:前半の街、20面:後半の街)
    const keys = kind === 'final' ? ['night', 'candy', 'jungle', 'sky', 'neon', 'retro'] : ['shopping', 'factory', 'port', 'future', 'mega'];
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

  /** 画面上に一瞬出る文字(ビリビリ！ など。ギミックが無い面でも使う) */
  gimmickText(x, y, text, color = '#fff') {
    (this.popTexts || (this.popTexts = [])).push({ x, y, text, color, life: 1.1 });
  }

  _drawPopTexts(ctx) {
    if (!this.popTexts || !this.popTexts.length) return;
    const z = Math.max(0.4, this.camera.zoom);
    for (const t of this.popTexts) {
      const k = 1 - t.life / 1.1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `900 ${Math.round(30 / z)}px "M PLUS Rounded 1c", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6 / z;
      ctx.strokeStyle = 'rgba(60,40,45,0.85)';
      ctx.fillStyle = t.color;
      ctx.strokeText(t.text, t.x, t.y - k * 60);
      ctx.fillText(t.text, t.x, t.y - k * 60);
      ctx.restore();
    }
  }

  /** 激辛で爆走中:口から火を吹く */
  /** 炎のやわらかい玉(色ごとに1回だけ作って使い回す) */
  static flameSprite(color) {
    Game.flameSprites = Game.flameSprites || new Map();
    let c = Game.flameSprites.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    // 同じ色のまま外側だけ透明に(黒くにじまないように)
    const rgb = (color.match(/\d+\s*,\s*\d+\s*,\s*\d+/) || ['255,120,40'])[0];
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.45, `rgba(${rgb},0.85)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    Game.flameSprites.set(color, c);
    return c;
  }

  /** 激辛の火:口から火の玉を次々に吹き出す(焦げる範囲と同じ長さ・幅) */
  _updateFlames(dt) {
    if (!this.flames) this.flames = [];
    const p = this.player;
    if (this.rampage && p) {
      const m = p.getMouth(), dx = this.rampage.dx, dy = this.rampage.dy, R = p.bodyR;
      this.flameAcc = (this.flameAcc || 0) + dt * 170;
      while (this.flameAcc >= 1) {
        this.flameAcc -= 1;
        const side = (Math.random() - 0.5) * 2;
        const ember = Math.random() < 0.12;
        const sp = R * (ember ? 5.5 : 4.2) * (0.8 + Math.random() * 0.4);
        this.flames.push({
          x: m.x + dx * R * 0.3 - dy * side * R * 0.12,
          y: m.y + dy * R * 0.3 + dx * side * R * 0.12,
          vx: dx * sp - dy * side * R * 1.1,
          vy: dy * sp + dx * side * R * 1.1,
          age: 0, life: ember ? 0.55 : 0.36 + Math.random() * 0.12,
          size: R * (ember ? 0.06 : 0.2 + Math.random() * 0.08), ember,
        });
      }
    }
    for (const f of this.flames) {
      f.age += dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      const drag = Math.max(0, 1 - 2.2 * dt);
      f.vx *= drag; f.vy *= drag;
      f.vy -= (p ? p.bodyR : 60) * 1.4 * dt; // 熱いので少し上へ
    }
    this.flames = this.flames.filter(f => f.age < f.life);
  }

  _drawFlames(ctx) {
    if (!this.flames || !this.flames.length) return;
    // マンガ風の炎:同じ玉を「赤→オレンジ→黄色」の順に小さくして重ねると、くっきりした炎の形になる
    const layers = [
      { k: 1.0, color: '#ff4a2e', until: 1 },
      { k: 0.72, color: '#ff9a1f', until: 0.75 },
      { k: 0.42, color: '#ffe45c', until: 0.45 },
      { k: 0.2, color: '#fffbe6', until: 0.22 },
    ];
    ctx.save();
    // 先っぽの煙
    ctx.fillStyle = 'rgba(120, 100, 100, 0.35)';
    for (const f of this.flames) {
      const t = f.age / f.life;
      if (f.ember || t < 0.8) continue;
      const r = f.size * (1 + t * 2.2);
      ctx.globalAlpha = (1 - t) * 4;
      ctx.beginPath(); ctx.arc(f.x, f.y - r * 0.3, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      for (const f of this.flames) {
        const t = f.age / f.life;
        if (f.ember || t > layer.until) continue;
        // 若い玉ほど小さく、だんだんふくらんでから縮む
        const grow = t < 0.6 ? 1 + t * 1.6 : (1 + 0.96) * (1 - (t - 0.6) / 0.4 * 0.7);
        const r = f.size * grow * layer.k;
        ctx.moveTo(f.x + r, f.y);
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // 火の粉
    ctx.fillStyle = '#ffe45c';
    for (const f of this.flames) {
      if (!f.ember) continue;
      ctx.globalAlpha = 1 - f.age / f.life;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawRampage(ctx) {
    const p = this.player, m = p.getMouth();
    // 口の中が赤く光る
    ctx.save();
    const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, p.bodyR * 0.9);
    glow.addColorStop(0, 'rgba(255, 210, 90, 0.75)');
    glow.addColorStop(1, 'rgba(255, 90, 30, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(m.x, m.y, p.bodyR * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 頭から湯気(辛い!)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(3, p.bodyR * 0.07);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (this.time * 1.6 + i / 3) % 1;
      const x = p.x + (i - 1) * p.bodyR * 0.45;
      const y = p.y - p.bodyR * (1.05 + ph * 0.7);
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y + p.bodyR * 0.25);
      ctx.quadraticCurveTo(x + p.bodyR * 0.14, y + p.bodyR * 0.12, x, y);
      ctx.quadraticCurveTo(x - p.bodyR * 0.14, y - p.bodyR * 0.12, x, y - p.bodyR * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 炭酸のゲップ:口から泡がぶわっと出る */
  _drawBurp(ctx) {
    const p = this.player, m = p.getMouth();
    const k = 1 - this.burpTimer / 0.6;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = 'rgba(155, 231, 245, 0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const a = Math.atan2(p.dirY, p.dirX) + Math.PI + (i - 3) * 0.35;
      const d = p.bodyR * (0.4 + k * 1.4) * (0.7 + (i % 3) * 0.2);
      const r = p.bodyR * (0.12 + (i % 2) * 0.08) * (1 - k * 0.5);
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /** しびれている間、体のまわりに稲妻が走る */
  _drawShock(ctx, p = this.player) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const seed = Math.floor(this.time * 18);
    // 影ぼかし(shadowBlur)は重いので、太い半透明の線を下に重ねて光らせる
    for (const [w, c] of [[10, 'rgba(255, 243, 160, 0.45)'], [4, '#ffe14d']]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (seed * 1.3 + i * 1.26) % (Math.PI * 2);
        const r0 = p.bodyR * 0.7, r1 = p.bodyR * 1.35;
        ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0);
        ctx.lineTo(p.x + Math.cos(a + 0.18) * (r0 + r1) / 2, p.y + Math.sin(a + 0.18) * (r0 + r1) / 2);
        ctx.lineTo(p.x + Math.cos(a - 0.05) * r1, p.y + Math.sin(a - 0.05) * r1);
      }
      ctx.stroke();
    }
    // 体がチカチカ光る
    if (seed % 2 === 0) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#fff6a8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.bodyR * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 目が回っている間、頭の上を星が回る */
  _drawStun(ctx) {
    const p = this.player;
    ctx.save();
    ctx.fillStyle = '#ffd24d';
    ctx.strokeStyle = '#5a3b3f';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = this.time * 7 + (i / 3) * Math.PI * 2;
      const x = p.x + Math.cos(a) * p.bodyR * 0.7;
      const y = p.y - p.bodyR * 1.05 + Math.sin(a) * p.bodyR * 0.2;
      ctx.save();
      ctx.translate(x, y);
      this.particles._starPath(ctx, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
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
