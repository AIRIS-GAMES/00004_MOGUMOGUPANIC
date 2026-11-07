/* =========================================================
 * Retention.js - 継続プレイの仕組み
 *  - 連続ログインボーナス(7日周期)の報酬テーブル
 *  - ステージ★評価(クリアタイム基準)と★ボーナス
 *  - デイリーミッション(毎日3つ・日付で決まる)
 *  - 初回チュートリアルの完了フラグ
 * 保存は Storage 経由。DOM には触らない(UI は Game/UI 側)。
 * ========================================================= */
class Retention {
  /** 連続ログイン 1〜7日目の報酬。7日目のあとは1日目に戻る */
  static STREAK_REWARDS = [100, 150, 200, 250, 300, 400, 1000];

  /** ★到達時に一度だけもらえる追加報酬(ステージ初回報酬に対する割合) */
  static STAR_BONUS_RATE = { 2: 0.3, 3: 0.6 };

  /**
   * デイリーミッション候補。毎日 tier ごとに1つずつ選ばれる。
   * stat : recordRun に渡す値の名前
   * mode : sum = 1日の合計 / max = 1プレイでの最大
   */
  static MISSIONS = [
    { id: 'play3',   tier: 0, stat: 'plays',    mode: 'sum', goal: 3,   reward: 80,  text: '3回あそぶ' },
    { id: 'eat100',  tier: 0, stat: 'eaten',    mode: 'sum', goal: 100, reward: 80,  text: '合計100こ すいこむ' },
    { id: 'clear2',  tier: 1, stat: 'clears',   mode: 'sum', goal: 2,   reward: 120, text: 'ステージを2回クリア' },
    { id: 'vacuum3', tier: 1, stat: 'vacuums',  mode: 'sum', goal: 3,   reward: 120, text: 'コスミーフィーバーを3回発動' },
    { id: 'combo15', tier: 1, stat: 'maxCombo', mode: 'max', goal: 15,  reward: 120, text: '1回のプレイで15コンボ' },
    { id: 'star3',   tier: 2, stat: 'stars',    mode: 'max', goal: 3,   reward: 200, text: 'どこかのステージを★3でクリア' },
    { id: 'combo30', tier: 2, stat: 'maxCombo', mode: 'max', goal: 30,  reward: 200, text: '1回のプレイで30コンボ' },
    { id: 'eat300',  tier: 2, stat: 'eaten',    mode: 'sum', goal: 300, reward: 200, text: '合計300こ すいこむ' },
  ];

  /* ---------------- ★評価 ---------------- */

  /** クリアタイムから★数(0〜3)。stage.starTimes = [★2の秒数, ★3の秒数] */
  static starsFor(stage, cleared, clearTime) {
    if (!cleared) return 0;
    const [two, three] = stage.starTimes || [Infinity, Infinity];
    if (clearTime == null || !Number.isFinite(clearTime)) return 1;
    if (clearTime <= three) return 3;
    if (clearTime <= two) return 2;
    return 1;
  }

  /** 保存済みのベストクリアタイムからステージの★数を求める */
  static stageStars(stage) {
    if (!Storage.hasClearedStage(stage.id)) return 0;
    return Retention.starsFor(stage, true, Storage.getClearTime(stage.id));
  }

  static totalStars(stages) {
    return stages.reduce((sum, stage) => sum + Retention.stageStars(stage), 0);
  }

  /**
   * 今回のプレイで新しく到達した★段階のボーナスを付与する。
   * 既存プレイヤーの過去記録には遡って払わない(新記録を出した時に付与)。
   * @returns {number} 付与したコイン
   */
  static awardStarBonus(stage, runStars) {
    const key = Storage.KEYS.starRewards;
    const map = Storage.getObject(key, {});
    const paid = Math.max(1, Number(map[stage.id]) || 1);
    let coins = 0;
    for (let level = paid + 1; level <= runStars; level++) {
      coins += Retention.starBonusAmount(stage, level);
    }
    if (runStars > paid) {
      map[stage.id] = runStars;
      Storage.set(key, map);
    }
    if (coins > 0) Storage.addCoins(coins);
    return coins;
  }

