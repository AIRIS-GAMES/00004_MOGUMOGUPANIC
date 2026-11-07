/* =========================================================
 * Accessories.js - コスミーのアクセサリー
 *  - UFOキャッチャーの景品(8種)と、ずかんのレアページ完成でもらえる特別品(4種)
 *  - 1つだけ装備でき、プレイ中のコスミーの頭や顔に描かれる
 *  - 絵はすべてコードで描く(体の大きさ r と画像の高さ h に合わせて拡大縮小)
 * ========================================================= */
class Accessories {
  static LIST = [
    { id: 'ribbon', name: 'リボン', source: 'ufo' },
    { id: 'sunglasses', name: 'サングラス', source: 'ufo' },
    { id: 'headphones', name: 'ヘッドホン', source: 'ufo' },
    { id: 'flowerpin', name: 'おはなピン', source: 'ufo' },
    { id: 'propeller', name: 'プロペラぼうし', source: 'ufo' },
    { id: 'halo', name: 'てんしのわ', source: 'ufo' },
    { id: 'beret', name: 'ベレーぼう', source: 'ufo' },
    { id: 'starglasses', name: 'ほしメガネ', source: 'ufo' },
    { id: 'goldcrown', name: 'きんのおうかん', source: 'zukan' },
    { id: 'rainbowbow', name: 'にじのリボン', source: 'zukan' },
    { id: 'wizardhat', name: 'まほうのぼうし', source: 'zukan' },
    { id: 'catears', name: 'ねこみみ', source: 'zukan' },
  ];

  static get(id) { return Accessories.LIST.find(a => a.id === id) || null; }

  static owned() {
    const list = Storage.get(Storage.KEYS.accessories, []);
    return Array.isArray(list) ? list.filter(id => Accessories.get(id)) : [];
  }

  static has(id) { return Accessories.owned().includes(id); }

  static give(id) {
    if (!Accessories.get(id) || Accessories.has(id)) return false;
    Storage.set(Storage.KEYS.accessories, [...Accessories.owned(), id]);
    return true;
  }

  static equipped() {
    const id = Storage.get(Storage.KEYS.accessoryEquipped, null);
    return id && Accessories.has(id) ? id : null;
  }

  static equip(id) {
    Storage.set(Storage.KEYS.accessoryEquipped, id && Accessories.has(id) ? id : null);
  }

  /**
   * それぞれのコスミーの絵の中の目の位置(画像の幅・高さに対する割合)。
   * open=口を開けた絵 / closed=口を閉じた絵。メガネはここに合わせてかける
   */
  static EYES = {
    red:    { open: { y: 0.38, l: 0.37, r: 0.645 }, closed: { y: 0.625, l: 0.37, r: 0.624 } },
    blue:   { open: { y: 0.43, l: 0.34, r: 0.65 },  closed: { y: 0.58, l: 0.367, r: 0.62 } },
    green:  { open: { y: 0.41, l: 0.35, r: 0.61 },  closed: { y: 0.675, l: 0.29, r: 0.60 } },
    pink:   { open: { y: 0.55, l: 0.37, r: 0.64 },  closed: { y: 0.70, l: 0.34, r: 0.64 } },
    purple: { open: { y: 0.45, l: 0.39, r: 0.64 },  closed: { y: 0.61, l: 0.40, r: 0.61 } },
  };

  /**
   * プレイヤーの描画の中から呼ぶ(原点=体の中心、r=体の半径、h=画像の高さ)。
   * face = { skin, open, w } を渡すと、メガネをその絵の目の位置・目の間かくに合わせる
   */
  static draw(g, id, r, h, face = null) {
    const painter = Accessories.PAINTERS[id];
    if (!painter) return;
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const eyes = face && Accessories.FACE.includes(id) && Accessories.EYES[face.skin];
    if (eyes) {
      const e = face.open ? eyes.open : eyes.closed;
      const w = face.w;
      // 目と目のあいだの真ん中へ。レンズの間かく(0.6r)を、実際の目の間かくに合わせて拡大縮小
      g.translate(((e.l + e.r) / 2 - 0.5) * w, (e.y - 0.5) * h - r * 0.02);
      const k = ((e.r - e.l) * w) / (0.6 * r);
      g.scale(k, k);
    }
    painter(g, r, -h * 0.4);
    g.restore();
  }

