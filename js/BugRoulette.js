/* =========================================================
 * BugRoulette.js - ステージ開始時の「バグルーレット」
 * ステージ紹介のあいだにルーレットが回り、15秒のあいだ(「なにもなし」もある)
 * コスミーの体や操作に異常(バグ)がかかる。
 * 不利なバグほどスコア倍率で埋め合わせる。
 *
 * 効果は Player のパラメータとして持たせる:
 *   sizeMul  : 体と口の大きさ
 *   eatBonus : 食べられるサイズ段階の上乗せ(おっきくなるバグ)
 *   speedMul : 移動速度
 *   invert   : 操作の向きが逆になる
 *   slippery : 止まれず滑る(慣性)
 *   scoreMul : 獲得スコア倍率
 * ========================================================= */
class BugRoulette {
  // 円盤の回り方。scripts/generate-sfx.cjs のカチカチ音もこの値で作っている
  static DURATION = 15;    // バグが続く秒数(切れると元に戻る)
  static SPIN = 2.6;       // 回っている秒数
  static REVEAL = 1.3;     // 止まってから結果を見せる秒数
  static TURN_DEG = 1440;  // 回る角度(4回転)
  static PEG_DEG = 30;     // 外周ピンの間隔

  static BUGS = [
    {
      id: 'mini', name: 'ちっちゃくなるバグ', short: 'ちっちゃく', color: '#58cfee',
      description: '体が小さくなった！ 足は速いよ',
      sizeMul: 0.65, speedMul: 1.35, scoreMul: 1.2,
    },
    {
      id: 'giant', name: 'おっきくなるバグ', short: 'おっきく', color: '#ff7438',
      description: '体が大きくなった！ 大物も食べられる',
      sizeMul: 1.5, eatBonus: 1, scoreMul: 1,
    },
    {
      id: 'confuse', name: 'こんらんバグ', short: 'こんらん', color: '#b388ff',
      description: '操作がさかさまに！',
      invert: true, scoreMul: 1.5,
    },
    {
      id: 'slippery', name: 'つるつるバグ', short: 'つるつる', color: '#6cb9ff',
      description: '止まれない！ すべって進む',
      slippery: true, speedMul: 1.15, scoreMul: 1.3,
    },
    {
      id: 'none', name: 'なにもなし', short: 'なにもなし', color: '#ffc8d6',
      description: 'なにも起きなかった！ いつも通り',
      none: true, scoreMul: 1,
    },
  ];

  /** ルーレットが回り始めるステージ(1〜3面は操作に慣れてもらうためバグなし) */
  static FROM_STAGE = 4;

  /** ルーレットを回すか */
  static enabledFor(stageId) {
    return stageId >= BugRoulette.FROM_STAGE;
  }

  static pick(random = Math.random) {
    const list = BugRoulette.BUGS;
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  }

  /**
   * 円盤をどう回すか。止まる角度のズレは30度刻みにして、
   * ピンが針を通過するタイミング(=カチカチ音)が毎回同じになるようにする。
   */
  static wheelPlan(bug, random = Math.random) {
    const index = Math.max(0, BugRoulette.BUGS.indexOf(bug));
    const step = 360 / BugRoulette.BUGS.length;
    // 止まる角度は「ピンの位置(30度刻み+15度)」にそろえる。区切りの真ん中から±30度の中で選ぶ
    const base = -(index * step + step / 2);
    const P = BugRoulette.PEG_DEG, mod = (a, n) => ((a % n) + n) % n;
    const options = [];
    for (let v = Math.ceil(base - P); v <= Math.floor(base + P); v++) if (mod(v, P) === P / 2) options.push(v);
    const final = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
    return { index, final, start: final - BugRoulette.TURN_DEG };
  }

  /** 経過時間から円盤の角度(最初速く、だんだん遅くなる) */
  static wheelAngle(plan, t) {
    const p = Math.max(0, Math.min(1, t / BugRoulette.SPIN));
    return plan.start + BugRoulette.TURN_DEG * (1 - Math.pow(1 - p, 3));
  }

  static get(id) {
    return BugRoulette.BUGS.find(bug => bug.id === id) || null;
  }

}
