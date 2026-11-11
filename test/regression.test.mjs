import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { loadGame, setShot, key } from './harness.mjs';

test('break pot leaves table open; legal post-break pot assigns groups', () => {
  for (const isBreak of [true, false]) {
    const g = loadGame().createGame();
    setShot(g, { break: isBreak, pocketOrder: [1] });
    g.resolveShot();
    assert.equal(g.players[0].group, isBreak ? null : 'solid');
    assert.equal(g.current, 0);
  }
});

test('fouls give ball in hand without assigning a group', () => {
  for (const overrides of [{ cuePocketed: true, pocketOrder: [1, 0] }, { firstHit: null },
    { firstHit: 8, firstHitKind: 'eight' }, { railAfterContact: false }]) {
    const g = loadGame().createGame();
    setShot(g, overrides);
    g.resolveShot();
    assert.equal(g.current, 1);
    assert.equal(g.ballInHand, true);
    assert.equal(g.players[0].group, null);
  }
});

test('eight: early loss, legal win, scratch loss, break rerack', () => {
  for (const [extra, winner] of [[{}, 1], [{ startOnEight: true, firstHit: 8 }, 0],
    [{ startOnEight: true, firstHit: 8, cuePocketed: true }, 1]]) {
    const g = loadGame().createGame();
    setShot(g, { pocketOrder: [8], ...extra });
    g.resolveShot();
    assert.equal(g.result.winner, winner);
    assert.equal(g.prefs.games, 1);
  }
  const g = loadGame().createGame();
  setShot(g, { break: true, pocketOrder: [8] });
  g.resolveShot();
  assert.equal(g.isBreak, true);
  assert.equal(g.balls.filter((b) => b.active).length, 16);
  assert.equal(g.prefs.games, 0);
});

test('soft cushion contact counts after object-ball contact', () => {
  const g = loadGame().createGame();
  const cue = g.cueBall();
  Object.assign(cue, { x: g.geo.play.x0 + g.geo.r - 0.05, vx: -2, vy: 0 });
  setShot(g, { railAfterContact: false });
  g.cushionCollision(cue);
  assert.equal(g.shot.railAfterContact, true);
});

test('real physics pots a straight ball and assigns the group', () => {
  const g = loadGame().createGame();
  g.debugSetBalls({ cue: { x: 720, y: 230 }, balls: [{ number: 1, x: 720, y: 100 }] });
  g.isBreak = false;
  g.shoot(-Math.PI / 2, 0.3);
  g.debugAdvance(8);
  assert.equal(g.ballByNumber(1).active, false);
  assert.equal(g.players[0].group, 'solid');
  assert.equal(g.phase, 'aiming');
});

test('full-power break spreads the rack, stays finite and does not create energy', () => {
  for (const seed of [1, 7, 42]) {
    const g = loadGame(undefined, seed).createGame();
    const positions = g.balls.map((b) => ({ x: b.x, y: b.y }));
    g.shoot(g.aimAngle, 1);
    const energy = () => g.balls.reduce((sum, b) => sum + (b.active ? b.vx ** 2 + b.vy ** 2 : 0), 0);
    const initial = energy();
    let max = initial;
    for (let i = 0; i < 2400 * 9 && !g.allStopped(); i++) {
      g.stepPhysics(1 / 2400);
      max = Math.max(max, energy());
    }
    assert.ok(g.allStopped());
    assert.ok(max <= initial * 1.00001, `seed ${seed}: energy gain ${max / initial}`);
    const spread = g.balls.filter((b, i) => i && Math.hypot(b.x - positions[i].x, b.y - positions[i].y) > 150).length;
    // Rack jitter is intentionally random; the baseline seed 7 spreads six.
    assert.ok(spread >= 6, `seed ${seed}: spread ${spread}`);
    for (const b of g.balls) assert.ok([b.x, b.y, b.vx, b.vy].every(Number.isFinite));
  }
});

test('Escape cancels charging before closing the table', () => {
  const g = loadGame().createGame();
  g.isOpen = true;
  let closed = false;
  g.close = () => { closed = true; };
  g.beginCharge();
  g.onGlobalKeyDown(key(g, 'Escape'));
  assert.equal(g.charging, false);
  assert.equal(closed, false);
});

