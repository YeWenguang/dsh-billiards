  const inputMethods = {
    onGlobalKeyDown(e) {
      if (this.destroyed || e.isComposing) return;
      if (this.isOpen && e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) this.setPassive(!this.passive);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) this.toggle();
        return;
      }
      if (!this.isOpen || this.passive || e.ctrlKey || e.metaKey || e.altKey || !this.stage.contains(e.target)) return;
      this.onKeyDown(e);
      this.requestFrame();
    },

    onKeyDown(e) {
      if (this.panelOpen) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.hidePanel(); }
        else if (e.key === 'Tab') {
          const items = Array.from(this.panel.querySelectorAll('button,select')).filter((el) => !el.closest('[hidden]'));
          const index = items.indexOf(document.activeElement);
          e.preventDefault();
          items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
        }
        return;
      }
      const inEditable = e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === 'Tab' && !this.refs.result.hidden) {
        const buttons = this.refs.result.querySelectorAll('button');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!this.refs.result.contains(e.target)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && e.target === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && e.target === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (this.charging) this.cancelCharge();
        else if (!this.refs.result.hidden) {
          this.refs.result.hidden = true;
          this.stage.focus({ preventScroll: true });
          this.updateHud();
        } else this.close();
        return;
      }
      if (inEditable) return;
      if (this.ballInHand && this.current === 0 && this.phase === 'placing') {
        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const p = this.ghostCue || this.cueBall();
          const step = this.geo.r * (e.shiftKey ? 0.2 : 1);
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          const delta = this.view?.rotated ? { x: dy, y: -dx } : { x: dx, y: dy };
          const { play, r } = this.geo;
          const x = clamp(p.x + delta.x, play.x0 + r + 1, play.x1 - r - 1);
          const y = clamp(p.y + delta.y, play.y0 + r + 1, play.y1 - r - 1);
          this.ghostCue = { x, y, valid: this.validCuePosition(x, y) };
          this.requestFrame();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target?.closest?.('button')) return;
          e.preventDefault();
          if (!e.repeat && this.ghostCue) this.placeCue(this.ghostCue);
          return;
        }
      }
      if (e.target && e.target.closest && e.target.closest('.dsh-bil-spin-ball')
        && (e.key.startsWith('Arrow') || e.key === 'Home')) return;
      if (e.key === ' ' || e.code === 'Space') {
        if (e.target?.closest?.('button')) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (this.canHumanShoot()) this.beginCharge();
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        if (!e.repeat) this.onAction('guide');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (!e.repeat) this.onAction('mute');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (!e.repeat) this.requestNewGame();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (this.canHumanShoot()) {
          this.aimAngle += (e.shiftKey ? 0.0015 : 0.008) * (e.key === 'ArrowLeft' ? -1 : 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.canHumanShoot()) {
          this.aimAngle += (e.shiftKey ? 0.02 : 0.06) * (e.key === 'ArrowDown' ? 1 : -1);
        }
      }
    },

    onKeyUp(e) {
      if (!this.isOpen || this.passive || this.chargeSource !== 'keyboard' || !this.stage.contains(e.target)) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (this.charging) this.releaseCharge();
      }
    },

    canHumanShoot() {
      return this.isOpen && !this.passive && !this.panelOpen && !document.hidden && !this.gameOver && this.current === 0 && !this.ballInHand && this.phase === 'aiming' && !this.charging;
    },

    onPointerDown(e) {
      if (!this.isOpen || this.passive || this.panelOpen || e.button !== 0 || e.isPrimary === false) return;
      if (this.gameOver) return;
      this.stage.focus({ preventScroll: true });
      this.audio.unlock();
      if (this.ballInHand && this.current === 0) {
        e.preventDefault();
        this.tryPlaceCue(e);
        return;
      }
      if (!this.canHumanShoot()) return;
      e.preventDefault();
      this.updateAimFromEvent(e);
      this.beginCharge('pointer', e.pointerId);
      try { this.stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
    },

    onPointerMove(e) {
      if (!this.isOpen || this.passive || this.panelOpen) return;
      if (this.charging && this.chargeSource === 'pointer' && e.pointerId !== this.chargePointerId) return;
      if (!this.charging && e.target && e.target.closest && e.target.closest('.dsh-bil-layer')) return;
      this.updateAimFromEvent(e);
      if (this.ballInHand && this.current === 0) this.updateGhostCue(e);
      this.requestFrame();
    },

    onPointerUp(e) {
      if (!this.isOpen || this.passive || this.chargeSource !== 'pointer' || e.pointerId !== this.chargePointerId || e.button !== 0) return;
      if (this.charging) {
        e.preventDefault();
        this.releaseCharge();
      }
    },

    updateAimFromEvent(e) {
      const cue = this.cueBall();
      if (!cue || !cue.active) return;
      const { x, y } = this.eventPoint(e);
      this.pointer = { x, y, inside: true };
      if (this.current !== 0 || this.gameOver || this.ballInHand || this.phase !== 'aiming') return;
      const dx = x - cue.x;
      const dy = y - cue.y;
      if (hypot(dx, dy) > this.geo.r * 1.2) this.aimAngle = Math.atan2(dy, dx);
    },

    beginCharge(source = 'keyboard', pointerId = null) {
      if (!this.canHumanShoot()) return;
      this.audio.unlock();
      this.charging = true;
      this.chargeSource = source;
      this.chargePointerId = pointerId;
      this.chargeStart = performance.now();
      this.power = this.prefs.fixedPower || 0;
      this.stage.dataset.charging = 'true';
      this.updateHud();
      this.requestFrame();
    },

    updateCharge(now) {
      if (!this.charging) return;
      const t = (now - this.chargeStart) / 1000;
      this.power = this.prefs.fixedPower || clamp(t / 1.05, 0, 1);
      this.stage.style.setProperty('--bil-power', this.power.toFixed(4));
      if (this.refs.powerLabel) this.refs.powerLabel.textContent = `${Math.round(this.power * 100)}%`;
      if (this.power >= 1) this.stage.dataset.maxPower = 'true';
      else delete this.stage.dataset.maxPower;
    },

    releaseCharge() {
      if (!this.charging) return;
      this.updateCharge(performance.now());
      const power = Math.max(0.05, this.power);
      this.charging = false;
      this.clearChargeInput();
      this.stage.dataset.charging = 'false';
      delete this.stage.dataset.maxPower;
      this.updateHud();
      this.shoot(this.aimAngle, power);
    },

    cancelCharge(e) {
      if (e && e.preventDefault) e.preventDefault();
      this.spinDragging = false;
      if (!this.charging) return;
      this.charging = false;
      this.clearChargeInput();
      this.power = 0;
      this.stage.dataset.charging = 'false';
      delete this.stage.dataset.maxPower;
      this.stage.style.setProperty('--bil-power', '0');
      this.updateHud();
    },

    clearChargeInput() {
      const id = this.chargePointerId;
      this.chargePointerId = null;
      this.chargeSource = null;
      if (id !== null && this.stage.hasPointerCapture?.(id)) this.stage.releasePointerCapture(id);
    },

    spinLabel() {
      const parts = [];
      if (this.spinY > 0.12) parts.push('高杆');
      else if (this.spinY < -0.12) parts.push('低杆');
      if (this.spinX > 0.12) parts.push('右塞');
      else if (this.spinX < -0.12) parts.push('左塞');
      return parts.length ? parts.join('') : '中杆';
    },

    setSpin(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const length = hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      this.spinX = clamp(x, -1, 1);
      this.spinY = clamp(y, -1, 1);
      this.applySpinUI();
      this.requestFrame();
    },

    applySpinUI() {
      if (!this.spinDot) return;
      const left = 50 + this.spinX * 41;
      const top = 50 - this.spinY * 41;
      this.spinDot.style.left = `${left}%`;
      this.spinDot.style.top = `${top}%`;
      const label = this.spinLabel();
      this.spinName.textContent = label;
      this.spinBall.setAttribute('aria-label', `击球点：${label}。上高杆跟进，下低杆拉回，左右加塞`);
    },

    setSpinFromEvent(e) {
      const rect = this.spinBall.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ny = -((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
      this.setSpin(nx, ny);
    },

    onSpinPointerDown(e) {
      if (!this.isOpen || this.passive || e.button !== 0 || e.isPrimary === false) return;
      e.preventDefault();
      e.stopPropagation();
      this.spinDragging = true;
      try { this.spinBall.setPointerCapture(e.pointerId); } catch { /* noop */ }
      this.setSpinFromEvent(e);
    },

    onSpinPointerMove(e) {
      if (!this.spinDragging) return;
      e.preventDefault();
      this.setSpinFromEvent(e);
    },

    onSpinKeyDown(e) {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Home') {
        this.setSpin(0, 0);
        return;
      }
      const step = e.shiftKey ? 0.02 : 0.06;
      let x = this.spinX;
      let y = this.spinY;
      if (e.key === 'ArrowLeft') x -= step;
      else if (e.key === 'ArrowRight') x += step;
      else if (e.key === 'ArrowUp') y += step;
      else if (e.key === 'ArrowDown') y -= step;
      this.setSpin(x, y);
    },

    updateGhostCue(e) {
      const { x, y } = this.eventPoint(e);
      const result = this.nearestValidCuePosition(x, y);
      this.ghostCue = { x: result.x, y: result.y, valid: result.valid };
    },

    tryPlaceCue(e) {
      if (!this.ballInHand || this.current !== 0) return;
      const { x, y } = this.eventPoint(e);
      this.placeCue(this.nearestValidCuePosition(x, y));
    },

    placeCue(result) {
      if (!this.ballInHand || this.current !== 0) return;
      if (!result.valid || !this.validCuePosition(result.x, result.y)) {
        this.toast('这里放不下白球，换个位置。', 'foul', 1500);
        return;
      }
      const cue = this.cueBall();
      cue.active = true;
      cue.pocketed = false;
      cue.x = result.x;
      cue.y = result.y;
      cue.vx = 0;
      cue.vy = 0;
      cue.spinX = cue.spinY = 0;
      this.ballInHand = false;
      this.ghostCue = null;
      this.phase = 'aiming';
      this.aimAngle = this.defaultAimAngle();
      this.stage.dataset.placing = 'false';
      this.updateHud();
      this.persistSession();
      this.toast('白球放好了，开打。', 'good', 1200);
    },

    nearestValidCuePosition(x, y) {
      const g = this.geo;
      const r = g.r;
      const inside = x > g.play.x0 + r && x < g.play.x1 - r && y > g.play.y0 + r && y < g.play.y1 - r;
      if (inside && this.validCuePosition(x, y)) return { x, y, valid: true };
      let best = null;
      let bestDist = Infinity;
      const cx = clamp(x, g.play.x0 + r + 2, g.play.x1 - r - 2);
      const cy = clamp(y, g.play.y0 + r + 2, g.play.y1 - r - 2);
      for (let ring = 0; ring < 9 && !best; ring++) {
        const steps = 8 + ring * 8;
        const radius = ring * r * 0.5;
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * TAU;
          const px = clamp(cx + Math.cos(angle) * radius, g.play.x0 + r + 2, g.play.x1 - r - 2);
          const py = clamp(cy + Math.sin(angle) * radius, g.play.y0 + r + 2, g.play.y1 - r - 2);
          if (this.validCuePosition(px, py)) {
            const d = hypot(px - x, py - y);
            if (d < bestDist) { bestDist = d; best = { x: px, y: py, valid: true }; }
          }
        }
      }
      return best || { x: g.play.x0 + (g.play.x1 - g.play.x0) * 0.25, y: (g.play.y0 + g.play.y1) / 2, valid: false };
    },

    validCuePosition(x, y) {
      const g = this.geo;
      const r = g.r;
      if (x < g.play.x0 + r + 1 || x > g.play.x1 - r - 1 || y < g.play.y0 + r + 1 || y > g.play.y1 - r - 1) return false;
      for (const ball of this.balls) {
        if (!ball.active || ball.kind === 'cue') continue;
        if (hypot(ball.x - x, ball.y - y) < r * 2 + 1.2) return false;
      }
      for (const pocket of g.pockets) {
        if (hypot(pocket.x - x, pocket.y - y) < pocket.r + r * 0.55) return false;
      }
      return true;
    },


  };
