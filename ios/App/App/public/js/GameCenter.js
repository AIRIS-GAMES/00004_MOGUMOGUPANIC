/* =========================================================
 * GameCenter.js - Game Center のランキング(iOS アプリの時だけ動く)
 *  - 起動時にサインイン(未設定ならOSが案内を出す)
 *  - エンドレスのスコアを送る。送れなかった分は覚えておいて次のサインイン時に送る
 *  - ブラウザ版では何もしない(ランキングボタンも出さない)
 *  ネイティブ側: ios/App/App/GameCenterPlugin.swift
 * ========================================================= */
class GameCenter {
  static PENDING_KEY = 'mogu.gcPending';
  static signedIn = false;

  static plugin() {
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    if (cap.getPlatform && cap.getPlatform() !== 'ios') return null;
    return (cap.Plugins && cap.Plugins.GameCenter) || null;
  }

  /** ランキングボタンを出せるか(iOS アプリ内) */
  static available() { return !!GameCenter.plugin(); }

  static async signIn() {
    const p = GameCenter.plugin();
    if (!p) return false;
    try {
      const res = await p.authenticate();
      GameCenter.signedIn = !!(res && res.authenticated);
      if (GameCenter.signedIn) GameCenter._flush();
    } catch (_) {
      GameCenter.signedIn = false;
    }
    return GameCenter.signedIn;
  }

  static async submitScore(leaderboardId, score) {
    const p = GameCenter.plugin();
    if (!p || !(score > 0)) return false;
    try {
      if (!GameCenter.signedIn) throw new Error('not signed in');
      await p.submitScore({ leaderboardId, score: Math.floor(score) });
      return true;
    } catch (_) {
      GameCenter._remember(leaderboardId, score);
      return false;
    }
  }

  static async showLeaderboard(leaderboardId) {
    const p = GameCenter.plugin();
    if (!p) return;
    try {
      if (!GameCenter.signedIn) await GameCenter.signIn();
      await p.showLeaderboard({ leaderboardId });
    } catch (_) { /* サインインを断られた等 */ }
  }

  static _pending() {
    try { return JSON.parse(localStorage.getItem(GameCenter.PENDING_KEY) || '{}') || {}; } catch (_) { return {}; }
  }

  static _remember(id, score) {
    const p = GameCenter._pending();
    p[id] = Math.max(p[id] || 0, Math.floor(score));
    try { localStorage.setItem(GameCenter.PENDING_KEY, JSON.stringify(p)); } catch (_) { /* 保存できない環境 */ }
  }

  static async _flush() {
    const pending = GameCenter._pending();
    const plugin = GameCenter.plugin();
    if (!plugin) return;
    for (const [id, score] of Object.entries(pending)) {
      try {
        await plugin.submitScore({ leaderboardId: id, score });
        delete pending[id];
      } catch (_) { /* 次の機会に */ }
    }
    try { localStorage.setItem(GameCenter.PENDING_KEY, JSON.stringify(pending)); } catch (_) { /* 保存できない環境 */ }
  }
}
