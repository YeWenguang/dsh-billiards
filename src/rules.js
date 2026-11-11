  const rulesMethods = {
    requestNewGame() {
      if (this.shots > 0 && !this.gameOver) this.showPanel('confirm');
      else this.newGame();
    },

    newGame() {
      if (this.destroyed) return;
      this.newRack({ silent: false });
      this.hidePanel?.();
      this.discardSession();
      this.persistSession();
      this.refs.result.hidden = true;
      this.toast('新局已就绪，轮到你开球。', 'good', 1800);
      this.updateHud();
      if (this.isOpen) {
        if (!this.passive) this.stage.focus({ preventScroll: true });
        this.aiActionAt = 0;
        this.lastTs = 0;
        this.accum = 0;
      }
    },

    newRack({ silent = false } = {}) {
      this.cancelCharge();
      this.balls = [];
      this.players = [{ group: null }, { group: null }];
      this.current = 0;
      this.phase = 'aiming';
      this.gameOver = false;
      this.result = null;
      this.ballInHand = false;
      this.isBreak = true;
      this.shots = 0;
      this.lastShot = '';
      this.shot = null;
      this.aiPlan = null;
      this.aiActionAt = 0;
      this.resolveAt = 0;
      this.ghostCue = null;
      this.charging = false;
      this.power = 0;
      this.spinX = 0;
      this.spinY = 0;
      if (this.spinBall) this.applySpinUI();
      this.stage.style.setProperty('--bil-power', '0');
      this.stage.dataset.placing = 'false';
      this.stage.dataset.charging = 'false';
      this.stage.dataset.shooting = 'false';
      this.particles = [];
      this.animations = [];
      this.refs.result.hidden = true;
      if (this.viewW && this.viewH) {
        this.w = Math.max(320, this.viewW, this.viewH);
        this.h = Math.max(320, Math.min(this.viewW, this.viewH));
      }
      this.geo = this.computeGeometry(this.w, this.h);
      this.buildRack();
      this.resize();
      this.aimAngle = this.defaultAimAngle();
      this.updateHud();
      this.render();
      if (!silent) this.toast('开球吧。', 'good', 1100);
    },

    buildRack() {
      const g = this.geo;
      const r = g.r;
      const cueX = g.play.x0 + (g.play.x1 - g.play.x0) * 0.25;
      const centerY = (g.play.y0 + g.play.y1) / 2;
      this.balls.push({ kind: 'cue', number: 0, color: '#f2ead8', x: cueX, y: centerY, vx: 0, vy: 0, active: true, pocketed: false });
      const apexX = g.play.x0 + (g.play.x1 - g.play.x0) * 0.7;
      // A real rack is tight: the balls touch. The old 2.03r spacing left a
      // visible-looking gap of half a pixel that let every contact resolve
      // one at a time, so the impulse ran down the rows instead of through
      // the pack. 2.004r is tight but still collision-safe.
      const space = r * 2.004;
      const rowDx = space * 0.866;
      const slots = [];
      for (let row = 0; row < 5; row++) {
        for (let j = 0; j <= row; j++) {
          slots.push({ x: apexX + row * rowDx, y: centerY + (j - row / 2) * space, row, j });
        }
      }
      const back = slots.filter((s) => s.row === 4);
      const eightSlot = slots.find((s) => s.row === 2 && s.j === 1);
      const solids = shuffle([1, 2, 3, 4, 5, 6, 7]);
      const stripes = shuffle([9, 10, 11, 12, 13, 14, 15]);
      const backLeft = back[0];
      const backRight = back[4];
      const backLeftNumber = solids.pop();
      const backRightNumber = stripes.pop();
      const restNumbers = shuffle([...solids, ...stripes]);
      for (const slot of slots) {
        let number;
        if (slot === eightSlot) number = 8;
        else if (slot === backLeft) number = backLeftNumber;
        else if (slot === backRight) number = backRightNumber;
        else number = restNumbers.pop();
        // Nobody racks the balls to a tenth of a millimetre. A little
        // scatter (well under a pixel) keeps the pack from acting like a
        // perfect crystal, where the break is a mirror-symmetric chain.
        const jx = rand(-r * 0.04, r * 0.04);
        const jy = rand(-r * 0.04, r * 0.04);
        this.balls.push({
          kind: groupOf(number),
          number,
          color: number === 8 ? '#161a19' : BALL_COLORS[number],
          x: slot.x + jx,
          y: slot.y + jy,
          vx: 0,
          vy: 0,
          // Unit vector of the number spot in world space. The rack is set
          // with every number facing straight up; the pole tumbles as the
          // ball rolls and drawBall() projects it onto the table.
          pole: { x: 0, y: 0, z: 1 },
          active: true,
          pocketed: false,
        });
      }
      // The scatter can push neighbours into each other; relax the pack once
      // so the break starts from a clean, non-overlapping rack.
      const rack = this.balls.slice(1);
      const minGap = r * 2.004;
      for (let pass = 0; pass < 4; pass++) {
        let separated = false;
        for (let i = 0; i < rack.length; i++) {
          for (let j = i + 1; j < rack.length; j++) {
            const a = rack[i];
            const b = rack[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d = hypot(dx, dy);
            if (d >= minGap) continue;
            if (d < 1e-4) { dx = 1; dy = 0; d = 1; }
            const push = (minGap - d) / 2;
            const nx = dx / d;
            const ny = dy / d;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            separated = true;
          }
        }
        if (!separated) break;
      }
    },

    cueBall() {
      return this.balls.find((b) => b.kind === 'cue');
    },

    ballByNumber(number) {
      return this.balls.find((b) => b.number === number);
    },

    remainingOf(group) {
      return this.balls.filter((b) => b.active && b.kind === group).length;
    },

    defaultAimAngle() {
      const cue = this.cueBall();
      if (!cue) return 0;
      const targets = this.balls.filter((b) => b.active && b.number !== 0 && b.number !== 8);
      if (targets.length) {
        let nearest = targets[0];
        let d = Infinity;
        for (const b of targets) {
          const dd = dist(cue, b);
          if (dd < d) { d = dd; nearest = b; }
        }
        return Math.atan2(nearest.y - cue.y, nearest.x - cue.x);
      }
      return 0;
    },

    onBallsStopped() {
      if (this.phase !== 'shooting') return;
      this.phase = 'settling';
      this.stage.dataset.shooting = 'false';
      this.resolveAt = performance.now() + (this.reduceMotion ? 80 : 300);
      this.updateHud();
    },

    resolveShot() {
      if (!this.shot) {
        this.phase = this.current === 0 ? 'aiming' : 'ai';
        this.updateHud();
        return;
      }
      const shot = this.shot;
      this.shot = null;
      const shooter = shot.by;
      const player = this.players[shooter];
      const pocketed = shot.pocketOrder.slice();
      const eightPocketed = pocketed.includes(8);
      const isBreak = shot.break;
      const wasOpen = shot.startGroup === null;
      const wasOnEight = shot.startOnEight;
      const fouls = [];

      if (shot.cuePocketed) fouls.push('白球落袋');
      if (shot.firstHit === null) fouls.push('空杆');
      else if (wasOnEight) {
        if (shot.firstHit !== 8) fouls.push('必须先碰黑八');
      } else if (wasOpen) {
        if (shot.firstHitKind === 'eight') fouls.push('开放球桌不能先碰黑八');
      } else if (shot.firstHitKind !== player.group) {
        fouls.push('先碰到了对方的花色');
      }
      if (pocketed.length === 0 && !shot.railAfterContact) fouls.push('碰球后没有球碰库');

      if (isBreak && eightPocketed) {
        this.rebreak();
        return;
      }

      if (eightPocketed) {
        const legalWin = wasOnEight && fouls.length === 0;
        this.endGame(legalWin ? shooter : 1 - shooter, legalWin ? 'eight' : 'eight-foul', fouls, pocketed);
        return;
      }

      // On an open table, only a *legal* post-break pot assigns groups.
      // Balls pocketed on the break or on a foul leave the table open.
      let assignedNow = false;
      if (!isBreak && fouls.length === 0 && wasOpen) {
        const first = pocketed.find((n) => n !== 8);
        if (first !== undefined) {
          const group = groupOf(first);
          this.players[shooter].group = group;
          this.players[1 - shooter].group = otherGroup(group);
          assignedNow = true;
        }
      }

      const legal = fouls.length === 0;
      this.lastShot = `${shooter === 0 ? '你' : '对手'}：${fouls.length ? fouls.join('、') + '；对手自由球' : pocketed.length ? '进球 ' + pocketed.join('、') : '未进球，交换球权'}`;
      let continueTurn = false;
      if (legal) {
        const group = this.players[shooter].group;
        if (group) continueTurn = pocketed.some((n) => n !== 8 && groupOf(n) === group);
        else continueTurn = pocketed.length > 0;
      }

      if (fouls.length) {
        this.switchTurn({ foul: fouls[0], ballInHand: true });
      } else if (continueTurn) {
        this.phase = shooter === 0 ? 'aiming' : 'ai';
        this.aimAngle = this.defaultAimAngle();
        if (shooter === 1) this.scheduleAI();
        this.updateHud();
        if (shooter === 0) this.toast('进球，继续。', 'good', 1300);
        else this.toast('DeepSeek 继续。', 'ai', 1200);
      } else {
        this.switchTurn({ foul: null, ballInHand: false });
      }

      this.persistSession();
      if (assignedNow && !fouls.length) {
        this.toast(`你打${groupName(this.players[0].group)}球。`, shooter === 0 ? 'good' : 'ai', 1800);
      }
    },

    switchTurn({ foul, ballInHand }) {
      this.current = 1 - this.current;
      this.aiPlan = null;
      this.phase = this.current === 0 ? 'aiming' : 'ai';
      if (this.current === 0) this.aimAngle = this.defaultAimAngle();
      if (ballInHand) {
        this.ballInHand = true;
        const cue = this.cueBall();
        cue.active = false;
        cue.vx = 0;
        cue.vy = 0;
        if (this.current === 0) {
          this.phase = 'placing';
          this.ghostCue = this.nearestValidCuePosition(this.geo.play.x0 + (this.geo.play.x1 - this.geo.play.x0) * 0.25, (this.geo.play.y0 + this.geo.play.y1) / 2);
          if (!this.ghostCue.valid) {
            const spot = this.findAnyCueSpot();
            if (spot) this.ghostCue = { ...spot, valid: true };
          }
          this.stage.dataset.placing = 'true';
          this.toast(`${foul ? foul + '。' : ''}自由球：点击放置白球。`, 'foul', 2400);
        } else {
          this.stage.dataset.placing = 'false';
          this.aiActionAt = performance.now() + 750;
          this.toast(`${foul ? '你犯规：' + foul + '。' : ''}DeepSeek 自由球。`, 'ai', 2200);
        }
      } else {
        this.ballInHand = false;
        this.stage.dataset.placing = 'false';
        if (this.current === 1) {
          this.aiActionAt = performance.now() + 950;
          if (foul) this.toast(`你犯规：${foul}。轮到 DeepSeek。`, 'foul', 2100);
          else this.toast('轮到 DeepSeek。', 'ai', 1500);
        } else if (foul) {
          this.toast(`你犯规：${foul}。`, 'foul', 1800);
        } else {
          this.toast('轮到你了。', 'good', 1200);
        }
      }
      this.persistSession();
      this.updateHud();
    },

    findAnyCueSpot() {
      const g = this.geo;
      const w = g.play.x1 - g.play.x0;
      const h = g.play.y1 - g.play.y0;
      for (let ix = 1; ix <= 8; ix++) {
        for (let iy = 1; iy <= 5; iy++) {
          const x = g.play.x0 + w * (ix / 9);
          const y = g.play.y0 + h * (iy / 6);
          if (this.validCuePosition(x, y)) return { x, y };
        }
      }
      return null;
    },

    rebreak() {
      this.toast('开球黑八，重新摆球。', 'foul', 2000);
      const shooter = this.current;
      this.newRack({ silent: true });
      this.current = shooter;
      this.isBreak = true;
      this.phase = shooter === 0 ? 'aiming' : 'ai';
      if (shooter === 1) this.scheduleAI();
      this.aimAngle = this.defaultAimAngle();
      this.persistSession();
      this.updateHud();
    },

    endGame(winner, reason, fouls = [], pocketed = []) {
      if (this.destroyed || this.gameOver) return;
      this.discardSession();
      this.gameOver = true;
      this.phase = 'result';
      this.ballInHand = false;
      this.charging = false;
      this.power = 0;
      this.stage.dataset.shooting = 'false';
      this.stage.dataset.placing = 'false';
      this.prefs.games++;
      if (winner === 0) {
        this.prefs.wins++;
        this.prefs.streak++;
        this.prefs.best = Math.max(this.prefs.best, this.prefs.streak);
      } else {
        this.prefs.losses++;
        this.prefs.streak = 0;
      }
      this.savePrefs();
      this.result = { winner, reason, fouls, pocketed };
      const won = winner === 0;
      this.refs.result.hidden = false;
      this.refs.resultTitle.innerHTML = won ? (reason === 'eight-foul' ? '对手失误，<em>你赢了</em>' : '清台，<em>你赢了</em>') : '这局，<em>DeepSeek 收下</em>';
      this.refs.resultCopy.textContent = won
        ? (reason === 'eight-foul' ? `对手${fouls.length ? '打黑八时犯规：' + fouls.join('、') : '提前打进黑八'}，本局你获胜。` : this.prefs.streak > 1 ? `连胜 ${this.prefs.streak} 局。整张 Harness 都替你高兴。` : '黑八落袋，干干净净。Harness 还在后台等你。')
        : reason === 'eight-foul'
          ? (fouls.length ? `黑八落袋，但这杆犯规：${fouls[0]}。` : '黑八还没到时候。再来一局？')
          : 'DeepSeek 把黑八收走了。工作没停，球桌也还在。';
      this.refs.resultWins.textContent = String(this.prefs.wins);
      this.refs.resultLosses.textContent = String(this.prefs.losses);
      this.refs.resultStreak.textContent = String(this.prefs.streak);
      this.updateHud();
      if (this.isOpen && !this.passive && !document.hidden) this.refs.result.querySelector?.('[data-act="new"]')?.focus({ preventScroll: true });
      if (won) this.audio.win();
      else this.audio.lose();
    },


  };