  /** 顔につける物(目の高さ)か、頭にのせる物か */
  static FACE = ['sunglasses', 'starglasses'];

  /** アクセサリーだけを、指定した大きさの枠の真ん中に描く(一覧・UFOの景品用) */
  static drawCentered(g, id, size) {
    const r = size * (Accessories.FACE.includes(id) ? 0.78 : id === 'headphones' ? 0.5 : 0.66);
    const h = r * 2.1, top = -h * 0.4;
    const centerY = Accessories.FACE.includes(id) ? 0 : id === 'headphones' ? top + r * 0.45 : top - r * 0.08;
    g.save();
    g.translate(0, -centerY);
    Accessories.draw(g, id, r, h);
    g.restore();
  }

  /** 一覧表示用の小さな絵(data URL) */
  static icon(id, size = 96) {
    Accessories.iconCache = Accessories.iconCache || new Map();
    const key = `${id}:${size}`;
    if (Accessories.iconCache.has(key)) return Accessories.iconCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    Accessories.drawCentered(g, id, size * 0.7);
    const url = c.toDataURL();
    Accessories.iconCache.set(key, url);
    return url;
  }

  static _outline(g, r) { g.strokeStyle = '#4f3a40'; g.lineWidth = Math.max(2, r * 0.06); }

  static PAINTERS = {
    ribbon(g, r, top) {
      Accessories._outline(g, r);
      g.fillStyle = '#ff6b9d';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(r * 0.28, top + r * 0.12);
        g.lineTo(r * 0.28 + s * r * 0.38, top - r * 0.08);
        g.lineTo(r * 0.28 + s * r * 0.38, top + r * 0.34);
        g.closePath(); g.fill(); g.stroke();
      }
      g.fillStyle = '#ff8fb6';
      g.beginPath(); g.arc(r * 0.28, top + r * 0.13, r * 0.1, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    sunglasses(g, r) {
      Accessories._outline(g, r);
      g.fillStyle = '#2a2233';
      const y = r * 0.02;
      for (const s of [-1, 1]) {
        g.beginPath(); g.ellipse(s * r * 0.3, y, r * 0.24, r * 0.17, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      g.beginPath(); g.moveTo(-r * 0.07, y - r * 0.03); g.lineTo(r * 0.07, y - r * 0.03); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.3 - r * 0.08, y - r * 0.06, r * 0.06, r * 0.03, -0.4, 0, Math.PI * 2); g.fill(); }
    },
    headphones(g, r, top) {
      Accessories._outline(g, r);
      g.strokeStyle = '#4f3a40';
      g.lineWidth = r * 0.12;
      g.beginPath(); g.arc(0, top + r * 0.75, r * 0.82, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.strokeStyle = '#58cfee';
      g.lineWidth = r * 0.07;
      g.beginPath(); g.arc(0, top + r * 0.75, r * 0.82, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      Accessories._outline(g, r);
      g.fillStyle = '#58cfee';
      for (const s of [-1, 1]) {
        g.beginPath(); g.ellipse(s * r * 0.8, top + r * 0.62, r * 0.17, r * 0.24, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    },
    flowerpin(g, r, top) {
      Accessories._outline(g, r);
      const cx = -r * 0.35, cy = top + r * 0.18;
      g.fillStyle = '#fff3a8';
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.13, cy + Math.sin(a) * r * 0.13, r * 0.11, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      g.fillStyle = '#ff9b5a';
      g.beginPath(); g.arc(cx, cy, r * 0.08, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    propeller(g, r, top) {
      Accessories._outline(g, r);
      g.fillStyle = '#ffd24d';
      g.beginPath(); g.arc(0, top + r * 0.12, r * 0.42, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff6b81';
      g.beginPath(); g.arc(0, top + r * 0.12, r * 0.42, Math.PI, Math.PI * 1.33); g.lineTo(0, top + r * 0.12); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, top - r * 0.3); g.lineTo(0, top - r * 0.48); g.stroke();
      g.fillStyle = '#58b4ee';
      g.beginPath(); g.ellipse(0, top - r * 0.5, r * 0.36, r * 0.07, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    halo(g, r, top) {
      g.strokeStyle = '#4f3a40';
      g.lineWidth = r * 0.14;
      g.beginPath(); g.ellipse(0, top - r * 0.22, r * 0.42, r * 0.12, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#ffe66d';
      g.lineWidth = r * 0.08;
      g.beginPath(); g.ellipse(0, top - r * 0.22, r * 0.42, r * 0.12, 0, 0, Math.PI * 2); g.stroke();
    },
    beret(g, r, top) {
      Accessories._outline(g, r);
      g.fillStyle = '#c94a5e';
      g.beginPath(); g.ellipse(-r * 0.06, top + r * 0.08, r * 0.58, r * 0.22, -0.12, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.02, top - r * 0.12); g.lineTo(r * 0.02, top - r * 0.26); g.stroke();
    },
    starglasses(g, r) {
      Accessories._outline(g, r);
      g.fillStyle = '#ff9ec6';
      const y = r * 0.02;
      for (const s of [-1, 1]) {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.12 : r * 0.27;
          const x = s * r * 0.3 + Math.cos(a) * rr, yy = y + Math.sin(a) * rr;
          if (i) g.lineTo(x, yy); else g.moveTo(x, yy);
        }
        g.closePath(); g.fill(); g.stroke();
      }
      g.beginPath(); g.moveTo(-r * 0.06, y); g.lineTo(r * 0.06, y); g.stroke();
    },
    goldcrown(g, r, top) {
      Accessories._outline(g, r);
      const grad = g.createLinearGradient(0, top - r * 0.4, 0, top + r * 0.2);
      grad.addColorStop(0, '#fff3a0'); grad.addColorStop(1, '#f2b705');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-r * 0.42, top + r * 0.18);
      g.lineTo(-r * 0.46, top - r * 0.3); g.lineTo(-r * 0.2, top - r * 0.06);
      g.lineTo(0, top - r * 0.42); g.lineTo(r * 0.2, top - r * 0.06);
      g.lineTo(r * 0.46, top - r * 0.3); g.lineTo(r * 0.42, top + r * 0.18);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff4f6d';
      g.beginPath(); g.arc(0, top + r * 0.02, r * 0.07, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    rainbowbow(g, r, top) {
      Accessories._outline(g, r);
      const cols = ['#ff6b81', '#ffd24d', '#8fd14f', '#58b4ee'];
      for (const s of [-1, 1]) {
        cols.forEach((c, i) => {
          g.fillStyle = c;
          g.beginPath();
          const k = 1 - i * 0.2;
          g.moveTo(0, top + r * 0.1);
          g.lineTo(s * r * 0.5 * k, top - r * 0.14 * k);
          g.lineTo(s * r * 0.5 * k, top + r * 0.34 * k);
          g.closePath(); g.fill();
        });
        g.beginPath(); g.moveTo(0, top + r * 0.1); g.lineTo(s * r * 0.5, top - r * 0.14); g.lineTo(s * r * 0.5, top + r * 0.34); g.closePath(); g.stroke();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, top + r * 0.1, r * 0.1, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    wizardhat(g, r, top) {
      Accessories._outline(g, r);
      g.fillStyle = '#6b4fc8';
      g.beginPath(); g.ellipse(0, top + r * 0.14, r * 0.62, r * 0.14, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath();
      g.moveTo(-r * 0.38, top + r * 0.12);
      g.quadraticCurveTo(-r * 0.1, top - r * 0.5, r * 0.32, top - r * 0.78);
      g.quadraticCurveTo(r * 0.1, top - r * 0.3, r * 0.38, top + r * 0.12);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffd24d';
      g.beginPath(); g.arc(-r * 0.04, top - r * 0.2, r * 0.07, 0, Math.PI * 2); g.fill();
    },
    catears(g, r, top) {
      Accessories._outline(g, r);
      for (const s of [-1, 1]) {
        g.fillStyle = '#fffaf0';
        g.beginPath();
        g.moveTo(s * r * 0.18, top + r * 0.2);
        g.lineTo(s * r * 0.42, top - r * 0.32);
        g.lineTo(s * r * 0.62, top + r * 0.24);
        g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ff9ec6';
        g.beginPath();
        g.moveTo(s * r * 0.3, top + r * 0.14);
        g.lineTo(s * r * 0.42, top - r * 0.14);
        g.lineTo(s * r * 0.52, top + r * 0.16);
        g.closePath(); g.fill();
      }
    },
  };
}
