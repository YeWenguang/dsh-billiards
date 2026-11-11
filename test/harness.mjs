import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

// Evaluate the entire production bundle through an explicit test entry. No copied physics
// or rules, DOM library, browser, model, or network is needed for these tests.
export function loadGame(source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), seed = 1) {
  let state = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const frames = new Map();
  let nextFrame = 0;
  const storage = new Map();
  const context = {
    Math: math, performance, console, setTimeout, clearTimeout, atob,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    window: { __DSH_BILLIARDS_TEST__: true }, document: { hidden: false, activeElement: null },
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  vm.createContext(context);
  // Historical bundles used by benchmark --baseline predate the explicit entry.
  if (source.includes('__DSH_BILLIARDS_TEST_API__')) {
    vm.runInContext(source, context);
    context.api = context.window.__DSH_BILLIARDS_TEST_API__;
  } else {
    const end = source.indexOf('  function injectStyles() {');
    if (end < 0) throw new Error('Missing historical bundle mount boundary');
    vm.runInContext(source.slice(0, end) + '\n globalThis.api = { BilliardsGame, SoundKit, loadPrefs };\n})();', context);
  }
  const { BilliardsGame } = context.api;
  function createGame(width = 1440, height = 900) {
    const g = Object.create(BilliardsGame.prototype);
    Object.assign(g, {
      w: width, h: height, prefs: context.api.loadPrefs(), players: [{ group: null }, { group: null }],
      balls: [], phase: 'aiming', current: 0, isOpen: false, destroyed: false, passive: false,
      charging: false, power: 0, spinX: 0, spinY: 0, raf: null, accum: 0, lastTs: 0,
      reduceMotion: true, lastCollisionSound: 0, particles: [], animations: [],
      stage: { dataset: {}, style: { setProperty() {} }, contains: (target) => target === g.stage,
        setAttribute() {}, focus() {}, hasPointerCapture: () => false },
      refs: { result: { hidden: true }, resultTitle: {}, resultCopy: {}, resultWins: {}, resultLosses: {}, resultStreak: {} },
      audio: Object.fromEntries(['unlock', 'cue', 'click', 'rail', 'pocket', 'win', 'lose', 'ui'].map((key) => [key, () => {}])),
      toast(message) { this.message = message; }, updateHud() {}, render() {}, savePrefs() {},
    });
    g.loop = g.loop.bind(g);
    g.newRack({ silent: true });
    return g;
  }
  return { ...context.api, createGame, context, frames, storage };
}

export function setShot(g, overrides = {}) {
  g.isBreak = false;
  g.shot = { by: 0, firstHit: 1, firstHitKind: 'solid', railAfterContact: true,
    pocketOrder: [], cuePocketed: false, break: false, startGroup: null, startOnEight: false, ...overrides };
}

export function key(g, name, overrides = {}) {
  return { key: name, code: name === ' ' ? 'Space' : '', target: g.stage,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...overrides };
}
