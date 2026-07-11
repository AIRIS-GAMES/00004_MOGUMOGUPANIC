/* =========================================================
 * Storage - localStorage ラッパー
 * スキン選択・ベストスコア・サウンド設定を永続化する。
 * プライベートブラウズ等で localStorage が使えない環境でも
 * 例外を握りつぶしてゲームが止まらないようにする。
 * ========================================================= */
class Storage {
  static KEYS = {
    skin: 'mogu.skin',
    best: 'mogu.best',
    sound: 'mogu.sound',
    coins: 'mogu.coins',
    unlockedStage: 'mogu.unlockedStage',
    clearedStages: 'mogu.clearedStages',
    lastLoginDate: 'mogu.lastLoginDate',
    ownedSkins: 'mogu.ownedSkins',
    effect: 'mogu.effect',
    ownedEffects: 'mogu.ownedEffects',
    lastSeenAt: 'mogu.lastSeenAt',
    lastClaimAt: 'mogu.lastClaimAt',
    stageBests: 'mogu.stageBests',
  };

  static cache = new Map();
  static preferences = null;
  static pendingWrites = Promise.resolve();

  static async init() {
    const capacitor = window.Capacitor;
    const available = capacitor?.isPluginAvailable?.('Preferences') ?? Boolean(capacitor?.Plugins?.Preferences);
    Storage.preferences = available ? capacitor?.Plugins?.Preferences || null : null;
    if (!Storage.preferences) return;

    for (const key of Object.values(Storage.KEYS)) {
      try {
        const result = await Storage.preferences.get({ key });
        let raw = result.value;
        if (raw === null) {
          raw = localStorage.getItem(key);
          if (raw !== null) await Storage.preferences.set({ key, value: raw });
        }
        if (raw !== null) Storage.cache.set(key, raw);
      } catch (_) { /* localStorage fallback remains available */ }
    }
  }

  static get(key, fallback) {
    try {
      const raw = Storage.cache.has(key) ? Storage.cache.get(key) : localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  static set(key, value) {
    try {
      const raw = JSON.stringify(value);
      Storage.cache.set(key, raw);
      localStorage.setItem(key, raw);
      if (Storage.preferences) {
        Storage.pendingWrites = Storage.pendingWrites
          .then(() => Storage.preferences.set({ key, value: raw }))
          .catch(() => {});
      }
    } catch (_) { /* 保存できなくてもゲーム続行 */ }
  }

  static async flush() { await Storage.pendingWrites; }

  static getSkin()   { return Storage.get(Storage.KEYS.skin, 'red'); }
  static setSkin(id) { Storage.set(Storage.KEYS.skin, id); }

  static getBest()  { return Storage.get(Storage.KEYS.best, 0); }
  static setBest(v) { Storage.set(Storage.KEYS.best, v); }

  /** ステージ別ベストスコア。{ [stageId]: score } を保持 */
  static getStageBest(stageId) {
    const map = Storage.get(Storage.KEYS.stageBests, {});
    const v = map && typeof map === 'object' ? Number(map[stageId]) : 0;
    return Number.isFinite(v) ? v : 0;
  }
  static setStageBest(stageId, score) {
    const raw = Storage.get(Storage.KEYS.stageBests, {});
    const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    map[stageId] = Math.max(0, Math.floor(score));
    Storage.set(Storage.KEYS.stageBests, map);
  }

  static getSound()  { return Storage.get(Storage.KEYS.sound, true); }
  static setSound(v) { Storage.set(Storage.KEYS.sound, v); }

  static getCoins() { return Math.max(0, Number(Storage.get(Storage.KEYS.coins, 0)) || 0); }
  static setCoins(v) { Storage.set(Storage.KEYS.coins, Math.max(0, Math.floor(v))); }
  static addCoins(v) {
    const total = Storage.getCoins() + Math.max(0, Math.floor(v));
    Storage.setCoins(total);
    return total;
  }

  static getUnlockedStage() {
    return Math.max(1, Math.floor(Number(Storage.get(Storage.KEYS.unlockedStage, 1)) || 1));
  }
  static setUnlockedStage(v) { Storage.set(Storage.KEYS.unlockedStage, Math.max(1, Math.floor(v))); }

  static getClearedStages() {
    const value = Storage.get(Storage.KEYS.clearedStages, []);
    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  }
  static hasClearedStage(stageId) { return Storage.getClearedStages().includes(stageId); }
  static markStageCleared(stageId) {
    const cleared = Storage.getClearedStages();
    if (!cleared.includes(stageId)) cleared.push(stageId);
    Storage.set(Storage.KEYS.clearedStages, cleared);
  }

  static getLocalDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  static claimDailyBonus(amount) {
    const now = Date.now();
    const lastSeenAt = Number(Storage.get(Storage.KEYS.lastSeenAt, 0)) || 0;
    const lastClaimAt = Number(Storage.get(Storage.KEYS.lastClaimAt, 0)) || 0;
    const rollbackTolerance = 5 * 60 * 1000;
    if (now + rollbackTolerance < lastSeenAt || now < lastClaimAt) return null;

    Storage.set(Storage.KEYS.lastSeenAt, Math.max(now, lastSeenAt));
    const today = Storage.getLocalDateKey();
    if (Storage.get(Storage.KEYS.lastLoginDate, '') === today) return null;
    Storage.set(Storage.KEYS.lastLoginDate, today);
    Storage.set(Storage.KEYS.lastClaimAt, now);
    return Storage.addCoins(amount);
  }

  static recordCurrentTime() {
    const now = Date.now();
    const previous = Number(Storage.get(Storage.KEYS.lastSeenAt, 0)) || 0;
    if (now >= previous) Storage.set(Storage.KEYS.lastSeenAt, now);
  }

  static getOwnedSkins() {
    const selected = Storage.getSkin();
    const value = Storage.get(Storage.KEYS.ownedSkins, ['red', selected]);
    const owned = Array.isArray(value) ? value : ['red'];
    return [...new Set(['red', selected, ...owned])];
  }
  static ownsSkin(id) { return Storage.getOwnedSkins().includes(id); }
  static unlockSkin(id) {
    Storage.set(Storage.KEYS.ownedSkins, [...new Set([...Storage.getOwnedSkins(), id])]);
  }

  static getEffect() { return Storage.get(Storage.KEYS.effect, 'sparkle'); }
  static setEffect(id) { Storage.set(Storage.KEYS.effect, id); }
  static getOwnedEffects() {
    const value = Storage.get(Storage.KEYS.ownedEffects, ['sparkle']);
    return Array.isArray(value) ? [...new Set(['sparkle', ...value])] : ['sparkle'];
  }
  static ownsEffect(id) { return Storage.getOwnedEffects().includes(id); }
  static unlockEffect(id) {
    Storage.set(Storage.KEYS.ownedEffects, [...new Set([...Storage.getOwnedEffects(), id])]);
  }
}
