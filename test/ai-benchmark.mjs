import { execFileSync } from 'node:child_process';
import { loadGame } from './harness.mjs';

function benchmark(source) {
  let pots = 0;
  let fouls = 0;
  let scenarios = 0;
  let meanPower = 0;
  for (const [w, h] of [[1440, 900], [800, 600], [390, 844]]) {
    for (let seed = 1; seed <= 12; seed++) {
      const { createGame } = loadGame(source, seed);
      const g = createGame(w, h);
      const { play: p, r } = g.geo;
      const pocket = g.geo.pockets.find((p) => p.side);
      const horizontal = w >= h;
      const tx = horizontal ? pocket.x : p.x0 + r * (3.5 + seed * 0.3);
      const ty = horizontal ? p.y0 + r * (3.5 + seed * 0.3) : pocket.y;
      g.debugSetBalls({ cue: { x: tx + (horizontal ? (seed % 3 - 1) * r * 2 : r * 7),
        y: ty + (horizontal ? r * 7 : (seed % 3 - 1) * r * 2) }, balls: [{ number: 1, x: tx, y: ty }] });
      g.current = 1;
      g.phase = 'ai-aiming';
      g.isBreak = false;
      const plan = g.planAIShot();
      meanPower += plan.power;
      g.shoot(plan.angle, plan.power, { ai: true, spin: plan.spin });
      g.debugAdvance(9);
      if (!g.ballByNumber(1).active) pots++;
      if (g.ballInHand) fouls++;
      scenarios++;
    }
  }
  return { scenarios, pots, fouls, meanPower: +(meanPower / scenarios).toFixed(3) };
}

if (process.argv.includes('--baseline')) {
  const ref = process.argv[process.argv.indexOf('--baseline') + 1] || 'HEAD';
  const source = execFileSync('git', ['show', `${ref}:lib/client.js`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  console.log(`${ref} baseline`, benchmark(source));
}
console.log('working tree', benchmark());
