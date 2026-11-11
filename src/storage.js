  const storageMethods = {
    persistSession() {
      if (this.destroyed || this.gameOver || !this.balls?.length
        || ['shooting', 'settling'].includes(this.phase)) return;
      const snapshot = {
        version: 1, rules: 'casual-eight-v1', w: this.geo.w, h: this.geo.h,
        current: this.current, groups: this.players.map((p) => p.group),
        ballInHand: this.ballInHand, isBreak: this.isBreak, aimAngle: this.aimAngle,
        spinX: this.spinX, spinY: this.spinY, shots: this.shots || 0,
        lastShot: this.lastShot || '',
        balls: this.balls.map(({ number, x, y, active, pocketed }) => ({ number, x, y, active, pocketed })),
      };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot)); }
      catch { this.storageUnavailable = true; }
    },

    restoreSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return false;
        const s = JSON.parse(raw);
        const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
        if (!s || s.version !== 1 || s.rules !== 'casual-eight-v1'
          || !finite(s.w, 320, 10000) || !finite(s.h, 320, 10000)
          || ![0, 1].includes(s.current) || typeof s.ballInHand !== 'boolean' || typeof s.isBreak !== 'boolean'
          || !Array.isArray(s.groups) || s.groups.length !== 2
          || !((s.groups[0] === null && s.groups[1] === null)
            || (['solid', 'stripe'].includes(s.groups[0]) && s.groups[1] === otherGroup(s.groups[0])))
          || !Array.isArray(s.balls) || s.balls.length !== 16
          || new Set(s.balls.map((b) => b?.number)).size !== 16
          || !s.balls.every((b) => b && Number.isInteger(b.number) && b.number >= 0 && b.number <= 15
            && finite(b.x, 0, s.w) && finite(b.y, 0, s.h)
            && typeof b.active === 'boolean' && typeof b.pocketed === 'boolean'
            && !(b.active && b.pocketed) && (b.number === 0 || b.active || b.pocketed))
          || !finite(s.aimAngle, -1e6, 1e6) || !finite(s.spinX, -1, 1) || !finite(s.spinY, -1, 1)
          || !Number.isSafeInteger(s.shots) || s.shots < 0) throw new Error('Invalid saved game');
        const cue = s.balls.find((b) => b.number === 0);
        if (cue.active === s.ballInHand || !s.balls.find((b) => b.number === 8).active) throw new Error('Invalid saved turn');
        this.w = s.w; this.h = s.h;
        this.geo = this.computeGeometry(s.w, s.h);
        this.balls = s.balls.map((b) => ({ ...b, kind: b.number === 0 ? 'cue' : groupOf(b.number),
          color: b.number === 0 ? '#f2ead8' : BALL_COLORS[b.number], vx: 0, vy: 0, spinX: 0, spinY: 0 }));
        this.current = s.current;
        this.players = s.groups.map((group) => ({ group }));
        this.ballInHand = s.ballInHand; this.isBreak = s.isBreak;
        this.aimAngle = s.aimAngle; this.spinX = s.spinX; this.spinY = s.spinY;
        this.applySpinUI();
        this.shots = s.shots; this.lastShot = typeof s.lastShot === 'string' ? s.lastShot.slice(0, 150) : '';
        this.phase = this.current === 1 ? 'ai' : this.ballInHand ? 'placing' : 'aiming';
        this.stage.dataset.placing = String(this.ballInHand && this.current === 0);
        if (this.ballInHand && this.current === 0) this.ghostCue = this.nearestValidCuePosition(cue.x, cue.y);
        this.resize();
        return true;
      } catch {
        this.discardSession();
        this.restoreFailed = true;
        return false;
      }
    },

    discardSession() {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* optional storage */ }
    },


  };
