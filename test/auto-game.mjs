import assert from 'node:assert/strict';
import { loadGame } from './harness.mjs';

const games = [];
for (const seed of [1, 7, 42, 101, 2026, 3, 9, 17, 29, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765]) {
  const sizes = [[1440,900],[800,600],[390,844]];
  const size = sizes[games.length % sizes.length];
  const g = loadGame(undefined, seed).createGame(...size);
  g.prefs.difficulty = ['standard','easy','hard'][games.length % 3];
  g.shoot(g.aimAngle, 1);
  g.debugAdvance(9);
  let shots = 1;
  let fouls = Number(g.ballInHand);
  while (!g.gameOver && shots < 160) {
    const original = g.players;
    if (g.current === 0) g.players = [original[1], original[0]];
    if (g.ballInHand) g.aiPlaceCue();
    const plan = g.planAIShot();
    g.players = original;
    assert.ok(!g.ballInHand, 'AI must find a legal cue placement');
    g.phase = 'ai-aiming';
    g.shoot(plan.angle, plan.power, { ai: true, spin: plan.spin });
    g.debugAdvance(9);
    assert.notEqual(g.phase, 'shooting', 'shot must settle');
    for (const ball of g.balls) assert.ok([ball.x, ball.y, ball.vx, ball.vy].every(Number.isFinite));
    fouls += Number(g.ballInHand);
    shots++;
  }
  assert.ok(g.gameOver, `seed ${seed}: game must finish within 160 shots`);
  assert.equal(g.prefs.games, 1);
  const result = { seed, size, difficulty:g.prefs.difficulty, shots, fouls, winner: g.result.winner, reason: g.result.reason };
  games.push(result);
  console.log('PASS complete game', result);
}
console.log(`${games.length} seeded games completed`);
