/* =========================================================
 * Analytics - GameAnalytics(HTML5 SDK)ラッパー
 *
 * ・SDK(js/GameAnalytics.min.js)は同梱。window.gameanalytics
 *   として公開される。
 * ・プライバシー同意が得られた時だけ初期化する(同意連動)。
 *   同意前・SDK未ロード・計測失敗のいずれでも全メソッドは
 *   no-op になり、ゲーム本体は決して止まらない。
 * ・Capacitor でネイティブ化した場合も同じコードで動く。
 *   ビルド文字列にプラットフォーム名を入れて web / ios /
 *   android をダッシュボード上で区別できるようにする。
 *
 * 命名規則(GameAnalytics のバリデーション):
 *   currency  : 英字のみ            → 'coins'
 *   itemType  : 英数と _ - . 等      → 'skin' 'boost' ...
 *   progression: 同上                → 'stage_01'
 *   design eventId: ':' 区切り最大5階層
 * ========================================================= */
class Analytics {
  static GA = null;       // gameanalytics.GameAnalytics 参照
  static ready = false;   // initialize 完了フラグ
  static _config = null;  // { gameKey, secretKey }

  /** キーを登録する(初期化はまだ行わない) */
  static configure(gameKey, secretKey) {
    Analytics._config = { gameKey, secretKey };
  }

  /**
   * 同意が得られた時に一度だけ呼ぶ。冪等。
   * ここで初めて SDK を初期化しセッションを開始する。
   */
  static enableAndInit() {
    if (Analytics.ready || !Analytics._config) return;
    const root = window.gameanalytics;
    if (!root || !root.GameAnalytics) return; // SDK未ロードでも計測せず続行
    const GA = root.GameAnalytics;
    try {
      // Capacitor 検出でプラットフォーム別ビルドを設定(web/ios/android)
      const platform = (window.Capacitor && window.Capacitor.getPlatform)
        ? window.Capacitor.getPlatform() : 'web';
      GA.configureBuild(`${platform}-1.0.0`);

      // リソースイベントで使う通貨・アイテム種別は init 前に宣言が必要
      GA.configureAvailableResourceCurrencies(['coins']);
      GA.configureAvailableResourceItemTypes(
        ['daily_bonus', 'stage_reward', 'skin', 'effect', 'boost']);

      GA.initialize(Analytics._config.gameKey, Analytics._config.secretKey);
      Analytics.GA = GA;
      Analytics.ready = true;
    } catch (_) { /* 計測できなくてもゲームは継続 */ }
  }

  /* ---- イベント送信(すべて未初期化なら no-op) ---- */

  static _stageName(stageId) {
    return `stage_${String(stageId).padStart(2, '0')}`;
  }

  /** ステージ開始 */
  static stageStart(stageId) {
    if (!Analytics.ready) return;
    try {
      Analytics.GA.addProgressionEvent(
        gameanalytics.EGAProgressionStatus.Start, Analytics._stageName(stageId));
    } catch (_) {}
  }

  /** ステージクリア(スコア付き) */
  static stageComplete(stageId, score) {
    if (!Analytics.ready) return;
    try {
      Analytics.GA.addProgressionEvent(
        gameanalytics.EGAProgressionStatus.Complete,
        Analytics._stageName(stageId), undefined, undefined, Math.round(score));
    } catch (_) {}
  }

  /** ステージ失敗(スコア付き) */
  static stageFail(stageId, score) {
    if (!Analytics.ready) return;
    try {
      Analytics.GA.addProgressionEvent(
        gameanalytics.EGAProgressionStatus.Fail,
        Analytics._stageName(stageId), undefined, undefined, Math.round(score));
    } catch (_) {}
  }

  /** コイン獲得(source) */
  static coinSource(amount, itemType, itemId) {
    if (!Analytics.ready || amount <= 0) return;
    try {
      Analytics.GA.addResourceEvent(
        gameanalytics.EGAResourceFlowType.Source, 'coins', amount, itemType, itemId);
    } catch (_) {}
  }

  /** コイン消費(sink) */
  static coinSink(amount, itemType, itemId) {
    if (!Analytics.ready || amount <= 0) return;
    try {
      Analytics.GA.addResourceEvent(
        gameanalytics.EGAResourceFlowType.Sink, 'coins', amount, itemType, itemId);
    } catch (_) {}
  }

  /** 任意のデザインイベント(eventId は ':' 区切り、value は任意の数値) */
  static design(eventId, value) {
    if (!Analytics.ready) return;
    try {
      if (typeof value === 'number') Analytics.GA.addDesignEvent(eventId, value);
      else Analytics.GA.addDesignEvent(eventId);
    } catch (_) {}
  }
}
