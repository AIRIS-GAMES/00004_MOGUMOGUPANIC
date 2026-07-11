/* =========================================================
 * UI - DOM ベースの画面・HUD 管理
 * 画面の表示切り替え、HUD 更新、スキングリッド生成、
 * ボタンイベントの仲介(コールバックは Game から受け取る)。
 * ========================================================= */
class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.selectedBoosts = new Set();

    this.screens = {
      splash:  $('screen-splash'),
      loading: $('screen-loading'),
      title:   $('screen-title'),
      stage:   $('screen-stage'),
      skin:    $('screen-skin'),
      boost:   $('screen-boost'),
      hud:     $('hud'),
      pause:   $('screen-pause'),
      result:  $('screen-result'),
    };

    this.el = {
      loadFill:  $('load-bar-fill'),
      score:     $('hud-score'),
      size:      $('hud-size'),
      time:      $('hud-time'),
      target:    $('hud-target'),
      titleCoins: $('title-coins'),
      stageGrid: $('stage-grid'),
      comboPop:  $('combo-pop'),
      stageIntro: $('stage-intro'),
      stageIntroNumber: $('stage-intro-number'),
      stageIntroName: $('stage-intro-name'),
      stageIntroStory: $('stage-intro-story'),
      gaugeWrap: $('gauge-wrap'),
      gaugeFill: $('gauge-fill'),
      skinGrid:  $('skin-grid'),
      effectGrid: $('effect-grid'),
      shopCoins: $('shop-coins'),
      shopNotice: $('shop-notice'),
      boostCoins: $('boost-coins'),
      boostGrid: $('boost-grid'),
      boostTotal: $('boost-total'),
      boostStageName: $('boost-stage-name'),
      btnSound:  $('btn-sound'),
      resScore:  $('res-score'),
      resBest:   $('res-best'),
      resCount:  $('res-count'),
      resSize:   $('res-size'),
      resNew:    $('res-new'),
      resTitle:  $('res-title'),
      resReward: $('res-reward'),
      resStory: $('res-story'),
      loginBonus: $('login-bonus'),
      loginAmount: $('login-bonus-amount'),
    };

    this.buttons = {
      start:      $('btn-start'),
      stageSelect: $('btn-stage-select'),
      skin:       $('btn-skin'),
      sound:      $('btn-sound'),
      skinBack:   $('btn-skin-back'),
      shopSkins:  $('btn-shop-skins'),
      shopEffects: $('btn-shop-effects'),
      boostStart: $('btn-boost-start'),
      boostBack:  $('btn-boost-back'),
      stageBack:  $('btn-stage-back'),
      pause:      $('btn-pause'),
      resume:     $('btn-resume'),
      pauseHome:  $('btn-pause-home'),
      again:      $('btn-again'),
      nextStage:  $('btn-next-stage'),
      resultHome: $('btn-result-home'),
      loginBonus: $('btn-login-bonus'),
    };
  }

  /** ボタンにコールバックを紐付ける */
  bind(handlers) {
    const map = {
      start: handlers.onStart,
      stageSelect: handlers.onStageSelect,
      skin: handlers.onSkinOpen,
      sound: handlers.onSoundToggle,
      skinBack: handlers.onSkinBack,
      shopSkins: handlers.onShopSkins,
      shopEffects: handlers.onShopEffects,
      boostBack: handlers.onBoostBack,
      stageBack: handlers.onStageBack,
      pause: handlers.onPause,
      resume: handlers.onResume,
      pauseHome: handlers.onHome,
      again: handlers.onAgain,
      nextStage: handlers.onNextStage,
      resultHome: handlers.onHome,
      loginBonus: handlers.onLoginBonusClose,
    };
    for (const [key, fn] of Object.entries(map)) {
      if (fn) this.buttons[key].addEventListener('click', fn);
    }
    this.buttons.boostStart.addEventListener('click', () => {
      if (handlers.onBoostStart) handlers.onBoostStart([...this.selectedBoosts]);
    });
  }

  /** 指定した画面だけ表示する(複数可) */
  showScreen(...names) {
    for (const [name, elem] of Object.entries(this.screens)) {
      elem.classList.toggle('hidden', !names.includes(name));
    }
  }

  setLoadProgress(ratio) {
    this.el.loadFill.style.width = `${Math.round(ratio * 100)}%`;
  }

  updateCoins(coins) {
    this.el.titleCoins.textContent = coins.toLocaleString();
  }

  updateContinueStage(stageId) {
    this.buttons.start.textContent = `CONTINUE - STAGE ${stageId}`;
  }

  buildStageGrid(stages, unlockedStage, clearedStages, onPick) {
    this.el.stageGrid.innerHTML = '';
    for (const stage of stages) {
      const unlocked = stage.id <= unlockedStage;
      const cleared = clearedStages.includes(stage.id);
      const card = document.createElement('button');
      card.className = `stage-card${cleared ? ' cleared' : ''}`;
      card.disabled = !unlocked;
      card.innerHTML = `
        <span class="stage-number">${unlocked ? `STAGE ${stage.id}` : 'LOCKED'}</span>
        <strong>${unlocked ? stage.name : '???'}</strong>
        <span>目標 ${stage.targetScore.toLocaleString()}</span>
        <span>${stage.time}秒 / 報酬 <img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> ${stage.rewardCoins.toLocaleString()}</span>
        ${cleared ? '<b>CLEARED</b>' : ''}`;
      if (unlocked) card.addEventListener('click', () => onPick(stage.id));
      this.el.stageGrid.appendChild(card);
    }
  }

  showLoginBonus(amount) {
    this.el.loginAmount.textContent = `+${amount.toLocaleString()}`;
    this.el.loginBonus.classList.remove('hidden');
  }

  closeLoginBonus() { this.el.loginBonus.classList.add('hidden'); }

  showStageIntro(stage) {
    this.el.stageIntroNumber.textContent = `STAGE ${stage.id}`;
    this.el.stageIntroName.textContent = stage.name;
    this.el.stageIntroStory.textContent = stage.story;
    this.el.stageIntro.classList.remove('hidden');
    this.buttons.pause.disabled = true;
  }

  hideStageIntro() {
    this.el.stageIntro.classList.add('hidden');
    this.buttons.pause.disabled = false;
  }

  /* ---- HUD ---- */

  updateHUD(score, size, timeLeft, targetScore = 0) {
    this.el.score.textContent = score.toLocaleString();
    this.el.size.textContent = `×${size.toFixed(2)}`;
    const t = Math.max(0, Math.ceil(timeLeft));
    this.el.time.textContent = t;
    this.el.time.classList.toggle('warn', t <= 10);
    this.el.target.textContent = targetScore.toLocaleString();
  }

  setGauge(ratio, active) {
    this.el.gaugeFill.style.width = `${Math.round(ratio * 100)}%`;
    this.el.gaugeWrap.classList.toggle('active', active);
  }

  /** コンボ表示(アニメを再トリガー) */
  showCombo(mult) {
    const pop = this.el.comboPop;
    pop.textContent = `COMBO ×${mult}`;
    pop.classList.remove('show');
    void pop.offsetWidth; // リフロー強制でアニメ再生し直し
    pop.classList.add('show');
  }

  setSoundLabel(on) {
    this.el.btnSound.textContent = `SOUND : ${on ? 'ON' : 'OFF'}`;
  }

  /* ---- スキン選択 ---- */

  /**
   * スキンカードを生成する。
   * @param {Array} skins    SKINS 定義
   * @param {string} selected 選択中の id
   * @param {function} onPick クリック時コールバック(id)
   */
  buildSkinGrid(skins, selected, owned, coins, onPick) {
    this.el.shopCoins.textContent = coins.toLocaleString();
    this.el.skinGrid.innerHTML = '';
    for (const skin of skins) {
      const isOwned = owned.includes(skin.id);
      const card = document.createElement('button');
      card.className = 'skin-card' + (skin.id === selected ? ' selected' : '') + (!isOwned ? ' locked' : '') + (!isOwned && skin.price > coins ? ' unaffordable' : '');
      card.dataset.skinId = skin.id;
      card.setAttribute('aria-label', isOwned ? `${skin.name}を装備` : `${skin.name}を${skin.price}コインで購入`);
      const action = isOwned
        ? (skin.id === selected ? '装備中' : '選択する')
        : `<span>購入</span><img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> ${skin.price.toLocaleString()}`;
      card.innerHTML = `
        ${isOwned ? '' : '<span class="lock-badge">LOCKED</span>'}
        <img class="skin-image" src="${skin.closedSrc}" alt="${skin.name}">
        <span class="skin-name">${skin.name}</span>
        <span class="skin-ability">${skin.ability}</span>
        <b class="shop-price">${action}</b>`;
      card.addEventListener('click', () => onPick(skin.id));
      this.el.skinGrid.appendChild(card);
    }
  }

  showShopNotice(message = '', error = false) {
    this.el.shopNotice.textContent = message;
    this.el.shopNotice.classList.toggle('error', error);
  }

  buildEffectGrid(effects, selected, owned, coins, onPick) {
    this.el.shopCoins.textContent = coins.toLocaleString();
    this.el.effectGrid.innerHTML = '';
    for (const effect of effects) {
      const isOwned = owned.includes(effect.id);
      const card = document.createElement('button');
      card.className = 'effect-card' + (effect.id === selected ? ' selected' : '') + (!isOwned && effect.price > coins ? ' unaffordable' : '');
      card.dataset.effectId = effect.id;
      card.innerHTML = `
        <span class="effect-preview" style="--effect-color:${effect.color}">${effect.symbol}</span>
        <strong>${effect.name}</strong>
        <span>${effect.description}</span>
        <b class="shop-price">${isOwned ? (effect.id === selected ? 'EQUIPPED' : 'OWNED') : `<img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> ${effect.price.toLocaleString()}`}</b>`;
      card.addEventListener('click', () => onPick(effect.id));
      this.el.effectGrid.appendChild(card);
    }
  }

  showShopTab(tab) {
    const skins = tab === 'skins';
    this.el.skinGrid.classList.toggle('hidden', !skins);
    this.el.effectGrid.classList.toggle('hidden', skins);
    this.buttons.shopSkins.classList.toggle('selected', skins);
    this.buttons.shopEffects.classList.toggle('selected', !skins);
  }

  showBoosts(stage, boosts, coins) {
    this.selectedBoosts = new Set();
    this.el.boostStageName.textContent = `STAGE ${stage.id} - ${stage.name}`;
    this.el.boostCoins.textContent = coins.toLocaleString();
    this.el.boostGrid.innerHTML = '';
    for (const boost of boosts) {
      const card = document.createElement('button');
      card.className = 'boost-card';
      card.dataset.boostId = boost.id;
      card.innerHTML = `<strong>${boost.name}</strong><span>${boost.description}</span><b><img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> ${boost.price.toLocaleString()}</b>`;
      card.addEventListener('click', () => {
        if (this.selectedBoosts.has(boost.id)) this.selectedBoosts.delete(boost.id);
        else this.selectedBoosts.add(boost.id);
        card.classList.toggle('selected', this.selectedBoosts.has(boost.id));
        this._updateBoostTotal(boosts, coins);
      });
      this.el.boostGrid.appendChild(card);
    }
    this._updateBoostTotal(boosts, coins);
    this.showScreen('boost');
  }

  _updateBoostTotal(boosts, coins) {
    const total = boosts.filter(item => this.selectedBoosts.has(item.id)).reduce((sum, item) => sum + item.price, 0);
    this.el.boostTotal.textContent = total.toLocaleString();
    this.buttons.boostStart.disabled = total > coins;
  }

  /** 選択中カードのハイライトだけ更新 */
  updateSkinSelection(selected) {
    for (const card of this.el.skinGrid.children) {
      card.classList.toggle('selected', card.dataset.skinId === selected);
    }
  }

  /* ---- リザルト ---- */

  showResult({ score, best, isNewBest, count, maxSize, cleared, reward, hasNext, stage }) {
    this.el.resScore.textContent = score.toLocaleString();
    this.el.resBest.textContent = best.toLocaleString();
    this.el.resCount.textContent = count.toLocaleString();
    this.el.resSize.textContent = `×${maxSize.toFixed(2)}`;
    this.el.resNew.classList.toggle('hidden', !isNewBest);
    this.el.resTitle.textContent = cleared ? 'STAGE CLEAR!' : 'TRY AGAIN';
    this.el.resReward.innerHTML = `<img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> +${reward.toLocaleString()}`;
    this.el.resReward.classList.toggle('hidden', reward <= 0);
    this.buttons.nextStage.classList.toggle('hidden', !hasNext);
    this.el.resStory.textContent = cleared ? stage.clearText : 'エラーを回収しきれなかった。準備を整えて、もう一度挑戦しよう。';
    this.showScreen('hud', 'result');
  }
}