test('host dialog keys, modifier shortcuts and IME do not affect the game', () => {
  for (const extra of [{ target: {} }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }]) {
    const g = loadGame().createGame();
    g.isOpen = true;
    let resets = 0;
    g.newGame = () => resets++;
    const event = key(g, 'n', extra);
    g.onGlobalKeyDown(event);
    assert.equal(resets, 0);
    assert.ok(!event.prevented);
  }
});

test('pointer charging ignores other pointers, secondary release and keyboard release', () => {
  const g = loadGame().createGame();
  g.isOpen = true;
  g.beginCharge('pointer', 4);
  g.onPointerUp(key(g, '', { pointerId: 5, button: 0 }));
  assert.equal(g.charging, true);
  g.onPointerUp(key(g, '', { pointerId: 4, button: 2 }));
  assert.equal(g.charging, true);
  g.onKeyUp(key(g, ' '));
  assert.equal(g.charging, true);
  g.onPointerUp(key(g, '', { pointerId: 4, button: 0 }));
  assert.equal(g.phase, 'shooting');
});

test('passive and hidden games cannot shoot or advance scheduled frames', () => {
  for (const hidden of [false, true]) {
    const { createGame, context, frames } = loadGame();
    const g = createGame();
    g.isOpen = true;
    g.passive = !hidden;
    context.document.hidden = hidden;
    assert.equal(g.canHumanShoot(), false);
    g.loop(1000);
    assert.equal(frames.size, 0);
  }
});

test('idle table stops requesting frames; charging resumes them', () => {
  const { createGame, frames } = loadGame();
  const g = createGame();
  g.isOpen = true;
  g.loop(1000);
  assert.equal(frames.size, 0);
  g.beginCharge();
  g.loop(1017);
  assert.ok(frames.size > 0);
});

test('restarting a scheduled loop replaces its cancelled frame', () => {
  const { createGame, frames } = loadGame();
  const g = createGame();
  g.isOpen = true;
  g.startLoop();
  g.startLoop();
  assert.equal(frames.size, 1);
  assert.ok(frames.has(g.raf));
});

test('invalid numeric input cannot poison game physics', () => {
  for (const [angle, power] of [[NaN, 0.5], [0, NaN], [Infinity, 1]]) {
    const g = loadGame().createGame();
    g.shoot(angle, power);
    assert.equal(g.phase, 'aiming');
    assert.ok(Number.isFinite(g.cueBall().vx));
  }
});

test('game result is recorded once', () => {
  const g = loadGame().createGame();
  g.endGame(0, 'eight');
  g.endGame(0, 'eight');
  assert.equal(g.prefs.games, 1);
  assert.equal(g.prefs.wins, 1);
});

test('aim ray does not select an object beyond the first cushion', () => {
  const g = loadGame().createGame();
  g.debugSetBalls({ cue: { x: 100, y: 300 }, balls: [{ number: 1, x: 1500, y: 300 }] });
  g.isOpen = true;
  g.aimAngle = 0;
  assert.equal(g.aimPlan().hit, null);
});

test('AI pots a short straight ball at landscape and portrait sizes', () => {
  for (const [w, h] of [[1440, 900], [800, 600], [390, 844]]) {
    const g = loadGame().createGame(w, h);
    const p = g.geo.pockets.find((p) => p.side);
    const r = g.geo.r;
    const target = w >= h ? { x: p.x, y: p.y + r * 5 } : { x: p.x + r * 5, y: p.y };
    const cue = w >= h ? { x: target.x, y: target.y + r * 7 } : { x: target.x + r * 7, y: target.y };
    g.debugSetBalls({ cue, balls: [{ number: 1, ...target }] });
    g.isBreak = false;
    g.current = 1;
    g.phase = 'ai-aiming';
    const plan = g.planAIShot({ deterministic: true });
    assert.equal(plan.target.number, 1);
    g.shoot(plan.angle, plan.power, { ai: true, spin: plan.spin });
    g.debugAdvance(9);
    assert.equal(g.ballByNumber(1).active, false);
    assert.equal(g.ballInHand, false);
  }
});

test('AI fallback chooses a reachable legal target before a blocked target', () => {
  const g = loadGame().createGame();
  g.debugSetBalls({ cue: { x: 300, y: 450 }, balls: [
    { number: 1, x: 700, y: 450 }, { number: 9, x: 500, y: 450 }, { number: 2, x: 300, y: 650 },
  ] });
  g.players[1].group = 'solid';
  const blocked = g.segmentBlocked.bind(g);
  // Reject all pocket plans; keep real geometry for direct safety shots.
  g.segmentBlocked = (from, to, ignore) => g.geo.pockets.includes(to) || blocked(from, to, ignore);
  const plan = g.planAIShot({ deterministic: true });
  assert.ok(Math.abs(plan.angle - Math.PI / 2) < 1e-10);
});

