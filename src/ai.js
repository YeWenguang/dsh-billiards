  const aiMethods = {
    pauseAi() {
      this.aiActionAt = 0;
    },

    scheduleAI() {
      if (this.current !== 1 || this.gameOver) return;
      this.phase = 'ai';
      this.aiPlan = null;
      this.aiActionAt = performance.now() + 950;
    },

    updateAI(now) {
      if (!this.isOpen || this.gameOver || this.current !== 1) return;
      if (this.phase !== 'ai' && this.phase !== 'ai-aiming') return;
      if (!this.aiActionAt) this.aiActionAt = now + 700;
      if (now < this.aiActionAt) return;
      if (this.phase === 'ai') {
        if (this.ballInHand) this.aiPlaceCue();
        this.aiPlan = this.planAIShot();
        this.phase = 'ai-aiming';
        this.aimAngle = this.aiPlan.angle;
        this.power = this.aiPlan.power;
        this.aiActionAt = now + 880;
        this.updateHud();
        return;
      }
      if (this.phase === 'ai-aiming' && this.aiPlan) {
        const plan = this.aiPlan;
        this.aiPlan = null;
        this.shoot(plan.angle, plan.power, { ai: true, spin: plan.spin });
      }
    },

    planAIShot({ deterministic = false } = {}) {
      const cue = this.cueBall();
      const targets = this.aiTargets();
      const g = this.geo;
      let best = null;
      if (cue && cue.active) {
        for (const target of targets) {
          for (const pocket of g.pockets) {
            const pdx = pocket.x - target.x;
            const pdy = pocket.y - target.y;
            const pdist = hypot(pdx, pdy);
            if (pdist < g.r * 2) continue;
            const ux = pdx / pdist;
            const uy = pdy / pdist;
            const ghost = { x: target.x - ux * (g.r * 2 + 0.1), y: target.y - uy * (g.r * 2 + 0.1) };
            if (ghost.x < g.play.x0 + g.r || ghost.x > g.play.x1 - g.r || ghost.y < g.play.y0 + g.r || ghost.y > g.play.y1 - g.r) continue;
            if (this.segmentBlocked(cue, ghost, [target])) continue;
            if (this.segmentBlocked(target, pocket, [target])) continue;
            const cdx = ghost.x - cue.x;
            const cdy = ghost.y - cue.y;
            const cdist = hypot(cdx, cdy);
            if (cdist < g.r * 0.3) continue;
            const cut = (cdx * ux + cdy * uy) / cdist;
            if (cut < 0.22) continue;
            let score = (1 - cut) * 120 + pdist * 0.055 + cdist * 0.018;
            // Approximate the cue's tangent after contact and penalize a
            // direct scratch route. This is a one-contact risk estimate.
            const incoming = { x: cdx / cdist, y: cdy / cdist };
            const tangent = { x: incoming.x - cut * ux, y: incoming.y - cut * uy };
            const tl = hypot(tangent.x, tangent.y);
            if (tl > 0.08) {
              const tx = tangent.x / tl, ty = tangent.y / tl;
              for (const hole of g.pockets) {
                const hx = hole.x - ghost.x, hy = hole.y - ghost.y;
                const forward = hx * tx + hy * ty;
                if (forward > 0 && Math.abs(hx * ty - hy * tx) < hole.r + g.r * 0.4) score += 160;
              }
            }
            if (pocket.side) score += 9;
            if (target.number === 8) score -= 8;
            if (!best || score < best.score) best = { score, target, pocket, ghost, pdist, cdist, cut };
          }
        }
      }
      let angle;
      let power;
      if (best) {
        const cue2 = this.cueBall();
        const base = Math.atan2(best.ghost.y - cue2.y, best.ghost.x - cue2.x);
        const difficulty = this.prefs.difficulty || 'standard';
        const jitter = { easy: 0.045, standard: 0.014, hard: 0.004 }[difficulty];
        let error = deterministic ? 0 : (Math.random() - 0.5) * jitter;
        if (!deterministic && Math.random() < (difficulty === 'easy' ? 0.3 : difficulty === 'hard' ? 0.04 : 0.16)) error += (Math.random() < 0.5 ? -1 : 1) * rand(0.012, 0.032);
        angle = base + error;
        // Invert the actual rolling resistance model, including loss at the
        // cut. Pixel-based constants overhit short pots on smaller tables.
        const contactSpeed = this.speedForDistance(best.pdist + g.r * 4) / (best.cut * 0.9775);
        const speed = this.speedForDistance(best.cdist + this.stoppingDistance(contactSpeed));
        power = clamp(Math.pow(Math.max(0, (speed / g.maxSpeed - 0.055) / 0.945), 1 / 1.14), 0.12, 0.94);
      } else {
        // Prefer a visible legal ball to an arbitrary ball behind the pack.
        const visible = targets.filter((b) => !this.segmentBlocked(cue, b, [b]));
        if (!visible.length) {
          const kick = this.planKick(targets);
          if (kick) return { ...kick, spin: { x: 0, y: 0 }, pocket: null, score: 9000, strategy: 'kick' };
        }
        const target = (visible.length ? visible : targets).slice().sort((a, b) => dist(cue, a) - dist(cue, b))[0];
        const cue2 = this.cueBall();
        if (target && cue2) {
          const base = Math.atan2(target.y - cue2.y, target.x - cue2.x);
          // A fallback is intended to make legal contact, not deliberately
          // miss it. Save random error for pot attempts.
          angle = base;
          const distance = dist(cue2, target) + Math.max(g.w, g.h) * 0.55;
          const speed = this.speedForDistance(distance);
          power = clamp(Math.pow(Math.max(0, (speed / g.maxSpeed - 0.055) / 0.945), 1 / 1.14), 0.25, 0.8);
        } else {
          angle = rand(-0.3, 0.3);
          power = 0.5;
        }
      }
      return { angle, power, spin: { x: 0, y: 0 }, target: best?.target || null, pocket: best?.pocket || null, score: best?.score ?? 9999 };
    },

    planKick(targets) {
      const cue = this.cueBall(), { play, r } = this.geo;
      const walls = [
        { axis: 'x', value: play.x0 + r }, { axis: 'x', value: play.x1 - r },
        { axis: 'y', value: play.y0 + r }, { axis: 'y', value: play.y1 - r },
      ];
      let best = null;
      for (const target of targets) for (const wall of walls) {
        const axis = wall.axis, other = axis === 'x' ? 'y' : 'x';
        const before = Math.abs(wall.value - cue[axis]);
        const after = Math.abs(wall.value - target[axis]);
        // Normal and tangent speeds lose different amounts at a cushion.
        const t = before / (before + after * 0.985 / this.geo.cushion);
        if (!(t > 0 && t < 1)) continue;
        const bounce = { [axis]: wall.value, [other]: cue[other] + t * (target[other] - cue[other]) };
        if (bounce.x < play.x0 + r || bounce.x > play.x1 - r || bounce.y < play.y0 + r || bounce.y > play.y1 - r) continue;
        if (this.geo.pockets.some((p) => dist(p, bounce) < p.r + r)) continue;
        if (this.segmentBlocked(cue, bounce) || this.segmentBlocked(bounce, target, [target])) continue;
        const length = dist(cue, bounce) + dist(bounce, target);
        if (!best || length < best.length) best = { angle: Math.atan2(bounce.y-cue.y, bounce.x-cue.x), power: 0.65, target, length };
      }
      return best;
    },

    stoppingDistance(speed) {
      const { rollFriction: a, drag: k } = this.geo;
      return speed / k - (a / (k * k)) * Math.log1p(k * speed / a);
    },

    speedForDistance(distance) {
      let lo = 0;
      let hi = this.geo.maxSpeed * 4;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (this.stoppingDistance(mid) < distance) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    },

    aiTargets() {
      const group = this.players[1].group;
      if (group === null) return this.balls.filter((b) => b.active && b.number !== 8 && b.number !== 0);
      if (this.remainingOf(group) === 0) return this.balls.filter((b) => b.active && b.number === 8);
      return this.balls.filter((b) => b.active && b.kind === group);
    },

    aiPlaceCue() {
      const cue = this.cueBall();
      const g = this.geo;
      const candidates = [];
      const add = (x, y) => {
        const nx = clamp(x, g.play.x0 + g.r + 2, g.play.x1 - g.r - 2);
        const ny = clamp(y, g.play.y0 + g.r + 2, g.play.y1 - g.r - 2);
        if (this.validCuePosition(nx, ny)) candidates.push({ x: nx, y: ny });
      };
      const w = g.play.x1 - g.play.x0;
      const h = g.play.y1 - g.play.y0;
      add(g.play.x0 + w * 0.25, g.play.y0 + h * 0.5);
      add(g.play.x0 + w * 0.5, g.play.y0 + h * 0.5);
      add(g.play.x0 + w * 0.7, g.play.y0 + h * 0.5);
      for (let ix = 1; ix <= 6; ix++) {
        for (let iy = 1; iy <= 4; iy++) add(g.play.x0 + w * (ix / 7), g.play.y0 + h * (iy / 5));
      }
      let best = null;
      cue.active = true;
      for (const pos of candidates) {
        cue.x = pos.x;
        cue.y = pos.y;
        const plan = this.planAIShot({ deterministic: true });
        if (!best || plan.score < best.plan.score) best = { pos, plan };
      }
      const spot = best?.pos || candidates[0] || this.findAnyCueSpot();
      if (!spot) { cue.active = false; return; }
      cue.x = spot.x;
      cue.y = spot.y;
      cue.vx = 0;
      cue.vy = 0;
      cue.active = true;
      cue.pocketed = false;
      cue.spinX = 0;
      cue.spinY = 0;
      this.ballInHand = false;
      this.stage.dataset.placing = 'false';
      this.toast('DeepSeek 拿到自由球，重新摆白球。', 'ai', 1900);
    },

    segmentBlocked(from, to, ignore = []) {
      const g = this.geo;
      for (const ball of this.balls) {
        if (!ball.active) continue;
        if (ball.kind === 'cue') continue;
        if (ignore.includes(ball)) continue;
        if (dotDistToSegment(ball.x, ball.y, from.x, from.y, to.x, to.y) < g.r * 2 - 0.8) return true;
      }
      return false;
    },


  };
