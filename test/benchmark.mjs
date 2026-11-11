import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { loadGame } from './harness.mjs';

function benchmark(source) {
  const { createGame } = loadGame(source, 42);
  const times = [];
  let spread;
  for (let run = 0; run < 9; run++) {
    const g = createGame();
    const start = g.balls.map((b) => ({ x: b.x, y: b.y }));
    g.shoot(g.aimAngle, 1);
    const t = performance.now();
    for (let i = 0; i < 2400 * 9 && !g.allStopped(); i++) g.stepPhysics(1 / 2400);
    const elapsed = performance.now() - t;
    if (run >= 2) times.push(elapsed);
    spread = g.balls.filter((b, i) => i && Math.hypot(b.x - start[i].x, b.y - start[i].y) > 150).length;
  }
  times.sort((a, b) => a - b);
  return { medianMs: +times[Math.floor(times.length / 2)].toFixed(2), minMs: +times[0].toFixed(2), spread };
}

if (process.argv.includes('--baseline')) {
  const ref = process.argv[process.argv.indexOf('--baseline') + 1] || 'HEAD';
  const source = execFileSync('git', ['show', `${ref}:lib/client.js`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  console.log(`${ref} baseline`, benchmark(source));
}
console.log('working tree', benchmark());