test('follow, draw and side spin affect actual ball trajectories', () => {
  const run = (x, y) => {
    const g = loadGame().createGame();
    g.debugSetBalls({ cue: { x: 300, y: 450 }, balls: [{ number: 1, x: 500, y: 450 }] });
    g.setSpin(x, y);
    g.shoot(0, 0.6);
    g.debugAdvance(8);
    return { cue: g.cueBall(), object: g.ballByNumber(1), r: g.geo.r };
  };
  const follow = run(0, 1);
  const draw = run(0, -1);
  assert.ok(follow.cue.x - draw.cue.x > follow.r * 4);
  const right = run(1, 0);
  const left = run(-1, 0);
  assert.ok(right.object.y > left.object.y);
  assert.ok(right.cue.y < left.cue.y);
});

test('resize repairs squeezed positions without recording collisions or fouls', () => {
  const g = loadGame().createGame();
  const first = g.ballByNumber(1);
  Object.assign(first, { x: 319, y: 300 });
  Object.assign(g.ballByNumber(2), { x: 318, y: 300 });
  g.geo = g.computeGeometry(320, 640);
  setShot(g, { railAfterContact: false });
  g.relaxLayout();
  const { r, play } = g.geo;
  const active = g.balls.filter((b) => b.active);
  for (const b of active) {
    assert.ok(b.x >= play.x0 + r && b.x <= play.x1 - r);
    assert.ok(b.y >= play.y0 + r && b.y <= play.y1 - r);
  }
  // Inspect the explicit pair, rather than assuming an arbitrarily compressed
  // entire rack always converges within the bounded relaxation budget.
  assert.ok(Math.hypot(first.x - g.ballByNumber(2).x, first.y - g.ballByNumber(2).y) >= 2 * r - 0.02);
  assert.equal(g.shot.railAfterContact, false);
  assert.equal(g.shot.firstHit, 1);
});

test('audio destroy cancels delayed notes and cannot recreate the context', async () => {
  const { SoundKit, context } = loadGame();
  let created = 0;
  context.window.AudioContext = class { constructor() { created++; } };
  const audio = new SoundKit(false);
  audio.win();
  assert.equal(audio.timers.size, 4);
  audio.destroy();
  audio.unlock();
  audio.win();
  assert.equal(audio.timers.size, 0);
  assert.equal(created, 0);
  assert.equal(audio.destroyed, true);
});

test('audio decode completing after unmount does not repopulate samples', async () => {
  const { SoundKit } = loadGame();
  const audio = new SoundKit(false);
  let complete;
  audio.ctx = { state: 'running', close: () => Promise.resolve(),
    decodeAudioData: () => new Promise((resolve) => { complete = resolve; }) };
  const loading = audio.loadSamples();
  audio.destroy();
  complete({});
  await loading;
  assert.equal(audio.samples.size, 0);
});

test('Cordis entry registers the overlay and shares styles across consumers', () => {
  let bundle;
  let style = null;
  const sandbox = {
    window: { __ModuleLoader__: { load(value) { bundle = value; } } },
    document: {
      querySelector: () => style,
      createElement: () => ({ dataset: {}, remove() { style = null; } }),
      head: { appendChild(el) { style = el; } },
    },
  };
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox);
  assert.equal(bundle.id, 'dsh-billiards');
  const plugin = bundle.factory((name) => { assert.equal(name, 'react'); return {}; });
  const cleanup = [];
  const registrations = [];
  const ctx = {
    effect(fn) { cleanup.push(fn()); },
    slots: {
      inject(slot, generator) { assert.equal(slot, 'shell.overlay'); [...generator()]; },
      register(spec, component) { registrations.push(spec); assert.equal(typeof component, 'function'); },
    },
  };
  plugin.apply(ctx);
  plugin.apply(ctx);
  assert.equal(registrations.length, 2);
  assert.equal(registrations[0].id, 'billiards');
  assert.equal(style.dataset.users, '2');
  cleanup[0]();
  cleanup[0]();
  assert.equal(style.dataset.users, '1');
  cleanup[1]();
  assert.equal(style, null);
});
