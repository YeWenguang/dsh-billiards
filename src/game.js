  class BilliardsGame {
    constructor(host) {
      this.host = host;
      this.prefs = loadPrefs();
      this.audio = new SoundKit(this.prefs.muted);
      this.isOpen = false;
      this.destroyed = false;
      this.passive = false;
      this.balls = [];
      this.players = [{ group: null }, { group: null }];
      this.current = 0;
      this.phase = 'aiming';
      this.gameOver = false;
      this.result = null;
      this.ballInHand = false;
      this.isBreak = true;
      this.hasStarted = false;
      this.shot = null;
      this.power = 0;
      this.charging = false;
      this.chargeSource = null;
      this.chargePointerId = null;
      this.aimAngle = 0;
      this.spinX = 0;
      this.spinY = 0;
      this.spinDragging = false;
      this.pointer = { x: 0, y: 0, inside: false };
      this.ghostCue = null;
      this.aiPlan = null;
      this.aiActionAt = 0;
      this.accum = 0;
      this.lastTs = 0;
      this.resolveAt = 0;
      this.particles = [];
      this.animations = [];
      this.previousFocus = null;
      this.raf = null;
      this.toastTimer = null;
      this.resizeObserver = null;
      this.abort = new AbortController();
      this.themeObserver = null;
      this.desktopChromeBackup = null;
      this.geo = null;
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.lastCollisionSound = 0;
      this.loop = this.loop.bind(this);
      this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

      try {
        this.buildDom();
        this.bind();
        this.applyTheme();
        this.resize();
        this.newRack({ silent: true });
        this.restored = this.restoreSession();
        this.applyPrefsToUI();
        this.attachDebug();
      } catch (error) {
        this.destroy();
        host.textContent = '台球暂时无法启动，请重新启用插件。';
        console.error('[dsh-billiards] initialization failed', error);
      }
    }

    buildDom() {
      this.host.innerHTML = TEMPLATE;
      this.launcher = this.host.querySelector('.dsh-bil-launcher');
      this.stage = this.host.querySelector('.dsh-bil-stage');
      this.stage.inert = true;
      this.canvas = this.host.querySelector('.dsh-bil-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.staticCanvas = document.createElement('canvas');
      this.staticCtx = this.staticCanvas.getContext('2d');
      if (!this.ctx || !this.staticCtx) throw new Error('Canvas 2D is unavailable');
      this.refs = {
        turn: this.stage.querySelector('.dsh-bil-turn'),
        turnKicker: this.stage.querySelector('.dsh-bil-turn-kicker'),
        turnStrong: this.stage.querySelector('.dsh-bil-turn strong'),
        turnSmall: this.stage.querySelector('.dsh-bil-turn small'),
        human: this.stage.querySelector('.dsh-bil-player[data-side="human"]'),
        ai: this.stage.querySelector('.dsh-bil-player[data-side="ai"]'),
        humanSide: this.stage.querySelector('.dsh-bil-player[data-side="human"] .dsh-bil-player-side'),
        aiSide: this.stage.querySelector('.dsh-bil-player[data-side="ai"] .dsh-bil-player-side'),
        humanPips: this.stage.querySelector('.dsh-bil-player[data-side="human"] .dsh-bil-pips'),
        aiPips: this.stage.querySelector('.dsh-bil-player[data-side="ai"] .dsh-bil-pips'),
        humanWins: this.stage.querySelector('.dsh-bil-human-wins'),
        humanLosses: this.stage.querySelector('.dsh-bil-human-losses'),
        power: this.stage.querySelector('.dsh-bil-power'),
        powerLabel: this.stage.querySelector('.dsh-bil-power-label'),
        hintMain: this.stage.querySelector('.dsh-bil-hint-main'),
        hintSub: this.stage.querySelector('.dsh-bil-hint-sub'),
        toast: this.stage.querySelector('.dsh-bil-toast'),
        result: this.stage.querySelector('.dsh-bil-result'),
        resultTitle: this.stage.querySelector('#dshBilResultTitle'),
        resultCopy: this.stage.querySelector('.dsh-bil-result-copy'),
        resultWins: this.stage.querySelector('.dsh-bil-result-wins'),
        resultLosses: this.stage.querySelector('.dsh-bil-result-losses'),
        resultStreak: this.stage.querySelector('.dsh-bil-result-streak'),
        sr: this.stage.querySelector('.dsh-bil-sr'),
      };
      this.refs.mute = this.stage.querySelector('[data-act="mute"]');
      this.refs.guide = this.stage.querySelector('[data-act="guide"]');
      this.refs.focus = this.stage.querySelector('[data-act="focus"]');
      this.panel = this.stage.querySelector('.dsh-bil-panel');
      this.spinPanel = this.stage.querySelector('.dsh-bil-spin-panel');
      this.spinBall = this.stage.querySelector('.dsh-bil-spin-ball');
      this.spinDot = this.stage.querySelector('.dsh-bil-spin-dot');
      this.spinName = this.stage.querySelector('.dsh-bil-spin-name');
      this.refs.mute.innerHTML = ICONS.soundOn;
      this.refs.guide.innerHTML = ICONS.guide;
      this.refs.focus.innerHTML = ICONS.eye;
      this.stage.querySelector('[data-act="new"]').innerHTML = ICONS.reset;
      this.stage.querySelector('[data-act="pass"]').innerHTML = ICONS.pass;
      this.stage.querySelector('[data-act="close"]').innerHTML = ICONS.close;
      this.launcherCopyB = this.launcher.querySelector('.dsh-bil-launcher-copy b');
      this.launcherCopySmall = this.launcher.querySelector('.dsh-bil-launcher-copy small');
    }

    bind() {
      const signal = this.abort.signal;
      this.launcher.addEventListener('click', () => {
        if (this.isOpen && this.passive) this.setPassive(false);
        else this.open();
      }, { signal });
      this.stage.addEventListener('pointerdown', (e) => this.onPointerDown(e), { signal });
      this.stage.addEventListener('pointermove', (e) => this.onPointerMove(e), { signal });
      this.stage.addEventListener('pointerup', (e) => this.onPointerUp(e), { signal });
      this.stage.addEventListener('pointercancel', (e) => {
        if (this.chargeSource !== 'pointer' || e.pointerId === this.chargePointerId) this.cancelCharge(e);
      }, { signal });
      this.stage.addEventListener('lostpointercapture', (e) => {
        if (e.pointerId === this.chargePointerId) this.cancelCharge();
      }, { signal });
      this.stage.addEventListener('focusout', (e) => {
        if (!this.stage.contains(e.relatedTarget)) this.cancelCharge();
      }, { signal });
      this.stage.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.cancelCharge();
      }, { signal });
      this.stage.addEventListener('wheel', (e) => e.preventDefault(), { passive: false, signal });
      window.addEventListener('keydown', (e) => this.onGlobalKeyDown(e), { capture: true, signal });
      window.addEventListener('keyup', (e) => this.onKeyUp(e), { capture: true, signal });
      window.addEventListener('resize', () => this.onResize(), { signal });
      window.addEventListener('blur', () => this.cancelCharge(), { signal });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.cancelCharge();
          this.pauseAi();
          if (this.raf) cancelAnimationFrame(this.raf);
          this.raf = null;
        } else if (this.isOpen && !this.passive) {
          this.resolveAt = performance.now() + 80;
          this.startLoop();
        }
      }, { signal });
      this.stage.querySelectorAll('button').forEach((button) => {
        button.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onAction(button.dataset.act);
        }, { signal });
      });
      this.spinPanel.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
      this.panel.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
      this.panel.querySelectorAll('[data-pref]').forEach((input) => {
        input.addEventListener('change', () => {
          const key = input.dataset.pref;
          this.prefs[key] = key === 'guide' ? input.value === 'true' : key === 'difficulty' ? input.value : Number(input.value);
          this.savePrefs();
          if (this.phase === 'ai-aiming') { this.phase = 'ai'; this.aiPlan = null; }
          this.applyPrefsToUI(); this.updateHud();
        }, { signal });
      });
      this.spinBall.addEventListener('pointerdown', (e) => this.onSpinPointerDown(e), { signal });
      this.spinBall.addEventListener('pointermove', (e) => this.onSpinPointerMove(e), { signal });
      this.spinBall.addEventListener('pointerup', () => { this.spinDragging = false; }, { signal });
      this.spinBall.addEventListener('pointercancel', () => { this.spinDragging = false; }, { signal });
      this.spinBall.addEventListener('lostpointercapture', () => { this.spinDragging = false; }, { signal });
      this.spinBall.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setSpin(0, 0);
        this.toast('击球点回中：中杆', 'good', 1100);
      }, { signal });
      this.spinBall.addEventListener('keydown', (e) => this.onSpinKeyDown(e), { signal });
      this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.motionQuery?.addEventListener('change', (e) => {
        this.reduceMotion = e.matches;
        if (e.matches) { this.particles = []; this.animations = []; }
        this.requestFrame();
      }, { signal });
      window.addEventListener('pagehide', () => this.persistSession(), { signal });
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.host);
      }
      if (typeof MutationObserver !== 'undefined') {
        this.themeObserver = new MutationObserver(() => this.applyTheme());
        this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class'] });
        this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      }
    }

    applyTheme() {
      if (!this.stage) return;
      const dark = document.body.hasAttribute('data-ds-dark-theme') || document.documentElement.classList.contains('dark');
      this.stage.dataset.bilTheme = dark ? 'dark' : 'light';
      this.host.dataset.bilTheme = dark ? 'dark' : 'light';
      this.requestFrame();
    }

    /**
     * The Windows Electron shell paints its native caption buttons from two
     * CSS custom properties. While the game is open, make the titlebar
     * background transparent and mute the symbols so the native minimize /
     * maximize / close controls belong to the table instead of floating over
     * it. Both properties are restored on close.
     */
    syncDesktopChrome(active) {
      const available = document.documentElement.hasAttribute('data-windows-titlebar') && document.body;
      this.host.dataset.desktopChrome = String(Boolean(available));
      if (!available && active) return;
      if (active) {
        if (!this.desktopChromeBackup) {
          const read = (name) => ({
            value: document.body.style.getPropertyValue(name),
            priority: document.body.style.getPropertyPriority(name),
          });
          this.desktopChromeBackup = {
            fill: read('--dsw-specific-sidebar-fill'),
            label: read('--dsw-alias-label-primary'),
          };
        }
        document.body.style.setProperty('--dsw-specific-sidebar-fill', 'rgba(0,0,0,0)', 'important');
        document.body.style.setProperty('--dsw-alias-label-primary', 'rgb(110, 126, 119)', 'important');
      } else if (this.desktopChromeBackup) {
        const restore = (name, saved) => {
          if (saved.value) document.body.style.setProperty(name, saved.value, saved.priority);
          else document.body.style.removeProperty(name);
        };
        // Do not overwrite a newer inline theme value supplied by the host.
        if (document.body.style.getPropertyValue('--dsw-specific-sidebar-fill') === 'rgba(0,0,0,0)')
          restore('--dsw-specific-sidebar-fill', this.desktopChromeBackup.fill);
        if (document.body.style.getPropertyValue('--dsw-alias-label-primary') === 'rgb(110, 126, 119)')
          restore('--dsw-alias-label-primary', this.desktopChromeBackup.label);
        this.desktopChromeBackup = null;
      }
    }

    onAction(action) {
      if (action === 'close') this.close();
      else if (action === 'new') this.requestNewGame();
      else if (action === 'new-confirm') this.newGame();
      else if (action === 'help') this.showPanel('help');
      else if (action === 'panel-close') this.hidePanel();
      else if (action === 'spin-reset') { this.setSpin(0, 0); this.persistSession(); }
      else if (action === 'pass') this.setPassive(true);
      else if (action === 'mute') {
        this.prefs.muted = !this.prefs.muted;
        this.audio.setMuted(this.prefs.muted);
        this.savePrefs();
        this.updateHud();
        this.toast(this.prefs.muted ? '静音了。' : '声音回来了。', 'good', 1200);
      } else if (action === 'guide') {
        this.prefs.guide = !this.prefs.guide;
        this.savePrefs();
        this.updateHud();
      } else if (action === 'focus') {
        this.prefs.clarity = (this.prefs.clarity + 1) % 3;
        this.savePrefs();
        this.applyPrefsToUI();
        this.updateHud();
        const label = ['透视', '标准', '专注'][this.prefs.clarity];
        this.toast(`背景：${label}`, this.prefs.clarity === 2 ? 'ai' : 'good', 1200);
      }
    }

    applyPrefsToUI() {
      this.panel?.querySelectorAll('[data-pref]').forEach((input) => { input.value = String(this.prefs[input.dataset.pref]); });
      this.stage.dataset.clarity = String(this.prefs.clarity);
      const labels = ['透视', '标准', '专注'];
      this.refs.mute.innerHTML = this.prefs.muted ? ICONS.soundOff : ICONS.soundOn;
      this.refs.mute.setAttribute('aria-pressed', String(this.prefs.muted));
      this.refs.mute.setAttribute('aria-label', this.prefs.muted ? '取消静音' : '静音');
      this.refs.mute.title = `${this.prefs.muted ? '取消静音' : '静音'}（M）`;
      this.refs.guide.setAttribute('aria-pressed', String(this.prefs.guide));
      this.refs.focus.removeAttribute('aria-pressed');
      this.refs.focus.innerHTML = this.prefs.clarity === 2 ? ICONS.eyeOff : ICONS.eye;
      this.refs.focus.setAttribute('aria-label', `背景：${labels[this.prefs.clarity]}`);
      this.refs.focus.dataset.label = labels[this.prefs.clarity];
      this.refs.focus.title = `背景：${labels[this.prefs.clarity]}（点击切换）`;
      const difficulty = this.stage.querySelector('.dsh-bil-player[data-side="ai"] .dsh-bil-player-meta b');
      if (difficulty) difficulty.textContent = { easy: '简单', standard: '标准', hard: '困难' }[this.prefs.difficulty];
    }

    showPanel(kind) {
      if (!this.panel) return;
      if (!this.panelOpen) this.panelPreviousFocus = document.activeElement;
      this.cancelCharge();
      this.panelOpen = true;
      this.pauseAi();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.panel.hidden = false;
      this.panel.querySelector('h2').textContent = kind === 'confirm' ? '重新开始这一局？' : '帮助与设置';
      this.panel.querySelectorAll('[data-panel]').forEach((el) => { el.hidden = el.dataset.panel !== kind; });
      this.panel.querySelector('.dsh-bil-summary').textContent = `${this.current === 0 ? '你' : '对手'}的回合；你打${groupName(this.players[0].group)}。剩余球号：${this.balls.filter((b) => b.active && b.number).map((b) => b.number).sort((a,b) => a-b).join('、')}。${this.lastShot || '尚未击球'}。${this.storageUnavailable ? '本次存储不可用，球局仅保留在内存中。' : '每杆自动保存，重启后可继续。'}`;
      this.applyPrefsToUI();
      this.panel.querySelector('.dsh-bil-panel-card').focus({ preventScroll: true });
    }

    hidePanel(resume = true) {
      if (!this.panel) return;
      this.panel.hidden = true;
      this.panelOpen = false;
      if (resume && this.isOpen && !this.passive) {
        const target = this.panelPreviousFocus;
        if (target?.isConnected && !this.panel.contains(target)) target.focus({ preventScroll: true });
        else this.stage.focus({ preventScroll: true });
        this.startLoop();
      }
    }

    savePrefs() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
      } catch {
        /* localStorage may be disabled; the table still works. */
      }
    }

    open() {
      if (this.destroyed || this.isOpen) return;
      this.isOpen = true;
      this.passive = false;
      this.hasStarted = true;
      this.previousFocus = document.activeElement;
      this.host.dataset.open = 'true';
      this.stage.hidden = false;
      this.stage.inert = false;
      this.launcher.inert = true;
      this.stage.dataset.passive = 'false';
      this.setLauncherReturn(false);
      this.stage.setAttribute('aria-hidden', 'false');
      this.launcher.setAttribute('aria-expanded', 'true');
      this.syncDesktopChrome(true);
      this.audio.unlock();
      this.audio.ui();
      this.resize();
      this.updateHud();
      this.stage.focus({ preventScroll: true });
      this.lastTs = 0;
      this.accum = 0;
      this.pauseAi();
      if (this.phase === 'settling' && this.allStopped()) this.resolveAt = performance.now() + 80;
      if (this.phase === 'ai-aiming') {
        this.phase = 'ai';
        this.aiPlan = null;
      }
      this.aiActionAt = performance.now() + 600;
      if (this.gameOver) {
        this.refs.result.hidden = false;
        this.refs.result.querySelector('[data-act="new"]').focus({ preventScroll: true });
      }
      this.startLoop();
      this.showIntroOnce();
    }

    showIntroOnce() {
      if (this.introShown) return;
      this.introShown = true;
      this.introTimer = setTimeout(() => {
        if (!this.isOpen || this.destroyed) return;
        this.toast(this.restored ? '已恢复上一局；若上次在击球中退出，回到该杆开始前。'
          : this.restoreFailed ? '旧存档不可用，已安全开始新局。'
            : '鼠标瞄准，按住蓄力，松开击球。点「帮助」查看规则与操作。', 'good', 4500);
      }, 500);
    }

    close() {
      if (!this.isOpen) return;
      this.persistSession();
      this.hidePanel(false);
      this.isOpen = false;
      this.passive = false;
      this.cancelCharge();
      this.pauseAi();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.host.dataset.open = 'false';
      this.stage.dataset.passive = 'false';
      this.setLauncherReturn(false);
      this.stage.hidden = true;
      this.stage.inert = true;
      this.launcher.inert = false;
      this.stage.setAttribute('aria-hidden', 'true');
      this.launcher.setAttribute('aria-expanded', 'false');
      this.syncDesktopChrome(false);
      this.refs.result.hidden = true;
      this.updateLauncherState();
      if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
        try { this.previousFocus.focus({ preventScroll: true }); } catch { /* noop */ }
      }
    }

    setPassive(active) {
      if (this.destroyed || !this.isOpen) return;
      const next = Boolean(active);
      if (next === this.passive) return;
      this.passive = next;
      this.hidePanel(false);
      this.stage.inert = next;
      this.launcher.inert = !next;
      if (next) {
        this.cancelCharge();
        this.pauseAi();
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
        this.lastTs = 0;
        this.accum = 0;
        this.stage.dataset.passive = 'true';
        this.stage.setAttribute('aria-hidden', 'true');
        this.setLauncherReturn(true);
        this.syncDesktopChrome(false);
        this.stage.blur();
        try {
          let target = this.previousFocus;
          if (!target || !target.isConnected || (target.closest && target.closest('.dsh-bil-host'))) {
            target = document.querySelector('textarea, input:not([type="hidden"]), [contenteditable="true"]');
          }
          if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
        } catch { /* noop */ }
      } else {
        this.stage.dataset.passive = 'false';
        this.stage.setAttribute('aria-hidden', 'false');
        this.setLauncherReturn(false);
        this.syncDesktopChrome(true);
        this.resize();
        this.updateHud();
        if (this.gameOver) this.refs.result.hidden = false;
        if (this.gameOver) this.refs.result.querySelector('[data-act="new"]').focus({ preventScroll: true });
        else this.stage.focus({ preventScroll: true });
        this.lastTs = 0;
        this.accum = 0;
        this.startLoop();
      }
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    cushionCollision(ball) {
      const g = this.geo;
      const r = g.r;
      let impact = 0;
      let railContact = false;
      let verticalRail = false;
      if (ball.x - r < g.play.x0) {
        ball.x = g.play.x0 + r;
        if (ball.vx < 0) { railContact = true; verticalRail = true; impact = Math.max(impact, Math.abs(ball.vx)); ball.vx = -ball.vx * g.cushion; ball.vy *= 0.985; }
      } else if (ball.x + r > g.play.x1) {
        ball.x = g.play.x1 - r;
        if (ball.vx > 0) { railContact = true; verticalRail = true; impact = Math.max(impact, Math.abs(ball.vx)); ball.vx = -ball.vx * g.cushion; ball.vy *= 0.985; }
      }
      if (ball.y - r < g.play.y0) {
        ball.y = g.play.y0 + r;
        if (ball.vy < 0) { railContact = true; impact = Math.max(impact, Math.abs(ball.vy)); ball.vy = -ball.vy * g.cushion; ball.vx *= 0.985; }
      } else if (ball.y + r > g.play.y1) {
        ball.y = g.play.y1 - r;
        if (ball.vy > 0) { railContact = true; impact = Math.max(impact, Math.abs(ball.vy)); ball.vy = -ball.vy * g.cushion; ball.vx *= 0.985; }
      }
      if (!railContact) return;
      if (ball.kind === 'cue' && (ball.spinX || ball.spinY)) {
        const speed = hypot(ball.vx, ball.vy);
        if (speed > 2 && ball.spinX) {
          // Side spin bends the rebound. The sign flips between a long rail
          // and a short rail because the tangent direction changes.
          const angle = Math.atan2(ball.vy, ball.vx) + ball.spinX * (verticalRail ? 0.27 : -0.27);
          ball.vx = Math.cos(angle) * speed;
          ball.vy = Math.sin(angle) * speed;
        }
        ball.spinX *= 0.55;
        ball.spinY *= 0.82;
      }
      // A legal shot only needs *contact* with a cushion after the first
      // object-ball contact, however softly the ball arrives. Sound and
      // particles still have an amplitude threshold so a slow roll is quiet.
      if (this.shot && this.shot.firstHit !== null) this.shot.railAfterContact = true;
      if (impact > 35) {
        const now = performance.now();
        if (now - this.lastCollisionSound > 28) {
          this.audio.rail(impact);
          this.lastCollisionSound = now;
        }
        this.spawnImpact(ball.x, ball.y, impact * 0.5);
      }
    }

    updateHud() {
      if (!this.refs) return;
      const human = this.players[0];
      const ai = this.players[1];
      const humanActive = !this.gameOver && this.current === 0;
      const aiActive = !this.gameOver && this.current === 1;
      this.refs.human.dataset.active = String(humanActive);
      this.refs.ai.dataset.active = String(aiActive);
      this.refs.humanSide.textContent = groupName(human.group) + (human.group ? ` · ${this.remainingOf(human.group)}` : '');
      this.refs.aiSide.textContent = ai.group ? `${groupName(ai.group)} · ${this.remainingOf(ai.group)}` : '待定';
      this.refs.humanWins.textContent = String(this.prefs.wins);
      this.refs.humanLosses.textContent = String(this.prefs.losses);
      this.renderPips(this.refs.humanPips, human.group, 0);
      this.renderPips(this.refs.aiPips, ai.group, 1);
      this.refs.turn.dataset.tone = this.gameOver ? 'foul' : this.current === 1 ? 'ai' : 'human';
      if (this.gameOver) {
        this.refs.turnKicker.textContent = 'RACK OVER';
        this.refs.turnStrong.textContent = this.result?.winner === 0 ? '清台成功' : 'DeepSeek 收杆';
        this.refs.turnSmall.textContent = '按 N 再来一局';
      } else if (this.charging) {
        this.refs.turnKicker.textContent = 'YOUR SHOT';
        this.refs.turnStrong.textContent = '松开击球';
        this.refs.turnSmall.textContent = 'Esc 取消本次蓄力';
      } else if (this.phase === 'shooting' || this.phase === 'settling') {
        this.refs.turnKicker.textContent = 'IN PLAY';
        this.refs.turnStrong.textContent = '球在滚动';
        this.refs.turnSmall.textContent = '看球';
      } else if (this.current === 0 && this.ballInHand) {
        this.refs.turnKicker.textContent = 'BALL IN HAND';
        this.refs.turnStrong.textContent = '自由球';
        this.refs.turnSmall.textContent = '点击摆球，或方向键移动 · Enter 确认';
      } else if (this.current === 1) {
        this.refs.turnKicker.textContent = 'DEEPSEEK';
        this.refs.turnStrong.textContent = this.phase === 'ai-aiming' ? '正在瞄准' : '思考下一杆';
        this.refs.turnSmall.textContent = 'Harness 后台照常运行';
      } else {
        this.refs.turnKicker.textContent = 'YOUR TURN';
        this.refs.turnStrong.textContent = '轮到你';
        this.refs.turnSmall.textContent = this.onEight(0) ? '目标：黑八' : human.group ? `目标：${groupName(human.group)}球` : '开放球桌 · 先碰任意非黑八';
      }
      const hint = this.bottomHint();
      this.refs.hintMain.textContent = hint[0];
      this.refs.hintSub.textContent = hint[1];
      this.refs.sr.textContent = `${this.refs.turnStrong.textContent}。${this.refs.turnSmall.textContent}`;
      this.stage.style.setProperty('--bil-power', String(this.power));
      if (this.refs.powerLabel && !this.charging) this.refs.powerLabel.textContent = 'POWER';
      this.applyPrefsToUI();
      if (this.refs.result && !this.refs.result.hidden) {
        this.refs.resultWins.textContent = String(this.prefs.wins);
        this.refs.resultLosses.textContent = String(this.prefs.losses);
        this.refs.resultStreak.textContent = String(this.prefs.streak);
      }
      this.updateLauncherState();
      // The turn card is centred and its width follows the copy, so re-measure
      // the HUD boxes whenever its content changes.
      this.hudNeedsMeasure = true;
      this.requestFrame();
    }

    bottomHint() {
      if (this.gameOver) return ['这局结束', '按 N 开新局'];
      if (this.ballInHand && this.current === 0) return ['自由球', '点击放置白球'];
      if (this.phase === 'shooting' || this.phase === 'settling') return ['球在滚动', '等它停下来'];
      if (this.charging) return ['正在蓄力', '松开击球 · Esc 取消'];
      if (this.current === 1) return ['DeepSeek 的回合', 'Alt+H 回到工作'];
      if (this.onEight(0)) return ['目标：黑八', '按住蓄力 · 松开击球'];
      return ['按住蓄力', '松开击球'];
    }

    onEight(playerIndex) {
      const group = this.players[playerIndex]?.group;
      return Boolean(group) && this.remainingOf(group) === 0;
    }

    renderPips(container, group, playerIndex) {
      const numbers = group === 'stripe' ? [9, 10, 11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6, 7];
      const signature = `${group === null ? 'open' : group}-${numbers.join(',')}`;
      if (container.dataset.signature !== signature) {
        container.dataset.signature = signature;
        container.innerHTML = '';
        for (const number of numbers) {
          const span = document.createElement('span');
          span.className = 'dsh-bil-pip' + (group ? (group === 'solid' ? '' : ' is-stripe') : '');
          span.dataset.number = String(number);
          span.style.setProperty('--ball', BALL_COLORS[number]);
          container.appendChild(span);
        }
        const eight = document.createElement('span');
        eight.className = 'dsh-bil-pip is-eight';
        eight.dataset.number = '8';
        eight.title = '黑八';
        container.appendChild(eight);
      }
      for (const pip of container.querySelectorAll('.dsh-bil-pip')) {
        const n = Number(pip.dataset.number);
        if (n === 8) {
          pip.classList.toggle('is-down', false);
          pip.classList.toggle('is-target', Boolean(group) && this.remainingOf(group) === 0 && this.current === playerIndex && !this.gameOver);
        } else {
          const ball = this.ballByNumber(n);
          pip.classList.toggle('is-down', !ball || !ball.active);
          pip.classList.remove('is-target');
        }
      }
    }

    setLauncherReturn(active) {
      this.host.dataset.passive = active ? 'true' : 'false';
      if (this.launcherCopyB) this.launcherCopyB.textContent = active ? '回到球桌' : '来一局台球';
      if (this.launcherCopySmall) this.launcherCopySmall.textContent = active ? 'ALT+H' : 'ALT+B';
      if (this.launcher) {
        this.launcher.setAttribute('aria-label', active ? '回到球桌（Alt+H）' : '打开台球（Alt+B）');
        this.launcher.title = active ? '回到球桌 · Alt+H' : '台球 · Alt+B';
      }
    }

    updateLauncherState() {
      if (!this.launcher) return;
      if (this.passive) {
        this.setLauncherReturn(true);
        return;
      }
      const live = this.hasStarted && !this.gameOver && (this.current === 1 || this.phase === 'shooting' || this.ballInHand);
      this.launcher.dataset.live = String(Boolean(live));
      this.launcher.setAttribute('aria-label', this.isOpen ? '收起台球' : '打开台球（Alt+B）');
    }

    toast(text, tone = 'good', duration = 1700) {
      if (!this.refs?.toast) return;
      this.refs.toast.textContent = text;
      this.refs.toast.dataset.tone = tone;
      this.refs.toast.classList.add('is-show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.refs?.toast.classList.remove('is-show');
      }, duration);
    }

    attachDebug() {
      if (window.__DSH_BILLIARDS_DEBUG__ !== true && window.__DSH_BILLIARDS_PREVIEW__ !== true
        && document.documentElement.getAttribute('data-dsh-billiards-debug') !== 'true') return;
      const self = this;
      this.host.__dshBilliardsGame = this;
      window.__DSH_BILLIARDS__ = {
        game: self,
        open: () => self.open(),
        close: () => self.close(),
        newGame: () => self.newGame(),
        state: () => self.debugState(),
        shoot: (angle, power) => {
          self.current = 0;
          self.ballInHand = false;
          self.phase = 'aiming';
          self.shoot(angle, power, { force: true });
        },
        advance: (seconds) => self.debugAdvance(seconds),
        setBalls: (spec) => self.debugSetBalls(spec),
        setTurn: (index) => {
          self.current = index;
          self.phase = index === 0 ? 'aiming' : 'ai';
        },
        forceResult: (winner) => self.endGame(winner, 'debug'),
        toast: (text, tone = 'good') => self.toast(text, tone, 2500),
      };
    }

    debugState() {
      const cue = this.cueBall();
      return {
        phase: this.phase,
        current: this.current,
        ballInHand: this.ballInHand,
        gameOver: this.gameOver,
        groups: this.players.map((p) => p.group),
        stats: { ...this.prefs },
        cue: cue ? { x: cue.x, y: cue.y, active: cue.active } : null,
        balls: this.balls.map((b) => ({ number: b.number, kind: b.kind, x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, vx: Math.round(b.vx), vy: Math.round(b.vy), active: b.active, pocketed: b.pocketed })),
        geo: this.geo ? { w: this.geo.w, h: this.geo.h, r: this.geo.r, play: this.geo.play, pockets: this.geo.pockets.map((p) => ({ id: p.id, x: p.x, y: p.y, r: p.r })) } : null,
      };
    }

    debugAdvance(seconds) {
      const wasOpen = this.isOpen;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      const oldOpen = this.isOpen;
      this.isOpen = false;
      const steps = Math.max(1, Math.ceil(seconds / FIXED_STEP));
      for (let i = 0; i < steps; i++) {
        if (this.phase !== 'shooting') break;
        this.stepPhysics(FIXED_STEP);
        if (this.allStopped()) {
          this.phase = 'settling';
          this.resolveShot();
          break;
        }
      }
      this.isOpen = oldOpen;
      if (wasOpen) this.startLoop();
      return this.debugState();
    }

    debugSetBalls(spec) {
      for (const ball of this.balls) {
        ball.active = false;
        ball.pocketed = true;
      }
      const cue = this.cueBall();
      cue.active = true;
      cue.pocketed = false;
      cue.x = spec.cue?.x ?? (this.geo.play.x0 + this.geo.play.x1) / 2;
      cue.y = spec.cue?.y ?? (this.geo.play.y0 + this.geo.play.y1) / 2;
      cue.vx = 0;
      cue.vy = 0;
      for (const item of spec.balls || []) {
        const b = this.ballByNumber(item.number);
        if (!b) continue;
        b.active = true;
        b.pocketed = false;
        b.x = item.x;
        b.y = item.y;
        b.vx = 0;
        b.vy = 0;
      }
      this.updateHud();
      this.render();
    }

    destroy() {
      if (this.destroyed) return;
      this.persistSession();
      this.destroyed = true;
      this.isOpen = false;
      this.syncDesktopChrome(false);
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.abort.abort();
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.themeObserver) this.themeObserver.disconnect();
      if (this.toastTimer) clearTimeout(this.toastTimer);
      if (this.introTimer) clearTimeout(this.introTimer);
      this.audio.destroy();
      this.host.innerHTML = '';
      delete this.host.__dshBilliardsGame;
      if (window.__DSH_BILLIARDS__?.game === this) delete window.__DSH_BILLIARDS__;
    }
  }