  static starBonusAmount(stage, level) {
    const rate = Retention.STAR_BONUS_RATE[level] || 0;
    return Math.round((stage.rewardCoins * rate) / 10) * 10;
  }

  /* ---------------- デイリーミッション ---------------- */

  /** 日付文字列から決まる疑似乱数(端末間で同じ日に同じミッション) */
  static _hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  static pickMissionIds(dateKey) {
    const ids = [];
    for (let tier = 0; tier < 3; tier++) {
      const options = Retention.MISSIONS.filter(m => m.tier === tier);
      ids.push(options[Retention._hash(`${dateKey}:${tier}`) % options.length].id);
    }
    return ids;
  }

  /** 今日のミッション状態(日付が変わっていれば作り直して保存) */
  static missionState(date = new Date()) {
    const today = Storage.getLocalDateKey(date);
    const saved = Storage.getObject(Storage.KEYS.missions, null);
    if (saved && saved.date === today && Array.isArray(saved.ids) && saved.ids.length === 3 &&
        saved.ids.every(id => Retention.MISSIONS.some(m => m.id === id))) {
      saved.progress = saved.progress && typeof saved.progress === 'object' ? saved.progress : {};
      saved.claimed = Array.isArray(saved.claimed) ? saved.claimed : [];
      return saved;
    }
    const state = { date: today, ids: Retention.pickMissionIds(today), progress: {}, claimed: [] };
    Storage.set(Storage.KEYS.missions, state);
    return state;
  }

  /** 表示用: [{ ...定義, progress, done, claimed }] */
  static missions(date) {
    const state = Retention.missionState(date);
    return state.ids.map(id => {
      const def = Retention.MISSIONS.find(m => m.id === id);
      const progress = Math.min(def.goal, Math.max(0, Number(state.progress[id]) || 0));
      return { ...def, progress, done: progress >= def.goal, claimed: state.claimed.includes(id) };
    });
  }

  /**
   * 1プレイ分の結果を反映する。
   * @param {object} run { plays, clears, eaten, vacuums, maxCombo, stars }
   * @returns {Array} 今回新たに達成したミッション
   */
  static recordRun(run, date) {
    const state = Retention.missionState(date);
    const completed = [];
    for (const id of state.ids) {
      const def = Retention.MISSIONS.find(m => m.id === id);
      const before = Math.max(0, Number(state.progress[id]) || 0);
      const value = Math.max(0, Number(run[def.stat]) || 0);
      const after = Math.min(def.goal, def.mode === 'max' ? Math.max(before, value) : before + value);
      state.progress[id] = after;
      if (before < def.goal && after >= def.goal) completed.push(def);
    }
    Storage.set(Storage.KEYS.missions, state);
    return completed;
  }

  /** 達成済みミッションの報酬を受け取る。戻り値は付与コイン(不可なら0) */
  static claimMission(id, date) {
    const state = Retention.missionState(date);
    const def = Retention.MISSIONS.find(m => m.id === id);
    if (!def || !state.ids.includes(id) || state.claimed.includes(id)) return 0;
    if ((Number(state.progress[id]) || 0) < def.goal) return 0;
    state.claimed.push(id);
    Storage.set(Storage.KEYS.missions, state);
    Storage.addCoins(def.reward);
    return def.reward;
  }

  static claimableCount(date) {
    return Retention.missions(date).filter(m => m.done && !m.claimed).length;
  }

  /* ---------------- チュートリアル ---------------- */

  static tutorialDone() { return Storage.get(Storage.KEYS.tutorialDone, false) === true; }
  static markTutorialDone() { Storage.set(Storage.KEYS.tutorialDone, true); }
}
