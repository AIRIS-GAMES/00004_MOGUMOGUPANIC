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
    sunStageBests: 'mogu.sunStageBests',
    sunBest: 'mogu.sunBest',
    clearTimes: 'mogu.clearTimes',
    sunClearTimes: 'mogu.sunClearTimes',
  };

  static cache = new Map();
  static records = new Map();
  static dirty = new Set();
  static queued = new Map();
  static revision = 0;
  static preferences = null;
  static pendingWrites = Promise.resolve();
  static IO_TIMEOUT = 5000;

  // Each value and its revision are stored together in one atomic store entry.
  // Legacy JSON saves have revision zero and remain readable.
  static decode(raw) {
    if (raw === null) return null;
    const value = JSON.parse(raw);
    if (value?.__moguSave === 1) {
      if (!Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.raw !== 'string') {
        throw new Error('保存データの形式が正しくありません');
      }
      JSON.parse(value.raw);
      return value;
    }
    return { __moguSave: 1, revision: 0, raw };
  }

  static localRecord(key) {
    try { return Storage.decode(localStorage.getItem(key)); }
    catch (_) { return null; }
  }

  static mirror(key, record) {
    try { localStorage.setItem(key, JSON.stringify(record)); } catch (_) {}
  }

  static async startupCall(call) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(call),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error('保存データの処理がタイムアウトしました');
            error.code = 'STORAGE_TIMEOUT';
            reject(error);
          }, Storage.IO_TIMEOUT);
        }),
      ]);
    } finally { clearTimeout(timer); }
  }

  static async init() {
    const capacitor = window.Capacitor;
    const available = capacitor?.isPluginAvailable?.('Preferences') ?? Boolean(capacitor?.Plugins?.Preferences);
    Storage.preferences = available ? capacitor?.Plugins?.Preferences || null : null;
    const loaded = new Map();
    const repairs = [];
    // Finish all reads before updating either store. Native read errors must
    // stop startup: an older local copy is not proof that progress is current.
    for (const key of Object.values(Storage.KEYS)) {
      const local = Storage.localRecord(key);
      let native = null;
      if (Storage.preferences) {
        const result = await Storage.startupCall(() => Storage.preferences.get({ key }));
        native = Storage.decode(result.value);
      }
      const record = local && (!native || local.revision > native.revision) ? local : native;
      if (!record) continue;
      loaded.set(key, record);
      if (Storage.preferences && (!native || record.revision > native.revision)) repairs.push(key);
    }
    for (const [key, record] of loaded) {
      Storage.records.set(key, record);
      Storage.cache.set(key, record.raw);
      Storage.revision = Math.max(Storage.revision, record.revision);
      Storage.mirror(key, record);
    }
    for (const key of repairs) Storage.queueWrite(key);
  }

  static get(key, fallback) {
    try {
      const raw = Storage.cache.has(key) ? Storage.cache.get(key) : Storage.localRecord(key)?.raw;
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  }

  static set(key, value) {
    let raw;
    try {
      raw = JSON.stringify(value);
      if (typeof raw !== 'string') return;
    } catch (_) { return; }
    const previous = Storage.localRecord(key);
    Storage.revision = Math.max(Storage.revision, previous?.revision || 0, Date.now()) + 1;
    const record = { __moguSave: 1, revision: Storage.revision, raw };
    Storage.records.set(key, record);
    Storage.cache.set(key, raw);
    Storage.mirror(key, record);
    if (Storage.preferences) Storage.queueWrite(key);
  }

  static queueWrite(key) {
    const record = Storage.records.get(key);
    const preferences = Storage.preferences;
    if (!record || !preferences) return;
    Storage.dirty.add(key);
    if (Storage.queued.get(key) === record.revision) return;
    Storage.queued.set(key, record.revision);
    Storage.pendingWrites = Storage.pendingWrites.then(async () => {
      // Coalesce outdated requests before they reach the native bridge.
      if (Storage.records.get(key) !== record) return;
      try {
        await Storage.startupCall(() => Promise.resolve(preferences.set({ key, value: JSON.stringify(record) })).then(() => {
          if (Storage.records.get(key) === record) Storage.dirty.delete(key);
          else {
            // A timed-out native call may still finish after a newer save.
            // Repair that late write using the current value.
            Storage.queueWrite(key);
          }
        }));
      } catch (_) { /* Keep the local revision and retry on flush/foreground. */ }
      finally {
        if (Storage.queued.get(key) === record.revision) Storage.queued.delete(key);
      }
    });
  }

  static async flush() {
    for (const key of Storage.dirty) Storage.queueWrite(key);
    await Storage.pendingWrites;
  }

  static getSkin()   { return Storage.get(Storage.KEYS.skin, 'red'); }
  static setSkin(id) { Storage.set(Storage.KEYS.skin, id); }

  static getBest(sun = false)  { return Storage.get(sun ? Storage.KEYS.sunBest : Storage.KEYS.best, 0); }
  static setBest(v, sun = false) { Storage.set(sun ? Storage.KEYS.sunBest : Storage.KEYS.best, v); }

  /** ステージ別ベストスコア。{ [stageId]: score } を保持 */
  static getStageBest(stageId, sun = false) {
    const map = Storage.get(sun ? Storage.KEYS.sunStageBests : Storage.KEYS.stageBests, {});
    const v = map && typeof map === 'object' ? Number(map[stageId]) : 0;
    return Number.isFinite(v) ? v : 0;
  }
  static setStageBest(stageId, score, sun = false) {
    const key = sun ? Storage.KEYS.sunStageBests : Storage.KEYS.stageBests;
    const raw = Storage.get(key, {});
    const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    map[stageId] = Math.max(0, Math.floor(score));
    Storage.set(key, map);
  }

  static getSound()  { return Storage.get(Storage.KEYS.sound, true); }
  static getClearTime(stageId, sun = false) {
    const map = Storage.get(sun ? Storage.KEYS.sunClearTimes : Storage.KEYS.clearTimes, {});
    const value = map?.[stageId];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }
  static setClearTime(stageId, seconds, sun = false) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const key = sun ? Storage.KEYS.sunClearTimes : Storage.KEYS.clearTimes;
    const raw = Storage.get(key, {});
    const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    map[stageId] = seconds;
    Storage.set(key, map);
  }
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
