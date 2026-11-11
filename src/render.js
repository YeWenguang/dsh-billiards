  const renderMethods = {
    spawnImpact(x, y, speed) {
      if (this.reduceMotion) return;
      const count = clamp(Math.round(speed / 220), 1, 4);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * TAU;
        const v = rand(18, 60) * clamp(speed / 600, 0.4, 1.4);
        this.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, born: performance.now(), life: rand(220, 420), size: rand(0.8, 2), color: 'rgba(225,255,245,.7)' });
      }
    },

    spawnBurst(x, y) {
      if (this.reduceMotion) return;
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * TAU;
        const v = rand(20, 95);
        this.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, born: performance.now(), life: rand(300, 650), size: rand(0.7, 2.2), color: i % 3 === 0 ? 'rgba(240,202,132,.8)' : 'rgba(120,240,208,.65)' });
      }
    },

    screenToWorld(x, y) {
      const v = this.view || { x: 0, y: 0, scale: 1, rotated: false };
      return v.rotated ? { x: (y - v.y) / v.scale, y: this.geo.h - (x - v.x) / v.scale }
        : { x: (x - v.x) / v.scale, y: (y - v.y) / v.scale };
    },

    worldToScreen(x, y) {
      const v = this.view || { x: 0, y: 0, scale: 1, rotated: false };
      return v.rotated ? { x: v.x + (this.geo.h - y) * v.scale, y: v.y + x * v.scale }
        : { x: v.x + x * v.scale, y: v.y + y * v.scale };
    },

    eventPoint(e) {
      const rect = this.stage.getBoundingClientRect();
      return this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    },

    resize() {
      if (!this.canvas) return;
      const w = Math.max(1, window.innerWidth || 1200);
      const h = Math.max(1, window.innerHeight || 800);
      this.viewW = w; this.viewH = h;
      if (!this.geo) {
        this.w = Math.max(320, w, h); this.h = Math.max(320, Math.min(w, h));
        this.geo = this.computeGeometry(this.w, this.h);
      }
      // A rack owns its physics geometry. Resizing only changes the camera.
      const rotated = (h > w) !== (this.geo.h > this.geo.w);
      const rw = rotated ? this.geo.h : this.geo.w;
      const rh = rotated ? this.geo.w : this.geo.h;
      const scale = Math.min(w / rw, h / rh);
      const x = (w - rw * scale) / 2, y = (h - rh * scale) / 2;
      this.view = { x, y, scale, rotated };
      const dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(4_000_000 / (w * h)));
      this.dpr = dpr;
      const size = (canvas, cw, ch) => {
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      };
      size(this.canvas, Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)));
      this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
      const raster = dpr * scale;
      const sw = Math.max(1, Math.round(this.geo.w * raster)), sh = Math.max(1, Math.round(this.geo.h * raster));
      const redraw = this.staticCanvas.width !== sw || this.staticCanvas.height !== sh || this.staticGeometry !== this.geo;
      size(this.staticCanvas, sw, sh);
      this.staticCtx.setTransform(raster, 0, 0, raster, 0, 0);
      if (redraw) { this.renderStatic(); this.staticGeometry = this.geo; }
      this.hudNeedsMeasure = true;
      this.render();
      this.requestFrame();
    },

    relaxLayout() {
      const { r, play } = this.geo;
      const balls = this.balls.filter((b) => b.active);
      const bound = (ball) => {
        ball.x = clamp(ball.x, play.x0 + r, play.x1 - r);
        ball.y = clamp(ball.y, play.y0 + r, play.y1 - r);
      };
      for (const ball of balls) bound(ball);
      for (let pass = 0; pass < 48; pass++) {
        let overlap = false;
        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i];
            const b = balls[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d = hypot(dx, dy);
            if (d >= r * 2 - 0.001) continue;
            if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
            const push = (r * 2 + 0.001 - d) / 2;
            a.x -= dx / d * push;
            a.y -= dy / d * push;
            b.x += dx / d * push;
            b.y += dy / d * push;
            bound(a);
            bound(b);
            overlap = true;
          }
        }
        if (!overlap) break;
      }
    },

    onResize() {
      if (this.destroyed) return;
      this.resize();
    },

    startLoop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.lastTs = 0;
      this.accum = 0;
      this.requestFrame();
    },

    requestFrame() {
      if (this.raf || !this.isOpen || this.passive || this.panelOpen || this.destroyed || document.hidden) return;
      this.raf = requestAnimationFrame(this.loop);
    },

    loop(ts) {
      this.raf = null;
      if (!this.isOpen || this.passive || this.panelOpen || this.destroyed || document.hidden) return;
      if (!this.lastTs) this.lastTs = ts;
      const dt = Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      this.updateCharge(ts);
      this.updateAI(ts);
      if (this.phase === 'shooting') {
        this.accum += dt;
        let steps = 0;
        while (this.accum >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
          this.stepPhysics(FIXED_STEP);
          this.accum -= FIXED_STEP;
          steps++;
        }
        if (this.accum > FIXED_STEP * MAX_STEPS_PER_FRAME) this.accum = 0;
        if (this.allStopped()) this.onBallsStopped();
      } else if (this.phase === 'settling' && ts >= this.resolveAt) {
        this.resolveShot();
      }
      this.render();
      if (this.charging || ['shooting', 'settling', 'ai', 'ai-aiming'].includes(this.phase)
        || (this.phase === 'placing' && !this.reduceMotion)
        || this.animations.length || this.particles.length) this.requestFrame();
    },

    renderStatic() {
      if (!this.staticCtx || !this.geo) return;
      const ctx = this.staticCtx;
      const { w, h, rail, play, pockets } = this.geo;
      ctx.clearRect(0, 0, w, h);

      const wood = ctx.createLinearGradient(0, 0, w, h);
      wood.addColorStop(0, '#3a2319');
      wood.addColorStop(0.22, '#20130f');
      wood.addColorStop(0.5, '#43281b');
      wood.addColorStop(0.78, '#1a100c');
      wood.addColorStop(1, '#332017');
      ctx.fillStyle = wood;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.055;
      ctx.strokeStyle = '#e7bf87';
      ctx.lineWidth = 1;
      for (let i = -h; i < w + h; i += 7) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.bezierCurveTo(i + 12, h * 0.3, i - 16, h * 0.7, i + 4, h);
        ctx.stroke();
      }
      ctx.restore();

      // The playfield stays transparent so the Harness UI shows through the
      // CSS veil underneath: the page itself is the cloth.
      ctx.clearRect(play.x0, play.y0, play.x1 - play.x0, play.y1 - play.y0);

      ctx.save();
      ctx.beginPath();
      ctx.rect(play.x0, play.y0, play.x1 - play.x0, play.y1 - play.y0);
      ctx.clip();
      const innerShade = ctx.createLinearGradient(0, play.y0, 0, play.y0 + 90);
      innerShade.addColorStop(0, 'rgba(0,5,4,.16)');
      innerShade.addColorStop(1, 'rgba(0,5,4,0)');
      ctx.fillStyle = innerShade;
      ctx.fillRect(play.x0, play.y0, play.x1 - play.x0, 90);
      const innerShade2 = ctx.createLinearGradient(0, play.y1, 0, play.y1 - 90);
      innerShade2.addColorStop(0, 'rgba(0,5,4,.11)');
      innerShade2.addColorStop(1, 'rgba(0,5,4,0)');
      ctx.fillStyle = innerShade2;
      ctx.fillRect(play.x0, play.y1 - 90, play.x1 - play.x0, 90);
      const sideShade = ctx.createLinearGradient(play.x0, 0, play.x0 + 110, 0);
      sideShade.addColorStop(0, 'rgba(0,8,6,.09)');
      sideShade.addColorStop(1, 'rgba(0,8,6,0)');
      ctx.fillStyle = sideShade;
      ctx.fillRect(play.x0, play.y0, 110, play.y1 - play.y0);
      const sideShade2 = ctx.createLinearGradient(play.x1, 0, play.x1 - 110, 0);
      sideShade2.addColorStop(0, 'rgba(0,8,6,.08)');
      sideShade2.addColorStop(1, 'rgba(0,8,6,0)');
      ctx.fillStyle = sideShade2;
      ctx.fillRect(play.x1 - 110, play.y0, 110, play.y1 - play.y0);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.42, Math.max(w, h) * 0.62);
      glow.addColorStop(0, 'rgba(78, 205, 168, .075)');
      glow.addColorStop(0.5, 'rgba(20, 92, 76, .035)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(play.x0, play.y0, play.x1 - play.x0, play.y1 - play.y0);

      // Key light from above-left: a soft warm pool that falls off toward the
      // corners, plus a long specular sheen across the cloth.
      const keyLight = ctx.createRadialGradient(w * 0.38, h * 0.3, 8, w * 0.38, h * 0.3, Math.max(w, h) * 0.82);
      keyLight.addColorStop(0, 'rgba(255, 246, 220, .075)');
      keyLight.addColorStop(0.42, 'rgba(180, 235, 210, .032)');
      keyLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = keyLight;
      ctx.fillRect(play.x0, play.y0, play.x1 - play.x0, play.y1 - play.y0);
      const sheen = ctx.createLinearGradient(play.x0, play.y0, play.x1, play.y1);
      sheen.addColorStop(0, 'rgba(255, 250, 232, 0)');
      sheen.addColorStop(0.34, 'rgba(255, 250, 232, .022)');
      sheen.addColorStop(0.65, 'rgba(255, 250, 232, .008)');
      sheen.addColorStop(1, 'rgba(255, 250, 232, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(play.x0, play.y0, play.x1 - play.x0, play.y1 - play.y0);

      ctx.globalAlpha = 0.09;
      ctx.strokeStyle = '#dfffee';
      ctx.lineWidth = 1;
      const headX = play.x0 + (play.x1 - play.x0) * 0.25;
      ctx.beginPath();
      ctx.moveTo(headX, play.y0);
      ctx.lineTo(headX, play.y1);
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#f2e6c9';
      ctx.beginPath();
      ctx.arc(play.x0 + (play.x1 - play.x0) * 0.7, (play.y0 + play.y1) / 2, Math.max(2, this.geo.r * 0.17), 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.022;
      ctx.fillStyle = '#eafff8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${clamp(Math.min(w, h) * 0.06, 26, 74)}px "Inter", "Segoe UI", system-ui, sans-serif`;
      ctx.fillText('DEEPSEEK HARNESS', w / 2, h / 2);
      ctx.restore();

      // Brass diamonds on the rails.
      ctx.save();
      ctx.fillStyle = 'rgba(232, 197, 137, .72)';
      ctx.shadowColor = 'rgba(240, 202, 132, .45)';
      ctx.shadowBlur = 5;
      const diamond = (x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.restore();
      };
      const spanX = play.x1 - play.x0;
      const spanY = play.y1 - play.y0;
      for (let i = 1; i <= 7; i++) {
        if (i === 4) continue;
        diamond(play.x0 + (spanX * i) / 8, rail / 2);
        diamond(play.x0 + (spanX * i) / 8, h - rail / 2);
      }
      for (let i = 1; i <= 3; i++) {
        diamond(rail / 2, play.y0 + (spanY * i) / 4);
        diamond(w - rail / 2, play.y0 + (spanY * i) / 4);
      }
      ctx.restore();

      // Warm top edge / cool lower edge: a tiny directional cue that ties the
      // cloth to the key light above-left.
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 240, 205, .24)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(play.x0 + 18, play.y0 + 1);
      ctx.lineTo(play.x1 - 18, play.y0 + 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(100, 226, 194, .11)';
      ctx.beginPath();
      ctx.moveTo(play.x0 + 18, play.y1 - 1);
      ctx.lineTo(play.x1 - 18, play.y1 - 1);
      ctx.stroke();
      ctx.restore();

      // Cushion bevel: a warm gold line and a deep inner shadow.
      ctx.save();
      ctx.strokeStyle = 'rgba(238, 205, 148, .38)';
      ctx.lineWidth = 1;
      ctx.strokeRect(play.x0 - 0.5, play.y0 - 0.5, play.x1 - play.x0 + 1, play.y1 - play.y0 + 1);
      ctx.strokeStyle = 'rgba(0, 0, 0, .35)';
      ctx.strokeRect(play.x0 + 1.5, play.y0 + 1.5, play.x1 - play.x0 - 3, play.y1 - play.y0 - 3);
      ctx.restore();

      // Pockets: black wells with a brushed metal jaw.
      for (const pocket of pockets) {
        const pr = pocket.r;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.65)';
        ctx.shadowBlur = 18;
        const rim = ctx.createLinearGradient(pocket.x - pr, pocket.y - pr, pocket.x + pr, pocket.y + pr);
        rim.addColorStop(0, 'rgba(245, 221, 170, .72)');
        rim.addColorStop(0.32, 'rgba(116, 89, 53, .85)');
        rim.addColorStop(0.55, 'rgba(15, 12, 9, .94)');
        rim.addColorStop(0.8, 'rgba(158, 126, 76, .6)');
        rim.addColorStop(1, 'rgba(27, 21, 14, .9)');
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, pr * 1.12, 0, TAU);
        ctx.fillStyle = rim;
        ctx.fill();
        ctx.shadowBlur = 0;
        const hole = ctx.createRadialGradient(pocket.x - pr * 0.2, pocket.y - pr * 0.2, pr * 0.1, pocket.x, pocket.y, pr * 1.05);
        hole.addColorStop(0, '#000');
        hole.addColorStop(0.72, '#020504');
        hole.addColorStop(1, '#07120e');
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, pr * 1.0, 0, TAU);
        ctx.fillStyle = hole;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 233, 189, .18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, pr * 1.01, Math.PI * 1.05, Math.PI * 1.9);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      ctx.restore();
    },

    render() {
      if (!this.ctx || !this.geo || !this.isOpen || this.passive || document.hidden) return;
      if (this.hudNeedsMeasure) this.measureHud();
      const ctx = this.ctx;
      const { w, h } = this.geo;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const v = this.view || { x: 0, y: 0, scale: 1, rotated: false };
      const k = this.dpr * v.scale;
      if (v.rotated) ctx.setTransform(0, k, -k, 0, (v.x + h * v.scale) * this.dpr, v.y * this.dpr);
      else ctx.setTransform(k, 0, 0, k, v.x * this.dpr, v.y * this.dpr);
      ctx.drawImage(this.staticCanvas, 0, 0, w, h);
      const aim = this.prefs.guide ? this.aimPlan() : null;
      if (aim) this.drawAim(ctx, aim);
      this.drawBalls(ctx);
      this.drawCue(ctx);
      this.drawAnimations(ctx);
      this.drawParticles(ctx);
      this.drawGhostCue(ctx);
      this.updateHudOcclusion(aim);
    },

    // The HUD floats over the table, so anything it covers is information the
    // player cannot see. Measure the panels once, then fade a panel out
    // completely while a ball or the aim path is underneath it.
    measureHud() {
      if (!this.stage || !this.isOpen || this.passive) return;
      this.hudNeedsMeasure = false;
      this.hudItems = Array.from(this.stage.querySelectorAll(
        '.dsh-bil-brand, .dsh-bil-turn, .dsh-bil-actions, .dsh-bil-player, .dsh-bil-spin-panel, .dsh-bil-corner, .dsh-bil-bottom',
      ));
      this.hudRects = this.hudItems.map((el) => {
        const box = el.getBoundingClientRect();
        const a = this.screenToWorld(box.left, box.top);
        const b = this.screenToWorld(box.right, box.bottom);
        return { el, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x-a.x), h: Math.abs(b.y-a.y) };
      });
    },

    hudAimSegments(plan = this.aimPlan()) {
      if (!this.prefs.guide) return null;
      if (!plan) return null;
      const r = this.geo.r;
      const segs = [{
        x1: plan.cue.x + plan.dx * (r + 3),
        y1: plan.cue.y + plan.dy * (r + 3),
        x2: plan.px,
        y2: plan.py,
      }];
      if (plan.hit) {
        const bx = plan.hit.x - plan.px;
        const by = plan.hit.y - plan.py;
        const bl = hypot(bx, by) || 1;
        segs.push({
          x1: plan.hit.x + (bx / bl) * (r + 2),
          y1: plan.hit.y + (by / bl) * (r + 2),
          x2: plan.hit.x + (bx / bl) * (r + 52),
          y2: plan.hit.y + (by / bl) * (r + 52),
        });
      }
      return segs;
    },

    updateHudOcclusion(aim = this.aimPlan()) {
      if (!this.isOpen || !this.hudRects) return;
      const r = this.geo.r * 1.02;
      const segments = this.hudAimSegments(aim);
      for (const item of this.hudRects) {
        const pad = item.el.classList.contains('dsh-bil-actions') ? 4 : 6;
        const minX = item.x - pad;
        const maxX = item.x + item.w + pad;
        const minY = item.y - pad;
        const maxY = item.y + item.h + pad;
        let covered = false;
        for (const ball of this.balls) {
          if (!ball.active) continue;
          const nx = clamp(ball.x, minX, maxX);
          const ny = clamp(ball.y, minY, maxY);
          if ((ball.x - nx) ** 2 + (ball.y - ny) ** 2 < r * r) {
            covered = true;
            break;
          }
        }
        if (!covered && segments) {
          for (const s of segments) {
            if (segmentHitsRect(s.x1, s.y1, s.x2, s.y2, minX, minY, maxX, maxY)) {
              covered = true;
              break;
            }
          }
        }
        const next = covered ? 'true' : 'false';
        if (item.el.dataset.occluded !== next) item.el.dataset.occluded = next;
      }
    },

    // Shared aim geometry: used by drawAim() and by the HUD occlusion pass so
    // the panels can get out of the way of the predicted path.
    aimPlan() {
      if (!this.isOpen || this.gameOver) return null;
      if (this.phase !== 'aiming' && this.phase !== 'ai-aiming') return null;
      if (this.ballInHand) return null;
      const cue = this.cueBall();
      if (!cue || !cue.active) return null;
      const g = this.geo;
      const r = g.r;
      const dx = Math.cos(this.aimAngle);
      const dy = Math.sin(this.aimAngle);
      let hit = null;
      let hitT = Infinity;
      for (const ball of this.balls) {
        if (!ball.active || ball.kind === 'cue') continue;
        const t = rayCircle(cue.x, cue.y, dx, dy, ball.x, ball.y, r * 2);
        if (t !== null && t < hitT) {
          hitT = t;
          hit = ball;
        }
      }
      let wallT = Infinity;
      let wallNormal = null;
      if (dx > 0) {
        const t = (g.play.x1 - r - cue.x) / dx;
        if (t > 0 && t < wallT) { wallT = t; wallNormal = { x: -1, y: 0 }; }
      } else if (dx < 0) {
        const t = (g.play.x0 + r - cue.x) / dx;
        if (t > 0 && t < wallT) { wallT = t; wallNormal = { x: 1, y: 0 }; }
      }
      if (dy > 0) {
        const t = (g.play.y1 - r - cue.y) / dy;
        if (t > 0 && t < wallT) { wallT = t; wallNormal = { x: 0, y: -1 }; }
      } else if (dy < 0) {
        const t = (g.play.y0 + r - cue.y) / dy;
        if (t > 0 && t < wallT) { wallT = t; wallNormal = { x: 0, y: 1 }; }
      }
      const t = Math.min(hitT, wallT, 4000);
      if (hitT > wallT || hitT > 4000) hit = null;
      if (hit) wallNormal = null;
      return { cue, dx, dy, hit, hitT, wallT, wallNormal, t, px: cue.x + dx * t, py: cue.y + dy * t };
    },

    drawAim(ctx, plan = this.aimPlan()) {
      if (!plan) return;
      const { cue, dx, dy, hit, wallNormal, px, py } = plan;
      const r = this.geo.r;
      const accent = this.current === 1 ? '240, 202, 132' : '160, 255, 227';
      ctx.save();
      // Dark underlay keeps the aim line readable over a very transparent,
      // light-theme Harness page as well as over the dark felt.
      ctx.strokeStyle = 'rgba(0, 16, 12, .3)';
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 8]);
      ctx.beginPath();
      ctx.moveTo(cue.x + dx * (r + 3), cue.y + dy * (r + 3));
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${accent}, .72)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cue.x + dx * (r + 3), cue.y + dy * (r + 3));
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hit) {
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.strokeStyle = 'rgba(0, 16, 12, .28)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.strokeStyle = `rgba(${accent}, .66)`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = `rgba(${accent}, .07)`;
        ctx.fill();
        const bx = hit.x - px;
        const by = hit.y - py;
        const bl = hypot(bx, by) || 1;
        const tx = bx / bl;
        const ty = by / bl;
        ctx.strokeStyle = 'rgba(0, 16, 12, .24)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hit.x + tx * (r + 2), hit.y + ty * (r + 2));
        ctx.lineTo(hit.x + tx * (r + 52), hit.y + ty * (r + 52));
        ctx.stroke();
        ctx.strokeStyle = 'rgba(240, 202, 132, .7)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(hit.x + tx * (r + 2), hit.y + ty * (r + 2));
        ctx.lineTo(hit.x + tx * (r + 52), hit.y + ty * (r + 52));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, r + 2, 0, TAU);
        ctx.strokeStyle = 'rgba(240, 202, 132, .26)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (this.current === 1) {
          ctx.beginPath();
          ctx.arc(hit.x, hit.y, r + 7 + (this.reduceMotion ? 0 : Math.sin(performance.now() / 280) * 2), 0, TAU);
          ctx.strokeStyle = 'rgba(240, 202, 132, .2)';
          ctx.stroke();
        }
      } else if (wallNormal) {
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, TAU);
        ctx.strokeStyle = `rgba(${accent}, .36)`;
        ctx.stroke();
      }
      ctx.restore();
    },

    drawCue(ctx) {
      const cue = this.cueBall();
      if (!cue || !cue.active) return;
      const g = this.geo;
      const isCharging = this.charging;
      const isAI = this.current === 1 && this.phase === 'ai-aiming';
      if (!isCharging && this.phase !== 'aiming' && !isAI) return;
      if (this.ballInHand) return;
      const power = isCharging ? this.power : isAI ? this.aiPlan?.power || this.power : 0;
      const glowR = g.r * (2.3 + power * 1.7);
      const glow = ctx.createRadialGradient(cue.x, cue.y, g.r * 0.45, cue.x, cue.y, glowR);
      glow.addColorStop(0, isAI ? `rgba(240, 202, 132, ${0.06 + power * 0.07})` : `rgba(95, 240, 196, ${0.05 + power * 0.1})`);
      glow.addColorStop(0.55, isAI ? 'rgba(240, 202, 132, .025)' : 'rgba(95, 240, 196, .022)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cue.x, cue.y, glowR, 0, TAU);
      ctx.fill();
      ctx.restore();
      const resting = 12 + g.r * 0.55;
      const pull = resting + power * (g.r * 3.4) + (this.reduceMotion ? 0 : Math.sin(performance.now() / 80) * power * 1.8);
      const length = clamp(Math.min(g.w, g.h) * 0.28, 140, 240);
      const angle = this.aimAngle;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const tipX = cue.x - dx * (g.r + pull);
      const tipY = cue.y - dy * (g.r + pull);
      const buttX = tipX - dx * length;
      const buttY = tipY - dy * length;
      const px = -dy;
      const py = dx;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 5;
      const gradient = ctx.createLinearGradient(tipX, tipY, buttX, buttY);
      gradient.addColorStop(0, '#f4e8cf');
      gradient.addColorStop(0.025, '#d8b77f');
      gradient.addColorStop(0.28, '#9b6a35');
      gradient.addColorStop(0.55, '#57351e');
      gradient.addColorStop(0.7, '#15100d');
      gradient.addColorStop(0.86, '#3e2a1d');
      gradient.addColorStop(1, '#0a0807');
      ctx.beginPath();
      ctx.moveTo(tipX + px * 2.2, tipY + py * 2.2);
      ctx.lineTo(tipX - px * 2.2, tipY - py * 2.2);
      ctx.lineTo(buttX - px * 6.2, buttY - py * 6.2);
      ctx.lineTo(buttX + px * 6.2, buttY + py * 6.2);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(255, 240, 206, .42)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(tipX + px * 0.4, tipY + py * 0.4);
      ctx.lineTo(buttX + px * 1.8, buttY + py * 1.8);
      ctx.stroke();
      ctx.fillStyle = '#e9f5ed';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.1, 0, TAU);
      ctx.fill();
      if (isCharging) {
        const ringR = g.r + 10;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(0, 8, 6, .28)';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.arc(cue.x, cue.y, ringR, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235, 255, 248, .18)';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(cue.x, cue.y, ringR, 0, TAU);
        ctx.stroke();
        const chargeColor = power >= 0.99 ? 'rgba(255, 138, 120, .96)'
          : power >= 0.66 ? 'rgba(240, 202, 132, .96)' : 'rgba(95, 240, 196, .96)';
        ctx.strokeStyle = chargeColor;
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cue.x, cue.y, ringR, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.002, power));
        ctx.stroke();
        ctx.save();
        ctx.font = '700 10px "Inter", "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, .55)';
        ctx.shadowBlur = 5;
        ctx.fillStyle = chargeColor;
        const labelY = clamp(cue.y - g.r - 16, g.play.y0 + 16, g.play.y1 - 14);
        ctx.fillText(`${Math.round(power * 100)}%`, cue.x, labelY);
        ctx.restore();
      } else if (isAI) {
        ctx.strokeStyle = 'rgba(240,202,132,.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cue.x, cue.y, g.r + 7, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawBalls(ctx) {
      const g = this.geo;
      const r = g.r;
      const active = this.balls.filter((b) => b.active);
      active.sort((a, b) => (a.kind === 'cue' ? 1 : b.kind === 'cue' ? -1 : a.y - b.y));
      for (const ball of active) {
        const speed = hypot(ball.vx, ball.vy);
        if (!this.reduceMotion && speed > 120) {
          ctx.save();
          ctx.strokeStyle = ball.kind === 'cue' ? 'rgba(255,245,220,.08)' : this.hexToRgba(ball.color, 0.1);
          ctx.lineWidth = r * 1.7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y);
          ctx.lineTo(ball.x - ball.vx * 0.02, ball.y - ball.vy * 0.02);
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        // Soft ambient shadow: a large, blurred pool of darkness offset away
        // from the key light, plus a tighter contact shadow that keeps the
        // ball visually seated on the cloth.
        ctx.save();
        ctx.translate(ball.x + r * 0.16, ball.y + r * 0.32);
        ctx.scale(1, 0.62);
        const ambient = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.62);
        ambient.addColorStop(0, 'rgba(0, 9, 7, .48)');
        ambient.addColorStop(0.52, 'rgba(0, 9, 7, .22)');
        ambient.addColorStop(1, 'rgba(0, 9, 7, 0)');
        ctx.fillStyle = ambient;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.62, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(0, 7, 5, .3)';
        ctx.beginPath();
        ctx.ellipse(ball.x + r * 0.1, ball.y + r * 0.22, r * 0.92, r * 0.66, 0, 0, TAU);
        ctx.fill();
        this.drawBall(ctx, ball, r);
        ctx.restore();
      }
    },

    drawBall(ctx, ball, r) {
      const x = ball.x;
      const y = ball.y;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();
      if (ball.kind === 'cue') {
        const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.08, x, y, r * 1.04);
        grad.addColorStop(0, '#fffdf4');
        grad.addColorStop(0.34, '#f6ecd7');
        grad.addColorStop(0.78, '#d8c8aa');
        grad.addColorStop(1, '#8f7d63');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        const previewingSpin = this.current === 0 && (this.phase === 'aiming' || this.phase === 'placing');
        const spinX = previewingSpin ? this.spinX : ball.spinX || 0;
        const spinY = previewingSpin ? this.spinY : ball.spinY || 0;
        ctx.fillStyle = 'rgba(196, 60, 48, .8)';
        ctx.beginPath();
        ctx.arc(x + spinX * r * 0.52, y - spinY * r * 0.52, r * 0.095, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 240, 220, .55)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(x + spinX * r * 0.52, y - spinY * r * 0.52, r * 0.135, 0, TAU);
        ctx.stroke();
      } else if (ball.kind === 'stripe') {
        const white = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.08, x, y, r * 1.04);
        white.addColorStop(0, '#fffef7');
        white.addColorStop(0.72, '#f2e8d5');
        white.addColorStop(1, '#a79980');
        ctx.fillStyle = white;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        const grad = ctx.createLinearGradient(x - r, y, x + r, y);
        grad.addColorStop(0, this.shade(ball.color, -0.35));
        grad.addColorStop(0.32, ball.color);
        grad.addColorStop(0.7, this.shade(ball.color, 0.1));
        grad.addColorStop(1, this.shade(ball.color, -0.45));
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r * 0.58, r * 2, r * 1.16);
        ctx.fillStyle = 'rgba(255,255,255,.09)';
        ctx.fillRect(x - r, y - r * 0.68, r * 2, r * 0.1);
      } else {
        const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.06, x, y, r * 1.06);
        grad.addColorStop(0, this.shade(ball.color, 0.45));
        grad.addColorStop(0.33, this.shade(ball.color, 0.06));
        grad.addColorStop(0.76, this.shade(ball.color, -0.25));
        grad.addColorStop(1, this.shade(ball.color, -0.65));
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      if (ball.kind !== 'cue') {
        // Project the number spot from the ball's world-space pole. Numbers
        // are printed on two opposite spots, so one is always facing up;
        // as the ball rolls the spot slides towards the direction of travel,
        // squashes at the rim and the other spot rises from the far side.
        const pole = ball.pole || { x: 0, y: 0, z: 1 };
        const flip = pole.z < 0 ? -1 : 1;
        const nx = pole.x * flip;
        const ny = pole.y * flip;
        const nz = Math.abs(pole.z);
        const spotX = x + nx * r;
        const spotY = y + ny * r;
        const squash = Math.max(0.06, nz);
        const tilt = Math.atan2(ny, nx);
        const spotR = r * 0.385;
        ctx.save();
        ctx.translate(spotX, spotY);
        ctx.rotate(tilt);
        ctx.scale(squash, 1);
        ctx.beginPath();
        ctx.arc(0, 0, spotR, 0, TAU);
        ctx.fillStyle = '#f8f2e6';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.12)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
        if (nz > 0.14) {
          ctx.save();
          ctx.translate(spotX, spotY);
          ctx.rotate(tilt);
          ctx.scale(squash, 1);
          ctx.rotate(-tilt);
          ctx.fillStyle = '#1b2420';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `800 ${ball.number > 9 ? r * 0.5 : r * 0.57}px "Inter", "Segoe UI", system-ui, sans-serif`;
          ctx.fillText(String(ball.number), 0, r * 0.02);
          ctx.restore();
        }
      }

      ctx.beginPath();
      ctx.arc(x, y, r * 0.985, 0, TAU);
      ctx.strokeStyle = 'rgba(0,0,0,.34)';
      ctx.lineWidth = Math.max(0.8, r * 0.06);
      ctx.stroke();
      // Cool bounce light from the cloth along the lower-right rim.
      ctx.beginPath();
      ctx.arc(x, y, r * 0.9, 0.35, 1.45);
      ctx.strokeStyle = 'rgba(126, 240, 208, .13)';
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.stroke();
      const shine = ctx.createLinearGradient(x - r * 0.7, y - r * 0.7, x + r * 0.1, y + r * 0.2);
      shine.addColorStop(0, 'rgba(255,255,255,.6)');
      shine.addColorStop(0.55, 'rgba(255,255,255,.06)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.ellipse(x - r * 0.34, y - r * 0.38, r * 0.34, r * 0.2, -0.55, 0, TAU);
      ctx.fillStyle = shine;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - r * 0.43, y - r * 0.48, r * 0.1, r * 0.06, -0.5, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.fill();
      ctx.restore();
    },

    drawAnimations(ctx) {
      const now = performance.now();
      this.animations = this.animations.filter((a) => now - a.born < a.life);
      for (const a of this.animations) {
        const t = clamp((now - a.born) / a.life, 0, 1);
        const ease = t * t;
        const x = lerp(a.fromX, a.x, ease);
        const y = lerp(a.fromY, a.y, ease);
        const r = this.geo.r * (1 - t * 0.65);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = a.color;
        ctx.fill();
        ctx.restore();
      }
    },

    drawParticles(ctx) {
      const now = performance.now();
      this.particles = this.particles.filter((p) => now - p.born < p.life);
      for (const p of this.particles) {
        const age = (now - p.born) / 1000;
        const t = clamp((now - p.born) / p.life, 0, 1);
        const x = p.x + p.vx * age;
        const y = p.y + p.vy * age;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 - t * 0.6), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    },

    drawGhostCue(ctx) {
      if (!this.ballInHand || this.current !== 0 || !this.ghostCue) return;
      const g = this.geo;
      const { x, y, valid } = this.ghostCue;
      ctx.save();
      ctx.globalAlpha = valid ? 0.62 : 0.5;
      ctx.beginPath();
      ctx.arc(x, y, g.r, 0, TAU);
      ctx.fillStyle = 'rgba(242, 234, 216, .45)';
      ctx.fill();
      ctx.strokeStyle = valid ? 'rgba(95, 240, 196, .9)' : 'rgba(255, 138, 120, .9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, g.r + 9 + (this.reduceMotion ? 0 : Math.sin(performance.now() / 250) * 2), 0, TAU);
      ctx.strokeStyle = valid ? 'rgba(95, 240, 196, .25)' : 'rgba(255, 138, 120, .25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    },

    hexToRgba(hex, alpha) {
      const clean = hex.replace('#', '');
      const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
      const n = parseInt(value, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    },

    shade(hex, amount) {
      const clean = hex.replace('#', '');
      const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
      const n = parseInt(value, 16);
      let r = (n >> 16) & 255;
      let g = (n >> 8) & 255;
      let b = n & 255;
      if (amount >= 0) {
        r = Math.round(lerp(r, 255, amount));
        g = Math.round(lerp(g, 255, amount));
        b = Math.round(lerp(b, 255, amount));
      } else {
        r = Math.round(lerp(r, 0, -amount));
        g = Math.round(lerp(g, 0, -amount));
        b = Math.round(lerp(b, 0, -amount));
      }
      return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
    },


  };
