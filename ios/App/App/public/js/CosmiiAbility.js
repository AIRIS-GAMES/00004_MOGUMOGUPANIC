class CosmiiAbility {
  static DURATION = 8;
  static REQUIRED_TOKENS = 5;
  static FIRST_DELAY = [16, 24];
  static NEXT_DELAY = [14, 26];

  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.state = 'normal';
    this.count = 0;
    this.time = 0;
    this.remaining = 0;
    this.completedBonuses = 0;
    this.startedBonuses = 0;
    this.runElapsed = 0;
    this.randomActivationAt = 0;
    this.pendingTokens = 0;
    this.tokenSpawnTimer = 0;
    this.tokenType = Object.freeze({ id: 'rainbowToken', r: 20, req: 1, score: 25 });

    this.hud = document.createElement('div');
    this.hud.className = 'cosmii-bonus-hud hidden';
    this.hud.innerHTML = '<span class="cosmii-bonus-label">RAINBOW</span><span class="cosmii-bonus-meter" role="progressbar" aria-label="虹色アイテムゲージ" aria-valuemin="0" aria-valuemax="5"><i></i></span><span class="cosmii-bonus-count">0 / 5</span>';
    document.getElementById('hud').append(this.hud);
    this.label = this.hud.querySelector('.cosmii-bonus-label');
    this.meter = this.hud.querySelector('.cosmii-bonus-meter');
    this.counter = this.hud.querySelector('.cosmii-bonus-count');

    this.layer = document.createElement('div');
    this.layer.className = 'cosmii-ability-layer hidden';
    this.character = document.createElement('img');
    this.character.className = 'cosmii-ability-character';
    this.character.alt = '能力を発動したコスミー';
    this.announcement = document.createElement('p');
    this.announcement.className = 'cosmii-ability-announcement';
    this.announcement.setAttribute('role', 'status');
    this.layer.append(this.character, this.announcement);
    document.getElementById('app').append(this.layer);
  }

  get isRunning() {
    return this.enabled && ['bonusEntering', 'bonusActive', 'bonusEnding'].includes(this.state);
  }

  get scoreMultiplier() {
    return this.enabled && this.state === 'bonusActive' ? 2 : 1;
  }

  startRun() {
    this.leave();
    this.enabled = true;
    this.randomActivationAt = this.runElapsed + this._randomDelay(CosmiiAbility.FIRST_DELAY);
    this.spawnRainbow();
    this.spawnRainbow();
    this.tokenSpawnTimer = 2;
    this.updateHUD();
  }

  leave() {
    this.enabled = false;
    this.state = 'normal';
    this.count = this.remaining = this.time = 0;
    this.completedBonuses = 0;
    this.startedBonuses = 0;
    this.runElapsed = 0;
    this.randomActivationAt = 0;
    this.pendingTokens = 0;
    this.tokenSpawnTimer = 0;
    this.game.spawner.eventPool = [];
    if (this.game.player) this.game.player.cosmiiRangeMul = 1;
    this.hud.classList.add('hidden');
    this.layer.classList.add('hidden');
    this.layer.classList.remove('is-entering', 'is-ending');
    this.character.removeAttribute('src');
    this.lastHUDKey = null;
  }

  beginBonus() {
    if (!this.enabled || this.state !== 'normal') return;
    this.startedBonuses++;
    this.randomActivationAt = Infinity;
    this.count = CosmiiAbility.REQUIRED_TOKENS;
    this.state = 'bonusEntering';
    this.time = 0;
    this.remaining = CosmiiAbility.DURATION;
    const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
    this.character.src = skin.closedSrc;
    this.announcement.textContent = 'COSMII BONUS!';
    this.layer.classList.remove('hidden', 'is-ending');
    this.layer.classList.add('is-entering');
    this.game.player.cosmiiRangeMul = 1;
    this.game.camera.shake(3);
    this.game.audio.grow();
    this.updateHUD();
  }

  ensureFirstBonus() {
    if (this.startedBonuses === 0) this.beginBonus();
  }

  onConsume(obj) {
    if (!this.enabled || obj.type.id !== 'rainbowToken') return;
    this.game.particles.burst(obj.x, obj.y, '#ffd24d', { kind: 'spark', colors: ['#ffd24d', '#fff3aa'] });
    if (!obj.rainbowCharge) return;
    if (this.state !== 'normal') {
      this.pendingTokens = Math.min(CosmiiAbility.REQUIRED_TOKENS - 1, this.pendingTokens + 1);
      return;
    }
    this.count = Math.min(CosmiiAbility.REQUIRED_TOKENS, this.count + 1);
    if (this.count === CosmiiAbility.REQUIRED_TOKENS) this.beginBonus();
    this.updateHUD();
  }

  update(dt, elapsed = dt) {
    if (!this.enabled || this.game.state !== 'play') return;
    this.time += elapsed;
    this.runElapsed += elapsed;
    if (this.startedBonuses === 0 && (this.runElapsed >= this.randomActivationAt || this.game.timeLeft <= 12)) {
      this.ensureFirstBonus();
    } else if (this.startedBonuses > 0 && this.state === 'normal' && this.runElapsed >= this.randomActivationAt) {
      this.beginBonus();
    }

    if (this.state === 'normal') {
      this.tokenSpawnTimer -= elapsed;
      if (this.tokenSpawnTimer <= 0) {
        this.spawnRainbow();
        this.tokenSpawnTimer = 2;
      }
    } else if (this.state === 'bonusEntering' && this.time >= 0.65) {
      this.state = 'bonusActive';
      this.time = 0;
      this.remaining = CosmiiAbility.DURATION;
      this.game.player.cosmiiRangeMul = 1.5;
      this.layer.classList.remove('is-entering');
      this.emitItems(40);
      this.burstTimer = 1;
    } else if (this.state === 'bonusActive') {
      this.remaining = Math.max(0, this.remaining - elapsed);
      this.burstTimer -= elapsed;
      if (this.remaining <= 0) {
        this.state = 'bonusEnding';
        this.time = 0;
        this.game.player.cosmiiRangeMul = 1;
        this.layer.classList.add('is-ending');
        this.announcement.textContent = 'BONUS FINISH!';
      } else if (this.burstTimer <= 0) {
        this.emitItems(10);
        this.burstTimer = 1;
      }
    } else if (this.state === 'bonusEnding' && this.time >= 1) {
      this.completedBonuses++;
      this.tokenSpawnTimer = 2;
      this.state = 'normal';
      this.count = this.pendingTokens;
      this.pendingTokens = this.time = 0;
      this.randomActivationAt = this.runElapsed + this._randomDelay(CosmiiAbility.NEXT_DELAY);
      this.layer.classList.add('hidden');
      this.layer.classList.remove('is-ending');
    }

    this.updateHUD();
    for (const obj of this.game.spawner.eventPool) {
      if (!obj.active || obj.state !== 'idle' || !obj.flight) continue;
      obj.flight.t = Math.min(1, obj.flight.t + dt / 0.9);
      const f = obj.flight, t = 1 - Math.pow(1 - f.t, 3);
      obj.x = f.x + (f.tx - f.x) * t;
      obj.y = f.y + (f.ty - f.y) * t;
      if (f.t === 1) obj.flight = null;
    }
  }

  spawnRainbow() {
    const game = this.game;
    if (!this.enabled || this.state !== 'normal') return;
    const tokens = game.spawner.eventPool.filter(obj => obj.rainbowCharge);
    const camera = game.camera;
    const view = camera.viewBounds(game.w, game.h, 0);
    const outside = obj => obj.state === 'idle' &&
      (obj.x < view.l || obj.x > view.r || obj.y < view.t || obj.y > view.b);
    const active = tokens.filter(obj => obj.active);
    const obj = active.length >= 3 ? active.find(outside)
      : tokens.find(obj => !obj.active) || new GameObject();
    if (!obj) return;
    if (!tokens.includes(obj)) game.spawner.eventPool.push(obj);

    let best = null;
    const mouth = game.player.getMouth();
    for (let i = 0; i < 20; i++) {
      const sx = 40 + Math.random() * Math.max(0, game.w - 80);
      const sy = 140 + Math.random() * Math.max(0, game.h - 210);
      const x = Math.max(40, Math.min(Game.WORLD - 40, camera.x + (sx - game.w / 2) / camera.zoom));
      const y = Math.max(40, Math.min(Game.WORLD - 40, camera.y + (sy - game.h / 2) / camera.zoom));
      const spacing = Math.min(Infinity,
        ...active.filter(other => other !== obj).map(other => Math.hypot(x - other.x, y - other.y) - 70 / camera.zoom));
      const separation = -Math.abs(Math.hypot(x - mouth.x, y - mouth.y) - mouth.r - 100 / camera.zoom)
        + (spacing < 0 ? -10000 + spacing : 0);
      if (!best || separation > best.separation) best = { x, y, separation };
    }
    obj.reset(this.tokenType, best.x, best.y);
    obj.eventOnly = true;
    obj.rainbowCharge = true;
  }

  emitItems(count) {
    const game = this.game, camera = game.camera;
    const x = camera.x + (game.w * 0.82 - game.w / 2) / camera.zoom;
    const y = camera.y + (game.h * 0.36 - game.h / 2) / camera.zoom;
    for (let i = 0; i < count; i++) {
      let obj = game.spawner.eventPool.find(item => !item.active && !item.rainbowCharge && !item.gimmickOwned);
      if (!obj) {
        if (game.spawner.eventPool.filter(item => !item.rainbowCharge).length >= 100) break;
        obj = new GameObject();
        game.spawner.eventPool.push(obj);
      }
      const typeId = Math.random() < 0.8 ? 'coin' : 'flower';
      const type = OBJECT_TYPES.find(item => item.id === typeId);
      obj.reset(type, x, y);
      obj.eventOnly = true;
      obj.scoreOnly = true;
      obj.cosmiiBonusItem = true;
      const angle = Math.random() * Math.PI * 2;
      const radius = (45 + Math.random() * Math.min(game.w * 0.4, 220)) / camera.zoom;
      obj.flight = {
        t: 0, x, y,
        tx: Math.max(35, Math.min(Game.WORLD - 35, game.player.x + Math.cos(angle) * radius)),
        ty: Math.max(35, Math.min(Game.WORLD - 35, game.player.y + Math.sin(angle) * radius)),
      };
    }
  }

  drawItem(ctx, obj) {
    if (!this.enabled || obj.type.id !== 'rainbowToken' || obj.state !== 'idle') {
      obj.draw(ctx);
      return;
    }
    const phase = this.game.time + obj.x * 0.013 + obj.y * 0.017;
    ctx.save();
    ctx.translate(obj.x, obj.y);
    const scale = Math.max(1, 28 / (obj.r * 2 * this.game.camera.zoom));
    ctx.scale(scale, scale);
    ctx.rotate(Math.sin(phase * 0.45) * 0.16);
    ctx.translate(-obj.x, -obj.y + Math.sin(phase * 2) * 3);
    obj.draw(ctx);
    ctx.fillStyle = '#fff3aa';
    ctx.globalAlpha = 0.3 + Math.max(0, Math.sin(phase * 1.4)) * 0.5;
    ctx.fillRect(obj.x + obj.r, obj.y - obj.r - 4, 3, 7);
    ctx.fillRect(obj.x + obj.r - 2, obj.y - obj.r - 2, 7, 3);
    ctx.restore();
  }

  updateHUD() {
    const bonus = this.state === 'bonusActive';
    const hudKey = `${this.state}:${this.count}:${bonus ? this.remaining.toFixed(1) : ''}`;
    if (this.lastHUDKey === hudKey) return;
    this.lastHUDKey = hudKey;
    this.label.textContent = bonus ? 'COSMII BONUS' : 'RAINBOW';
    this.counter.textContent = bonus ? `残り ${this.remaining.toFixed(1)}s` : `${this.count} / ${CosmiiAbility.REQUIRED_TOKENS}`;
    this.meter.setAttribute('aria-valuemax', CosmiiAbility.REQUIRED_TOKENS);
    this.meter.setAttribute('aria-valuenow', this.count);
    this.meter.firstElementChild.style.width = `${this.count / CosmiiAbility.REQUIRED_TOKENS * 100}%`;
    this.hud.classList.toggle('is-bonus', bonus);
    this.hud.classList.toggle('hidden', !this.enabled);
  }

  _randomDelay([min, max]) {
    return min + Math.random() * (max - min);
  }
}
