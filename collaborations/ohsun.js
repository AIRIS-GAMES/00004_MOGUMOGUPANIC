/* Independent, positive-only SUN BONUS. Original PNG is display-only. */
(() => {
  'use strict';
  const config = window.OHSUN_COLLAB_CONFIG;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const preview = Boolean(window.OHSUN_COLLAB_PREVIEW) || (local && new URLSearchParams(location.search).get('ohsun-preview') === '1');
  const start = Date.parse(config?.startsAt), end = Date.parse(config?.endsAt);
  const available = () => Boolean(config?.enabled && (preview || (Number.isFinite(start) && Number.isFinite(end) && start < end && Date.now() >= start && Date.now() < end)));
  class OhSunCollaboration {
    constructor(game) {
      this.game = game;
      this.enabled = false;
      this.state = 'normal';
      this.count = this.time = this.remaining = 0;
      this.completedBonuses = 0;
      this.sunSpawnTimer = 0;
      this.sunType = Object.freeze({ id: 'sunToken', r: 20, req: 1, score: 25 });
      // Original game-style vector token, unrelated to the licensed character.
      OBJECT_PAINTERS.sunToken = function (g, u) {
        const colors = ['#ff627f', '#ffa447', '#ffe45e', '#68dca1', '#55cde7', '#6994ff', '#ad80ef', '#ef82cb'];
        g.lineWidth = u * .15;
        g.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          g.strokeStyle = colors[i];
          g.beginPath();
          g.moveTo(Math.cos(a) * u * .78, Math.sin(a) * u * .78);
          g.lineTo(Math.cos(a) * u * 1.1, Math.sin(a) * u * 1.1);
          g.stroke();
        }
        this._dot(g, 0, 0, u * .69, '#ffffff');
        const rainbow = g.createLinearGradient(-u * .5, -u * .5, u * .5, u * .5);
        colors.slice(0, 7).forEach((color, i) => rainbow.addColorStop(i / 6, color));
        this._dot(g, 0, 0, u * .58, rainbow);
        this._dot(g, -u * .16, -u * .18, u * .14, '#ffffffbb');
      };
      this.banner = document.createElement('button');
      this.banner.type = 'button';
      this.banner.className = 'sun-collab-banner hidden';
      this.banner.setAttribute('aria-label', 'おっ！さんコラボのルール説明を開く');
      this.banner.setAttribute('aria-haspopup', 'dialog');
      this.banner.innerHTML = '<span class="sun-banner-art"><img alt="おっ！サン"><small>©SUN-TV</small></span><span><strong>おっ！さんコラボ開催中</strong><small>レアな太陽を集めよう · タップでルール</small></span>';
      document.querySelector('#screen-title .title-hint').after(this.banner);
      this.rules = document.createElement('dialog');
      this.rules.className = 'sun-rules';
      this.rules.setAttribute('aria-labelledby', 'sun-rules-title');
      this.rules.innerHTML = `<h2 id="sun-rules-title">☀ SUN BONUSの遊び方</h2>
        <figure class="sun-rules-character"><img alt="サンテレビ公式キャラクター おっ！サン"><figcaption>©SUN-TV</figcaption></figure>
        <ol>
          <li><strong>虹色の太陽を5個集める</strong><p>黄色い★コインとは別のアイテム！</p></li>
          <li><strong>おっ！サンが登場！</strong><p>ボーナスアイテムがいっぱい！</p></li>
          <li><strong>8秒間のSUN BONUS！</strong><p>吸い込み範囲1.5倍・スコア2倍</p></li>
        </ol>
        <p class="sun-rules-note">おっ！サンは吸い込み対象ではありません。</p>
        <button type="button" class="btn btn-primary" autofocus>閉じる</button>`;
      document.getElementById('app').append(this.rules);
      const tokenIcon = document.createElement('canvas');
      tokenIcon.width = tokenIcon.height = 64;
      tokenIcon.style.cssText = 'width:32px;height:32px;vertical-align:middle;margin-right:6px';
      tokenIcon.setAttribute('aria-hidden', 'true');
      tokenIcon.getContext('2d').drawImage(GameObject.getSprite(this.sunType).canvas, 0, 0, 64, 64);
      this.rules.querySelector('li strong').prepend(tokenIcon);
      this.banner.addEventListener('click', () => {
        if (!available() || this.game.state !== 'title') return;
        this.game._btn();
        this.rules.querySelector('img').src = 'public/collaborations/ohsun/characters/ohsun_09.png';
        this.rules.showModal();
        const heading = this.rules.querySelector('h2');
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        this.rules.scrollTop = 0;
      });
      this.rules.querySelector('button').addEventListener('click', () => { this.game._btn(); this.rules.close(); });
      this.rules.addEventListener('close', () => {
        this.game.keys.clear();
        this.rules.querySelector('img').removeAttribute('src');
      });
      this.hud = document.createElement('div');
      this.hud.className = 'sun-hud hidden';
      this.hud.innerHTML = '<span class="sun-label">☀ SUN</span><span class="sun-meter" role="progressbar" aria-label="SUNゲージ" aria-valuemin="0" aria-valuemax="5"><i></i></span><span class="sun-count">0 / 5</span>';
      document.getElementById('hud').append(this.hud);
      this.layer = document.createElement('div');
      this.layer.className = 'sun-layer hidden';
      this.layer.innerHTML = '<div class="sun-light"></div><figure class="sun-guest"><img alt="おっ！サン"><figcaption>©SUN-TV</figcaption></figure><p class="sun-announcement" role="status"></p>';
      document.getElementById('app').append(this.layer);
      this.art = this.layer.querySelector('figure');
      this.img = this.layer.querySelector('img');
      this.img.addEventListener('load', () => { this.art.hidden = false; });
      this.img.addEventListener('error', () => { this.art.hidden = true; });
      this.label = this.hud.querySelector('.sun-label');
      this.meter = this.hud.querySelector('.sun-meter');
      this.counter = this.hud.querySelector('.sun-count');
      this.announcement = this.layer.querySelector('.sun-announcement');
      document.addEventListener('visibilitychange', () => this.tick());
      window.Capacitor?.Plugins?.App?.addListener('appStateChange', () => this.tick());
    }
    startRun() {
      this.leave();
      this.enabled = available();
      if (!this.enabled) return;
      this.art.hidden = true;
      this.img.src = 'public/collaborations/ohsun/characters/ohsun_09.png';
      this.updateHUD();
    }
    leave() {
      this.enabled = false;
      this.state = 'normal';
      this.count = this.remaining = this.time = 0;
      this.completedBonuses = 0;
      this.pendingStars = 0;
      this.sunSpawnTimer = 0;
      this.game.spawner.eventPool = [];
      if (this.game.player) this.game.player.sunRangeMul = 1;
      this.hud.classList.add('hidden');
      this.layer.classList.add('hidden');
      this.img.removeAttribute('src');
    }
    get scoreMultiplier() { return this.enabled && this.state === 'sunBonusActive' ? 2 : 1; }
    get requiredStars() { return 5; }
    onConsume(obj) {
      if (!this.enabled || obj.type.id !== 'sunToken') return;
      this.game.particles.burst(obj.x, obj.y, '#ffd24d', { kind: 'spark', colors: ['#ffd24d', '#fff3aa'] });
      if (!obj.sunCharge) return;
      if (this.state !== 'normal') {
        this.pendingStars = Math.min(this.requiredStars - 1, this.pendingStars + 1);
        return;
      }
      this.count = Math.min(this.requiredStars, this.count + 1);
      if (this.count === this.requiredStars) {
        this.state = 'sunBonusEntering';
        this.time = 0;
        this.remaining = 8;
        this.game.camera.shake(3);
        this.game.audio.grow();
        this.announcement.textContent = 'SUN BONUS!';
      }
      this.updateHUD();
    }
    update(dt, elapsed = dt) {
      if (!this.enabled || this.game.state !== 'play') return;
      this.time += elapsed;
      if (this.state === 'normal') {
        this.sunSpawnTimer -= elapsed;
        if (this.sunSpawnTimer <= 0) {
          this.spawnSun();
          this.sunSpawnTimer = 4;
        }
      }
      if (this.state === 'sunBonusEntering' && this.time >= .65) {
        this.state = 'sunBonusActive';
        this.time = 0;
        this.game.player.sunRangeMul = 1.5;
        this.emitItems(40);
        this.burstTimer = 1;
      } else if (this.state === 'sunBonusActive') {
        this.remaining = Math.max(0, this.remaining - elapsed);
        this.burstTimer -= elapsed;
        if (this.remaining <= 0) {
          this.state = 'sunBonusEnding';
          this.time = 0;
          this.game.player.sunRangeMul = 1;
          this.announcement.textContent = 'SUN BONUS FINISH!';
        } else if (this.burstTimer <= 0) {
          this.emitItems(10);
          this.burstTimer = 1;
        }
      } else if (this.state === 'sunBonusEnding' && this.time >= 1) {
        this.completedBonuses++;
        this.sunSpawnTimer = 4;
        this.state = 'normal';
        this.count = this.pendingStars;
        this.pendingStars = this.time = 0;
      }
      for (const obj of this.game.spawner.eventPool) {
        if (!obj.active || obj.state !== 'idle' || !obj.flight) continue;
        obj.flight.t = Math.min(1, obj.flight.t + dt / .9);
        const f = obj.flight, t = 1 - Math.pow(1 - f.t, 3);
        obj.x = f.x + (f.tx - f.x) * t;
        obj.y = f.y + (f.ty - f.y) * t;
        if (f.t === 1) obj.flight = null;
      }
      this.updateHUD();
    }
    guestPosition() {
      const { w, h } = this.game;
      const width = Math.min(w * .36, 330, (h - 160) * .65);
      const slide = this.state === 'sunBonusEntering' ? Math.max(0, 1 - this.time / .65) : this.state === 'sunBonusEnding' ? Math.min(1, this.time) : 0;
      return { width, x: w - width * .58 + slide * width * 1.4 + Math.sin(this.time * 1.3) * Math.min(8, width * .06),
        y: Math.max(165 + width * .58, h * .34) + Math.sin(this.time * 1.7) * 8 };
    }
    spawnSun() {
      const game = this.game;
      if (!this.enabled || this.state !== 'normal') return;
      const suns = game.spawner.eventPool.filter(obj => obj.sunCharge);
      const camera = game.camera;
      const view = camera.viewBounds(game.w, game.h, 60);
      const outside = obj => obj.state === 'idle' &&
        (obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b);
      const active = suns.filter(obj => obj.active);
      // Offscreen tokens must not permanently occupy both rare-item slots.
      const obj = active.length >= 2 ? active.find(outside)
        : suns.find(obj => !obj.active) || new GameObject();
      if (!obj) return;
      if (!suns.includes(obj)) game.spawner.eventPool.push(obj);
      let best = null;
      const mouth = game.player.getMouth();
      for (let i = 0; i < 20; i++) {
        const sx = 40 + Math.random() * Math.max(0, game.w - 80);
        const sy = 140 + Math.random() * Math.max(0, game.h - 210);
        const x = Math.max(40, Math.min(Game.WORLD - 40, camera.x + (sx - game.w / 2) / camera.zoom));
        const y = Math.max(40, Math.min(Game.WORLD - 40, camera.y + (sy - game.h / 2) / camera.zoom));
        const separation = Math.min(Math.hypot(x - mouth.x, y - mouth.y) - mouth.r,
          ...active.filter(other => other !== obj).map(other => Math.hypot(x - other.x, y - other.y) - 70 / camera.zoom));
        if (!best || separation > best.separation) best = { x, y, separation };
      }
      obj.reset(this.sunType, best.x, best.y);
      obj.eventOnly = true;
      obj.sunCharge = true;
    }
    emitItems(count) {
      const game = this.game, camera = game.camera, pos = this.guestPosition();
      const x = camera.x + (pos.x - game.w / 2) / camera.zoom, y = camera.y + (pos.y - game.h / 2) / camera.zoom;
      for (let i = 0; i < count; i++) {
        let obj = game.spawner.eventPool.find(item => !item.active && !item.sunCharge);
        if (!obj) {
          if (game.spawner.eventPool.filter(item => !item.sunCharge).length >= 100) break;
          obj = new GameObject();
          game.spawner.eventPool.push(obj);
        }
        const typeId = Math.random() < .8 ? 'coin' : 'flower';
        const type = OBJECT_TYPES.find(item => item.id === typeId);
        obj.reset(type, x, y);
        obj.eventOnly = true;
        obj.scoreOnly = true;
        const angle = Math.random() * Math.PI * 2, radius = (45 + Math.random() * Math.min(game.w * .4, 220)) / camera.zoom;
        obj.flight = { t: 0, x, y,
          tx: Math.max(35, Math.min(Game.WORLD - 35, game.player.x + Math.cos(angle) * radius)),
          ty: Math.max(35, Math.min(Game.WORLD - 35, game.player.y + Math.sin(angle) * radius)) };
      }
    }
    drawItem(ctx, obj) {
      if (!this.enabled || obj.type.id !== 'sunToken' || obj.state !== 'idle') { obj.draw(ctx); return; }
      const phase = this.game.time + obj.x * .013 + obj.y * .017;
      ctx.save();
      ctx.translate(obj.x, obj.y);
      // Keep the rare token legible when the camera zooms out; collision is unchanged.
      const visualScale = Math.max(1, 28 / (obj.r * 2 * this.game.camera.zoom));
      ctx.scale(visualScale, visualScale);
      ctx.rotate(Math.sin(phase * .45) * .16);
      ctx.translate(-obj.x, -obj.y + Math.sin(phase * 2) * 3);
      obj.draw(ctx);
      ctx.fillStyle = '#fff3aa';
      ctx.globalAlpha = .3 + Math.max(0, Math.sin(phase * 1.4)) * .5;
      ctx.fillRect(obj.x + obj.r, obj.y - obj.r - 4, 3, 7);
      ctx.fillRect(obj.x + obj.r - 2, obj.y - obj.r - 2, 7, 3);
      ctx.restore();
    }
    updateHUD() {
      const bonus = this.state === 'sunBonusActive';
      const hudKey = `${this.state}:${this.count}:${bonus ? this.remaining.toFixed(1) : ''}`;
      if (this.lastHUDKey === hudKey) return;
      this.lastHUDKey = hudKey;
      this.label.textContent = bonus ? '☀ SUN BONUS' : '☀ SUN';
      this.counter.textContent = bonus ? `残り ${this.remaining.toFixed(1)}s` : `${this.count} / ${this.requiredStars}`;
      this.meter.setAttribute('aria-valuemax', this.requiredStars);
      this.meter.setAttribute('aria-valuenow', this.count);
      this.meter.firstElementChild.style.width = `${this.count / this.requiredStars * 100}%`;
      this.hud.classList.toggle('is-bonus', bonus);
    }
    renderWorld() {
      const visible = this.enabled && ['play', 'pause'].includes(this.game.state) && this.state !== 'normal';
      this.layer.classList.toggle('hidden', !visible);
      if (!visible) return;
      const pos = this.guestPosition();
      Object.assign(this.art.style, { left: `${pos.x - pos.width / 2}px`, top: `${pos.y - pos.width * .58}px`, width: `${pos.width}px` });
      this.announcement.classList.toggle('hidden', this.state === 'sunBonusActive' && this.time > 1);
      this.layer.classList.toggle('is-entering', this.state === 'sunBonusEntering');
    }
    tick() {
      const inPeriod = available();
      const bannerImage = this.banner.querySelector('img');
      if (inPeriod && !bannerImage.hasAttribute('src')) bannerImage.src = 'public/collaborations/ohsun/characters/ohsun_09.png';
      else if (!inPeriod && bannerImage.hasAttribute('src')) bannerImage.removeAttribute('src');
      this.banner.classList.toggle('hidden', !inPeriod);
      if (this.rules.open && (!inPeriod || this.game.state !== 'title')) this.rules.close();
      document.getElementById('screen-title').classList.toggle('sun-collab-title', inPeriod);
      if (this.enabled && !inPeriod) this.leave();
      this.hud.classList.toggle('hidden', !this.enabled || !['play', 'intro', 'pause'].includes(this.game.state));
    }
  }
  window.OhSunCollaboration = OhSunCollaboration;
})();
