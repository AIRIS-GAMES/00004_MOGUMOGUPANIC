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
      const timer = setTimeout(() => finish(new Error(`画像の読み込みがタイムアウト: ${src}`)), 15000);
      function finish(error) {
        clearTimeout(timer);
        img.onload = img.onerror = null;
        if (error) reject(error);
        else resolve(img);
      }
      img.onload = () => finish();
      img.onerror = () => finish(new Error(`画像の読み込みに失敗: ${src}`));
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
      const consent = localStorage.getItem(key);
      if (consent === 'declined') return state;
      if (consent === 'accepted') {
        window.__airisCookieConsent = true;
        return state;
      }
    } catch (_) { /* localStorage不可なら毎回表示 */ }

    state.pending = true;
    state.show = () => banner.classList.remove('hidden');
    state.hide = () => banner.classList.add('hidden');

    const dismiss = (accepted) => {
      try { localStorage.setItem(key, accepted ? 'accepted' : 'declined'); } catch (_) {}
      if (accepted) {
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

  async function start() {
    let phase = '保存データ';
    try {
      await Storage.init();

      phase = '初期設定';
      const ui = new UI();
      Analytics.configure(GA_GAME_KEY, GA_SECRET_KEY);
      const privacy = setupPrivacyBanner();
      // 既に同意済みのユーザー(再訪問)はこの時点で計測を開始
      if (window.__airisCookieConsent) Analytics.enableAndInit();
      ui.showScreen('splash');
      const splashDelay = new Promise(resolve => setTimeout(resolve, 2000));

      const audio = new AudioSys();
      // 最初のユーザー操作でファイル音声の再生を許可する
      window.addEventListener('pointerdown', () => audio.unlock());

      // スキン画像(開口/通常)をすべて読み込む
      const images = {};
      let done = 0;
      const total = SKINS.length * 2;

      phase = '画像';
      const preload = Promise.all(SKINS.map(async (skin) => {
        const [open, closed] = await Promise.all([
          loadImage(skin.openSrc).then(img => { ui.setLoadProgress(++done / total); return img; }),
          loadImage(skin.closedSrc).then(img => { ui.setLoadProgress(++done / total); return img; }),
        ]);
        images[skin.id] = { open: shrink(open), closed: shrink(closed) };
      }));
      await Promise.all([preload, splashDelay.then(() => ui.showScreen('loading'))]);

      phase = 'ゲーム';
      const game = new Game(document.getElementById('game'), images, ui, audio, privacy);
      if (window.OhSunCollaboration) game.collaboration = new window.OhSunCollaboration(game);
      game.showTitle();
      document.addEventListener('visibilitychange', () => {
        audio.setBackgroundPaused(document.hidden, 'visibility');
        Storage.flush();
        if (!document.hidden) game.checkDailyBonus();
      });

      const appPlugin = window.Capacitor?.Plugins?.App;
      if (appPlugin) {
        appPlugin.addListener('appStateChange', ({ isActive }) => {
          audio.setBackgroundPaused(!isActive);
          Storage.flush();
          if (isActive) game.checkDailyBonus();
          else {
            game.pauseGame();
          }
        });
      }
        window.__game = game; // デバッグ用フック(コンソールから状態確認できる)
        window.addEventListener('pagehide', () => audio.setBackgroundPaused(true, 'page'));
        window.addEventListener('pageshow', () => audio.setBackgroundPaused(false, 'page'));

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
    } catch (error) {
      console.error(`Startup failed (${phase})`, error);
      document.querySelectorAll('#app > .screen').forEach(el => el.classList.add('hidden'));
      document.getElementById('screen-loading').classList.remove('hidden');
      document.querySelector('.load-text').textContent =
        `起動できませんでした（${phase}）：${error.message || error}`;
      const retry = document.createElement('button');
      retry.className = 'btn btn-primary';
      retry.textContent = 'もう一度ためす';
      retry.addEventListener('click', () => window.location.reload());
      document.getElementById('screen-loading').appendChild(retry);
    }
  }
  // Start once the DOM is ready; unrelated resource loads must not hold startup.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
