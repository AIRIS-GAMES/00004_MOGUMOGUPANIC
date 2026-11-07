/* =========================================================
 * Endless.js - エンドレスモード(時間回復サバイバル)
 *  - 残り30秒でスタート。食べると少し時間が増える(大きい物ほど多い)
 *  - スコアが区切りを越えるたびに次のエリアへ。街の見た目・ギミック・危険物が変わり、
 *    だんだん難しくなる(エリアが進むほど食べて増える時間は減る)
 *  - 時間が0になったら終わり。スコアでランキング(Game Center)
 * ========================================================= */
class Endless {
  static UNLOCK_STAGE = 3;       // この面をクリアすると遊べる
  static START_TIME = 30;
  static MAX_TIME = 45;          // 貯められる時間の上限
  static LEADERBOARD = 'mogumogu.endless';

  /** エリアの並び(街のテーマは本編と同じ順で、11エリア目からはぐるぐる回る) */
  static AREA_THEMES = ['park', 'town', 'city', 'shopping', 'office', 'factory', 'port', 'airport', 'future', 'mega'];

  /** エリア n を抜けるのに必要な累計スコア */
  static BASE = 2500;    // エリア1を抜けるスコア
  static GROWTH = 1.35;   // 区切りの伸び方(大きくなるほど速く稼げるので、区切りも大きくしていく)
  static threshold(area) {
    const g = Endless.GROWTH;
    return Math.round(Endless.BASE * (Math.pow(g, area) - 1) / (g - 1) / 100) * 100;
  }

  static areaFor(score) {
    let area = 1;
    while (score >= Endless.threshold(area)) area++;
    return area;
  }

  /** 難しさの段階(本編のステージ番号として各ギミックに渡す。10が最大) */
  static level(area) { return Math.min(10, area); }

  /** そのエリアのステージギミック(エリア1はなし。2から本編の2〜10面のものを順番に) */
  static gimmickStage(area) { return area <= 1 ? null : ((area - 2) % 19) + 2; }  // 2〜20面のギミックを順番に

  static stageFor(area) {
    const theme = Endless.AREA_THEMES[(area - 1) % Endless.AREA_THEMES.length];
    const base = Game.STAGES.find(s => s.theme === theme) || Game.STAGES[0];
    return {
      id: Endless.level(area),
      endless: true,
      area,
      name: base.name,
      theme,
      time: Endless.START_TIME,
      targetScore: Endless.threshold(area),
      starTimes: null,
      rewardCoins: 0,
      story: '',
      clearText: '',
    };
  }

  /** 食べた時に増える時間(秒)。大きい物ほど多く、エリアが進むほど少なく */
  static timeGain(type, area) {
    const base = Math.min(3, 0.55 + type.req * 0.3);
    const decay = Math.max(Endless.MIN_DECAY, 1 - (area - 1) * Endless.DECAY);
    return base * decay;
  }
  static DECAY = 0.07;
  static MIN_DECAY = 0.15;

  /** 毎秒じわじわ減る量(エリアが進むほど時間の流れが速い) */
  static drain(area) { return 1 + Math.min(Endless.MAX_DRAIN, (area - 1) * Endless.DRAIN); }
  static DRAIN = 0.07;
  static MAX_DRAIN = 1.5;

  /** 次のエリアに入った時のおまけ時間(先に進むほど少ない) */
  static areaBonus(area) { return Math.max(2, 6 - area * 0.5); }

  /** スタート時の紹介 */
  static introStage() {
    return { introLabel: 'ENDLESS', name: 'エンドレス', story: '食べると時間がふえる。どこまで行けるかな？' };
  }

  /** ごほうびコイン:到達エリアに比例(スコアは後半ほど桁が増えるので使わない) */
  static coinsFor(area) { return Math.min(250, area * 15); }

  static unlocked() { return Storage.hasClearedStage(Endless.UNLOCK_STAGE); }

  static best() {
    const s = Storage.getObject(Storage.KEYS.endless, {});
    return { score: Math.max(0, Number(s.score) || 0), area: Math.max(0, Number(s.area) || 0) };
  }

  /** 結果を記録。自己ベストを更新したら true */
  static record(score, area) {
    const best = Endless.best();
    const isBest = score > best.score;
    if (isBest) Storage.set(Storage.KEYS.endless, { score, area: Math.max(area, best.area) });
    else if (area > best.area) Storage.set(Storage.KEYS.endless, { score: best.score, area });
    return isBest;
  }
}
