/* =========================================================
 * Zukan.js - エラーずかん
 *  - 食べた物が登録される(吸い込んではいけない物も「食べた」ら登録)
 *  - ときどき色違いのレア(金色に光る)が混ざる。食べるとレア欄が埋まる
 *  - 4ページ。ふつうの欄が埋まるとコイン、レア欄が埋まると特別なアクセサリー
 * ========================================================= */
class Zukan {
  static RARE_CHANCE = 0.012;   // 出現する物が色違いになる確率
  static RARE_SCORE = 3;        // レアは得点が高い(画面には数字を出さない)

  static PAGES = [
    { id: 'machi', name: 'まちのエラー', items: ['flower', 'coin', 'trash', 'bench', 'tree'], coins: 300, accessory: 'goldcrown' },
    { id: 'street', name: 'ストリートのエラー', items: ['house', 'signal', 'car', 'tower', 'shoppingBag'], coins: 400, accessory: 'rainbowbow' },
    { id: 'work', name: 'はたらくエラー', items: ['officeChair', 'crate', 'barrel', 'buoy', 'suitcase'], coins: 500, accessory: 'wizardhat' },
    { id: 'special', name: 'ふしぎなエラー', items: ['drone', 'clock', 'zapper', 'chili', 'soda'], coins: 600, accessory: 'catears' },
  ];

  /** 色違いがある物(通常の出現物だけ) */
  static hasRare(id) { return OBJECT_TYPES.some(t => t.id === id); }

  static typeOf(id) { return OBJECT_TYPES.find(t => t.id === id) || GIMMICK_TYPES[id]; }

  /** 食べるたびに読むので、読み込んだ中身は覚えておく(保存した時に入れ替える) */
  static state() {
    if (Zukan.cached) return Zukan.cached;
    const s = Storage.getObject(Storage.KEYS.zukan, {});
    Zukan._cacheRaw = Storage.cache.get(Storage.KEYS.zukan);
    return Zukan._cache = {
      seen: s.seen && typeof s.seen === 'object' ? s.seen : {},
      rare: s.rare && typeof s.rare === 'object' ? s.rare : {},
      claimed: s.claimed && typeof s.claimed === 'object' ? s.claimed : {},
    };
  }

  static get cached() { return Zukan._cache && Zukan._cacheRaw === Storage.cache.get(Storage.KEYS.zukan) ? Zukan._cache : null; }

  static _save(s) {
    Storage.set(Storage.KEYS.zukan, s);
    Zukan._cache = s;
    Zukan._cacheRaw = Storage.cache.get(Storage.KEYS.zukan);
  }

  /** 食べた物を登録。新しく埋まった欄を返す(なければ null) */
  static record(type, rare = false) {
    if (!Zukan.PAGES.some(p => p.items.includes(type.id))) return null;
    const s = Zukan.state();
    let result = null;
    if (!s.seen[type.id]) { s.seen[type.id] = true; result = { id: type.id, rare: false }; }
    if (rare && Zukan.hasRare(type.id) && !s.rare[type.id]) { s.rare[type.id] = true; result = { id: type.id, rare: true }; }
    if (result) Zukan._save(s);
    return result;
  }

  static pageStatus(page, s = Zukan.state()) {
    const rareItems = page.items.filter(Zukan.hasRare);
    const seen = page.items.filter(id => s.seen[id]).length;
    const rare = rareItems.filter(id => s.rare[id]).length;
    return {
      seen, total: page.items.length,
      rare, rareTotal: rareItems.length,
      done: seen === page.items.length,
      rareDone: rare === rareItems.length,
      claimed: !!s.claimed[page.id],
      rareClaimed: !!s.claimed[`${page.id}:rare`],
    };
  }

  static claimableCount() {
    const s = Zukan.state();
    return Zukan.PAGES.reduce((n, p) => {
      const st = Zukan.pageStatus(p, s);
      return n + (st.done && !st.claimed ? 1 : 0) + (st.rareDone && !st.rareClaimed ? 1 : 0);
    }, 0);
  }

