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
      mission: $('screen-mission'),
      zukan:   $('screen-zukan'),
      ufo:     $('screen-ufo'),
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
      hudArea:   $('hud-area'),
      progressFace: $('hud-progress-face'),
      resBest:   $('res-best'),
      resCount:  $('res-count'),
      resSize:   $('res-size'),
      resNew:    $('res-new'),
      resTitle:  $('res-title'),
      resReward: $('res-reward'),
      resStory: $('res-story'),
      loginBonus: $('login-bonus'),
      loginAmount: $('login-bonus-amount'),
      loginDay: $('login-bonus-day'),
      loginStreak: $('login-streak'),
      loginNext: $('login-bonus-next'),
      titleStars: $('title-stars'),
      titleStarsMax: $('title-stars-max'),
      missionBadge: $('mission-badge'),
      missionList: $('mission-list'),
      tutorial: $('tutorial'),
      tutorialText: $('tutorial-text'),
      resStars: $('res-stars'),
      resStarHint: $('res-star-hint'),
      resMission: $('res-mission'),
      notifyPrompt: $('notify-prompt'),
      bugWheel: $('bug-wheel'),
      wheelSvg: $('wheel-svg'),
      wheelResultName: $('wheel-result-name'),
      wheelResultDesc: $('wheel-result-desc'),
      bugBadge: $('bug-badge'),
      resBug: $('res-bug'),
      introGimmick: $('stage-intro-gimmick'),
      progressFill: $('hud-progress-fill'),
      zukanBadge: $('zukan-badge'),
      zukanTabs: $('zukan-tabs'),
      zukanPage: $('zukan-page'),
      zukanNew: $('zukan-new'),
      ufoCoins: $('ufo-coins'),
      ufoOwned: $('ufo-owned'),
      ufoPlay: $('btn-ufo-play'),
      gimmickToast: $('gimmick-toast'),
    };

    this.buttons = {
      start:      $('btn-start'),
      endless:    $('btn-endless'),
      ranking:    $('btn-ranking'),
      skin:       $('btn-skin'),
      sound:      $('btn-sound'),
      skinBack:   $('btn-skin-back'),
      shopSkins:  $('btn-shop-skins'),
      shopEffects: $('btn-shop-effects'),
      boostStart: $('btn-boost-start'),
      boostBack:  $('btn-boost-back'),
      stageBack:  $('btn-stage-back'),
      pause:      $('btn-pause'),
      hudSound:   $('btn-hud-sound'),
      resume:     $('btn-resume'),
      pauseHome:  $('btn-pause-home'),
      again:      $('btn-again'),
      nextStage:  $('btn-next-stage'),
      resultHome: $('btn-result-home'),
      loginBonus: $('btn-login-bonus'),
      mission:    $('btn-mission'),
      missionBack: $('btn-mission-back'),
      zukan:      $('btn-zukan'),
      zukanBack:  $('btn-zukan-back'),
      ufo:        $('btn-ufo'),
      ufoBack:    $('btn-ufo-back'),
      notifyAccept: $('btn-notify-accept'),
      notifyLater: $('btn-notify-later'),
    };
  }

  /** ボタンにコールバックを紐付ける */
  bind(handlers) {
    const map = {
      start: handlers.onStart,
      endless: handlers.onEndless,
      ranking: handlers.onRanking,
      skin: handlers.onSkinOpen,
      sound: handlers.onSoundToggle,
      skinBack: handlers.onSkinBack,
      shopSkins: handlers.onShopSkins,
      shopEffects: handlers.onShopEffects,
      boostBack: handlers.onBoostBack,
      stageBack: handlers.onStageBack,
      pause: handlers.onPause,
      hudSound: handlers.onSoundToggle,
      resume: handlers.onResume,
      pauseHome: handlers.onHome,
      again: handlers.onAgain,
      nextStage: handlers.onNextStage,
      resultHome: handlers.onHome,
      loginBonus: handlers.onLoginBonusClose,
      mission: handlers.onMissionOpen,
      missionBack: handlers.onMissionBack,
      zukan: handlers.onZukanOpen,
      zukanBack: handlers.onMissionBack,
      ufo: handlers.onUfoOpen,
      ufoBack: handlers.onUfoBack,
      notifyAccept: handlers.onNotifyAccept,
      notifyLater: handlers.onNotifyLater,
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
    this.clearCombo();
    this.resultCoins?.remove();
    this.resultCoins = null;
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

  shakeButton(btn) {
    btn.classList.remove('shake');
    void btn.offsetWidth;
    btn.classList.add('shake');
  }

  /** タイトルのエンドレスボタン(解放前はカギ付き) */
  updateEndless(unlocked, best, unlockStage) {
    const btn = this.buttons.endless;
    btn.classList.toggle('locked', !unlocked);
    btn.setAttribute('aria-disabled', String(!unlocked));
    const sub = document.getElementById('endless-best');
    sub.textContent = !unlocked ? `STAGE ${unlockStage}で解放` : best > 0 ? `BEST ${best.toLocaleString()}` : 'NEW!';
  }

  /** タイトルの大きいボタン:ステージ選択へ(今のステージのカードが開く) */
  updateContinueStage(stageId) {
    this.buttons.start.innerHTML = `<span class="play-main">PLAY ▶</span><small class="play-sub">STAGE ${stageId}</small>`;
    this.buttons.start.setAttribute('aria-label', `ステージをえらぶ(いまはSTAGE ${stageId})`);
  }

  /** ★表示用の文字列(獲得数ぶん塗りつぶし) */
  static starMarkup(count) {
    return [1, 2, 3].map(i => `<i class="${i <= count ? 'on' : ''}">★</i>`).join('');
  }

  updateStars(total, max) {
    this.el.titleStars.textContent = total;
    this.el.titleStarsMax.textContent = `/${max}`;
  }

  setMissionBadge(count) {
    this.el.missionBadge.classList.toggle('hidden', count <= 0);
  }

  /**
   * ステージ選択:大きなカードを横にスワイプ。1枚に1ステージ
   *  - カードの中では、その面の街のジオラマが動く(ギミックも小さく再現)
   *  - ★3つと、その★の条件(旗=クリア、時計=タイム)。下の点で全体のクリア状況
   *  - 「あそぶ」でコスミーが街ごとパクッと食べてから始まる
   */
  buildStageGrid(stages, unlockedStage, clearedStages, onPick, starsOf = () => 0, ctx = {}) {
    const track = this.el.stageGrid;
    const dots = document.getElementById('card-dots');
    track.innerHTML = '';
    dots.innerHTML = '';
    this.dioramas = [];
    const flag = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M6 4h11l-2.5 4L17 12H6Z" fill="currentColor"/></svg>';
    const clock = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 13V9M9.5 3h5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
    stages.forEach((stage, i) => {
      const unlocked = stage.id <= unlockedStage;
      const cleared = clearedStages.includes(stage.id);
      const stars = unlocked ? starsOf(stage) : 0;
      const info = StageGimmicks.infoFor(stage.id);
      const times = stage.starTimes || [];
      const conds = [flag, `${clock}${times[0]}s`, `${clock}${times[1]}s`];
      const best = Storage.getClearTime(stage.id);
      const card = document.createElement('div');
      card.className = `stage-card2${unlocked ? '' : ' locked'}${stage.id > 10 ? ' night' : ''}${cleared ? ' cleared' : ''}`;
      card.dataset.id = stage.id;
      card.setAttribute('aria-label', unlocked ? `STAGE ${stage.id} ${stage.name} ★${stars}` : `STAGE ${stage.id} (まだ遊べない)`);
      card.innerHTML = `
        <div class="sc-head"><span class="sc-num">STAGE ${stage.id}</span><b class="sc-name">${unlocked ? stage.name : '？？？'}</b></div>
        <div class="sc-view"><canvas width="600" height="600"></canvas>
          ${info && unlocked ? `<span class="sc-gimmicks">${StageGimmicks.chipsFor(stage.id).map(c => `<span class="sc-g"><svg viewBox="0 0 24 24" aria-hidden="true">${c.icon}</svg>${c.name}${c.count > 1 ? `<small>×${c.count}</small>` : ''}</span>`).join('')}</span>` : ''}
          ${unlocked ? '' : `<div class="sc-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#fff"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="#fff" stroke-width="2.8"/></svg></div>`}
        </div>
        <div class="stage-stars sc-stars">${[0, 1, 2].map(k => `<span class="sc-star"><i class="${k < stars ? 'on' : ''}">★</i><small>${conds[k]}</small></span>`).join('')}</div>
        <div class="sc-best">${best !== null && unlocked ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v3a7 7 0 0 1-14 0Z M12 15v3M8 21h8" fill="#ffd24d" stroke="#4f3a40" stroke-width="2.2" stroke-linejoin="round"/></svg>${best.toFixed(2)}s` : '&nbsp;'}</div>
        <button class="sc-play" type="button" ${unlocked ? '' : 'disabled'}>${unlocked ? 'あそぶ<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l10 7-10 7Z" fill="#fff"/></svg>' : `STAGE ${stage.id - 1} をクリア`}</button>`;
      track.appendChild(card);
      const canvas = card.querySelector('canvas');
      const dio = new StageDiorama(canvas, stage, { images: ctx.images, skin: ctx.skin, kinds: StageGimmicks.kindsFor(stage.id) });
      dio.update(0.5); dio.draw();
      this.dioramas.push(dio);
      if (unlocked) card.querySelector('.sc-play').addEventListener('click', () => {
        if (this.cardBusy) return;
        this.cardBusy = true;
        dio.eatAll = 0.01;
        setTimeout(() => { this.cardBusy = false; onPick(stage.id); }, 650);
      });
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `card-dot${!unlocked ? ' locked' : stars >= 3 ? ' s3' : stars > 0 ? ' s1' : ''}${stage.id > 10 ? ' night' : ''}`;
      dot.setAttribute('aria-label', `STAGE ${stage.id}`);
      dot.addEventListener('click', () => this._scrollToCard(i, true));
      dots.appendChild(dot);
    });
    this.cardIndex = -1;
    const onScroll = () => {
      if (this.cardScrollFrame) return;
      this.cardScrollFrame = requestAnimationFrame(() => { this.cardScrollFrame = null; this._updateActiveCard(); });
    };
    track.onscroll = onScroll;
    const start = Math.max(0, Math.min(stages.length, unlockedStage) - 1);
    requestAnimationFrame(() => { this._scrollToCard(start, false); this._updateActiveCard(); });
    this._startCardLoop();
  }

  _scrollToCard(i, smooth) {
    const track = this.el.stageGrid, card = track.children[i];
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  _updateActiveCard() {
    const track = this.el.stageGrid, mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bd = Infinity;
    [...track.children].forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    if (best === this.cardIndex) return;
    this.cardIndex = best;
    [...track.children].forEach((c, i) => c.classList.toggle('active', i === best));
    [...document.getElementById('card-dots').children].forEach((d, i) => d.classList.toggle('active', i === best));
  }

  /** 真ん中のカードのジオラマだけ動かす(ほかは止めた絵のまま) */
  _startCardLoop() {
    if (this.cardLoop) return;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.screens.stage.classList.contains('hidden')) { this.cardLoop = null; return; }
      const dio = this.dioramas && this.dioramas[this.cardIndex];
      if (dio) { dio.update(dt); dio.draw(); }
      this.cardLoop = requestAnimationFrame(loop);
    };
    this.cardLoop = requestAnimationFrame(loop);
  }

  /** 開始前のローディング:コスミーが点を食べながら進む */
  showLoading(on, faceSrc = '', label = '') {
    const el = document.getElementById('loading-screen');
    if (!el) return;
    if (on) {
      const img = document.getElementById('ld-cosmii');
      if (faceSrc && img.getAttribute('src') !== faceSrc) img.src = faceSrc;
      document.getElementById('ld-stage').textContent = label;
    }
    el.classList.toggle('hidden', !on);
  }

  setMapBadges(stars, maxStars, coins) {
    document.getElementById('map-stars').textContent = `${stars}/${maxStars}`;
    document.getElementById('map-coins').textContent = coins.toLocaleString();
  }


  showLoginBonus(amount, day = 1, rewards = [amount]) {
    this.el.loginAmount.textContent = `+${amount.toLocaleString()}`;
    this.el.loginDay.textContent = `連続ログイン ${day}日目`;
    this.el.loginStreak.innerHTML = rewards.map((value, i) => {
      const n = i + 1;
      const state = n < day ? 'got' : n === day ? 'today' : '';
      return `<li class="${state}${n === rewards.length ? ' big' : ''}"><span>${n}日目</span><b>${n < day ? '✓' : value.toLocaleString()}</b></li>`;
    }).join('');
    const nextDay = day % rewards.length + 1;
    this.el.loginNext.textContent = `明日は +${rewards[nextDay - 1].toLocaleString()}コイン！ 1日あくと1日目にもどるよ`;
    this.el.loginBonus.classList.remove('hidden');
  }

  closeLoginBonus() { this.el.loginBonus.classList.add('hidden'); }

  /**
   * ステージ紹介(物語とギミック)。バグルーレットはこの後に別画面で回す。
   * @param {number} duration 紹介全体の秒数(CSS アニメの長さに合わせる)
   */
  showStageIntro(stage, duration = 3.5, gimmick = null) {
    // ギミックの説明や札は出さず、そのコースで気をつけることをひと言だけ
    const tip = gimmick && gimmick.tip ? gimmick.tip : '';
    this.el.introGimmick.classList.toggle('hidden', !tip);
    this.el.introGimmick.innerHTML = tip ? '<i class="intro-tip-mark" aria-hidden="true">!</i><b></b>' : '';
    if (tip) this.el.introGimmick.querySelector('b').textContent = tip;
    this.el.stageIntro.classList.toggle('has-gimmick', !!tip);
    this.el.gimmickToast.classList.remove('show');
    this.el.stageIntroNumber.textContent = stage.introLabel || `STAGE ${stage.id}`;
    this.el.stageIntroName.textContent = stage.name;
    this.el.stageIntroStory.textContent = stage.story;
    this.el.stageIntro.style.animationDuration = `${duration}s`;
    this.el.stageIntro.classList.remove('hidden');
    this.buttons.pause.disabled = true;
    this.hideBugBadge();
    this.hideWheel();
  }

  hideStageIntro() {
    this.el.stageIntro.classList.add('hidden');
    this.buttons.pause.disabled = false;
  }

  /* ---- バグルーレット(円盤) ---- */

  /** 円盤の SVG を作る。区切りの真ん中が上の針に来たとき、そのバグに止まる */
  _buildWheel(bugs) {
    if (this.wheelBuiltFor === bugs) return;
    this.wheelBuiltFor = bugs;
    const NS = 'http://www.w3.org/2000/svg';
    const point = (deg, r) => {
      const rad = deg * Math.PI / 180;
      return `${(Math.sin(rad) * r).toFixed(2)} ${(-Math.cos(rad) * r).toFixed(2)}`;
    };
    const step = 360 / bugs.length;
    let rotor = '';
    bugs.forEach((bug, i) => {
      const a0 = i * step, a1 = (i + 1) * step, c = a0 + step / 2;
      rotor += `<g class="wheel-seg" data-index="${i}">
        <path d="M0 0 L${point(a0, 92)} A92 92 0 0 1 ${point(a1, 92)} Z" fill="${bug.color}" stroke="#2a2233" stroke-width="3"/>
        <path d="M0 0 L${point(a0, 92)} A92 92 0 0 1 ${point(a1, 92)} Z" fill="url(#wheel-shine)"/>
        <text transform="rotate(${c}) translate(0 -58)" text-anchor="middle" dominant-baseline="middle">${bug.short}</text>
      </g>`;
    });
    // 外周のピン(30度ごと)。針を通過するたびにカチッと鳴る(音もこの間隔で作ってある)
    for (let k = 0; k < 360 / BugRoulette.PEG_DEG; k++) {
      rotor += `<circle class="wheel-peg" cx="${point(k * BugRoulette.PEG_DEG, 86).split(' ')[0]}" cy="${point(k * BugRoulette.PEG_DEG, 86).split(' ')[1]}" r="3.2"/>`;
    }
    let bulbs = '';
    for (let k = 0; k < 16; k++) {
      const [x, y] = point(k * 22.5 + 11.25, 101).split(' ');
      bulbs += `<circle class="wheel-bulb${k % 2 ? ' alt' : ''}" cx="${x}" cy="${y}" r="3.6"/>`;
    }
    this.el.wheelSvg.innerHTML = `
      <defs>
        <radialGradient id="wheel-shine" cx="0" cy="0" r="92" gradientUnits="userSpaceOnUse">
          <stop offset="0.25" stop-color="#fff" stop-opacity="0.35"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle r="108" fill="#2a2233"/>
      <circle r="96" fill="#3b3147"/>
      ${bulbs}
      <g id="wheel-rotor">${rotor}</g>
      <circle r="19" fill="#fffaf0" stroke="#2a2233" stroke-width="4"/>
      <text class="wheel-hub" text-anchor="middle" dominant-baseline="middle" y="1">BUG</text>`;
    this.el.wheelRotor = this.el.wheelSvg.querySelector('#wheel-rotor');
    this.el.wheelSegs = [...this.el.wheelSvg.querySelectorAll('.wheel-seg')];
  }

  showWheel(bugs, angle) {
    this._buildWheel(bugs);
    const wheel = this.el.bugWheel;
    wheel.classList.remove('landed', 'hidden');
    wheel.style.removeProperty('--bug-color');
    this.el.wheelResultName.textContent = '';
    this.el.wheelResultDesc.textContent = '';
    for (const seg of this.el.wheelSegs) seg.classList.remove('hit', 'miss');
    this.setWheelAngle(angle);
    this.buttons.pause.disabled = true;
  }

  setWheelAngle(deg) {
    if (this.el.wheelRotor) this.el.wheelRotor.setAttribute('transform', `rotate(${deg.toFixed(2)})`);
  }

  landWheel(bug, index) {
    const wheel = this.el.bugWheel;
    wheel.classList.add('landed');
    wheel.style.setProperty('--bug-color', bug.color);
    this.el.wheelSegs.forEach((seg, i) => seg.classList.add(i === index ? 'hit' : 'miss'));
    this.el.wheelResultName.textContent = bug.name;
    this.el.wheelResultDesc.textContent = bug.description;
  }

  hideWheel() {
    this.el.bugWheel.classList.add('hidden');
  }

  /** プレイ中の進み具合バーに乗せるコスミーの顔 */
  setHudFace(src) {
    const face = document.getElementById('hud-progress-face');
    if (face && face.getAttribute('src') !== src) face.setAttribute('src', src);
  }

  /** バグの種類ごとの小さなアイコン(文字のかわり) */
  static bugIcon(id) {
    const ink = '#fff';
    const s = `fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
    const icons = {
      mini: `<path d="M4 4l6 6M10 5v5H5M20 20l-6-6M14 19v-5h5" ${s}/>`,
      giant: `<path d="M10 10L4 4M4 9V4h5M14 14l6 6M20 15v5h-5" ${s}/>`,
      confuse: `<path d="M12 12a1.5 1.5 0 1 1 1.5-1.5 3.5 3.5 0 1 1-3.5 3.5 5.5 5.5 0 1 1 5.5-5.5" ${s}/>`,
      slippery: `<path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11Z" ${s}/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" ${s}/>`,
      none: `<circle cx="12" cy="12" r="8.5" ${s}/><path d="M8.5 13.5a4 4 0 0 0 7 0" ${s}/><path d="M9 9.5v.5M15 9.5v.5" ${s}/>`,
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id] || icons.confuse}</svg><span class="visually-hidden">`;
  }

  showBugBadge(bug) {
    if (!bug) { this.hideBugBadge(); return; }
    this.el.bugBadge.innerHTML = `${UI.bugIcon(bug.id)}${bug.short || bug.name}</span>`;
    this.el.bugBadge.setAttribute('aria-label', `発生中のバグ：${bug.name}`);
    this.el.bugBadge.style.setProperty('--bug-color', bug.color);
    this.el.bugBadge.style.setProperty('--left', '100%');
    this._bugRatio = 100;
    this.el.bugBadge.classList.remove('ending');
    this.el.bugBadge.classList.remove('hidden');
  }

  hideBugBadge() { this.el.bugBadge.classList.add('hidden'); }

  /** バグの残り時間(1→0)を、バッジのまわりの輪で見せる */
  updateBugBadge(ratio) {
    const v = Math.round(ratio * 100);
    if (v === this._bugRatio) return;
    this._bugRatio = v;
    this.el.bugBadge.style.setProperty('--left', `${v}%`);
    this.el.bugBadge.classList.toggle('ending', ratio < 0.2);
  }

  /** スコアが減った:数字が赤くなって揺れる(文字は出さない) */
  flashScoreLoss() {
    const el = this.el.score && this.el.score.parentElement;
    if (!el || !el.classList) return;
    el.classList.remove('loss');
    void el.offsetWidth;
    el.classList.add('loss');
    clearTimeout(this.scoreLossTimer);
    this.scoreLossTimer = setTimeout(() => el.classList.remove('loss'), 700);
  }

  /** ギミックのお知らせ(セール開始・停電など)を一瞬表示 */
  showGimmickToast(text) {
    const toast = this.el.gimmickToast;
    toast.textContent = text;
    toast.classList.remove('show');
    clearTimeout(this.gimmickToastTimer);
    requestAnimationFrame(() => toast.classList.add('show'));
    this.gimmickToastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  /* ---- チュートリアル ---- */

  showTutorial(text, hand = true) {
    this.el.tutorialText.textContent = text;
    this.el.tutorial.classList.toggle('no-hand', !hand);
    this.el.tutorial.classList.remove('hidden');
  }

  hideTutorial() { this.el.tutorial.classList.add('hidden'); }

  /* ---- デイリーミッション ---- */

  buildMissionList(missions, onClaim) {
    const list = this.el.missionList;
    list.innerHTML = '';
    for (const m of missions) {
      const card = document.createElement('div');
      card.className = `mission-card${m.done ? ' done' : ''}${m.claimed ? ' claimed' : ''}`;
      const ratio = Math.min(1, m.progress / m.goal);
      card.innerHTML = `
        <div class="mission-body">
          <strong>${m.text}</strong>
          <div class="mission-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.goal}" aria-valuenow="${m.progress}"><i style="width:${Math.round(ratio * 100)}%"></i></div>
          <span class="mission-progress">${m.progress.toLocaleString()} / ${m.goal.toLocaleString()}</span>
        </div>`;
      const button = document.createElement('button');
      button.className = 'mission-claim';
      button.type = 'button';
      if (m.claimed) {
        button.textContent = '受取済み';
        button.disabled = true;
      } else {
        button.innerHTML = `<img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> ${m.reward}`;
        button.disabled = !m.done;
        button.setAttribute('aria-label', m.done ? `${m.reward}コインを受け取る` : `報酬 ${m.reward}コイン(未達成)`);
        if (m.done) button.addEventListener('click', () => onClaim(m.id));
      }
      card.append(button);
      list.append(card);
    }
  }

  /* ---- ずかん ---- */

  setZukanBadge(count) { this.el.zukanBadge.classList.toggle('hidden', count <= 0); }

  buildZukan(pageIndex, onTab, onClaim) {
    const state = Zukan.state();
    this.el.zukanTabs.innerHTML = '';
    Zukan.PAGES.forEach((page, i) => {
      const st = Zukan.pageStatus(page, state);
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `zukan-tab${i === pageIndex ? ' selected' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(i === pageIndex));
      const claimable = (st.done && !st.claimed) || (st.rareDone && !st.rareClaimed);
      tab.innerHTML = `<img src="${Zukan.imageUrl(page.items[0], st.seen ? 'normal' : 'unknown')}" alt=""><span>${st.seen}/${st.total}</span>${claimable ? '<i class="tab-dot"></i>' : ''}`;
      tab.setAttribute('aria-label', `${page.name} ${st.seen}/${st.total}`);
      tab.addEventListener('click', () => onTab(i));
      this.el.zukanTabs.append(tab);
    });
    const page = Zukan.PAGES[pageIndex];
    const st = Zukan.pageStatus(page, state);
    const rows = page.items.map(id => {
      const seen = !!state.seen[id];
      const rareOk = Zukan.hasRare(id);
      const rare = !!state.rare[id];
      return `<div class="zukan-row">
        <div class="zukan-cell${seen ? '' : ' unknown'}"><img src="${Zukan.imageUrl(id, seen ? 'normal' : 'unknown')}" alt="${seen ? '' : 'まだ見ていない'}"></div>
        ${rareOk ? `<div class="zukan-cell rare${rare ? '' : ' unknown'}"><img src="${Zukan.imageUrl(id, rare ? 'rare' : 'unknown')}" alt="${rare ? '色違い' : 'まだ見ていない色違い'}"></div>` : '<div class="zukan-cell none"></div>'}
      </div>`;
    }).join('');
    const reward = (kind) => {
      const done = kind === 'rare' ? st.rareDone : st.done;
      const claimed = kind === 'rare' ? st.rareClaimed : st.claimed;
      const icon = kind === 'rare'
        ? `<img class="reward-acc" src="${Accessories.icon(page.accessory, 64)}" alt="${Accessories.get(page.accessory).name}">`
        : `<img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> ${page.coins}`;
      const count = kind === 'rare' ? `${st.rare}/${st.rareTotal}` : `${st.seen}/${st.total}`;
      return `<button type="button" class="zukan-reward${kind === 'rare' ? ' rare' : ''}${done && !claimed ? ' ready' : ''}" data-kind="${kind}" ${done && !claimed ? '' : 'disabled'}>
        <span class="reward-count">${kind === 'rare' ? '★' : ''}${count}</span>${claimed ? '<span class="reward-done">✓</span>' : icon}</button>`;
    };
    this.el.zukanPage.innerHTML = `<h3>${page.name}</h3>
      <div class="zukan-rewards">${reward('normal')}${reward('rare')}</div>
      <div class="zukan-head"><span>ふつう</span><span>いろちがい</span></div>
      <div class="zukan-grid">${rows}</div>`;
    this.el.zukanPage.querySelectorAll('.zukan-reward:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => onClaim(page.id, btn.dataset.kind));
    });
  }

  /** プレイ中、ずかんに新しく登録された時の小さなお知らせ(絵と NEW だけ) */
  showZukanNew(found) {
    const el = this.el.zukanNew;
    el.querySelector('img').src = Zukan.imageUrl(found.id, found.rare ? 'rare' : 'normal');
    el.classList.toggle('rare', !!found.rare);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.zukanNewTimer);
    this.zukanNewTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  /* ---- UFOキャッチャー ---- */

  setUfoCoins(coins, canPlay) {
    this.el.ufoCoins.textContent = coins.toLocaleString();
    this.el.ufoPlay.classList.toggle('disabled', !canPlay);
    this.el.ufoPlay.classList.toggle('is-ready', canPlay);
  }

  buildUfoOwned(onEquip) {
    const owned = Accessories.owned();
    const equipped = Accessories.equipped();
    const box = this.el.ufoOwned;
    box.innerHTML = '';
    if (!owned.length) {
      box.innerHTML = '<p class="ufo-empty">とったアクセサリーがここに並ぶよ</p>';
      return;
    }
    const none = document.createElement('button');
    none.type = 'button';
    none.className = `acc-chip${equipped ? '' : ' on'}`;
    none.textContent = 'なし';
    none.addEventListener('click', () => onEquip(null));
    box.append(none);
    for (const id of owned) {
      const acc = Accessories.get(id);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `acc-chip${id === equipped ? ' on' : ''}`;
      chip.setAttribute('aria-label', `${acc.name}${id === equipped ? '(つけている)' : ''}`);
      chip.innerHTML = `<img src="${Accessories.icon(id, 64)}" alt="">`;
      chip.addEventListener('click', () => onEquip(id));
      box.append(chip);
    }
  }

  /* ---- 通知の説明ダイアログ ---- */

  showNotifyPrompt() { this.el.notifyPrompt.classList.remove('hidden'); }
  hideNotifyPrompt() { this.el.notifyPrompt.classList.add('hidden'); }

  /* ---- HUD ---- */

  updateHUD(score, size, timeLeft, targetScore = 0, label = '') {
    const scoreText = score.toLocaleString();
    const sizeText = `×${size.toFixed(2)}`;
    if (this.el.score.textContent !== scoreText) this.el.score.textContent = scoreText;
    if (this.el.size.textContent !== sizeText) this.el.size.textContent = sizeText;
    const t = Math.max(0, Math.ceil(timeLeft));
    if (this.el.time.textContent !== String(t)) this.el.time.textContent = t;
    const warn = t <= 10;
    if (warn !== this.lastWarn) {
      this.lastWarn = warn;
      this.el.time.classList.toggle('warn', warn);
      this.el.time.parentElement?.classList?.toggle('warn', warn);
    }
    const left = `あと ${Math.max(0, targetScore - score).toLocaleString()}`;
    // エンドレスのエリア番号だけは数字で見せる(それ以外の文字は出さない)
    const areaText = label ? label.replace('AREA ', '') : '';
    const areaEl = this.el.hudArea;
    if (areaEl && areaEl.textContent !== areaText) areaEl.textContent = areaText;
    const targetText = label ? `${label}  ${left}` : (score >= targetScore && targetScore > 0 ? 'CLEAR!' : left);
    if (this.el.target.textContent !== targetText) {
      this.el.target.textContent = targetText;
      this.el.target.parentElement?.classList?.toggle('is-clear', targetText === 'CLEAR!');
    }
    // 目標までの進み具合バー(1% 単位で変わった時だけ書く)
    if (this.el.progressFill) {
      const pct = targetScore > 0 ? Math.min(100, Math.floor(score / targetScore * 100)) : 0;
      if (pct !== this.lastProgress) {
        this.lastProgress = pct;
        this.el.progressFill.style.width = `${pct}%`;
        const face = this.el.progressFace;
        if (face) face.style.left = `${pct}%`;
      }
    }
  }

  /** エンドレス中はバーを「次のエリアまで」に使う */
  setEndlessHud(on) {
    this.screens.hud.classList.toggle('is-endless', on);
    this.lastProgress = -1;
  }

  /** 食べて時間が増えた:時間の表示を一瞬ふくらませる(数字は出さない) */
  flashTimeGain() {
    const panel = this.el.time.parentElement;
    if (!panel) return;
    panel.classList.remove('gain');
    void panel.offsetWidth;
    panel.classList.add('gain');
  }

  /* ---- コスミーフィーバー ---- */

  bindFeverChoice(onPick, onTap) {
    document.querySelectorAll('#fever-choice .fc-btn').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onPick(btn.dataset.kind); });
    });
    const layer = document.getElementById('mash-layer');
    layer.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); });
  }

  showFeverChoice(on, faceSrc = null, openSrc = null) {
    const el = document.getElementById('fever-choice');
    if (faceSrc) el.querySelectorAll('.fc-face:not([data-fixed])').forEach(img => { if (img.getAttribute('src') !== faceSrc) img.src = faceSrc; });
    const open = openSrc || faceSrc;
    if (open) el.querySelectorAll('.fc-open:not([data-fixed])').forEach(img => { if (img.getAttribute('src') !== open) img.src = open; });
    el.classList.toggle('hidden', !on);
    this.screens.hud.classList.toggle('is-choosing', on);
  }

  showMashLayer(on) {
    document.getElementById('mash-layer').classList.toggle('hidden', !on);
  }

  /** 指のジェスチャーの見本(ダッシュ:はじく、連打:トントン)。文字は出さない */
  showFeverHint(kind, on) {
    const el = document.getElementById('fever-hint');
    if (!on) { if (!kind || el.dataset.kind === kind) el.classList.add('hidden'); return; }
    el.dataset.kind = kind;
    el.classList.remove('hidden');
  }

  /** クリア後の食べ放題 */
  showFever(on) {
    const el = document.getElementById('fever');
    if (!el) return;
    el.classList.toggle('hidden', !on);
    this.screens.hud.classList.toggle('is-fever', on);
    this.lastFeverCoins = -1;
  }

  updateFever(ratio, coins, full = false) {
    document.getElementById('fever-coins')?.parentElement.classList.toggle('full', full);
    const fill = document.getElementById('fever-fill');
    if (fill) fill.style.width = `${Math.round(ratio * 1000) / 10}%`;
    if (coins !== this.lastFeverCoins) {
      const el = document.getElementById('fever-coins');
      if (el) {
        el.textContent = coins;
        el.parentElement.classList.remove('bump');
        void el.offsetWidth;
        el.parentElement.classList.add('bump');
      }
      this.lastFeverCoins = coins;
    }
  }

  /** 次のエリアに入った */
  showAreaBanner(area, name, gimmickName = '') {
    this.showGimmickToast(gimmickName ? `AREA ${area} ${name}  ／  ${gimmickName}` : `AREA ${area} ${name}`);
  }

  setGauge(ratio, active) {
    const width = `${Math.round(ratio * 100)}%`;
    if (this.el.gaugeFill.style.width !== width) this.el.gaugeFill.style.width = width;
    if (active !== this.lastGaugeActive) {
      this.lastGaugeActive = active;
      this.el.gaugeWrap.classList.toggle('active', active);
    }
  }

  clearCombo() {
    if (this.comboFrame != null) cancelAnimationFrame(this.comboFrame);
    this.comboFrame = null;
    this.pendingCombo = null;
    this.lastComboAnimation = -Infinity;
    this.comboAlternate = false;
    this.el.comboPop.classList.remove('show', 'show-alt');
  }

  /** 同じフレームの取得をまとめ、最後のコンボだけ表示する。 */
  showCombo(mult, count) {
    this.pendingCombo = { mult, count };
    if (this.comboFrame != null) return;
    this.comboFrame = requestAnimationFrame(() => {
      this.comboFrame = null;
      const latest = this.pendingCombo;
      this.pendingCombo = null;
      if (!latest) return;
      const pop = this.el.comboPop;
      // 数字だけを本文にし、「COMBO」は CSS で添える(倍率の数字は見せない)
      const text = String(latest.count);
      if (pop.textContent !== text) pop.textContent = text;
      const now = performance.now();
      if (latest.count > 2 && now - (this.lastComboAnimation ?? -Infinity) < 500) return;
      this.lastComboAnimation = now;
      // Alternate equivalent animation names to restart without a layout read.
      this.comboAlternate = !this.comboAlternate;
      pop.classList.remove('show', 'show-alt');
      pop.classList.add(this.comboAlternate ? 'show' : 'show-alt');
    });
  }

  setSoundLabel(on) {
    // 下部メニューのアイコン:OFF のときはスピーカーに×を表示
    this.el.btnSound.classList.toggle('is-off', !on);
    if (this.buttons.hudSound) {
      this.buttons.hudSound.classList.toggle('is-off', !on);
      this.buttons.hudSound.textContent = `SOUND : ${on ? 'ON' : 'OFF'}`;
    }
    this.el.btnSound.setAttribute('aria-pressed', String(on));
    this.el.btnSound.setAttribute('aria-label', `サウンド ${on ? 'ON' : 'OFF'}`);
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

  showBoosts(stage, boosts, coins, faceSrc = null) {
    this.selectedBoosts = new Set();
    this.el.boostStageName.textContent = `STAGE ${stage.id}  ${stage.name}`;
    this.el.boostCoins.textContent = coins.toLocaleString();
    // 上のコスミー:選んだブーストが身につく(大きくなる・時計・星・バリア…)
    const hero = document.getElementById('boost-hero');
    if (hero) {
      const img = hero.querySelector('.bh-face');
      if (faceSrc && img.getAttribute('src') !== faceSrc) img.src = faceSrc;
      hero.className = 'boost-hero';
    }
    this.el.boostGrid.innerHTML = '';
    for (const boost of boosts) {
      const card = document.createElement('button');
      card.className = 'boost-card';
      card.type = 'button';
      card.dataset.boostId = boost.id;
      card.style.setProperty('--bc', boost.color || '#ffd24d');
      card.setAttribute('aria-pressed', 'false');
      card.innerHTML = `<i class="bc-check" aria-hidden="true"></i><span class="bc-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${boost.icon || ''}</svg></span><strong></strong><span class="bc-short"></span><b><img class="currency-icon" src="public/opt/cosmo-coin.webp" alt=""> ${boost.price.toLocaleString()}</b>`;
      card.querySelector('strong').textContent = boost.name;
      card.querySelector('.bc-short').textContent = boost.short || boost.description || '';
      const affordable = boost.price <= coins;
      card.classList.toggle('cant', !affordable);
      card.addEventListener('click', () => {
        if (this.selectedBoosts.has(boost.id)) this.selectedBoosts.delete(boost.id);
        else this.selectedBoosts.add(boost.id);
        const on = this.selectedBoosts.has(boost.id);
        card.classList.toggle('selected', on);
        card.setAttribute('aria-pressed', String(on));
        if (hero) { hero.classList.toggle(`has-${boost.id}`, on); hero.classList.remove('pop'); void hero.offsetWidth; hero.classList.add('pop'); }
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
    this.el.boostTotal.parentElement.classList.toggle('over', total > coins);
    this.el.boostTotal.parentElement.classList.toggle('zero', total === 0);
    this.buttons.boostStart.disabled = total > coins;
  }

  /** 選択中カードのハイライトだけ更新 */
  updateSkinSelection(selected) {
    for (const card of this.el.skinGrid.children) {
      card.classList.toggle('selected', card.dataset.skinId === selected);
    }
  }

  /* ---- リザルト ---- */

  showResult(args) {
    this.screens.result.classList.remove('is-endless');
    this.buttons.ranking.classList.add('hidden');
    this._showStageResult(args);
  }

  /** リザルトの上にいるコスミー(いま着ているスキン) */
  _resultCosmii(happy) {
    const skin = (typeof SKINS !== 'undefined' && SKINS.find(k => k.id === Storage.getSkin())) || null;
    const img = document.getElementById('res-cosmii');
    if (skin) img.src = happy ? skin.openSrc : skin.closedSrc;
    img.classList.toggle('sad', !happy);
  }

  /** ごほうびの内訳を、文字ではなく小さなアイコン付きチップで */
  _resultChips({ starBonus = 0, feverCoins = 0, nextStar = null, nextStarLimit = null }) {
    const chips = [];
    if (starBonus > 0) chips.push(`<span class="res-chip chip-star"><i aria-hidden="true">★</i>+${starBonus.toLocaleString()}</span>`);
    if (feverCoins > 0) chips.push(`<span class="res-chip chip-fever"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.6-2.6 1.5-3.5.3 1.3 1 2 2 2C11 8 11 5.5 12 3Z" fill="#ff7438"/><path d="M12 12c.6 1.4 2 2.2 2 3.6a2 2 0 0 1-4 0c0-1.2.9-2 2-3.6Z" fill="#ffd24d"/></svg>+${feverCoins.toLocaleString()}</span>`);
    if (nextStar && nextStarLimit) chips.push(`<span class="res-chip chip-next" aria-label="★${nextStar}は${nextStarLimit}秒以内"><i aria-hidden="true">☆</i>${nextStarLimit}s</span>`);
    this.el.resStarHint.innerHTML = chips.join('');
    this.el.resStarHint.classList.toggle('hidden', !chips.length);
  }

  _resultCommon({ reward = 0, missions = [], bug = null, count = 0, maxSize = 1, score = 0 }) {
    this.el.resReward.innerHTML = `<img class="currency-icon" src="public/opt/cosmo-coin.webp" alt="コイン">+${reward.toLocaleString()}`;
    this.el.resReward.classList.toggle('hidden', reward <= 0);
    this.el.resMission.innerHTML = missions.length
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#49ad7f"/><path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>ミッション達成${missions.length > 1 ? ` ×${missions.length}` : ''}`
      : '';
    this.el.resMission.classList.toggle('hidden', !missions.length);
    this.el.resBug.textContent = bug ? bug.name : '';
    this.el.resScore.textContent = score.toLocaleString();
    this.el.resCount.textContent = count.toLocaleString();
    this.el.resSize.textContent = `×${maxSize.toFixed(2)}`;
  }

  _showStageResult({ score, best, isNewBest, clearTime = null, bestTime = null, count, maxSize, cleared, reward, hasNext, stage, stars = 0,
    starBonus = 0, feverCoins = 0, nextStar = null, nextStarLimit = null, firstClear = false, missions = [], bug = null }) {
    const formatTime = value => value === null ? '—' : `${value.toFixed(2)}s`;
    this._resultCosmii(cleared);
    this.el.resTitle.textContent = cleared ? 'CLEAR!' : 'ざんねん…';
    this.screens.result.classList.toggle('is-fail', !cleared);
    this.el.resStars.classList.toggle('hidden', !cleared);
    this.el.resStars.setAttribute('aria-label', `★${stars}`);
    // ★の下に、その★の条件をアイコンで(1つ目:クリア、2つ目と3つ目:タイム)
    const flag = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M6 4h11l-2.5 4L17 12H6Z" fill="currentColor"/></svg>';
    const clock = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 13V9M9.5 3h5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
    const times = stage.starTimes || [];
    const conds = [flag, times[0] ? `${clock}${times[0]}s` : '', times[1] ? `${clock}${times[1]}s` : ''];
    const labels = ['クリア', times[0] ? `${times[0]}秒以内にクリア` : '', times[1] ? `${times[1]}秒以内にクリア` : ''];
    [...this.el.resStars.children].forEach((star, i) => {
      star.className = i < stars ? 'on' : '';
      star.innerHTML = `<b class="star-glyph" style="animation-delay:${0.25 + i * 0.22}s">★</b><small class="star-cond" aria-label="${labels[i]}">${conds[i]}</small>`;
    });
    document.getElementById('res-area').classList.add('hidden');
    // クリア:タイムが主役。失敗:ゴールまでどれくらいだったかをバーで
    document.querySelector('.res-hero').classList.toggle('hidden', !cleared);
    document.getElementById('res-sub').classList.toggle('hidden', !cleared || bestTime === null);
    document.getElementById('res-hero').textContent = formatTime(clearTime);
    this.el.resBest.textContent = formatTime(bestTime);
    document.getElementById('res-clear-time').textContent = formatTime(clearTime);
    document.getElementById('res-best-time').textContent = formatTime(bestTime);
    this.el.resNew.classList.toggle('hidden', !isNewBest);
    const prog = document.getElementById('res-progress');
    prog.classList.toggle('hidden', cleared);
    if (!cleared) {
      const pct = Math.max(4, Math.min(100, Math.round(score / Math.max(1, stage.targetScore) * 100)));
      document.getElementById('res-progress-fill').style.width = `${pct}%`;
      const face = document.getElementById('res-progress-face');
      face.style.left = `${pct}%`;
      face.src = document.getElementById('res-cosmii').src;
    }
    // 次の★の条件は★の下に出しているので、チップはごほうびの内訳だけ
    this._resultChips(cleared ? { starBonus, feverCoins } : {});
    this._resultCommon({ reward, missions: cleared ? missions : [], bug, count, maxSize, score });  // ざんねんの時はミッション達成を出さない(達成はタイトルのミッションに残る)
    // お話は初めてクリアした時だけ、コスミーのふきだしで
    this.el.resStory.textContent = cleared && firstClear ? stage.clearText : '';
    this.el.resStory.classList.toggle('hidden', !(cleared && firstClear));
    this.buttons.nextStage.classList.toggle('hidden', !hasNext);
    this.buttons.nextStage.closest('.res-actions').classList.toggle('has-next', !!hasNext);
    this.showScreen('hud', 'result');
    if (cleared) this.showClearCoins();
  }

  /** エンドレスのリザルト(★やタイムは出さず、スコアと到達エリアとランキング) */
  showEndlessResult({ score, best, isNewBest, area, count, maxSize, reward, missions = [], bug = null, ranking = false }) {
    const panel = this.screens.result;
    panel.classList.add('is-endless');
    panel.classList.remove('is-fail');
    this._resultCosmii(true);
    this.el.resTitle.textContent = 'TIME UP!';
    this.el.resStars.classList.add('hidden');
    const areaEl = document.getElementById('res-area');
    areaEl.innerHTML = `<span class="endless-area">AREA ${area}</span>`;
    areaEl.classList.remove('hidden');
    document.querySelector('.res-hero').classList.remove('hidden');
    document.getElementById('res-hero').textContent = score.toLocaleString();
    document.getElementById('res-sub').classList.remove('hidden');
    this.el.resBest.textContent = best.toLocaleString();
    this.el.resNew.classList.toggle('hidden', !isNewBest);
    document.getElementById('res-progress').classList.add('hidden');
    this._resultChips({});
    this._resultCommon({ reward, missions, bug, count, maxSize, score });
    this.el.resStory.textContent = `AREA ${area} まで到達！`;
    this.el.resStory.classList.add('hidden');
    this.buttons.nextStage.classList.add('hidden');
    this.buttons.nextStage.closest('.res-actions').classList.remove('has-next');
    this.buttons.ranking.classList.toggle('hidden', !ranking);
    this.showScreen('hud', 'result');
    if (isNewBest) this.showClearCoins();
  }

  showClearCoins() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'result-coins';
    layer.setAttribute('aria-hidden', 'true');
    // A viewport diagonal carries every ray fully offscreen, including tall phones.
    const bounds = this.screens.result.getBoundingClientRect();
    const travel = Math.hypot(bounds.width, bounds.height) + 60;
    for (let i = 0; i < 24; i++) {
      const coin = document.createElement('img');
      coin.src = 'public/opt/cosmo-coin.webp';
      coin.alt = '';
      const angle = (i + .5) / 24 * Math.PI * 2;
      const radius = travel * (1 + (i % 4) * .06);
      coin.style.setProperty('--coin-x', `${Math.cos(angle) * radius}px`);
      coin.style.setProperty('--coin-y', `${Math.sin(angle) * radius}px`);
      coin.style.setProperty('--coin-spin', `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`);
      coin.style.animationDelay = `${i % 6 * 35}ms`;
      coin.addEventListener('animationend', () => {
        coin.remove();
        if (!layer.childElementCount) {
          layer.remove();
          if (this.resultCoins === layer) this.resultCoins = null;
        }
      }, { once: true });
      layer.append(coin);
    }
    this.resultCoins = layer;
    this.screens.result.append(layer);
  }
}
