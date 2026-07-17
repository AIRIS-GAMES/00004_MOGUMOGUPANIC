/* =========================================================
 * main.js - エントリーポイント
 * 画像のプリロード → ゲーム起動。
 * 大きい元画像は一度オフスクリーンキャンバスに縮小して
 * 描画コスト・メモリを抑える(モバイル対策)。
 * ========================================================= */
(() => {
  'use strict';

  const ASSET_MAX_WIDTH = 512; // ゲーム内描画に十分な解像度

  // GameAnalytics(HTML5)のキー。Secret Key は HTML5 SDK では
  // クライアント埋め込み前提の署名鍵で、サーバー秘密鍵とは性質が異なる。
  const GA_GAME_KEY   = '6b8da6650470f97fedbf9b9f38c71167';
  const GA_SECRET_KEY = '160ed5005e955b281fb232d1157e86de101df4ba';

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`画像の読み込みに失敗: ${src}`));
      img.src = src;
    });
  }

  /** 元画像を最大幅 ASSET_MAX_WIDTH に縮小したキャンバスを返す */
  function shrink(img) {
    const scale = Math.min(1, ASSET_MAX_WIDTH / img.width);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /**
   * プライバシーバナーの状態管理。
   * 表示タイミングは Game 側が制御する(タイトル表示中のみ出し、
   * ログインボーナス等と重ならないよう直列化するため)。
   * @returns {{pending:boolean, show:Function, hide:Function, onDismiss:?Function}}
   */
  function setupPrivacyBanner() {
    const banner = document.getElementById('privacy-banner');
    const accept = document.getElementById('btn-privacy-accept');
    const close = document.getElementById('btn-privacy-close');
    const state = { pending: false, show: () => {}, hide: () => {}, onDismiss: null };
    if (!banner || !accept || !close) return state;

    const key = 'airisPrivacyConsent';
    try {
      if (localStorage.getItem(key) === 'accepted') {
        window.__airisCookieConsent = true;
        return state;
      }
    } catch (_) { /* localStorage不可なら毎回表示 */ }

    state.pending = true;
    state.show = () => banner.classList.remove('hidden');
    state.hide = () => banner.classList.add('hidden');

    const dismiss = (accepted) => {
      if (accepted) {
        try { localStorage.setItem(key, 'accepted'); } catch (_) {}
        window.__airisCookieConsent = true;
        Analytics.enableAndInit(); // 同意時のみ計測開始
      }
      state.pending = false;
      banner.classList.add('hidden');
      if (state.onDismiss) state.onDismiss();
    };
    accept.addEventListener('click', () => dismiss(true));
    close.addEventListener('click', () => dismiss(false));
    return state;
  }

   window.addEventListener('load', async () => {
    await Storage.init();

    const admob = window.Capacitor?.Plugins?.AdMob;

   if (admob) {
   try {
    await admob.initialize();

    const prepareAd = async () => {
    await admob.prepareInterstitial({
        adId: 'ca-app-pub-3169496152943405/3757878182',
        isTesting: false
    });
};

    await prepareAd();

    window.showInterstitialAd = async () => {
    try {
    await admob.showInterstitial();
    await prepareAd();
    } catch (error) {
    console.error('広告を表示できませんでした', error);
    try {
    await prepareAd();
    } catch (_) {}
    }
    };
   } catch (error) {
    console.error('AdMobの初期化に失敗しました', error);
  }
   }

    const ui = new UI();
    Analytics.configure(GA_GAME_KEY, GA_SECRET_KEY);
    const privacy = setupPrivacyBanner();
    // 既に同意済みのユーザー(再訪問)はこの時点で計測を開始
    if (window.__airisCookieConsent) Analytics.enableAndInit();
    ui.showScreen('splash');
    const splashDelay = new Promise(resolve => setTimeout(resolve, 2000));

    const audio = new AudioSys();
    // モバイルの自動再生制限対策:最初のタップで AudioContext を有効化
    window.addEventListener('pointerdown', () => audio.unlock());

    // スキン画像(開口/通常)をすべて読み込む
    const images = {};
    let done = 0;
    const total = SKINS.length * 2;

    try {
      const preload = Promise.all(SKINS.map(async (skin) => {
        const [open, closed] = await Promise.all([
          loadImage(skin.openSrc).then(img => { ui.setLoadProgress(++done / total); return img; }),
          loadImage(skin.closedSrc).then(img => { ui.setLoadProgress(++done / total); return img; }),
        ]);
        images[skin.id] = { open: shrink(open), closed: shrink(closed) };
      }));
      await splashDelay;
      ui.showScreen('loading');
      await preload;
    } catch (err) {
      document.querySelector('.load-text').textContent =
        'よみこみに しっぱいしました... リロードしてね';
      console.error(err);
      return;
    }

    const game = new Game(document.getElementById('game'), images, ui, audio, privacy);
    game.showTitle();
    document.addEventListener('visibilitychange', () => {
      audio.setBackgroundPaused(document.hidden);
      if (document.hidden) Storage.flush();
      else game.checkDailyBonus();
    });

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin) {
      appPlugin.addListener('appStateChange', ({ isActive }) => {
        audio.setBackgroundPaused(!isActive);
        if (isActive) game.checkDailyBonus();
        else Storage.flush();
      });
    }
    window.__game = game; // デバッグ用フック(コンソールから状態確認できる)

    // Capacitor(iOS/Android)では target=_blank の外部リンクが WebView 内で
    // 開けないため、Browser プラグイン経由でシステムブラウザに委譲する。
    // Web(通常ブラウザ)では Capacitor が無いので通常のリンク動作のまま。
    const browser = window.Capacitor?.Plugins?.Browser;
    if (browser) {
      document.addEventListener('click', (e) => {
        const link = e.target.closest?.('a[href^="http"]');
        if (!link) return;
        e.preventDefault();
        browser.open({ url: link.href }).catch(() => {});
      });
    }
  });
})();