  /** ページ完成のごほうび。kind='normal' はコイン、'rare' はアクセサリー */
  static claim(pageId, kind) {
    const page = Zukan.PAGES.find(p => p.id === pageId);
    if (!page) return null;
    const s = Zukan.state();
    const st = Zukan.pageStatus(page, s);
    if (kind === 'rare') {
      if (!st.rareDone || st.rareClaimed) return null;
      s.claimed[`${page.id}:rare`] = true;
      Zukan._save(s);
      Accessories.give(page.accessory);
      return { accessory: page.accessory };
    }
    if (!st.done || st.claimed) return null;
    s.claimed[page.id] = true;
    Zukan._save(s);
    Storage.addCoins(page.coins);
    return { coins: page.coins };
  }

  /* ---- 見た目 ---- */

  /** 色違いの絵(金色に塗り重ね、ハイライトを足したもの) */
  static rareSprite(type) {
    const key = `${type.id}:rare`;
    let sprite = GameObject.spriteCache.get(key);
    if (sprite) return sprite;
    const base = GameObject.getSprite(type);
    const c = document.createElement('canvas');
    c.width = base.canvas.width;
    c.height = base.canvas.height;
    const g = c.getContext('2d');
    g.drawImage(base.canvas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const grad = g.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, 'rgba(255, 240, 150, 0.75)');
    grad.addColorStop(0.5, 'rgba(255, 196, 40, 0.62)');
    grad.addColorStop(1, 'rgba(255, 150, 60, 0.7)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(c.width * 0.38, c.height * 0.3, c.width * 0.12, c.height * 0.06, -0.6, 0, Math.PI * 2);
    g.fill();
    sprite = { canvas: c, drawSize: base.drawSize };
    GameObject.spriteCache.set(key, sprite);
    return sprite;
  }

  /** まだ見ていない欄のシルエット */
  static silhouette(type) {
    const key = `${type.id}:silhouette`;
    let sprite = GameObject.spriteCache.get(key);
    if (sprite) return sprite;
    const base = GameObject.getSprite(type);
    const c = document.createElement('canvas');
    c.width = base.canvas.width;
    c.height = base.canvas.height;
    const g = c.getContext('2d');
    g.drawImage(base.canvas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#5b4d63';
    g.fillRect(0, 0, c.width, c.height);
    sprite = { canvas: c, drawSize: base.drawSize };
    GameObject.spriteCache.set(key, sprite);
    return sprite;
  }

  static imageUrl(id, variant) {
    Zukan.urlCache = Zukan.urlCache || new Map();
    const key = `${id}:${variant}`;
    if (Zukan.urlCache.has(key)) return Zukan.urlCache.get(key);
    const type = Zukan.typeOf(id);
    const sprite = variant === 'rare' ? Zukan.rareSprite(type) : variant === 'unknown' ? Zukan.silhouette(type) : GameObject.getSprite(type);
    const url = sprite.canvas.toDataURL();
    Zukan.urlCache.set(key, url);
    return url;
  }

  /** プレイ中、レアの周りにキラキラを描く */
  static drawSparkles(ctx, game, view, time) {
    game.spawner.forEachActive(obj => {
      if (!obj.rare || obj.state !== 'idle') return;
      if (obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b) return;
      ctx.save();
      ctx.fillStyle = '#fff6b0';
      for (let i = 0; i < 4; i++) {
        const a = time * 1.6 + i * Math.PI / 2 + obj.x * 0.01;
        const d = obj.r * (1.15 + 0.15 * Math.sin(time * 4 + i));
        const s = obj.r * 0.16 * (0.6 + 0.4 * Math.abs(Math.sin(time * 5 + i)));
        const x = obj.x + Math.cos(a) * d, y = obj.y + Math.sin(a) * d;
        ctx.beginPath();
        ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 2, y);
        ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y + s * 0.5);
        ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * 0.5, y - s * 0.5); ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  }
}
