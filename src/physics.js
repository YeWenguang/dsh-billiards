  const physicsMethods = {
    computeGeometry(w, h) {
      const rail = Math.round(clamp(Math.min(w, h) * 0.034, 20, 40));
      const r = Math.round(clamp(Math.min(w, h) * 0.017, 9.5, 17) * 10) / 10;
      const play = { x0: rail, y0: rail, x1: w - rail, y1: h - rail };
      const pockets = [
        { id: 'tl', x: play.x0, y: play.y0, corner: true },
        { id: 'tr', x: play.x1, y: play.y0, corner: true },
        { id: 'bl', x: play.x0, y: play.y1, corner: true },
        { id: 'br', x: play.x1, y: play.y1, corner: true },
      ];
      const sideR = r * 1.7;
      const cornerR = r * 2.0;
      if (w >= h) {
        pockets.push({ id: 'tm', x: w / 2, y: play.y0, corner: false, side: true });
        pockets.push({ id: 'bm', x: w / 2, y: play.y1, corner: false, side: true });
      } else {
        pockets.push({ id: 'lm', x: play.x0, y: h / 2, corner: false, side: true });
        pockets.push({ id: 'rm', x: play.x1, y: h / 2, corner: false, side: true });
      }
      for (const p of pockets) p.r = p.corner ? cornerR : sideR;
      return {
        w, h, rail, r, play, pockets,
        maxSpeed: clamp(Math.min(w, h) * 3.4, 2400, 5200),
        rollFriction: clamp(Math.min(w, h) * 0.13, 70, 280),
        drag: 0.72,
        cushion: 0.84,
      };
    },

    shoot(angle, power, opts = {}) {
      if (this.destroyed || this.gameOver || !Number.isFinite(angle) || !Number.isFinite(power)) return;
      if (this.phase !== 'aiming' && this.phase !== 'ai-aiming' && !opts.force) return;
      if (this.ballInHand) return;
      const cue = this.cueBall();
      if (!cue || !cue.active) return;
      const g = this.geo;
      const spin = opts.spin
        ? { x: clamp(opts.spin.x, -1, 1), y: clamp(opts.spin.y, -1, 1) }
        : opts.ai ? { x: 0, y: 0 } : { x: this.spinX, y: this.spinY };
      if (!Number.isFinite(spin.x) || !Number.isFinite(spin.y)) return;
      const spinAmount = Math.min(1, hypot(spin.x, spin.y));
      const speed = g.maxSpeed * (0.055 + 0.945 * Math.pow(clamp(power, 0, 1), 1.14)) * (1 - 0.04 * spinAmount);
      this.persistSession();
      this.shots = (this.shots || 0) + 1;
      this.aimAngle = angle;
      cue.vx = Math.cos(angle) * speed;
      cue.vy = Math.sin(angle) * speed;
      cue.spinX = spin.x;
      cue.spinY = spin.y;
      this.shot = {
        firstHit: null,
        firstHitKind: null,
        railAfterContact: false,
        pocketOrder: [],
        cuePocketed: false,
        spin,
        break: this.isBreak,
        startGroup: this.players[this.current].group,
        startOnEight: this.players[this.current].group ? this.remainingOf(this.players[this.current].group) === 0 : false,
        by: this.current,
      };
      this.isBreak = false;
      this.phase = 'shooting';
      this.charging = false;
      this.power = 0;
      this.stage.style.setProperty('--bil-power', '0');
      this.stage.dataset.charging = 'false';
      delete this.stage.dataset.maxPower;
      this.stage.dataset.shooting = 'true';
      this.ghostCue = null;
      this.audio.cue(power);
      this.updateHud();
      this.accum = 0;
      this.lastTs = 0;
      this.requestFrame();
      if (opts.ai) this.toast(AI_LINES[Math.floor(Math.random() * AI_LINES.length)], 'ai', 1800);
    },

    stepPhysics(dt) {
      const g = this.geo;
      const r = g.r;
      for (const ball of this.balls) {
        if (!ball.active) continue;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
      }
      for (const ball of this.balls) {
        if (!ball.active) continue;
        const pocket = this.pocketFor(ball);
        if (pocket) {
          this.sinkBall(ball, pocket);
          continue;
        }
        this.cushionCollision(ball);
      }
      const minDist = r * 2;
      const contacts = this.contacts || (this.contacts = []);
      const pool = this.contactPool || (this.contactPool = []);
      contacts.length = 0;
      for (let i = 0; i < this.balls.length; i++) {
        const a = this.balls[i];
        if (!a.active) continue;
        for (let j = i + 1; j < this.balls.length; j++) {
          const b = this.balls[j];
          if (!b.active) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          if (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minDist * minDist) continue;
          let d = Math.sqrt(d2);
          let nx;
          let ny;
          if (d < 1e-4) {
            const angle = Math.random() * TAU;
            nx = Math.cos(angle);
            ny = Math.sin(angle);
            d = 1e-4;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const cueBall = a.kind === 'cue' ? a : b.kind === 'cue' ? b : null;
          const index = contacts.length;
          const c = pool[index] || (pool[index] = {});
          c.a = a;
          c.b = b;
          c.nx = nx;
          c.ny = ny;
          c.overlap = minDist - d;
          c.approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          c.impulse = 0;
          c.cuePreX = cueBall ? cueBall.vx : 0;
          c.cuePreY = cueBall ? cueBall.vy : 0;
          contacts.push(c);
        }
      }
      // A rack is one dense contact cluster. Resolving the pairs strictly in
      // list order turns a break into a Newton's cradle: the impulse runs
      // down a row, two balls fly out, and the middle of the rack never
      // moves. Iterating the whole contact set (accumulated impulses, with
      // restitution expressed as a target closing speed) shares the hit out.
      // A lone pair still converges in one pass, so ordinary shots keep the
      // exact same feel.
      const passes = contacts.length > 1 ? 4 : 1;
      for (let pass = 0; pass < passes; pass++) {
        for (const c of contacts) {
          if (!c.a.active || !c.b.active) continue;
          const vn = (c.b.vx - c.a.vx) * c.nx + (c.b.vy - c.a.vy) * c.ny;
          const target = c.approach < 0 ? -0.955 * c.approach : 0;
          let dj = (target - vn) / 2;
          if (c.impulse + dj < 0) dj = -c.impulse;
          if (dj === 0) continue;
          c.impulse += dj;
          c.a.vx -= dj * c.nx;
          c.a.vy -= dj * c.ny;
          c.b.vx += dj * c.nx;
          c.b.vy += dj * c.ny;
        }
      }
      for (const c of contacts) {
        const a = c.a;
        const b = c.b;
        const nx = c.nx;
        const ny = c.ny;
        const push = c.overlap / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        if (c.approach >= 0) continue;
        const cueBall = a.kind === 'cue' ? a : b.kind === 'cue' ? b : null;
        const objectBall = cueBall === a ? b : cueBall === b ? a : null;
        const impact = -c.approach;
        if (impact > 30) {
          const now = performance.now();
          if (now - this.lastCollisionSound > 18) {
            this.audio.click(impact);
            this.lastCollisionSound = now;
          }
          this.spawnImpact((a.x + b.x) / 2, (a.y + b.y) / 2, impact);
        }
        if (this.shot) {
          if (a.kind === 'cue' && this.shot.firstHit === null) {
            this.shot.firstHit = b.number;
            this.shot.firstHitKind = b.kind;
          } else if (b.kind === 'cue' && this.shot.firstHit === null) {
            this.shot.firstHit = a.number;
            this.shot.firstHitKind = a.kind;
          }
        }
        if (cueBall && objectBall) {
          const vertical = cueBall.spinY || 0;
          const side = cueBall.spinX || 0;
          if (Math.abs(vertical) > 0.01 || Math.abs(side) > 0.01) {
            const cnx = cueBall === a ? nx : -nx;
            const cny = cueBall === a ? ny : -ny;
            const tx = -cny;
            const ty = cnx;
            const cuePreVx = c.cuePreX;
            const cuePreVy = c.cuePreY;
            const preSpeed = hypot(cuePreVx, cuePreVy) || 1;
            // Follow/draw: impulse along the cue ball's pre-impact line.
            const follow = vertical * impact * 0.42;
            cueBall.vx += (cuePreVx / preSpeed) * follow;
            cueBall.vy += (cuePreVy / preSpeed) * follow;
            // Side spin throws the object ball off the line of centres
            // and kicks the cue ball the other way.
            const sideImpulse = side * impact * 0.105;
            objectBall.vx += tx * sideImpulse;
            objectBall.vy += ty * sideImpulse;
            cueBall.vx -= tx * sideImpulse * 0.62;
            cueBall.vy -= ty * sideImpulse * 0.62;
            cueBall.spinX = side * 0.72;
            cueBall.spinY = vertical * 0.7;
            const cap = g.maxSpeed * 1.35;
            for (const ball of [cueBall, objectBall]) {
              const speed = hypot(ball.vx, ball.vy);
              if (speed > cap) {
                ball.vx = (ball.vx / speed) * cap;
                ball.vy = (ball.vy / speed) * cap;
              }
            }
          }
        }
      }
      for (const ball of this.balls) {
        if (!ball.active) continue;
        const pocket = this.pocketFor(ball);
        if (pocket) {
          this.sinkBall(ball, pocket);
          continue;
        }
        const speed = hypot(ball.vx, ball.vy);
        if (speed < 3.2) {
          ball.vx = 0;
          ball.vy = 0;
        } else {
          // A real rolling ball loses energy to both a roughly constant
          // rolling resistance and speed-dependent cloth drag. At break
          // speed the drag dominates; in the tail only the constant term
          // remains, which is what makes a soft roll settle naturally.
          const next = Math.max(0, speed - (g.rollFriction + g.drag * speed) * dt);
          const scale = next / speed;
          ball.vx *= scale;
          ball.vy *= scale;
        }
        if (ball.kind === 'cue' && (ball.spinX || ball.spinY)) {
          const spinDecay = Math.exp(-0.85 * dt);
          ball.spinX *= spinDecay;
          ball.spinY *= spinDecay;
          if (Math.abs(ball.spinX) < 0.002) ball.spinX = 0;
          if (Math.abs(ball.spinY) < 0.002) ball.spinY = 0;
        }
        this.rollPole(ball, speed * dt);
      }
    },

    // Tumbe the number spot while the ball rolls: a rolling sphere turns by
    // distance / radius around the horizontal axis perpendicular to travel.
    // The pole is a unit vector in world space; drawBall() projects it.
    rollPole(ball, distance) {
      if (!ball.pole) ball.pole = { x: 0, y: 0, z: 1 };
      if (distance < 1e-4) return;
      const speed = hypot(ball.vx, ball.vy);
      if (speed < 1e-6) return;
      const angle = distance / this.geo.r;
      if (angle < 1e-5) return;
      // Axis = table normal x travel direction = (-sin, cos, 0).
      const ux = -ball.vy / speed;
      const uy = ball.vx / speed;
      const px = ball.pole.x;
      const py = ball.pole.y;
      const pz = ball.pole.z;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dot = ux * px + uy * py;
      // u x p (uz = 0)
      const cx = uy * pz;
      const cy = -ux * pz;
      const cz = ux * py - uy * px;
      const nx = px * cos + cx * sin + ux * dot * (1 - cos);
      const ny = py * cos + cy * sin + uy * dot * (1 - cos);
      const nz = pz * cos + cz * sin;
      const len = hypot(nx, hypot(ny, nz)) || 1;
      ball.pole.x = nx / len;
      ball.pole.y = ny / len;
      ball.pole.z = nz / len;
    },

    pocketFor(ball) {
      const g = this.geo;
      for (const pocket of g.pockets) {
        const capture = pocket.r * (pocket.corner ? 1.08 : 0.92);
        const dx = ball.x - pocket.x;
        const dy = ball.y - pocket.y;
        if (dx * dx + dy * dy < capture * capture) return pocket;
      }
      return null;
    },

    sinkBall(ball, pocket) {
      ball.active = false;
      ball.pocketed = true;
      ball.vx = 0;
      ball.vy = 0;
      this.animations.push({
        type: 'drop',
        x: pocket.x,
        y: pocket.y,
        color: ball.color,
        number: ball.number,
        born: performance.now(),
        life: 380,
        fromX: ball.x,
        fromY: ball.y,
      });
      this.audio.pocket();
      this.spawnBurst(pocket.x, pocket.y);
      if (this.shot) {
        this.shot.pocketOrder.push(ball.number);
        if (ball.kind === 'cue') this.shot.cuePocketed = true;
      }
      if (ball.kind === 'cue') this.stage.dataset.placing = 'true';
      this.updateHud();
    },

    allStopped() {
      return this.balls.every((b) => !b.active || (b.vx === 0 && b.vy === 0));
    },


  };
