/* dsh-billiards client half — the whole Harness becomes the table.
 *
 * This file is a classic-script bundle for the DSH client module loader:
 *   window.__ModuleLoader__.load({ id, factory })
 * The factory may only require modules the shell seeds (react, ...).
 * Everything below is plain ES2020 and has no build step.
 */
(() => {
  'use strict';

  const PLUGIN_ID = 'dsh-billiards';
  const STORAGE_KEY = 'dsh-billiards.v1';
  const TAU = Math.PI * 2;
  const FIXED_STEP = 1 / 2400;
  const MAX_STEPS_PER_FRAME = 120;

  const BALL_COLORS = {
    1: '#f4c542',
    2: '#2f6ed8',
    3: '#e2453f',
    4: '#7a4ab2',
    5: '#e78931',
    6: '#2f9d61',
    7: '#8f2b2f',
    8: '#161a19',
    9: '#f4c542',
    10: '#2f6ed8',
    11: '#e2453f',
    12: '#7a4ab2',
    13: '#e78931',
    14: '#2f9d61',
    15: '#8f2b2f',
  };

  const AI_LINES = [
    '这桌界面，比球桌还花。',
    '你忙你的，我来清台。',
    '别盯着我看，看球。',
    '这张桌子，是整页 Harness。',
    '我算过了，角度没问题。',
    '你敲键盘的声音，影响我瞄准。',
    '工作照跑，球也照打。',
    '这杆不进，算你的。',
  ];

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hypot = (x, y) => Math.sqrt(x * x + y * y);
  const dist = (a, b) => hypot(a.x - b.x, a.y - b.y);
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const shuffle = (items) => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const groupOf = (number) => (number === 8 ? 'eight' : number < 8 ? 'solid' : 'stripe');
  const otherGroup = (group) => (group === 'solid' ? 'stripe' : 'solid');
  const groupName = (group) => (group === 'solid' ? '全色' : group === 'stripe' ? '花色' : group === 'eight' ? '黑八' : '待定');

  function dotDistToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSq = abx * abx + aby * aby;
    const t = lengthSq === 0 ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / lengthSq, 0, 1);
    const dx = px - (ax + abx * t);
    const dy = py - (ay + aby * t);
    return hypot(dx, dy);
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, radius) {
    const fx = ox - cx;
    const fy = oy - cy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-b - root) / 2;
    const t2 = (-b + root) / 2;
    const t = t1 > 1e-6 ? t1 : t2 > 1e-6 ? t2 : null;
    return t === null ? null : t;
  }

  function loadPrefs() {
    const fallback = { muted: false, guide: true, clarity: 0, wins: 0, losses: 0, streak: 0, best: 0, games: 0 };
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        muted: Boolean(raw.muted),
        guide: raw.guide !== false,
        clarity: raw.clarity === 0 || raw.clarity === 1 || raw.clarity === 2 ? raw.clarity : raw.focus ? 2 : 0,
        wins: Number.isFinite(raw.wins) ? Math.max(0, raw.wins) : 0,
        losses: Number.isFinite(raw.losses) ? Math.max(0, raw.losses) : 0,
        streak: Number.isFinite(raw.streak) ? Math.max(0, raw.streak) : 0,
        best: Number.isFinite(raw.best) ? Math.max(0, raw.best) : 0,
        games: Number.isFinite(raw.games) ? Math.max(0, raw.games) : 0,
      };
    } catch {
      return fallback;
    }
  }

  const CSS = `
  .dsh-bil-host {
    position: fixed; inset: 0; z-index: 40; pointer-events: none;
    color: #eafff8; font-family: "Inter", "Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;
    --bil-glass-sheen: linear-gradient(132deg, rgba(255, 255, 255, .07), rgba(255, 255, 255, .018) 34%, rgba(255, 255, 255, 0) 64%);
    --bil-glass-dark: linear-gradient(152deg, rgba(7, 29, 24, .28), rgba(3, 15, 12, .12));
    --bil-glass-strong: linear-gradient(152deg, rgba(8, 35, 29, .4), rgba(3, 17, 13, .22));
    --bil-glass-border: rgba(212, 255, 244, .12);
    --bil-glass-shadow: 0 10px 26px rgba(0, 0, 0, .1), inset 0 1px 0 rgba(255, 255, 255, .1), inset 0 0 0 1px rgba(255, 255, 255, .015);
    --bil-glass-blur: blur(22px) saturate(1.12);
  }
  .dsh-bil-host *, .dsh-bil-host *::before, .dsh-bil-host *::after { box-sizing: border-box; }

  .dsh-bil-launcher {
    position: fixed; right: 18px; bottom: 20px;
    display: flex; align-items: center; gap: 0; height: 52px; padding: 8px 9px;
    border-radius: 999px; border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-strong);
    color: #eafff8; cursor: pointer; pointer-events: auto;
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    transition: border-color .22s ease, box-shadow .22s ease, background .22s ease, opacity .2s ease;
    z-index: 2; -webkit-app-region: no-drag;
  }
  .dsh-bil-host[data-open="true"] .dsh-bil-launcher { opacity: 0; pointer-events: none; }
  .dsh-bil-launcher:hover, .dsh-bil-launcher:focus-visible {
    border-color: rgba(116, 255, 216, .58);
    box-shadow: 0 20px 52px rgba(0, 0, 0, .42), 0 0 0 1px rgba(81, 240, 195, .15), 0 0 34px rgba(55, 232, 185, .12);
    outline: none;
  }
  .dsh-bil-launcher-ball {
    width: 34px; height: 34px; flex: 0 0 34px; border-radius: 50%;
    background: radial-gradient(circle at 32% 26%, #59625f 0 8%, #202725 33%, #070a09 74%);
    box-shadow: inset -3px -4px 8px rgba(0, 0, 0, .8), inset 2px 2px 5px rgba(255, 255, 255, .16), 0 3px 10px rgba(0, 0, 0, .5);
    display: grid; place-items: center; position: relative;
  }
  .dsh-bil-launcher-ball::after {
    content: "8"; width: 17px; height: 17px; border-radius: 50%;
    display: grid; place-items: center; background: #f4efe2; color: #17201d;
    font: 800 11px/1 "Inter", system-ui, sans-serif; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .16);
  }
  .dsh-bil-launcher-copy {
    display: flex; align-items: baseline; gap: 6px; overflow: hidden;
    max-width: 0; opacity: 0; white-space: nowrap; padding-left: 0;
    transition: max-width .3s cubic-bezier(.22, 1, .36, 1), opacity .18s ease, padding-left .3s cubic-bezier(.22, 1, .36, 1);
  }
  .dsh-bil-launcher:hover .dsh-bil-launcher-copy, .dsh-bil-launcher:focus-visible .dsh-bil-launcher-copy {
    max-width: 190px; opacity: 1; padding-left: 9px;
  }
  .dsh-bil-launcher-copy b { font-size: 12.5px; font-weight: 650; letter-spacing: .02em; }
  .dsh-bil-launcher-copy small { font-size: 9.5px; color: rgba(184, 255, 232, .55); letter-spacing: .06em; }
  .dsh-bil-launcher-live {
    position: absolute; right: 2px; top: 1px; width: 9px; height: 9px; border-radius: 50%;
    background: #5ff0c4; border: 2px solid #071310; opacity: 0; transform: scale(.5);
    transition: opacity .2s ease, transform .2s ease;
  }
  .dsh-bil-launcher[data-live="true"] .dsh-bil-launcher-live { opacity: 1; transform: scale(1); box-shadow: 0 0 10px #5ff0c4; }
  .dsh-bil-host[data-passive="true"] .dsh-bil-launcher { opacity: 1; pointer-events: auto; box-shadow: 0 0 0 2px rgba(95, 240, 196, .22), 0 18px 46px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .08); }
  .dsh-bil-host[data-passive="true"] .dsh-bil-launcher-live { opacity: 1; transform: scale(1); box-shadow: 0 0 10px #5ff0c4; }
  .dsh-bil-host[data-passive="true"] .dsh-bil-launcher-copy,
  .dsh-bil-host[data-passive="true"] .dsh-bil-launcher:hover .dsh-bil-launcher-copy,
  .dsh-bil-host[data-passive="true"] .dsh-bil-launcher:focus-visible .dsh-bil-launcher-copy { max-width: 0; opacity: 0; padding-left: 0; }

  .dsh-bil-stage[data-passive="true"] { display: none; }

  .dsh-bil-stage {
    --bil-ink: #eafff8;
    --bil-muted: rgba(207, 244, 232, .55);
    --bil-dim: rgba(207, 244, 232, .32);
    --bil-accent: #5ff0c4;
    --bil-gold: #f0ca84;
    --bil-danger: #ff8a78;
    --bil-power: 0;
    --bil-veil: radial-gradient(ellipse 76% 66% at 50% 42%, rgba(43, 158, 132, .15), rgba(3, 28, 23, .07) 58%, rgba(1, 9, 8, .48) 100%);
    --bil-wash: linear-gradient(150deg, rgba(2, 20, 16, .35), rgba(3, 38, 30, .25) 45%, rgba(1, 14, 11, .46));
    --bil-blur: .7px;
    --bil-bright: .97;
    --bil-sat: .98;
    --bil-vignette: .42;
    position: fixed; inset: 0; overflow: hidden; pointer-events: auto; isolation: isolate;
    background: transparent;
    cursor: crosshair; outline: none; -webkit-user-select: none; user-select: none;
    font-family: inherit; color: var(--bil-ink);
  }
  .dsh-bil-stage[hidden], .dsh-bil-result[hidden] { display: none !important; }
  .dsh-bil-stage[data-clarity="0"] {
    --bil-veil: radial-gradient(ellipse 80% 70% at 50% 42%, rgba(86, 218, 180, .022), rgba(3, 28, 23, .004) 62%, rgba(1, 9, 8, .075) 100%);
    --bil-wash: linear-gradient(150deg, rgba(2, 20, 16, .052), rgba(3, 38, 30, .022) 45%, rgba(1, 14, 11, .078));
    --bil-blur: .18px;
    --bil-bright: 1.025;
    --bil-sat: 1;
    --bil-vignette: .14;
  }
  .dsh-bil-stage[data-clarity="2"] {
    --bil-veil: radial-gradient(ellipse 80% 70% at 50% 44%, rgba(19, 86, 72, .28), rgba(2, 16, 13, .76) 64%, rgba(0, 7, 6, .94) 100%);
    --bil-wash: linear-gradient(150deg, rgba(1, 12, 10, .94), rgba(1, 22, 18, .88));
    --bil-blur: 12px;
    --bil-bright: .52;
    --bil-sat: .72;
    --bil-vignette: .62;
  }
  .dsh-bil-stage[data-bil-theme="light"] {
    --bil-veil: radial-gradient(ellipse 76% 66% at 50% 42%, rgba(58, 193, 158, .14), rgba(2, 28, 23, .14) 58%, rgba(0, 9, 7, .44) 100%);
    --bil-wash: linear-gradient(150deg, rgba(1, 17, 14, .46), rgba(3, 40, 32, .34) 46%, rgba(1, 12, 9, .56));
    --bil-blur: 1.2px;
    --bil-bright: .82;
    --bil-sat: .92;
    --bil-vignette: .38;
  }
  .dsh-bil-stage[data-bil-theme="light"][data-clarity="0"] {
    --bil-veil: radial-gradient(ellipse 80% 70% at 50% 42%, rgba(68, 205, 168, .035), rgba(2, 28, 23, .012) 62%, rgba(0, 9, 7, .1) 100%);
    --bil-wash: linear-gradient(150deg, rgba(1, 17, 14, .105), rgba(3, 40, 32, .06) 46%, rgba(1, 12, 9, .16));
    --bil-blur: .22px;
    --bil-bright: 1;
    --bil-sat: .99;
    --bil-vignette: .16;
  }
  .dsh-bil-stage[data-bil-theme="light"][data-clarity="2"] {
    --bil-veil: radial-gradient(ellipse 80% 70% at 50% 44%, rgba(23, 102, 85, .18), rgba(1, 15, 12, .88) 64%, rgba(0, 7, 6, .97) 100%);
    --bil-wash: linear-gradient(150deg, rgba(1, 10, 8, .94), rgba(1, 20, 16, .9));
    --bil-blur: 12px;
    --bil-bright: .5;
    --bil-sat: .7;
    --bil-vignette: .62;
  }
  /* Light Harness: white frosted glass with dark ink instead of smoked glass. */
  .dsh-bil-stage[data-bil-theme="light"] {
    --bil-ink: #14251e;
    --bil-muted: rgba(12, 38, 29, .88);
    --bil-dim: rgba(12, 38, 29, .7);
    --bil-accent: #08795d;
    --bil-gold: #96651d;
    --bil-danger: #b23d2e;
    --bil-glass-sheen: linear-gradient(132deg, rgba(255, 255, 255, .48), rgba(255, 255, 255, .12) 42%, rgba(255, 255, 255, .03));
    --bil-glass-dark: linear-gradient(152deg, rgba(255, 255, 255, .34), rgba(228, 240, 235, .14));
    --bil-glass-strong: linear-gradient(152deg, rgba(255, 255, 255, .46), rgba(226, 240, 234, .22));
    --bil-glass-border: rgba(255, 255, 255, .44);
    --bil-glass-shadow: 0 10px 26px rgba(29, 64, 53, .07), inset 0 1px 0 rgba(255, 255, 255, .7), inset 0 0 0 1px rgba(255, 255, 255, .16);
    --bil-glass-blur: blur(24px) saturate(1.03);
  }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-brand { color: rgba(17, 43, 34, .88); text-shadow: none; }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-brand em { color: rgba(17, 43, 34, .72); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-tool { background: var(--bil-glass-sheen), rgba(255, 255, 255, .28); color: rgba(17, 43, 34, .86); text-shadow: none; }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-tool:hover { background: var(--bil-glass-sheen), rgba(255, 255, 255, .52); color: #0d2f24; border-color: rgba(255, 255, 255, .92); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-tool[aria-pressed="true"] { background: var(--bil-glass-sheen), rgba(95, 240, 196, .22); color: #07634c; border-color: rgba(8, 121, 93, .42); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-hint b,
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-player-meta b { color: rgba(17, 43, 34, .8); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-corner,
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-corner kbd { color: rgba(20, 52, 41, .76); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-corner strong { color: rgba(17, 43, 34, .84); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-brand,
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-turn,
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-player,
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-bottom,
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-spin-panel,
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-toast { text-shadow: none; }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-toast[data-tone="foul"] { color: #8d3026; border-color: rgba(178, 61, 46, .36); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-player[data-side="ai"][data-active="true"] .dsh-bil-player-side { color: #8a5a12; }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-result-card {
    --bil-ink: #eafff8;
    --bil-muted: rgba(207, 244, 232, .58);
    --bil-dim: rgba(207, 244, 232, .36);
    --bil-accent: #5ff0c4;
    --bil-gold: #f0ca84;
    color: #eafff8;
    background: var(--bil-glass-sheen), linear-gradient(160deg, rgba(8, 32, 26, .9), rgba(3, 14, 11, .88));
    border-color: rgba(212, 255, 244, .3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .25);
  }
  .dsh-bil-stage::before {
    content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: var(--bil-veil), var(--bil-wash);
    backdrop-filter: blur(var(--bil-blur)) saturate(var(--bil-sat)) brightness(var(--bil-bright));
    -webkit-backdrop-filter: blur(var(--bil-blur)) saturate(var(--bil-sat)) brightness(var(--bil-bright));
    transition: background .4s ease, backdrop-filter .4s ease;
  }
  .dsh-bil-stage::after {
    content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, .009) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(90deg, rgba(0, 0, 0, .013) 0 1px, transparent 1px 5px),
      radial-gradient(ellipse 80% 76% at 50% 48%, transparent 52%, rgba(0, 8, 6, var(--bil-vignette)) 100%);
  }
  .dsh-bil-stage[data-shooting="true"] { cursor: default; }
  .dsh-bil-stage[data-placing="true"] { cursor: grab; }
  .dsh-bil-stage[data-placing="true"]:active { cursor: grabbing; }
  .dsh-bil-stage[data-charging="true"] { cursor: none; }

  .dsh-bil-canvas { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; display: block; touch-action: none; }
  .dsh-bil-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
  .dsh-bil-layer > * { pointer-events: none; }

  .dsh-bil-brand {
    position: absolute; left: 78px; top: 22px; display: flex; align-items: center; gap: 10px;
    height: 30px; padding: 0 12px 0 9px; border-radius: 999px;
    border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-dark);
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    font-size: 10.5px; letter-spacing: .18em; font-weight: 700; text-transform: uppercase; color: rgba(218, 255, 244, .88);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .28);
  }
  .dsh-bil-brand-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bil-accent); box-shadow: 0 0 12px rgba(95, 240, 196, .85); animation: dshBilPulse 2.6s ease-in-out infinite; }
  .dsh-bil-brand em { font-style: normal; color: rgba(191, 255, 235, .42); letter-spacing: .04em; text-transform: none; font-weight: 500; font-size: 11px; }
  @keyframes dshBilPulse { 0%, 100% { opacity: .55; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.1); } }

  .dsh-bil-turn {
    position: absolute; left: 50%; top: 68px; transform: translateX(-50%);
    min-width: 210px; padding: 7px 22px 8px; border-radius: 16px; text-align: center;
    border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-strong);
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .26);
    transition: border-color .25s ease, box-shadow .25s ease;
  }
  .dsh-bil-turn[data-tone="ai"] { border-color: rgba(240, 202, 132, .32); box-shadow: var(--bil-glass-shadow), 0 0 24px rgba(240, 202, 132, .06); }
  .dsh-bil-turn[data-tone="foul"] { border-color: rgba(255, 138, 120, .38); }
  .dsh-bil-turn-kicker { display: block; font-size: 8.5px; letter-spacing: .26em; text-transform: uppercase; color: var(--bil-muted); font-weight: 700; margin-bottom: 2px; }
  .dsh-bil-turn strong { display: block; font-size: 14.5px; font-weight: 650; letter-spacing: .03em; line-height: 1.35; }
  .dsh-bil-turn small { display: block; margin-top: 1px; font-size: 10px; color: var(--bil-dim); letter-spacing: .03em; }

  .dsh-bil-actions { position: absolute; right: 78px; top: 21px; display: flex; align-items: center; gap: 6px; pointer-events: auto; }
  .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-actions { right: 190px; }
  .dsh-bil-tool {
    width: 34px; height: 34px; padding: 0; display: grid; place-items: center;
    border-radius: 11px; border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), rgba(4, 22, 17, .26); color: rgba(220, 255, 244, .84); cursor: pointer;
    box-shadow: 0 8px 22px rgba(0, 0, 0, .14), inset 0 1px 0 rgba(255, 255, 255, .14);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    transition: background .18s ease, color .18s ease, border-color .18s ease, transform .18s ease;
    -webkit-app-region: no-drag;
  }
  .dsh-bil-tool:hover { background: var(--bil-glass-sheen), rgba(24, 68, 56, .5); color: var(--bil-ink); border-color: rgba(190, 255, 235, .38); }
  .dsh-bil-tool:active { transform: scale(.95); }
  .dsh-bil-tool[aria-pressed="true"] { color: var(--bil-accent); border-color: rgba(95, 240, 196, .44); background: var(--bil-glass-sheen), rgba(15, 67, 54, .42); }
  .dsh-bil-tool svg { width: 16px; height: 16px; display: block; }

  .dsh-bil-player {
    position: absolute; top: 74px; width: 222px; padding: 11px 14px 10px;
    border-radius: 15px; border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-dark);
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .22);
    transition: border-color .3s ease, box-shadow .3s ease, background .3s ease;
  }
  .dsh-bil-player[data-side="human"] { left: 78px; }
  .dsh-bil-player[data-side="ai"] { right: 78px; text-align: right; }
  .dsh-bil-player[data-active="true"] {
    border-color: rgba(95, 240, 196, .5);
    box-shadow: 0 0 0 1px rgba(95, 240, 196, .1), var(--bil-glass-shadow);
    background: var(--bil-glass-sheen), var(--bil-glass-strong);
  }
  .dsh-bil-player[data-side="ai"][data-active="true"] { border-color: rgba(240, 202, 132, .38); box-shadow: 0 0 0 1px rgba(240, 202, 132, .06), 0 10px 36px rgba(0, 0, 0, .22); }
  .dsh-bil-player-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .dsh-bil-player[data-side="ai"] .dsh-bil-player-top { flex-direction: row-reverse; }
  .dsh-bil-player-name { font-size: 12px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .dsh-bil-player-name span { color: var(--bil-dim); font-weight: 600; letter-spacing: .02em; text-transform: none; }
  .dsh-bil-player-side { font-size: 9.5px; color: var(--bil-muted); letter-spacing: .06em; font-weight: 650; }
  .dsh-bil-player[data-active="true"] .dsh-bil-player-side { color: var(--bil-accent); }
  .dsh-bil-player[data-side="ai"][data-active="true"] .dsh-bil-player-side { color: var(--bil-gold); }
  .dsh-bil-pips { display: flex; align-items: center; gap: 4px; margin-top: 8px; min-height: 13px; }
  .dsh-bil-player[data-side="ai"] .dsh-bil-pips { justify-content: flex-end; }
  .dsh-bil-pip {
    width: 11px; height: 11px; border-radius: 50%; position: relative;
    background: radial-gradient(circle at 33% 28%, rgba(255, 255, 255, .6), var(--ball, #64716d) 38%, #0b100e 100%);
    box-shadow: inset -1px -1px 2px rgba(0, 0, 0, .6), 0 0 0 1px rgba(255, 255, 255, .1);
    transition: opacity .28s ease, transform .28s ease, filter .28s ease;
  }
  .dsh-bil-pip.is-stripe { background: linear-gradient(180deg, #f5efe1 0 28%, var(--ball, #64716d) 29% 71%, #f5efe1 72% 100%); }
  .dsh-bil-pip.is-eight { width: 15px; height: 15px; background: radial-gradient(circle at 33% 28%, #5b6460 0 8%, #171c1a 42%, #050706 100%); }
  .dsh-bil-pip.is-eight::after { content: "8"; position: absolute; inset: 3px; border-radius: 50%; background: #f7f1e4; color: #101614; font: 800 7px/9px "Inter", system-ui, sans-serif; text-align: center; }
  .dsh-bil-pip.is-down { opacity: .17; filter: grayscale(1); transform: scale(.72); }
  .dsh-bil-pip.is-target { box-shadow: 0 0 0 2px rgba(95, 240, 196, .55), 0 0 9px rgba(95, 240, 196, .35); }
  .dsh-bil-player[data-side="ai"] .dsh-bil-pip.is-target { box-shadow: 0 0 0 2px rgba(240, 202, 132, .5), 0 0 9px rgba(240, 202, 132, .28); }
  .dsh-bil-player-meta { display: flex; align-items: center; gap: 7px; margin-top: 6px; font-size: 9.5px; color: var(--bil-dim); letter-spacing: .04em; }
  .dsh-bil-player[data-side="ai"] .dsh-bil-player-meta { justify-content: flex-end; }
  .dsh-bil-player-meta b { color: rgba(220, 255, 244, .68); font-weight: 600; }

  .dsh-bil-bottom { display: none; }
  .dsh-bil-power { display: none; }
  .dsh-bil-hint { display: flex; align-items: center; gap: 8px; height: auto; padding: 3px 8px; font-size: 9.5px; color: var(--bil-muted); letter-spacing: .06em; }
  .dsh-bil-hint b { color: rgba(228, 255, 246, .78); font-weight: 600; }
  .dsh-bil-hint-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--bil-dim); }
  .dsh-bil-hint kbd { font: inherit; font-size: 9px; color: rgba(224, 255, 245, .6); border: 1px solid rgba(174, 255, 232, .16); border-radius: 4px; padding: 1px 4px; background: rgba(0, 0, 0, .14); }

  .dsh-bil-spin-panel {
    position: absolute; left: 78px; bottom: 84px; display: flex; align-items: center; gap: 11px;
    padding: 10px 13px 10px 10px; border-radius: 17px; pointer-events: auto;
    border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-dark);
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .22);
    -webkit-app-region: no-drag;
  }
  .dsh-bil-spin-ball {
    width: 52px; height: 52px; flex: 0 0 52px; border-radius: 50%; position: relative;
    cursor: crosshair; touch-action: none; outline: none;
    background: radial-gradient(circle at 33% 27%, #fffdf5 0 18%, #f2e8d4 52%, #b8a88c 100%);
    border: 1px solid rgba(255, 255, 255, .34);
    box-shadow: inset -4px -5px 10px rgba(70, 52, 30, .28), inset 2px 2px 5px rgba(255, 255, 255, .55), 0 5px 14px rgba(0, 0, 0, .28);
  }
  .dsh-bil-spin-ball:focus-visible { box-shadow: 0 0 0 2px rgba(95, 240, 196, .7), 0 5px 14px rgba(0, 0, 0, .28); }
  .dsh-bil-spin-ball::before, .dsh-bil-spin-ball::after { content: ""; position: absolute; background: rgba(46, 63, 55, .2); pointer-events: none; }
  .dsh-bil-spin-ball::before { left: 7px; right: 7px; top: 50%; height: 1px; }
  .dsh-bil-spin-ball::after { top: 7px; bottom: 7px; left: 50%; width: 1px; }
  .dsh-bil-spin-dot {
    position: absolute; width: 9px; height: 9px; border-radius: 50%; left: 50%; top: 50%;
    transform: translate(-50%, -50%); background: radial-gradient(circle at 35% 30%, #ff9b8a, #b3362c 60%, #721a15);
    box-shadow: 0 0 0 2px rgba(255, 246, 230, .7), 0 2px 5px rgba(0, 0, 0, .3);
    transition: left .08s linear, top .08s linear; pointer-events: none;
  }
  .dsh-bil-spin-copy { min-width: 94px; }
  .dsh-bil-spin-copy span { display: block; font-size: 8px; letter-spacing: .2em; text-transform: uppercase; color: var(--bil-dim); font-weight: 700; }
  .dsh-bil-spin-copy b { display: block; margin-top: 2px; font-size: 12px; font-weight: 650; color: var(--bil-accent); letter-spacing: .04em; }
  .dsh-bil-spin-copy small { display: block; margin-top: 3px; font-size: 8.5px; line-height: 1.4; color: var(--bil-dim); letter-spacing: .02em; white-space: nowrap; }

  .dsh-bil-corner { position: absolute; bottom: 26px; font-size: 9px; letter-spacing: .08em; color: rgba(190, 240, 226, .4); line-height: 1.7; }  .dsh-bil-corner strong { color: rgba(225, 255, 246, .68); font-weight: 650; }
  .dsh-bil-corner-left { left: 78px; }
  .dsh-bil-corner-right { right: 78px; text-align: right; }
  .dsh-bil-corner kbd { font: inherit; color: rgba(225, 255, 246, .64); }

  .dsh-bil-toast {
    position: absolute; left: 50%; top: 162px; transform: translate(-50%, -6px);
    max-width: min(460px, 72vw); padding: 8px 15px; border-radius: 10px;
    border: 1px solid var(--bil-glass-border); background: var(--bil-glass-sheen), var(--bil-glass-dark);
    box-shadow: var(--bil-glass-shadow); backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    font-size: 11.5px; color: rgba(230, 255, 247, .92); letter-spacing: .02em; line-height: 1.5;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .25);
    opacity: 0; pointer-events: none; transition: opacity .22s ease, transform .22s ease; z-index: 4; text-align: center;
  }
  .dsh-bil-toast.is-show { opacity: 1; transform: translate(-50%, 0); }
  .dsh-bil-toast[data-tone="foul"] { border-color: rgba(255, 138, 120, .36); color: #ffd9d2; }
  .dsh-bil-toast[data-tone="good"] { border-color: rgba(95, 240, 196, .38); }
  .dsh-bil-toast[data-tone="ai"] { border-color: rgba(240, 202, 132, .3); }

  .dsh-bil-result { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; padding: 24px; pointer-events: auto; background: radial-gradient(ellipse at center, rgba(1, 10, 8, .16), rgba(0, 6, 5, .4)); backdrop-filter: blur(2.5px); -webkit-backdrop-filter: blur(2.5px); }
  .dsh-bil-result-card {
    width: min(420px, calc(100vw - 38px)); padding: 28px 30px 24px; border-radius: 22px; text-align: center;
    border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), linear-gradient(160deg, rgba(8, 32, 26, .82), rgba(3, 14, 11, .76));
    box-shadow: 0 30px 90px rgba(0, 0, 0, .48), var(--bil-glass-shadow), 0 0 60px rgba(66, 221, 180, .07);
    backdrop-filter: blur(28px) saturate(1.15); -webkit-backdrop-filter: blur(28px) saturate(1.15);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .25);
    animation: dshBilResultIn .45s cubic-bezier(.2, .9, .25, 1.1);
  }
  @keyframes dshBilResultIn { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
  .dsh-bil-result-ball { width: 58px; height: 58px; margin: 0 auto 15px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 32% 25%, #65706c 0 7%, #222a27 35%, #050807 78%); box-shadow: inset -5px -7px 14px rgba(0, 0, 0, .8), inset 3px 3px 8px rgba(255, 255, 255, .17), 0 12px 30px rgba(0, 0, 0, .4); position: relative; }
  .dsh-bil-result-ball::after { content: "8"; width: 27px; height: 27px; border-radius: 50%; background: #f6f0e2; color: #121917; display: grid; place-items: center; font: 800 16px/1 "Inter", system-ui, sans-serif; }
  .dsh-bil-result-card h2 { margin: 0; font-size: 24px; line-height: 1.2; letter-spacing: .01em; font-weight: 650; }
  .dsh-bil-result-card h2 em { color: var(--bil-accent); font-style: normal; }
  .dsh-bil-result-card p { margin: 9px auto 0; max-width: 300px; color: var(--bil-muted); font-size: 11.5px; line-height: 1.7; }
  .dsh-bil-result-stats { display: flex; justify-content: center; gap: 26px; margin: 20px 0 22px; padding: 13px 0; border-top: 1px solid rgba(174, 255, 232, .1); border-bottom: 1px solid rgba(174, 255, 232, .1); }
  .dsh-bil-result-stat { min-width: 56px; }
  .dsh-bil-result-stat b { display: block; font-size: 19px; font-weight: 600; color: rgba(232, 255, 247, .9); }
  .dsh-bil-result-stat span { display: block; margin-top: 2px; font-size: 8.5px; letter-spacing: .14em; color: var(--bil-dim); text-transform: uppercase; }
  .dsh-bil-result-actions { display: flex; gap: 9px; justify-content: center; }
  .dsh-bil-btn { height: 37px; padding: 0 18px; border-radius: 10px; border: 1px solid rgba(174, 255, 232, .18); background: rgba(13, 43, 35, .45); color: rgba(230, 255, 248, .8); font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: background .18s, border-color .18s, color .18s, transform .18s; -webkit-app-region: no-drag; }
  .dsh-bil-btn:hover { background: rgba(21, 65, 53, .6); border-color: rgba(174, 255, 232, .36); color: #fff; }
  .dsh-bil-btn:active { transform: scale(.97); }
  .dsh-bil-btn[data-primary="true"] { background: linear-gradient(135deg, #54ecc5, #30b997); border-color: transparent; color: #04211a; box-shadow: 0 6px 20px rgba(54, 210, 170, .2); }
  .dsh-bil-btn[data-primary="true"]:hover { background: linear-gradient(135deg, #6dffda, #3ccca8); }

  .dsh-bil-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

  @media (max-width: 940px) {
    .dsh-bil-brand { left: 56px; top: 16px; }
    .dsh-bil-brand em { display: none; }
    .dsh-bil-actions { right: 56px; top: 15px; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-actions { right: 168px; }
    .dsh-bil-turn { top: 62px; min-width: 170px; padding: 6px 14px 7px; }
    .dsh-bil-turn strong { font-size: 12.5px; }
    .dsh-bil-player { top: 63px; width: 178px; padding: 9px 11px; }
    .dsh-bil-player[data-side="human"] { left: 56px; }
    .dsh-bil-player[data-side="ai"] { right: 56px; }
    .dsh-bil-pip { width: 9px; height: 9px; }
    .dsh-bil-pip.is-eight { width: 13px; height: 13px; }
    .dsh-bil-pip.is-eight::after { inset: 2.5px; font-size: 6px; line-height: 8px; }
    .dsh-bil-bottom { bottom: 54px; }
    .dsh-bil-spin-panel { left: 56px; bottom: 60px; padding: 8px 11px 8px 8px; }
    .dsh-bil-spin-ball { width: 46px; height: 46px; flex-basis: 46px; }
    .dsh-bil-spin-copy b { font-size: 11px; }
    .dsh-bil-spin-copy small { font-size: 8px; }
    .dsh-bil-corner { display: none; }
    .dsh-bil-toast { top: 152px; }
  }
  @media (max-width: 640px) {
    .dsh-bil-brand { left: 42px; height: 27px; padding: 0 10px 0 8px; font-size: 9px; }
    .dsh-bil-turn { top: 60px; min-width: 150px; }
    .dsh-bil-player { top: 94px; width: 148px; }
    .dsh-bil-player[data-side="human"] { left: 42px; }
    .dsh-bil-player[data-side="ai"] { right: 42px; }
    .dsh-bil-player-name { font-size: 9.5px; }
    .dsh-bil-player-name span { display: none; }
    .dsh-bil-player-meta { font-size: 8px; }
    .dsh-bil-actions .dsh-bil-tool { width: 30px; height: 30px; border-radius: 9px; }
    .dsh-bil-actions { gap: 4px; right: 42px; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-actions { right: 156px; }
    .dsh-bil-bottom { width: auto; bottom: 46px; }
    .dsh-bil-spin-panel { left: 42px; bottom: 142px; padding: 7px 9px 7px 7px; gap: 8px; }
    .dsh-bil-spin-ball { width: 40px; height: 40px; flex-basis: 40px; }
    .dsh-bil-spin-copy small { display: none; }
    .dsh-bil-launcher { top: auto; right: 14px; bottom: 18px; transform: none; }
    .dsh-bil-toast { top: 172px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dsh-bil-brand-dot, .dsh-bil-result-card { animation: none !important; }
    .dsh-bil-launcher, .dsh-bil-launcher-copy, .dsh-bil-tool, .dsh-bil-btn, .dsh-bil-pip { transition-duration: .01ms !important; }
  }
  `;

  const ICONS = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8.5a5 5 0 0 1 0 7"/><path d="M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
    guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 17 3"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M6 21a3 3 0 0 0 3-3"/><path d="m14 4 6 6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.8A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.8"/><path d="M6.1 6.1C3.7 8 2.5 12 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.6-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.3-5.8"/><path d="M3 4v5h5"/></svg>',
    pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5 19 10l-6 1.7L10 18z"/><path d="M14 15.5 18.5 20"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5 5 14 14M19 5 5 19"/></svg>',
  };

  const TEMPLATE = `
    <button class="dsh-bil-launcher" type="button" aria-label="打开台球（Alt+B）" title="台球 · Alt+B">
      <span class="dsh-bil-launcher-ball" aria-hidden="true"></span>
      <span class="dsh-bil-launcher-copy"><b>来一局台球</b><small>ALT+B</small></span>
      <span class="dsh-bil-launcher-live" aria-hidden="true"></span>
    </button>
    <div class="dsh-bil-stage" tabindex="-1" hidden data-clarity="0" role="application" aria-label="Harness 台球桌">
      <canvas class="dsh-bil-canvas" aria-hidden="true"></canvas>
      <div class="dsh-bil-layer">
        <div class="dsh-bil-brand"><span class="dsh-bil-brand-dot"></span>Harness 8-Ball <em>整张界面，就是球桌</em></div>
        <div class="dsh-bil-turn" data-tone="human"><span class="dsh-bil-turn-kicker">YOUR TURN</span><strong>轮到你</strong><small>按住蓄力 · 松开击球</small></div>
        <div class="dsh-bil-actions">
          <button class="dsh-bil-tool" type="button" data-act="mute" aria-label="静音" aria-pressed="false" title="静音（M）"></button>
          <button class="dsh-bil-tool" type="button" data-act="guide" aria-label="辅助线" aria-pressed="true" title="辅助线（G）"></button>
          <button class="dsh-bil-tool" type="button" data-act="focus" aria-label="背景：透视" aria-pressed="false" title="背景：透视（点击切换）"></button>
          <button class="dsh-bil-tool" type="button" data-act="new" aria-label="新的一局" title="新的一局（N）"></button>
          <button class="dsh-bil-tool" type="button" data-act="pass" aria-label="操控 Harness" title="操控 Harness（Alt+H）"></button>
          <button class="dsh-bil-tool" type="button" data-act="close" aria-label="收起球桌" title="收起球桌（Esc）"></button>
        </div>

        <section class="dsh-bil-player" data-side="human" data-active="true">
          <div class="dsh-bil-player-top"><div class="dsh-bil-player-name">YOU <span>你</span></div><div class="dsh-bil-player-side">待定</div></div>
          <div class="dsh-bil-pips"></div>
          <div class="dsh-bil-player-meta"><b class="dsh-bil-human-wins">0</b> 胜 · <b class="dsh-bil-human-losses">0</b> 负</div>
        </section>
        <section class="dsh-bil-player" data-side="ai" data-active="false">
          <div class="dsh-bil-player-top"><div class="dsh-bil-player-name">DEEPSEEK <span>对手</span></div><div class="dsh-bil-player-side">待定</div></div>
          <div class="dsh-bil-pips"></div>
          <div class="dsh-bil-player-meta">本地 · <b>标准</b></div>
        </section>

        <div class="dsh-bil-bottom">
          <div class="dsh-bil-power"><span class="dsh-bil-power-label">POWER</span><div class="dsh-bil-power-fill"></div></div>
          <div class="dsh-bil-hint"><b class="dsh-bil-hint-main">按住蓄力</b><span class="dsh-bil-hint-sep"></span><span class="dsh-bil-hint-sub">松开击球</span></div>
        </div>
        <div class="dsh-bil-spin-panel">
          <div class="dsh-bil-spin-ball" tabindex="0" role="group" aria-label="击球点：中杆">
            <span class="dsh-bil-spin-dot"></span>
          </div>
          <div class="dsh-bil-spin-copy">
            <span>STRIKE POINT</span>
            <b class="dsh-bil-spin-name">中杆</b>
            <small>上高 · 下拉 · 左右塞</small>
          </div>
        </div>
        <div class="dsh-bil-corner dsh-bil-corner-left"><strong>HARNESS TABLE</strong><br>整张界面 · 六个袋口</div>
        <div class="dsh-bil-corner dsh-bil-corner-right"><kbd>N</kbd> 新局 &nbsp; <kbd>G</kbd> 辅助 &nbsp; <kbd>M</kbd> 静音<br><kbd>Esc</kbd> 收起 &nbsp; <kbd>Alt+B</kbd> 开桌 &nbsp; <kbd>Alt+H</kbd> 操作</div>
        <div class="dsh-bil-toast" role="status"></div>
        <div class="dsh-bil-result" hidden>
          <div class="dsh-bil-result-card" role="dialog" aria-modal="true" aria-labelledby="dshBilResultTitle">
            <div class="dsh-bil-result-ball"></div>
            <h2 id="dshBilResultTitle">清台</h2>
            <p class="dsh-bil-result-copy">这张桌子，归你了。</p>
            <div class="dsh-bil-result-stats">
              <div class="dsh-bil-result-stat"><b class="dsh-bil-result-wins">0</b><span>胜场</span></div>
              <div class="dsh-bil-result-stat"><b class="dsh-bil-result-losses">0</b><span>负场</span></div>
              <div class="dsh-bil-result-stat"><b class="dsh-bil-result-streak">0</b><span>连胜</span></div>
            </div>
            <div class="dsh-bil-result-actions">
              <button class="dsh-bil-btn" type="button" data-act="new" data-primary="true">再来一局</button>
              <button class="dsh-bil-btn" type="button" data-act="close">回到 Harness</button>
            </div>
          </div>
        </div>
        <div class="dsh-bil-sr" aria-live="polite"></div>
      </div>
    </div>
  `;

  const AUDIO_DATA = {"cue":"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v/+6/7j/uP+2/73/xf/J/9H/2P/f/+b/7P/y//X/+P/9//z///8AAP//AAD+//v/+P/x/+3/5v/e/9r/0v/Q/9L/0f/X/97/5//1//7/BgAUABsAHgAfAB0AFwAMAAAA9f/k/9T/x/+6/7D/qv+n/6r/s/+7/8f/1f/k//j/CAAWACQALAAzADcANQAvACUAGAAKAPr/7f/g/9j/2v/g/+v///8RACYAPwBTAGMAbgBxAG4AYwBTAD4AJAAKAPX/4v/Q/8b/wf++/8X/z//W/+T/8f/6/wIACAANABAADAALAAgA///5//j/8//v/+//7v/u//L/9v/6//7/AQAJABAAFAAZAB8AJQAoACsAMAAvACwAKQAgABgADgACAPn/7//n/+H/3//j/+f/6//1//7/BAAKAA4AEQARAA8ACgABAP3/+f/x/+z/6f/n/+X/5P/o/+v/7v/z//j//P8BAAUADAASABMAFgAZABQAEAANAAcA///4//L/7v/s/+z/7f/y//z/AwAMABYAHQAlACcAIwAiABwAEAAFAPr/7f/j/9f/z//K/8b/xv/J/8//2f/l//X/AwAUACUAMwA+AEMAQwA/ADIAIwASAP7/6f/X/8j/vv+5/7r/vv/K/93/7v8BABcAKAA4AEMARwBIAEIANwAnABQAAgDw/93/z//F/77/v//F/83/1//m//b/AwAQABoAIQAlACUAJAAgABoAEwAMAAYAAgD+//3//P/7//7/AQACAAQABgAIAAgABwAIAAcABAAFAAUAAQABAAIAAgADAAQABQAIAAgACAAJAAYAAgAAAAAA/v/9////AAACAAYACgAPABUAGQAaABwAHQAZABQAEAAHAP3/9f/s/+P/4P/d/9z/4P/l/+v/8//7/wMADAATABgAHQAgAB8AHQAbABQADQAGAP3/9f/s/+T/4v/e/9v/4P/l/+7/+v8CAA4AGgAjACgAKQApACUAHQAUAAgA/v/2/+3/6f/p/+n/7//1//z/BAANABYAHAAfACIAIQAdABkAEQAHAPz/8P/l/9n/0P/K/8f/yP/M/9b/5f/z/wIAFQAlADMAPgBFAEcARQA/ADQAJgAXAAcA9//p/9z/1P/Q/87/0f/Y/+L/8f/+/woAFwAgACYAKQAnACAAFwAOAAMA+//1//D/7//z//j/AAAJABIAGwAiACYAJwAlACEAGgATAAwAAwD8//f/9P/z//T/9P/2//r//f8CAAcACgAQABUAFgAXABcAEwAPAAgA///1/+v/4//c/9X/0v/T/9b/3P/k/+z/9/8BAAsAFQAdACUAKwAuADEAMQAvAC0AKAAiABoAEQAIAP//9v/s/+T/3v/a/9j/2f/d/+T/6//1//7/BQAMABEAEgATAA8ACwAFAP7/9//w/+j/4//f/93/3P/c/9//4v/m/+z/7//y//X/9//3//b/9P/x/+z/6P/j/+D/3v/d/97/3//k/+z/8//5/wEACAAOABIAEwAVABUAEAAMAAYAAAD6//X/8P/s/+r/6f/q/+3/8v/3//7/AwAHAA0ADwAPAA4ACgAEAP//9//x/+z/6P/n/+f/6P/s//H/9v/7/wAAAgAEAAUABAACAP7/+f/2//H/7f/s/+r/6//u//D/9P/6////AwAIAA0AEgATABUAFwAWABUAEgANAAkAAwD+//n/8//u/+z/6v/q/+z/8P/2//3/AwAKABIAFwAbAB0AHQAaABYAEAAKAAIA/f/3//L/8f/x//L/9v/5//7/AwAHAAoADQAOAA4ADQAKAAcAAwAAAPz/+f/3//X/9v/2//j//P/9/wAABAAGAAkACwAMAA4ADQAMAAwACgAJAAgABwAHAAYABgAHAAYABgAHAAYABgAGAAUABQAEAAIAAgACAAEAAQAAAAAAAAD///7//v/9//3//v/+/wAAAQADAAUACAAKAAwADQAOAA4ADQALAAoABwAEAAIAAAD///7//f/9//3//f/+//7//v/+//7//v/+//7//////wAAAAACAAMABAAEAAMAAgAAAP7/+//4//b/9P/z//P/8//1//f/+f/8////AAACAAQABAAEAAQAAwABAAAA/v/9//r/+f/4//f/+P/5//r//P/+/wAAAQACAAMABAAEAAMAAgABAAAA/v/9//z/+//7//z//f/9//7//v/+//7//f/8//v/+v/5//n/+f/5//v//f/+/wAAAQACAAMAAwADAAIAAQABAAEAAAAAAAAAAQACAAQABQAGAAcACAAIAAcABgAFAAMAAQAAAP///v/9//z//P/8//3//v///wAAAAABAAIAAwADAAMAAwADAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAgACAAMAAwAEAAQABAAEAAQAAwADAAIAAgABAAAAAAAAAAAA/////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAA/////////////wAAAAAAAAAAAAAAAAAAAAAAAAAA","click":"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MwAsACUAHwAYABIACwAFAAIAAAD+//7/AAADAAoAFAAeACoANQBAAEkATwBSAE8ASQA/ADAAIAANAPv/6//e/9T/z//R/9j/4//z/wIAEgAkADMAPgBGAEcAQwA6AC4AHgANAAAA9P/p/+T/4v/k/+r/8//9/wcAEQAaAB4AIQAgABwAGAAUAA4ACQAFAAQABAAGAAkADgATABgAHQAgACQAJQAjACAAGQARAAgAAAD3//D/6//p/+v/8P/5/wQAEAAeACgALwA2ADsAOwA4ADIAKgAgABUACQD///X/7P/n/+X/5//t//X/AAAMABkAJQAwADcAOwA7ADcAMQAoAB8AFwAMAAQA/P/1//L/8v/3////BgAQABoAIwAoACoAKgAnACAAFwAOAAUA/v/3//H/8P/w//L/9//+/wcAEgAdACcALwA0ADcANgAyACsAIwAbABIACgAFAAQABQAKAA4AFAAaACAAJQAnACkAKAAjABwAFAALAAMA/f/3//T/8//0//n///8FAA4AFQAdACAAIQAgABoAFAALAAMA/P/1//H/7//w//H/9f/8/wIACwATABkAHQAfACAAHQAYABIACwAFAP//+v/2//L/8f/y//X/+v8AAAYADAARABUAFgAVABEACgAFAAAA+//6//j/9//4//v//v8BAAQACAANABEAEgATABIAEAAMAAgABAABAP///f/8//z/+//7//3/AAAAAAIABAAGAAYABQADAAEA///8//r/+P/3//X/9f/1//b/+P/5//r/+//7//v/+v/7//v//f///wAAAAABAAIAAwADAAQABgAHAAgACQAJAAcABgAEAAIAAQAAAAEAAwADAAUABQAEAAQABAAEAAUABgAHAAgACAAJAAkACgALAAsACwALAAsACgAKAAkABwAGAAQAAgABAAAAAAD///7//v/9//3//P/8//z//P/9//3//v///wAAAQABAAIAAwAEAAUABgAHAAgACQAKAAsACwALAAkABgADAAAA/v/8//n/+P/4//n/+v/8////AQAGAAoADgARABIAEgARAA4ACwAGAAIAAAD7//j/9f/z//P/9P/0//b/+P/6//3/AAACAAYACAAKAAoACQAHAAQAAQD+//z/+f/3//f/9v/1//X/9f/3//n//f8AAAMABwAJAAoACgAIAAYAAwAAAP7/+v/3//T/8v/w/+7/7f/s/+3/7//y//X/+P/8////AAACAAMABQAFAAYABQAEAAMAAQAAAP3/+v/4//X/9P/z//L/8//0//X/9//5//z///8AAAMABQAGAAYABgAFAAIAAQAAAP///f/8//z/+//6//n/+f/5//n/+v/7//3///8AAAMABQAGAAcABwAGAAUAAgAAAP7/+//5//j/+P/4//n/+v/8////AAACAAQABQAGAAYABQAEAAIAAQAAAP////////7//v////////////////////////////////////7//v/9//3//v/+/////////wAAAAAAAAAAAAABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////+//7//f/9//3//v///wAAAAABAAIAAgADAAMAAgACAAIAAgABAAAAAAAAAAAA//////7//v/+////AAAAAAEAAgADAAQABAAEAAMAAwADAAIAAQABAAAAAAAAAAAAAAABAAEAAgACAAIAAgABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAP///////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///////wAAAAAAAAAAAAAAAAAAAAABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","clickSoft":"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/f/9/wAAAwACAAAA///6//f/+P/4//X/8P/r/+z/7f/o/+D/3//j/+X/6f/y//f/9v/0//n////9//X/8v/u/+b/4v/k/+P/5v/u//L/8f/v/+7/6//n/+j/6v/n/+b/6P/q/+3/8//5//z//v8AAAEA///5//T/7v/n/+3/CQAoADAALQApAAwA7P8DADoARwAuAAYAuv9x/3v/s/+3/57/sf/J/6n/mP/l/ysA//+0/8H/9f/9//r/FgAwAB0A/f/l/8n/wv/p//3/3v/p/ysAKADX/8n/BwAKAM//wv/m//H/7//8/wEA///9/+P/vv/L//v//v/h/+3/FgAaAAMA///7/+X/z//G/8v/3v/s/+H/2//4/xQABwDs/+n/6f/X/87/3//w//L/7f/t//T////7/+b/1f/W/9v/1//a/+3/+f/5////CwAQAAgA9f/g/9n/3//h/97/4v/s//H/8//7//7/8//n/+X/5v/s//n//v/5//z/BgACAPT/7//q/9j/zP/Y/+f/6f/q//L/+v/+/wEAAQD6//D/6f/k/+T/7P/y/+//7//0//r//f/4/+//7P/s/+v/6v/v//T/8//t/+z/8f/x/+v/6f/t//D/9P/5//3/AAACAAIA///7//j/8v/u/+3/7//w//D/7f/r/+z/8P/y//L/9P/4//n//P8AAAAA/f/6//f/9v/6//r/9f/x//D/7//v//P/+f/3//H/8P/y//P/9f/4//r/+f/7//7//v/8//v/+f/1//T/9P/0//T/9P/2//f/9//3//b/9v/4//r/+//9//3//v/+//3/+//9//z/9//0//T/9P/z//L/9P/2//b/9//6//v/+//7//r/+v/7//z//f/+//7////+//3//P/7//r/+P/4//j/+f/6//v/+v/6//z//f/7//r/+//7//r/+v/8//7///8AAAAAAAAAAP///f/9//z/+//8//7/AAAAAAAAAAAAAP//AAD///7//v/9//n/9v/3//b/8//z//j/+v/6//3/AQAAAP3/+//9//7///8BAAIAAQAAAP3/+v/6//z//f/9//7/AAABAAAAAQACAAAA/v/8//3//f/8//3///8AAP////////////8AAAAAAAACAAEAAAAAAAAA///9//z//f/9//7/AAAAAAEAAQAAAAAAAAAAAP///v/9//7////+////AAAAAAAA////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQAAAAAA///+//7//v/+//////8AAAAAAAAAAAAAAQABAAAAAAAAAAAAAAAAAAAAAAD///////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAP//////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","rail":"UklGRkI2AABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YR42AACHAz0C8AFtAp0AyP9U/ZH7M/mj+Pb2BPf89pr2WvPy8sXzTPSd8+zyRvDM733x7O9Z7w3wUfAk8HXv+PAu8GnybPX09V/3FflE+E36Q/uC/Or8Qf2P/Hr+df7A/7wBpv+oAGkAHABDANUAywEZBBUIHwhMB9YK3gjnCKoJlAipB0IHJwVxAkMCKv/+/M/6ePdo9snzSfMG8u7zxfSF9NHzzPGf87nzvfIr8kTxf+2k59LjPuCj3dvcG9dh00fQ0Mw+yQPG1cSwwsS/irxFuuW3Y7YGtVu0RrTfs/W0JLWPtRi3PLhVtxa4KbR4td+03LTBs4Wx3LF0sc+vj6+7rlWtU6/orl+wqK/8r9yvzLL+sw24ZbqUuja9fLxKvvi827z5uRO467nwtluzX7KBsuCvM69crDaqLKppquGqdasOqz6r9KrZqoGrYK4KsCWyf7SFtn258bxLvd2/+cLwxZLHhsuFzS7PC9T31v3ZBd5u4xro1e3x8Yf4s/x3AIkFMgrZDzMV6xfDGEUc0h3zH78hyCGnIWMkrifHKDYq8SumLHEupS9TMBo0uTUDOi07zDy6PfE9jT/AQolHS0oBUPNRC1VkWTpe6V+KYjRmkmhXa9Zt9W9ncVRxgHDebpVrfGt+bKtszmtlarBrf2t3azVqAWy5bCFuOm9rcPdxbXHTcgFyM3IXcZFv3nFacvBxMnO6cUJsBmp8aNlmn2LJXyZdylvqWXZXt1bWVDtUXlEfUgtRzlF+UZlQqVDFTddKTUmlR0ZFdETBQAk9zDqfOKQ1gTL5LQ4rNSlIJSYjDCF/IFQc1Bn5FpsVWxMCEsYRRRCVDqkMjAtaCsUKegzmCjkKSgm2CZIJwQjyCFIIzQhNCUoIbwhhCBoHSAQ7Al4A/f6l/ir9Nvu8+bb5f/it9qz2K/ZD9kH10fRn9AbzHPI8753qH+h94/7dbNvn2EnWn9H3zI3IfMaXxSTDmb9VvMy5YbfxtGqzAbGDsLuvNq65rIisTq2crJWtdq2QqymrkqpGq5erPqqVqFamcKWHpMKkx6Mporyh+KEbo1ah7aEooimkrqQRpmynb6trrqyy5rMytuC2w7c7u4K8mb72v8nA1sAwwXjCDsNCwhvCNcNCws7CqcNCxAfGM8ggyEPLlsy/0PzSM9dG2jfcduCv4qrl1eiy6t7soO4L8UvynvNA9IH27PZZ9m/4Xvox+7f8of2H/3QBTgSaBhUKCQ3jD2ASThRAFvsaiR0EIGshviMvJYkodyj3KB0q7Ck9Ki0szCwFLTYuvC+vL9kxiDJ4NY42AjnlOnc9Oz/sQYFD30RdRZlGtEY8SMdJH0oFS39KhUq/S+BL1kr0SPBIp0Z3RVpCXkGNP7g+aD1zOqg37DVDNLszbTJ5MLkveS5mLvMtcCxZK/QpkClyKf8odSg6KDMnyiZ3JCIjaiG0HxIeCB0+GqUYUBb7E1YSSA8wDSgLwwgaByoDLQCa/Qj7//dV9KPxd+6V6efmaeIh3oPaV9gS1anTLdLr0NrOwczKyh3J1MfxxkzGMccXxvPEKMSNwxDE4sL0warCIMEgwPm/477DvE26L7hKtX+y/6+YrkiuS60pq2ipZahxpROl96S9pEWlbaW3paOmyqdPqbqrxa3VsLKykLW7t2i6X7yxv9DAscHFwrLER8YOxtPHAsmXyfnJa8sizXrPi9FB1BbXVtoN3Cnds9+p4RzksOUl5//nY+mZ6sfqderU6v7sxu757qPvTfEC8cTwUfHG8iHz2PMW9En2x/cO+e/6W/yD/ZD/ZACDAYYBCQOuAwID3wHIAPAA6f+A/if+hP+a//v+R/+TANMAQwBdASYCGAN2A3MFAwfGCIUKjgsPDegOeBH+E/QVzhaDGWMbFx1YHWseEB/VIGwhOSNJJbIlqCUYJh0niydtKPIofiqGLFgujDCNMqI0+TbfOXQ7VT7zQcdFH0nXTClOjFC8UW9S0FMOVo9XLVnkWYBa91xGXR1eUF6SXv9dmF3DXYpdfV0SXahaUFjuVbNUuFJ5UOlOvE1xTCBLoEjXRvhEmkKRP8w8dzlXNn4ykS+OLPooKCa0IjkeHRvZF/gUOxK3EFkOHA0SCzEJ0wbUBawDbgIAAfr+W/00+6b4VfbI8zrw+O246sDnKOXN4oXgA94e21vYpdZ/0wTRxM4uzevJEMevw3jB0r68vMe7G7qUuCy38LUUtH+z5rOWtEm0k7TAtbS207c/uLG5W7pduu+5xbsBvbe+D79mwJ/Am8DQwV7CW8IywwPEz8TPxI3EkcVwxiXHqMhGyorMqM33z+rSKdVL1rPXPtlP2h3bqNwd3hze196f3zTgcuAI4MHgZ+L44qrjhOQl5HPkG+RH5Tzmpuag5vDm5eYx5gDnrOYr513noOhS6Q7qJOuq7H7uRvCO8RPziPW+93n60vz3/9oBQgPzBOAHlwlcDHAOwg+xEicUVhUWFnMXBhmnGWYahRsRHEgd5B5UH+0fDyFuIoQjVyXdJ+8ptStSLr8vMDKmM8c06TUPOLo5nzmTOXI6BjuJO2I8TD2ePgxA70GjQklEiUVHRwFIpkhZSW5Jo0kFScZJBUqbSvdJn0kHSgpKtkl6SdVIjEhBSCFIC0hBSANJGElOSWNJD0rqSk9Mqk10Ty1R+FHQUupTaFWYVvVXw1itWaVZqFokW3Vbt1tNXKxbP1uaWt5Z6liSWJpXbFYvVRlUGlOlUjRSvlHFUJ9PHE5oTexLTkukScVIs0bWRAFDJUEdP+08lzpFOMg1nzNQMLgt2SqaKLAldyIiHwgcdhj6FP4Qlg2HCZ0GywJZANr96vrZ97r10fPz8c7vWu3e6trppuew5Z/jJuLL4ATfCt2v24vZEdgq1vDU8tIL0e3O1MzMyhfJgsfYxZ3D6sGmwG2/Tr0tvJm62rgGt4u17bOwsiixDbFZsDCwQrA5sJOw0LCQsFewV7Dqr+uue68Or5uteaxXq5Wq0amgqR+p66dsp6umzaY0pwuodKjXqBiq6Kqtq9mshq4PsBixr7K4s8O05bU+t1i4Y7mbutq7wrxFvm+/GMFbwtLCI8OWw/nDFcR+xM3EE8UgxYrF4MUixtjF+sXpxqvGKseSx7XHCMckx+vGlMagxfnElsRmxJzEtMRuxNfDw8OKwzfD58KZwk/Cr8JZwqDBgMHhwMa/E7/Dvom+Rb6dvSS967sJu+y55rgiuPO2wbVatMGyULGYsEew5q8gsEWx3LGoso6z7bQqtke3GrjNuLO5a7rGui270rsNvDq8crzmvO29Pr/NwFbCbcTpxl/IN8qozEvPXNKl1XfY4NrH3fPfy+EU5ODmGOmE68jtqe8T8sD0kva9+Ob6nP2x/6ECFQY8CXgMsg+UEvYUixddGskcsB/AIhElUSffKeIr6S0eMPgxOjQsNl04nzqjPFc/WEGCQ5ZFYEfoSHFKe0zwTaVPuFDUUcFSkFNJVExUDFW/VaxWp1eIV1ZY5FjIWSBaoFodW19czl3zXi5g6mCiYSljpWNBZE5kx2PNYw1j3WIKYm5hO2D0Xvxdsly6W5Rat1noWI5YYldVVsBVxVU5Vn1WlFUJVYRUxFMrU2NSjlE7ULlOdU1mTCxLVkrqSTdJbUgUSOdHWEeBR8FHxUfxRi1GEUWTRAZD50EgQJ4+rTwBO0s5WTd1NWkzgDG+MIsvwC7QLSstnyyWLBEsPiu9KvspuShdJ38lcCSMIsQhdiDDHjQdXBviGX0YNReyFjUVcxTFEx4TNhIhERkQcA+HD44Pcw/LDswNkwxJC+IJLQizBkUFlwP2AW8Ai/5b/QH8LftO+v74W/iy96n36fcE+F/3zvYF9v/1bPWw9Jz0OvQc89zxivAr78btY+xz607qe+lK6HHnduaw5cfk8eOg40LjbuMx4zXjveKJ4q/iLOLh4djhhOFc4fLg2ODM4EfgyN9W3z/fDd+N3xzgFOEy4tbiFOQo5QLn8+j/6tnstu4I8H3xdPPS9Fv2APg++UH6l/uk/Lf9fv4p/83/eQBQARYCswKpA2kEZwQ9BN8DzAOrA4kDpwPEA6YDgwMcA8kCqgIkAjwCcQKRAnoCOwKTAQIB9P+A/z/+bv18/C37F/qy+ID3Hvcu9iL1YPUW9S/1OvXm9B31UfVC9Uz1X/VX9Uz1P/Uf9Vr00PMM81zy/vFD8ePwNvBN7xfvsO4X7uvtmO2F7RnudO6K7tbuMO9I737vv+9r77PvJfBk8Bvwzu957ybvju6L7kju3e3E7SHtSuy96yTra+ow6mzqM+pZ6rrqAOta6/TrdOzN7FTtEO5n7rPuAe8Z76Puau7r7WjtTe307HPsTOzi64Tr8ur+6hHrtusr7KzsNe2f7UXute5j7wvw0/BH8enxR/KT8s/yt/Ix8j3yA/KY8WfxG/EG8aLwKfBl79/uQu6l7f/sYez46/PqZOp66Xrokuem5onld+SB48Xil+Gd4E7fPd7e3H7badpN2R/YE9cw1krVTNT20pHRpNDRz/7O3M5hzhnO/M39zfzNS866zlrPS9Cy0HTR59FJ0qLSF9Oj087TI9Rt1N/U8dQ21VbVjtV+1WfVytXo1RTW59XR1afVgdU/1VbVttXy1TvWuNYf187X+tjS2bvaHdzd3Wff9OBw4trjSeU15m7nOOir6ZrqluuU7Mztvu4g7xnwUPF18tnzWfXG9lv4FfpY+538zP0D/2cAfAHwAmUEawWOBhsH4gcYCSEKHguzDEYOpw/EECQSshNIFSIXzhiaGg0cQh2gHtYfBCHdIi8keiWwJt4n+ChKKkIrrCz3LdguAzDMMI0xczIRM2wzwzMJNAw0GTTTM1Az/jLhMmAyYzILMucxqTGoMZMxhDFyMX8xfTE7MToxcDE9MTAxKTHGMIow5S9LLz4vNy8uL/Qu3S6TLqouzS4tL7MvODDsMC8xsDENMqYyMTOaM2I0zjQANTc1VTW/Nds1ojUpNbQ0cDQ7NNEzczPlMgoyLzFOMDsvsi79LVUtYCyqK7kqiimSKH4neyZWJfYjvCJdIS0grB4SHWgbJxrHGIgXcBYiFdkTwRLDEeMQKBCBD8IO4w3pDAsMhwsqC9wKugo6CsMJ+QiFCOgHWgfVBnUG0wU2BYgE6ANBA04CbgHOAGYAGwA0AAoA7v+p/0n/5f5y/kX+Kv4l/r79a/3U/OD7//pM+ov5EPmB+Ln34fYm9kz1UvRY843ySvLm8bfxT/ED8drwu/Cm8NbwMfGB8frxifIk86Lz7/Mk9Fj0vPRJ9av16fVM9nL2fPZY9nH2NPb09d31p/Vo9Qz1mfQq9MzzZ/NR8wfz+vIl82fzy/MH9D70gfTQ9Cj1jPUR9o/2pvaX9oz2YfYk9vH14fWx9Xj1NPXk9C70xfOA80fzMPND84LzfPOa87DznfPR86LzYvNI80HzLfP98pXyNPLW8YLxJvHL8HDwU/Dg73rv+e547q3tAO2C7NjrFOtt6ofps+jT5+jm7OUi5Wfk4uOC4w/j+OKm4pHia+Il4vDhwuHW4aXhkeF94Tzh8eCD4A3ggt9h30TfJt9y36Lf8d8b4F3g1eBT4Rvi1+Ka40rk9ORe5aDlPOai5ibntucS6Ijo5uhh6Zjp/+mn6jPr+OuU7I3tbO4n7+zv3fCn8eTyP/TP9W33x/jo+Sb7SPyJ/f/+YQDbAf0CBgT7BLYFUQbMBl8HygdYCMsIRAnCCWwKygpEC4ALvwtUDBgNsQ1wDvEORg+fD7QPDBBBEGMQRhBWED8QJRAXEA0QMhAzECAQ8Q+iD1MPDQ/IDowOCA6eDeYMXQzpC70LiwtJC/gKngqHCiwK+gnPCckJoAl2CT0J+AjSCNwIkAhjCA0IcwfnBlEGtgU7BY8E+AOZAzwDCgPiAp4ChQJyAkUCRgKHAskCJQNqA6wDvAP2AxEEBAQIBN0DzQPIA4kDfgNuAycD7wK0ApECjAJpAjQCNQIlAgICOAKRAhgDpgNEBOUEPwXZBWAGFQfRB4YIIAmACYgJvAnoCQ0KPQpkCrkKGwtSC2YLqAvTCxQMpgxIDRcO2g7AD3oQLRHHEU0S9BLAE7wUjBU2FqcW/BYWFz8XjBfsF2QY9xhPGV4ZWRkIGdQYhBhIGB8Y6he8F38XIReMFrAV8RRCFK0TPxPPEmcS+hFpEc8QRxCpD0gPBQ/GDoYOGA6cDRINbwy4C94K/gk8CWEIowe0BsYFnARLAysCBAHy/+v+8P0H/Uf8cfum+sT57/gp+F73tvYb9rL1T/Xv9IH0HvTw87bzjfNe8zjz6fLG8rXyivJp8hvyv/FM8dnwaPAe8MjvfO8D747uDO7d7ejtD+5f7nnuju6E7pfut+7X7gLv5e7Z7qzuce4r7vvtye2M7S3tpuwc7JzrNuvc6nPq/+lo6bPo9udK58vmWuYD5t3luuWS5V7lNOUI5QjlD+VJ5XvliOWS5XzlUeUY5d3kr+SI5HfkV+Q35Bbk+eP24/3j8OPe4wPkOuSG5PTkKuVm5V3la+V05WPlc+Wa5bzlDeZh5pLm1+Yh51/ngOd251rnRedR53jnoOfR5w3oQOh96I7ox+j/6FXpzOlH6rvqOuuk6xPsm+wm7cHtbe4n7wXw6PDD8YjyQ/ML9PT02/XM9un3Bfnq+b36dvti/Ef9PP5X/2IAbQFKAvICrQNfBAcFjAUfBr4GPwfkB4IILwnJCWkK9QqbC2EMRg01DvMO3w+7EHsRWhIcExQUKxUoFiEXDhjbGG8ZzxklGlcajRrCGgobTxtmG3kbdxtpG1wbWxtJG1MbUBtVG1wbXxtcG08bQxs8G24brhvpG0QcaBx7HGscXRyEHMQc/RxRHV8dQx3oHJIcRxwlHBAcHBwNHO0bqxtbGxgb0hqbGqoawRr6Gkgbhxu0G74b6Bv4GwQcOByEHO8cRB2THcsd0h23HcQd4B0pHnsexh71Hgsf0B6THmUeOx5BHlYeUh4aHtEdbh0BHY8cMRytGxgbixoQGq4ZKRmOGP8XZxfKFnEWGhbxFcAVkxVRFQQVqxRqFFYUZxRiFEcUEBSrE1YT6hJjEtcRQxG5EDcQgw/WDigOLw1WDJkL+gpjCscJKAlyCKwHzQbsBS4FnAQFBH4D1wI6Ap4BCQFtAN//Wf/q/nr+Df7W/Zv9Uv3y/G788/tK+9H6Uvq4+Q/5Tfg/9zD2H/UZ9CHzU/KD8czwBPAr71/uju3o7Dbstesk66rqLeqk6TXpqOgW6KrnROfq5rvmleZY5jrmEObO5aDlf+WU5erlTubA5hDnZ+d855vnv+f45zXoWehV6EHoAOjE54znZedJ50PnDufH5o/mX+ZO5lvmZuaD5qzmyObI5uHm/OYI5yXnUedo55Dnt+fc5/DnGOgr6DvoSOhl6IrooujJ6Nzo6OgH6SbpQelJ6Wnpeumc6avpvum96cXpxOnO6crp1unW6eXp9On36f/pGOoq6i7qSepu6nrqkerJ6ijrfuvI6+Dr7uvt6/nrM+x97NbsFO0a7eTsluw97A7s9evz6/Pr3+ug60Pr+Oq96pzqjeqr6t3qJetm65/r4ush7Gbssuwh7bPtRu7O7jvvf++y7+HvLPCL8BPxmPEN8n/y1fIn83Xzy/NB9Nz0rvV29ln3NPj1+Kn5S/ru+pv7XvxE/TH+Iv8EAN0AoAF5Am0DdASMBa0GxAe3CI0JYArrCpALKQy7DGYN3g1fDswOHg9qD70PJhC1EGEROBIkE/wTwBRpFfoVmRY2F/EXxxiVGX4aUBsFHM4ceB1iHkEfNyAtISIi+CLAI1ok4yRAJXklsiXsJScmeSazJtIm5SbkJtgm1yb5JjknhCfWJ/knDijwJ9MnwifYJ/QnEigIKOYnlyc3J80mbSYnJuwlwCWEJR4lpSQRJFAjoiL3IWIh5yBeIOQfbx/jHjweqh0oHcQcbBwqHN8bdxvtGjwaghmtGOMXFhc8FloVehR4E2ESQxE8EEQPbg7BDUYN6Ax1DAIMfAvzCnsKGgrfCbYJfwkzCdIIVQjHB0UH3wZ9Bi8G6wWaBS0FyAQ7BKIDBANdAs4BSwHqAH4ACAB3/8j+A/48/W38rfvn+ib6VPlb+FD3Q/Y29UH0hPPb8mvy6/Fb8cfwKfCV7yPvye6M7lXu/u2K7QftZezA6w3rTeqE6bXo7ucc51rmo+Xl5CzkaOO74jHiweFq4Q3hmuAt4KzfLN/W3pPeY9443u7dkN0W3aPcPNz128Pbx9ve2wbcJNxO3GDcXNxP3EDcUtx73Lbc+Nw33VPdZd1l3ZHd2t1E3sjePt+b38/f+98g4FTgmuAF4XLh4eE14m/in+LA4uniMuOI4/rjbeTx5H7l+eVy5u/meOcH6KboYOkt6vHquut27CbtxO1M7tTuYe/r73rwFPGc8SjyoPIq87zzV/QF9dH1rfaC91L4E/my+VH67PqZ+178Lf0A/sP+b//7/3sA+gCCATIC9wLaA68EeAUtBuQGpgeCCIAJhAptCzgMygwmDWENlA3TDS8OmQ7+DmMPtw/qDyMQWxCsEBgRrBFeEh8T3ROUFDUVwBU7Fr8WNxelFxsYkRgAGXAZzxkjGoAa3ho8G6UbBxxOHHkcjByZHKUcwRzlHP0cAx3jHJkcHRyaGxwbrBpQGgEasBlaGQYZlxgOGIkXDReoFmsWUhZaFmMWYxZOFi8WBRbOFZQVXxUlFdgUfxQOFHUTvBL1ESwRaBDGDzgPvA5CDr4NLg2lDB8MtgtnCysL4wqSCiUKlgngCCYIZQetBgIGdAX+BIYEBgR4A+ICYQL5Ac0B0wHtAfYB3QGRAR0BogA9AOH/n/9j/xf/qP4k/pb9E/2q/GD8MvwL/O77yfuj+337T/sX++X6t/qC+kz6FPrN+Wn5D/mj+ED4/vfi9+33GfhH+Gv4e/hq+FD4Mfgk+A74+vfe96r3W/f69pf2QPYA9uP18vUW9kv2hfar9r72yPbG9un2Ivdj97X39/co+Db4O/gv+B/4D/gN+AT4A/gD+AP4/vf/9/33Efgw+GX4rvj9+D/5bvl++ZD5kPmh+cH5CPpX+qj64Prw+tf6qPpt+k/6UfqC+sT6Dfs9+0/7TvtS+2/7wfse/Iz87PxB/YX9qv3E/ev9Ev5M/qD+/P5E/3L/e/9k/zL/Bv8I/zD/g//b/x0APwBDAEUARABVAHcAfwB2AEYA/P+v/2f/Mf8N/wT///7t/sv+of5q/iL+8f3e/fv9Ov6M/sf+2/7R/qv+e/5n/nn+r/4I/2z/zP8SAE8AeACjANYAGAFvAdYBRwKiAukCDQMhAy8DSQN5A6oDxwPFA6MDfgNrA3cDsQMIBF4EkwSfBIoEXwQxBBkEHgQzBGMEngTtBDUFewW5Bd0F+gUbBlMGsgYnB5wHBAhICGkIdAh+CJQIswjJCNAIrwhxCDAI9AfLB7cHwAfSB+AH8QcGCBsIMAg/CE0IYwhzCHoIbQhSCB8I2geKB0wHKAcbByEHJAcmBycHKgc2B0QHVgdkB2IHVQc/BxoH3QZ8Bv4FbgXkBG0EFwTUA6ADaQMYA8ECbwI6Ah0CGwIZAgQC4gGXASwBsAAtAK7/Pv/h/pP+VP4R/sH9ZP0F/b/8lPx6/Hr8dfxM/P37lvsq+8X6g/pP+jb6H/r0+bT5afkt+Qz5G/lH+Yz50fn0+eT5q/lU+Qf5xvid+IT4b/hP+CH48ve293v3QvcN9wH3FvdU96L37/cl+D74Ofgf+BX4Jfg4+Ev4M/j49633b/dG9073Z/eK95/3o/eg96P3nPeM92j3NfcF9+n27vYV90r3fPeI94H3XfdA9zv3P/dB9zP3Ave29lj2Dvbr9ej1BvY09mr2o/bY9gH3H/c+91j3iffE9xX4aviz+N34z/iZ+E/4E/jz9wb4PviC+Lj41PjZ+Nr48vgj+XT50vkv+mr6kvqY+pb6kvqH+oH6efpw+m36a/pn+mr6bfp8+p360Poh+3b7zPsJ/Cf8K/wx/D/8cPy6/BX9Zv2Z/bv9x/3V/fj9LP59/t3+NP95/6v/x//X/9n/5v/w//v/CgAbACMAJQApAC8ARABnAKIA6gBCAZUB2AEGAhoCJgI7AnMCwgIgA3UDrgO+A7ADmwOTA6EDtwPJA7QDewM2A/oC4gL0AiYDYwOOA6UDogOaA6EDsAPHA9kD5APiA9gD0APMA84DzAPJA8ADtQO1A7QDugPCA84D0wPYA98D4wPoA+4D8APyA/UD+wP8A/sD+gP8A/sDAAQCBAQEBwQLBAwEDwQRBBIEDgQMBAEE/AP1A/QD8gPrA+MD3gPdA98D5gPuA/AD6wPdA8wDvQOxA6MDigNfAx4DzgKAAkkCNgJJAn0CwwIIA0EDaQN3A4EDiAOVA6QDqgOfA3UDNgPjApQCUQIvAi4CVgKVAt4CHANRA3IDkQO6A/MDPwSaBPkEQQVxBXkFaQVKBTEFIwUUBQQF3gSqBGkEJATvA9UD3AMFBEcEjATEBOIE7gTjBNEExwS9BLMEpgSBBEkE/AOlA10DLgMmAz8DcwOyA+MDAQQPBBAEBQT/AwAEBwT9A+UDrwNgAwgDtQJ4AmMCcAKXAswCBAMyA04DYwN2A5gD1AMpBIQE2QQeBT0FPAUiBQMF5gTOBLoEnwRwBCkE1AOBA0gDNQNIA3kDuwP0AyMEOgQ+BDoEMgQsBCIEGgQNBPYD3QPCA60DlgOBA24DXQNKAzwDMAMnAx0DEAMBA/IC3gLMArwCqwKdAo0CfQJvAmMCWgJQAkkCPgIzAioCIAIUAgkC/gHtAdoBygG6AawBowGaAZMBjgGJAYYBggF9AXYBbAFfAVEBPwExASQBEgH+AOoA3ADKAMMAvQC3ALUArQCmAJ4AlACGAHMAWQA5ABwAAgDl/8P/k/9U/wX/sP5q/kf+S/5x/rL+8f4j/z3/Qv9B/z3/Q/9O/1L/Q/8a/9n+fv4f/s79kP1s/Vn9RP0j/e38pfxW/Bf88fv0+xj8UfyW/M/8/vwX/Sb9M/0+/Uz9V/1m/W39bf1m/Vf9Rv0y/SH9Ev0E/fD80Pyg/GP8Ivzr+8v7z/v5+z38iPzH/O38/PwB/QT9Ev0o/T39Q/0r/fj8qvxX/AT8yful+5D7ffth+zf7//rC+o/6dvqE+rb6Bvth+7n7/vsp/Dz8RvxG/E38Vvxc/FD8NvwA/Lr7d/tO+0b7Z/un+/37UfyU/ML83fzy/Ar9KP1F/Vr9Vf0v/e78m/xK/Ab82vvD+7/7uPul+3z7Q/sM++z66PoI+0n7mvvt+zP8Z/yD/Jb8ovyz/Mv85vz//Bf9K/04/UP9Sf1T/WH9cP2B/X/9Z/07/f/8v/yM/Gr8Yfxo/HD8ZfxF/BP81/ur+6T7vfv5+0r8nvzr/Cb9Uf1x/Yv9pP3A/d79+v0S/iL+Lf4x/jP+M/47/kT+Sf5G/i3+/v3A/YD9TP0u/Sf9Lv0x/SH9+vzC/IX8VvxD/FX8i/za/DX9iP3K/ff9Ff4r/kX+av6P/qz+rf6O/lP+Cf7D/ZL9d/1t/Wj9Wf07/Q793Pyz/KH8r/zi/DT9lv31/Ub+f/6e/q3+tv7B/tP+4f7j/s/+ov5p/i3+B/4B/h/+X/60/g//YP+c/8X/4//+/yEASQBvAIEAeABPAA4Ayv+L/2P/Vf9T/1H/Rv8l//X+w/6f/pj+tv72/k7/rv8CAEYAeQCcALkA1gD1ABMBNAFMAWUBeAGJAZoBqgHAAdYB7AH5AfQB1wGoAXIBQwEmASEBMAE9ATwBIwH1AL0AlQCIAKMA4wA6AZgB8gFAAn4CsALaAv4CJQNQA3kDnAO4A80D3gPpA/YDCgQgBDkETgRQBEEEIQT4A9kD0APdA/gDEQQUBPkDyQOJA1QDOAM6A08DagN3A3ADVAMnA/wC3ALRAt4C9gIMAxED+QLGAoQCSgImAiMCNwJTAmMCWwI8AhIC7AHRAckBzwHdAekB5wHTAaEBVwH8AKEAUwAgAAQA+//y/9f/rf98/1L/Rf9Y/4H/q//F/8L/pf98/1r/Tf9b/33/pv/F/8v/vf+b/3r/Z/9s/4f/tv/j/wIACAD5/9n/u/+v/7//5/8aAEkAXQBVADoAGAAJABgAQwB5AK0AywDRAMMArQCXAJMApADHAPYAIgFDAU0BQAEnARcBJgFkAc0BSgLBAhoDSQNYA1sDaAOKA74D9wMpBEUEQgQgBOsDrgN2A1EDQgNGA1YDYgNdA0wDNwMxA0gDegO+AwEELgQ9BDAEGgQOBBsEQQR2BKsE0ATbBNMEvgSwBLUEzQT3BCgFUwVxBXsFbgVLBRcF3QSqBIUEeQR5BHkEZQQ3BO8DogNjA0IDQwNYA2sDcQNjA0sDOQM4A00DcwOfA8ADzQO/A5gDYgMkA/IC1ALKAtMC3gLdAs4CtwKjAqICvALqAiMDUwNuA28DVwMpA/QCxQKmApwCoAKjApkCfAJQAioCGwIxAmQCpQLdAvsCAAP3Au8C8gIJAywDUQNqA3UDawNIAwwDvwJyAjgCGQIWAiECKQIhAgcC6gHYAdsB9QEaAjoCSgJBAh0C3QGOAUEB/gDTAMUAxwDIALcAkQBkAEYARQBjAJAAtwDEALAAgwBLABEA1f+M/zP/0/57/j3+GP4G/vb92f2u/YH9Zf1n/YX9t/3u/SH+Tv51/pr+wf7m/gn/J/8+/07/T/8//xf/2f6O/kP+Af7Q/bf9tP3C/dj97P3u/d79vv2a/Yb9if2k/cz96P3s/dD9of1t/UT9Mv02/Ur9ZP2C/aP9w/3j/QP+J/5O/nv+pv7E/sr+tP6E/kf+Cv7b/bX9k/1j/R/9xfxi/Ab8w/uh+5n7ovuw+7r7svuW+2n7MPv3+sf6rPqm+qz6s/qr+ov6V/ob+uz53/n7+T/6lvrf+gf7BPvd+qr6gfp0+oH6mfqm+pb6Zvog+tn5p/mU+Zv5r/m5+bD5jvlY+Rv54vi6+KP4oPim+Kv4o/iG+FT4F/jo99X37Pcs+ID4zfj5+Pj40vid+Hf4bPh7+JX4nfiF+E74B/jD95L3ffd894X3j/eY95/3qve598735/cA+Bv4NfhM+GH4c/iK+K745fg2+Zf59/lK+ob6sPrU+gL7R/uk+wz8bfy1/N383/zB/JL8Xfwx/Bn8Fvwk/Dn8Tvxd/Gv8iPzB/Br9j/0J/nL+u/7h/vL+Bf8r/2r/s//y/w8AAgDU/5r/cP9r/5L/3f85AJEA1wAJASwBSgFrAZgBzwEMAkwCgwKoArEClwJhAhoC1gGmAZMBmQGlAakBngGKAXsBhwGzAfQBNQJcAl0CPQIPAu4B6AEFAjsCewK0AtkC5gLXAq8CdQI1AvoB0QG7AbUBswGtAZ8BkQGRAaoB3gEnAngCvwLzAhIDIQMsAz4DXgOPA8kDAgQmBCcEAwTEA4EDVQNPA3ADqQPgAwIEBgT5A+0D9wMeBF8EqATpBBQFKgUyBTcFQwVfBYwFwwX6BSQGNgYoBvkFsgVhBRgF3gS5BKQElASDBGwEVgRIBFMEewS8BAgFSwV2BYIFdwVpBWkFfQWhBcAFxAWjBV0FBQW3BIkEhQSmBNsEDwUzBUYFRgU+BToFPgVOBWcFgQWXBZ8FkQVrBSsF2gSCBDUEAwTyAwAEGwQqBB8E7gOjA08DBwPcAsgCvgKwApUCbwJNAkICWAKLAsoCAwMhAyUDEgP+AvoCDQMvA1EDWgM9A/sCpQJVAiMCGAIwAl4CiwKsAr4CwgLAAr4CwgLPAukCCwMxA0kDRAMaA88CdwItAgcCCwIrAlACZQJhAkwCNgIwAkMCaQKXAr8C1ALNAqkCawIcAsUBdwE6AREB9QDdAL4AmAB1AGMAbACRAMoABQE2AVUBYwFmAWoBdgGNAa0BzgHkAeUByAGMATsB4wCUAFkANgAlABwAFAAIAPv/8f/z/wQAJABOAHAAfwBwAD4A9v+h/1T/GP/y/tv+yf62/p7+h/54/nn+jP6u/tn+Av8d/x//A//K/oH+Of4B/uD90v3I/bX9lP1t/VL9Uv1y/aX91f3u/ej9xf2Y/XP9X/1a/Vz9V/1F/Sj9CP3s/N382fza/Nv82fzW/Nb83/zz/Az9If0p/ST9F/0R/Rz9Of1d/Xn9ev1d/Sz9+fzY/NP85fz+/BD9Ff0Q/Q/9IP1H/X79t/3i/fb97v3O/aH9cv1L/TP9LP0x/Tv9Q/1G/Uf9T/1l/ZD9y/0N/kn+b/55/mj+RP4a/vb94P3Z/dv93f3d/df90v3W/ev9GP5X/qD+5f4X/y//Kv8R/+v+xP6l/pD+gP5u/lD+IP7g/Zn9WP0s/Rn9If06/Vn9c/2I/Z79uv3j/Rr+WP6N/rH+uP6i/nb+QP4O/ur93P3h/fT9C/4g/jP+SP5l/pL+zv4T/1b/if+g/5r/fP9R/yf/C/8B/wf/F/8r/zv/Sf9Z/3L/m//V/xoAYACYALcAtwCeAHUASgAoABYAEwAYAB0AHwAdAB8ALQBMAH8AvwADATwBXwFnAVYBMgEHAd8AwQCuAKAAjwByAEMACQDM/5f/d/9v/3z/k/+r/7//zf/f//r/JQBdAJkAzADsAPEA2wCzAIQAWgA+ADQAOABDAE4AVQBaAGQAfACnAOMAJQFjAY8BoQGaAX4BVwEuAQsB8wDkANsAzgCzAIkAUgAaAO//2f/b/+z//P8BAP3/9P/3/wwANgBmAIkAkgB+AFkANAAiACwATgB+ALAA2QDxAPkA7wDWALIAiwBqAFYATQBKAEIAKwAAAMj/j/9i/0r/SP9V/2X/c/97/4L/kv+v/97/FgBQAIAAnACfAIwAaQA+ABcA+//s/+T/3f/M/63/fv9I/xf/9f7m/un+9f4A/wb/B/8K/xj/N/9l/5v/zv/y/wEA+//h/7z/lP9y/13/U/9O/0b/MP8J/9j+pP58/mf+Z/53/ov+nf6r/rn+zv7v/h//WP+U/8j/6//4/+3/0P+o/4T/bf9n/27/eP93/2f/Sf8o/xT/Gf87/2//pv/O/9z/z/+v/4n/af9W/1D/T/9L/zz/Hv/1/sn+ov6I/n3+f/6M/pz+rv69/sr+1P7c/uP+6/7z/vj+9f7o/s3+qf6D/mf+W/5i/nb+jv6i/rL+w/7d/gf/Qf+G/8r/AAAjADAAKgAYAAMA8//t//H/+v8AAP7/7P/P/67/lf+J/5H/qP/F/+D/9P8FABkAOgBpAKYA5wAgAUgBWQFVAUEBJgEMAfkA7wDtAO4A7QDkAM8AsACNAHIAaQB8AKcA3wAUATYBPgEwARkBCQEHARUBJgEuASQBBgHdALcAngCYAKQAuQDRAOcA+wARATABWwGSAdIBEgJHAmkCdAJqAlMCOAIiAhQCEAISAhUCEwIJAvQB2QG9AasBrwHKAfcBKwJUAmYCXgJEAiYCEgIQAhkCIAIaAgAC1gGmAX4BZgFfAWUBbwF5AX8BhgGQAaYByAH0AScCVgJ6AosCiAJ0AlUCNgIeAhACDAIKAgMC8QHUAa8BigFuAWIBZQFzAYYBlgGgAakBtgHOAfMBIQJQAncCjgKRAoICZwJGAigCEQIDAvsB8wHkAcgBnwFvAUEBHwEPAQ0BEgEXARcBEwERARgBLAFMAXEBkwGpAa0BoAGEAV0BNAEPAfUA4wDXAMkAsACKAFsAKgACAOv/5P/n/+7/8v/z//P/+f8IACQASABtAI4AoQCiAJAAcABJACUACwD8//T/6//b/77/l/9s/0T/Jv8U/wv/B/8E///+9/7v/uf+4P7c/tn+2P7W/tL+zf7I/sX+yf7X/u7+Cv8k/zT/M/8h/wD/2P6z/pX+gf5y/mT+Tv4t/gL+0v2m/YX9dP1x/Xj9g/2M/ZL9mP2k/bn92f3+/SH+Ov5C/jj+H/7+/d79xf24/bT9t/26/br9uf26/cL91P3z/Rj+P/5e/m/+bf5b/j7+Hv4C/u393/3U/cf9sf2Q/Wn9P/0b/QP9+vz9/Ab9D/0U/Rb9Gv0l/Tv9XP2B/aL9tv25/az9lP16/WX9V/1R/VL9VP1W/Vj9Wv1f/Wb9cP19/Y79oP2y/cP91P3l/fr9FP43/mH+i/6y/s3+2P7T/sX+sv6k/p7+n/6k/qf+oP6O/nP+Vf47/iz+K/41/kX+Vv5l/nH+fv6R/q7+1P78/iH/Of9B/zj/JP8M//f+6P7k/un+8v78/gX/Dv8b/y3/TP90/6T/0v/2/wkADQAFAPn/7v/p/+v/8v/7/wMACwAUACEAMQBGAFwAdACMAKMAuADOAOIA9AAEARIBHQEnATEBOwFFAVABWwFoAXUBhAGTAaEBrwG8AccB0gHbAeMB6QHuAfIB9AH4AfsB/wEEAgoCEgIaAiMCLQI3AkECSgJSAloCYAJmAmoCbgJxAnUCeQJ/AoUCjAKUAp4CqwK7As0C3gLuAvwCCwMeAzcDVwN4A5UDqAOsA6IDkAN8A2wDZQNmA2wDcwN3A3gDeAN7A4UDlwOwA80D5APyA/MD5QPNA7EDmAOEA3cDbQNjA1YDRQM0AykDJwMxA0UDXgN3A4gDkgOVA5cDmwOmA7YDxwPTA9YDzQO2A5YDcQNOAzIDIAMXAxQDFAMTAw8DCwMKAxEDIAM0A0cDUgNRA0EDJgMGA+cCzQK4AqcCmAKJAnkCaAJXAkgCOQItAiICGAINAgIC9gHoAdsB0AHLAcsBzgHPAcgBtQGUAWoBPQESAe4A0gC6AKMAiQBuAFIAOwAtACkALgA3AEAARABCADkALwAmACMAJgAtADIAMAAjAAoA6f/E/6D/gv9r/1r/S/89/y//IP8R/wP/9f7o/tz+0f7G/rv+r/6i/pX+jf6J/or+kP6U/pL+hP5q/kb+Hf71/dL9tf2d/YX9a/1P/TP9Gv0J/QP9Bf0N/RT9F/0T/Qr9//z0/O/87vzv/O/86PzZ/MH8oPx7/Fj8Ovwm/Br8FPwQ/Az8BvwA/P37//sI/Bb8Jfww/DL8Kvwa/AT87fva+877yPvH+8f7xPu/+7r7uPu8+8r73fvx+wP8DfwQ/BD8EfwV/CD8Lfw5/EL8RvxC/Db8JfwO/PX73/vS+8/71fvf++b75PvZ+8n7ufuv+677svu4+7n7t/uy+7L7uPvH+9379vsN/B/8Lvw8/Ev8X/x3/JL8rvzH/Nv85/zp/OX83vzX/NX82Pzi/O78+/wI/RT9Iv0z/Ur9Zf2B/Zz9sf29/cD9vP20/av9pP2h/aL9pv2q/a39r/2z/bz9y/3f/fj9D/4i/i/+N/49/kT+Tv5b/mr+ef6G/pD+lv6Z/pn+l/6V/pj+of6y/sf+3P7t/vX++P73/vj+//4L/xz/Lf87/0j/Vf9m/3z/l/+1/9H/6v/+/w0AGwAqADsATgBjAHcAiACWAJ4AoACfAJsAmQCYAJsAoAClAKgAqQCqAKsArwC3AMIAzgDZAOAA5ADhANsA0wDLAMYAwwDBAMAAvgC6ALcAtgC4AMAAzQDdAO0A+wAHAREBGgEkATABPgFMAVgBYQFmAWYBYwFeAVoBWQFbAWEBaQFyAXoBggGJAZEBmgGkAbABugHBAcQBwQG7AbMBqgGiAZ0BmgGYAZYBkwGPAYoBhwGGAYcBiQGLAYsBhwGCAXsBdQFxAW4BbQFtAW0BagFlAVwBUQFEATkBLwEnASEBHAEXAREBCwEGAQUBBwEMARIBFgEXARYBEwERAREBEwEYAR0BIQEiASIBIAEcARcBEgEOAQwBDAEMAQ0BDAELAQcBBQEDAQIBAwEDAQMBAAH7APYA8QDuAOwA6gDpAOYA4gDcANIAxwC5AKwAnwCUAIsAgwB7AHMAawBkAF8AXgBeAF8AXwBcAFgAUgBOAEsASQBKAEsATABNAE0ATQBNAEwASwBMAE4AUQBWAFoAXQBfAGEAYgBlAGkAbgByAHcAfAB/AIIAhQCJAI0AkgCXAJoAnACbAJgAkwCNAIYAgAB7AHcAdABxAG8AbQBrAGoAagBrAGwAbQBtAGsAZwBiAF0AVwBTAFAATgBNAE0ATgBPAFIAVgBbAGAAZwBtAHMAdwB6AHwAfgCAAIIAhQCKAI4AlACaAKAApwCuALYAvwDHAM8A1gDcAOEA5ADoAOsA7gDyAPUA+QD7AP0A/wAAAQEBAQECAQIBAgECAQEBAAH+APsA+QD4APcA9gD2APUA9QD0APMA8gDxAPAA7wDvAO4A7QDsAOsA6gDqAOsA7ADuAPEA9AD3APkA/AD/AAEBBAEGAQgBCgEMAQ0BDgEQAREBEwEWARkBHAEeASEBIwEkASUBJQElASQBIwEhAR8BHAEZARYBEwEQAQ4BDAEJAQcBBAEBAf0A+QD1APAA6wDmAOAA2gDUAM8AyQDEAMAAvAC4ALUAsgCvAKwAqAClAKIAngCaAJcAkwCPAIsAiACEAIIAfwB9AHsAeQB3AHUAdABxAG8AbABqAGYAYwBgAFwAWQBWAFIATwBMAEkARgBDAD8APAA4ADUAMQAtACkAJQAhAB0AGQAWABMADwAMAAkABwAEAAIAAAA=","pocket":"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d/+F/5r/pv+m/5z/of+t/8v/7f/0/wAADgAaAEAAaACBAJEAuwDyAAsBNgFtAXsBkQHEAfMBAAICAhoCGgIOAhwCGAL9AegB6gHqAdIBxQHBAcMB1wHdAekB/gH0AeUB6AH7AQEC/gEMAgEC5QHfAdsB0QHFAcoB1QG7Aa0BsQGeAYwBgwFwAU4BPAE/ASwBIQEuAS0BLwEwAS8BNQEtASMBFQECAfUA3wC/AJIAZQBMADUALAAjAAMA7v/b/8X/vf+u/5f/gv+B/5X/r//Y/wAAJQBSAGkAiQDDAPEAFAE1AVUBWwFJAVcBdwGSAbcB3QH9ARsCSwKDAp0CtwLHAroCuALAAscCzwLUAuEC8wIFAwUD8gL6Ag4DGAMmAx8D/QLWAtAC4ALTAsgCywKtAo8CmAKWAmgCQwJCAiwCGAIqAiMCFQI/AnoCmAKiAq8CrAKoAq4ClAJtAmMCTgInAhgCFgLqAasBlgGJAWsBXwFUAT0BPAFJAUEBLwEwASUBAQHuAOgAzgCuAKIAsgDRAPYAHQE6AVoBfwGaAbgB1gHbAd4B/QEbAhYCEAIOAukBwQHAAb8BrQGqAbUBtgGxAbMBsQGvAcIB2gHYAcoBxQG0AZUBjAGYAZwBrAHNAeQBAQItAkwCZgKRArMCwALPAtsC0QLKAtACvwKgAooCeAJgAk0CUwJbAkgCNAI0AkMCUQJOAkkCPgIrAiACJgI0AioCGAIfAiICFwIQAgcC8gHdAd8B5QHSAc4B3AHYAcUBsQGhAYoBcwFZATYBNAFMAVUBcgGbAaYBowGqAa4BpAGuAcIBtQGpAawBqQGkAY0BdgF2AYQBlAGSAY8BkAF6AVUBKwEJAfAA2QDWAMkApACOAHUAWwBXAF0AWQBIAEYATQBLAFcAXwBaAFcAUQBVAFkAVgBeAGAAYgBcAEgARgBQAF8AcgCNALwA3QD0ABYBGwH8AM4ArgCaAHwAaABYADsAIgAVACIAQgBVAF0AYgBoAHIAigCxALkArgC3ALMApQC1AN4AAAEXATkBVAFcAWMBXgFNATkBGQH1ANcAtwCMAGcAYABgAFsAbACDAIUAgQCMAJgAmgCiAKkAogCkALQAvAC8ALsAvQDGANgA4wDkAOoAAQEYAR4BJwE+AVkBcQGAAYYBjQGbAasBrwG2AbsBsAGnAZsBfwFaASwBAwHeALYA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GgMtAz8DTQNaA2oDcgNvA2gDYQNVA0cDNwMgAwsD/QLxAuAC0QLEArkCsAKlApMCewJiAkwCPQIwAh4CBgLrAc8BtQGcAYQBbQFQASwBCAHpANMAxwDGAMwA1wDnAP8AGAEmATEBQQFPAVUBVQFPAUIBNAElARYBBwH7APEA7ADpAOMA3wDfAOMA5ADlAOoA9wAEAQsBDQEJAfkA3gC+AJgAcABKACsAFAAHAP//9//1//f//f8HABEAFQAVAA0A+P/a/7n/lv9x/1H/Of8r/y3/Pv9d/4L/rf/d/w0AOQBgAIAAlgCmALMAvADCAMgA0QDaAOQA8wAIASIBOgFRAW0BjQGrAcMB2AHsAQECFAIgAiQCIgIbAg4C/gHrAdQBvwG0AboBygHbAesB/QEMAhMCFQITAgYC8QHZAb0BngGFAXUBZgFZAU4BQwE7ATgBNgEyASwBJgEfARYBDQEDAfwA+QD7AAIBDgEcASgBNgFJAV8BcwGFAZgBqwG5Ab8BvgG2Aa8BqwGpAaoBrAGvAbUBwAHLAdEB1QHXAdUBzQG/Aa4BnQGLAXcBYAFIATIBHQEKAfsA6gDZAM0AxgDDAMcAzwDWAN0A5QDrAO4A8ADrAN0AyQCvAI4AbwBTADsALAAmACEAHQAaABMAEQAYACMAKQAtADEANAA2ADsAQQBGAEoATQBMAEkASQBIAEMAPgA5ADEAKwApACgAKAAoACYAIAAeACIAJgAqAC4AMwA7AEcAUwBaAFwAVgBHADUAJgAaAA8ACAAFAAcACwAUACIANgBMAGUAfACMAJYAngCkAKIAnQCXAJAAigCIAIYAgwCAAH4AfgCEAI4AmwCmAK8AuAC/AMUAzADTANgA2wDdAN8A3wDjAOkA8AD1APgA9gDwAOoA5ADdANkA1wDUANAAzwDRANMA0wDYAN8A5gDrAPAA9AD2APUA7gDjANoA1gDUANMAzwDIAMIAvwC/AMMAzADXAOAA6ADxAPcA+wD7APkA9QDuAOkA5gDkAOAA3ADXANIAzgDKAMYAwQDAAL8AvAC4ALMArAClAJ0AlACNAIcAggB9AHYAawBhAFcATQBDADoALwAlABwAFAAMAAYA/v/1/+v/4f/W/8z/xP+8/7b/sP+r/6f/pP+k/6b/rP+y/7r/wv/K/9L/2f/f/+X/6//v//L/9f/3//r//f///wAAAQABAAEAAQADAAMAAQAAAP7///8BAAUACgAPABMAFwAbAB0AHgAeAB0AGwAYABUAEQANAAkABwAGAAYABgAFAAQABAAEAAQABAADAAIAAQAAAP7//P/7//v/+v/5//f/9f/z//H/8P/u/+3/7P/r/+v/6v/q/+n/6f/p/+j/5//m/+X/5f/l/+T/4//i/+H/4f/i/+L/4v/j/+P/4v/i/+P/4//k/+T/5f/m/+f/6P/q/+v/7f/v//D/8v/z//T/9f/2//f/9//4//n/+f/6//r/+//8//3//v/+////AAA="};

  class SoundKit {
    constructor(muted) {
      this.muted = muted;
      this.ctx = null;
      this.master = null;
      this.samples = new Map();
      this.loading = null;
      this.loadFailed = false;
    }
    unlock() {
      if (this.muted) return;
      try {
        if (!this.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.22;
          this.master.connect(this.ctx.destination);
        }
        this.loadSamples();
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      } catch {
        this.ctx = null;
      }
    }
    loadSamples() {
      if (!this.ctx || this.loading || this.loadFailed || !AUDIO_DATA) return this.loading;
      this.loading = (async () => {
        for (const [name, encoded] of Object.entries(AUDIO_DATA)) {
          const binary = atob(encoded);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const buffer = await this.ctx.decodeAudioData(bytes.buffer);
          this.samples.set(name, buffer);
        }
      })().catch((error) => {
        this.loadFailed = true;
        console.warn('[dsh-billiards] audio decode failed:', error);
      });
      return this.loading;
    }
    setMuted(muted) {
      this.muted = muted;
      if (this.master) this.master.gain.value = muted ? 0 : 0.22;
      if (!muted) this.unlock();
    }
    playSample(name, { gain = 0.5, rate = 1, lowpass = 0, highpass = 0 } = {}) {
      if (this.muted || !this.ctx) return false;
      const buffer = this.samples.get(name);
      if (!buffer) return false;
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        const amp = this.ctx.createGain();
        amp.gain.value = gain;
        let node = source;
        if (lowpass > 0) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = lowpass;
          filter.Q.value = 0.5;
          node.connect(filter);
          node = filter;
        }
        if (highpass > 0) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = highpass;
          filter.Q.value = 0.5;
          node.connect(filter);
          node = filter;
        }
        node.connect(amp).connect(this.master);
        source.start(this.ctx.currentTime);
        return true;
      } catch {
        return false;
      }
    }
    blip(freq, duration, gain, type = 'sine') {
      if (this.muted) return;
      this.unlock();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + duration);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(amp).connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }
    click(speed) {
      if (this.muted) return;
      this.unlock();
      const strength = clamp(speed / 1100, 0.05, 1);
      const soft = speed < 170;
      const rate = 0.93 + Math.random() * 0.14;
      const gain = (soft ? 0.34 : 0.52) * (0.28 + strength ** 0.72);
      const played = this.playSample(soft ? 'clickSoft' : 'click', {
        gain,
        rate,
        lowpass: soft ? 5200 : 9000,
      });
      return played;
    }
    rail(speed) {
      if (this.muted) return;
      this.unlock();
      const strength = clamp(speed / 1000, 0.04, 1);
      this.playSample('rail', {
        gain: 0.28 + strength * 0.42,
        rate: 0.92 + Math.random() * 0.08,
        lowpass: 1800,
      });
    }
    pocket() {
      if (this.muted) return;
      this.unlock();
      this.playSample('pocket', {
        gain: 0.6,
        rate: 0.96 + Math.random() * 0.06,
        lowpass: 7200,
      });
    }
    cue(power) {
      if (this.muted) return;
      this.unlock();
      this.playSample('cue', {
        gain: 0.42 + power * 0.24,
        rate: 0.97 + Math.random() * 0.03,
        lowpass: 6200,
      });
    }
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 0.05, 'sine'), i * 110));
    }
    lose() {
      [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.4, 0.045, 'triangle'), i * 130));
    }
    ui() {
      this.blip(820, 0.04, 0.025, 'sine');
    }
  }

  class BilliardsGame {
    constructor(host) {
      this.host = host;
      this.prefs = loadPrefs();
      this.audio = new SoundKit(this.prefs.muted);
      this.isOpen = false;
      this.destroyed = false;
      this.passive = false;
      this.balls = [];
      this.players = [{ group: null }, { group: null }];
      this.current = 0;
      this.phase = 'aiming';
      this.gameOver = false;
      this.result = null;
      this.ballInHand = false;
      this.isBreak = true;
      this.hasStarted = false;
      this.shot = null;
      this.power = 0;
      this.charging = false;
      this.aimAngle = 0;
      this.spinX = 0;
      this.spinY = 0;
      this.spinDragging = false;
      this.pointer = { x: 0, y: 0, inside: false };
      this.ghostCue = null;
      this.aiPlan = null;
      this.aiActionAt = 0;
      this.accum = 0;
      this.lastTs = 0;
      this.resolveAt = 0;
      this.particles = [];
      this.animations = [];
      this.previousFocus = null;
      this.raf = null;
      this.toastTimer = null;
      this.resizeObserver = null;
      this.abort = new AbortController();
      this.themeObserver = null;
      this.desktopChromeBackup = null;
      this.geo = null;
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.lastCollisionSound = 0;
      this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

      this.buildDom();
      this.bind();
      this.applyTheme();
      this.resize();
      this.newRack({ silent: true });
      this.applyPrefsToUI();
      this.attachDebug();
    }

    buildDom() {
      this.host.innerHTML = TEMPLATE;
      this.launcher = this.host.querySelector('.dsh-bil-launcher');
      this.stage = this.host.querySelector('.dsh-bil-stage');
      this.canvas = this.host.querySelector('.dsh-bil-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.staticCanvas = document.createElement('canvas');
      this.staticCtx = this.staticCanvas.getContext('2d');
      this.refs = {
        turn: this.stage.querySelector('.dsh-bil-turn'),
        turnKicker: this.stage.querySelector('.dsh-bil-turn-kicker'),
        turnStrong: this.stage.querySelector('.dsh-bil-turn strong'),
        turnSmall: this.stage.querySelector('.dsh-bil-turn small'),
        human: this.stage.querySelector('.dsh-bil-player[data-side="human"]'),
        ai: this.stage.querySelector('.dsh-bil-player[data-side="ai"]'),
        humanSide: this.stage.querySelector('.dsh-bil-player[data-side="human"] .dsh-bil-player-side'),
        aiSide: this.stage.querySelector('.dsh-bil-player[data-side="ai"] .dsh-bil-player-side'),
        humanPips: this.stage.querySelector('.dsh-bil-player[data-side="human"] .dsh-bil-pips'),
        aiPips: this.stage.querySelector('.dsh-bil-player[data-side="ai"] .dsh-bil-pips'),
        humanWins: this.stage.querySelector('.dsh-bil-human-wins'),
        humanLosses: this.stage.querySelector('.dsh-bil-human-losses'),
        power: this.stage.querySelector('.dsh-bil-power'),
        powerLabel: this.stage.querySelector('.dsh-bil-power-label'),
        hintMain: this.stage.querySelector('.dsh-bil-hint-main'),
        hintSub: this.stage.querySelector('.dsh-bil-hint-sub'),
        toast: this.stage.querySelector('.dsh-bil-toast'),
        result: this.stage.querySelector('.dsh-bil-result'),
        resultTitle: this.stage.querySelector('#dshBilResultTitle'),
        resultCopy: this.stage.querySelector('.dsh-bil-result-copy'),
        resultWins: this.stage.querySelector('.dsh-bil-result-wins'),
        resultLosses: this.stage.querySelector('.dsh-bil-result-losses'),
        resultStreak: this.stage.querySelector('.dsh-bil-result-streak'),
        sr: this.stage.querySelector('.dsh-bil-sr'),
      };
      this.refs.mute = this.stage.querySelector('[data-act="mute"]');
      this.refs.guide = this.stage.querySelector('[data-act="guide"]');
      this.refs.focus = this.stage.querySelector('[data-act="focus"]');
      this.spinPanel = this.stage.querySelector('.dsh-bil-spin-panel');
      this.spinBall = this.stage.querySelector('.dsh-bil-spin-ball');
      this.spinDot = this.stage.querySelector('.dsh-bil-spin-dot');
      this.spinName = this.stage.querySelector('.dsh-bil-spin-name');
      this.refs.mute.innerHTML = ICONS.soundOn;
      this.refs.guide.innerHTML = ICONS.guide;
      this.refs.focus.innerHTML = ICONS.eye;
      this.stage.querySelector('[data-act="new"]').innerHTML = ICONS.reset;
      this.stage.querySelector('[data-act="pass"]').innerHTML = ICONS.pass;
      this.stage.querySelector('[data-act="close"]').innerHTML = ICONS.close;
      this.launcherCopyB = this.launcher.querySelector('.dsh-bil-launcher-copy b');
      this.launcherCopySmall = this.launcher.querySelector('.dsh-bil-launcher-copy small');
    }

    bind() {
      const signal = this.abort.signal;
      this.launcher.addEventListener('click', () => {
        if (this.isOpen && this.passive) this.setPassive(false);
        else this.open();
      }, { signal });
      this.stage.addEventListener('pointerdown', (e) => this.onPointerDown(e), { signal });
      this.stage.addEventListener('pointermove', (e) => this.onPointerMove(e), { signal });
      this.stage.addEventListener('pointerup', (e) => this.onPointerUp(e), { signal });
      this.stage.addEventListener('pointercancel', (e) => this.cancelCharge(e), { signal });
      this.stage.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.cancelCharge(e);
      }, { signal });
      this.stage.addEventListener('wheel', (e) => e.preventDefault(), { passive: false, signal });
      window.addEventListener('keydown', (e) => this.onGlobalKeyDown(e), { capture: true, signal });
      window.addEventListener('keyup', (e) => this.onKeyUp(e), { capture: true, signal });
      window.addEventListener('resize', () => this.onResize(), { signal });
      window.addEventListener('blur', () => this.cancelCharge(), { signal });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.cancelCharge();
      }, { signal });
      this.stage.querySelectorAll('button').forEach((button) => {
        button.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onAction(button.dataset.act);
        }, { signal });
      });
      this.spinPanel.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
      this.spinBall.addEventListener('pointerdown', (e) => this.onSpinPointerDown(e), { signal });
      this.spinBall.addEventListener('pointermove', (e) => this.onSpinPointerMove(e), { signal });
      this.spinBall.addEventListener('pointerup', () => { this.spinDragging = false; }, { signal });
      this.spinBall.addEventListener('pointercancel', () => { this.spinDragging = false; }, { signal });
      this.spinBall.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setSpin(0, 0);
        this.toast('击球点回中：中杆', 'good', 1100);
      }, { signal });
      this.spinBall.addEventListener('keydown', (e) => this.onSpinKeyDown(e), { signal });
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.host);
      }
      if (typeof MutationObserver !== 'undefined') {
        this.themeObserver = new MutationObserver(() => this.applyTheme());
        this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class'] });
      }
    }

    applyTheme() {
      if (!this.stage) return;
      const dark = document.body.hasAttribute('data-ds-dark-theme') || document.documentElement.classList.contains('dark');
      this.stage.dataset.bilTheme = dark ? 'dark' : 'light';
    }

    /**
     * The Windows Electron shell paints its native caption buttons from two
     * CSS custom properties. While the game is open, make the titlebar
     * background transparent and mute the symbols so the native minimize /
     * maximize / close controls belong to the table instead of floating over
     * it. Both properties are restored on close.
     */
    syncDesktopChrome(active) {
      const available = document.documentElement.hasAttribute('data-windows-titlebar') && document.body;
      this.host.dataset.desktopChrome = String(Boolean(available));
      if (!available) return;
      if (active) {
        if (!this.desktopChromeBackup) {
          const read = (name) => ({
            value: document.body.style.getPropertyValue(name),
            priority: document.body.style.getPropertyPriority(name),
          });
          this.desktopChromeBackup = {
            fill: read('--dsw-specific-sidebar-fill'),
            label: read('--dsw-alias-label-primary'),
          };
        }
        document.body.style.setProperty('--dsw-specific-sidebar-fill', 'rgba(0,0,0,0)', 'important');
        document.body.style.setProperty('--dsw-alias-label-primary', 'rgb(110, 126, 119)', 'important');
      } else if (this.desktopChromeBackup) {
        const restore = (name, saved) => {
          if (saved.value) document.body.style.setProperty(name, saved.value, saved.priority);
          else document.body.style.removeProperty(name);
        };
        restore('--dsw-specific-sidebar-fill', this.desktopChromeBackup.fill);
        restore('--dsw-alias-label-primary', this.desktopChromeBackup.label);
        this.desktopChromeBackup = null;
      }
    }

    onAction(action) {
      if (action === 'close') this.close();
      else if (action === 'new') this.newGame();
      else if (action === 'pass') this.setPassive(true);
      else if (action === 'mute') {
        this.prefs.muted = !this.prefs.muted;
        this.audio.setMuted(this.prefs.muted);
        this.savePrefs();
        this.updateHud();
        this.toast(this.prefs.muted ? '静音了。' : '声音回来了。', 'good', 1200);
      } else if (action === 'guide') {
        this.prefs.guide = !this.prefs.guide;
        this.savePrefs();
        this.updateHud();
      } else if (action === 'focus') {
        this.prefs.clarity = (this.prefs.clarity + 1) % 3;
        this.savePrefs();
        this.applyPrefsToUI();
        this.updateHud();
        const label = ['透视', '标准', '专注'][this.prefs.clarity];
        this.toast(`背景：${label}`, this.prefs.clarity === 2 ? 'ai' : 'good', 1200);
      }
    }

    applyPrefsToUI() {
      this.stage.dataset.clarity = String(this.prefs.clarity);
      const labels = ['透视', '标准', '专注'];
      this.refs.mute.innerHTML = this.prefs.muted ? ICONS.soundOff : ICONS.soundOn;
      this.refs.mute.setAttribute('aria-pressed', String(this.prefs.muted));
      this.refs.mute.setAttribute('aria-label', this.prefs.muted ? '取消静音' : '静音');
      this.refs.guide.setAttribute('aria-pressed', String(this.prefs.guide));
      this.refs.focus.setAttribute('aria-pressed', String(this.prefs.clarity === 2));
      this.refs.focus.innerHTML = this.prefs.clarity === 2 ? ICONS.eyeOff : ICONS.eye;
      this.refs.focus.setAttribute('aria-label', `背景：${labels[this.prefs.clarity]}`);
      this.refs.focus.title = `背景：${labels[this.prefs.clarity]}（点击切换）`;
    }

    savePrefs() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
      } catch {
        /* localStorage may be disabled; the table still works. */
      }
    }

    open() {
      if (this.destroyed || this.isOpen) return;
      this.isOpen = true;
      this.passive = false;
      this.hasStarted = true;
      this.previousFocus = document.activeElement;
      this.host.dataset.open = 'true';
      this.stage.hidden = false;
      this.stage.dataset.passive = 'false';
      this.setLauncherReturn(false);
      this.stage.setAttribute('aria-hidden', 'false');
      this.launcher.setAttribute('aria-expanded', 'true');
      this.syncDesktopChrome(true);
      this.audio.unlock();
      this.audio.ui();
      this.resize();
      this.updateHud();
      this.stage.focus({ preventScroll: true });
      this.lastTs = 0;
      this.accum = 0;
      this.pauseAi();
      if (this.phase === 'settling' && this.allStopped()) this.resolveAt = performance.now() + 80;
      if (this.phase === 'ai-aiming') {
        this.phase = 'ai';
        this.aiPlan = null;
      }
      this.aiActionAt = performance.now() + 600;
      if (this.gameOver) this.refs.result.hidden = false;
      this.startLoop();
      this.showIntroOnce();
    }

    showIntroOnce() {
      if (this.introShown) return;
      this.introShown = true;
      setTimeout(() => {
        if (!this.isOpen || this.destroyed) return;
        this.toast('整张 Harness 就是球桌。按住蓄力，松开击球；Alt+H 可直接操作 Harness。', 'good', 3800);
      }, 500);
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.passive = false;
      this.cancelCharge();
      this.pauseAi();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.host.dataset.open = 'false';
      this.stage.dataset.passive = 'false';
      this.setLauncherReturn(false);
      this.stage.hidden = true;
      this.stage.setAttribute('aria-hidden', 'true');
      this.launcher.setAttribute('aria-expanded', 'false');
      this.syncDesktopChrome(false);
      this.refs.result.hidden = true;
      this.updateLauncherState();
      if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
        try { this.previousFocus.focus({ preventScroll: true }); } catch { /* noop */ }
      }
    }

    setPassive(active) {
      if (this.destroyed || !this.isOpen) return;
      const next = Boolean(active);
      if (next === this.passive) return;
      this.passive = next;
      if (next) {
        this.cancelCharge();
        this.pauseAi();
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
        this.lastTs = 0;
        this.accum = 0;
        this.stage.dataset.passive = 'true';
        this.stage.setAttribute('aria-hidden', 'true');
        this.setLauncherReturn(true);
        this.syncDesktopChrome(false);
        this.stage.blur();
        try {
          let target = this.previousFocus;
          if (!target || !target.isConnected || (target.closest && target.closest('.dsh-bil-host'))) {
            target = document.querySelector('textarea, input:not([type="hidden"]), [contenteditable="true"]');
          }
          if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
        } catch { /* noop */ }
      } else {
        this.stage.dataset.passive = 'false';
        this.stage.setAttribute('aria-hidden', 'false');
        this.setLauncherReturn(false);
        this.syncDesktopChrome(true);
        this.resize();
        this.updateHud();
        if (this.gameOver) this.refs.result.hidden = false;
        this.stage.focus({ preventScroll: true });
        this.lastTs = 0;
        this.accum = 0;
        this.startLoop();
      }
    }

    pauseAi() {
      this.aiActionAt = 0;
    }

    onGlobalKeyDown(e) {
      if (this.destroyed) return;
      if (this.isOpen && e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        e.stopPropagation();
        this.setPassive(!this.passive);
        return;
      }
      if (this.passive) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
        return;
      }
      if (this.isOpen) this.onKeyDown(e);
    }

    onKeyDown(e) {
      const inEditable = e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!this.refs.result.hidden) {
          this.refs.result.hidden = true;
          this.updateHud();
        } else this.close();
        return;
      }
      if (inEditable) return;
      if (e.target && e.target.closest && e.target.closest('.dsh-bil-spin-ball')
        && (e.key.startsWith('Arrow') || e.key === 'Home')) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (this.canHumanShoot()) this.beginCharge();
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        this.onAction('guide');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.onAction('mute');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.newGame();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (this.canHumanShoot()) {
          this.aimAngle += (e.shiftKey ? 0.0015 : 0.008) * (e.key === 'ArrowLeft' ? -1 : 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.canHumanShoot()) {
          this.aimAngle = clamp(this.aimAngle + (e.shiftKey ? 0.02 : 0.06) * (e.key === 'ArrowDown' ? 1 : -1), -Math.PI, Math.PI);
        }
      }
    }

    onKeyUp(e) {
      if (!this.isOpen || this.passive) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (this.charging) this.releaseCharge();
      }
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    canHumanShoot() {
      return this.isOpen && !this.gameOver && this.current === 0 && !this.ballInHand && this.phase === 'aiming' && !this.charging;
    }

    onPointerDown(e) {
      if (!this.isOpen || e.button !== 0) return;
      if (this.gameOver) return;
      this.audio.unlock();
      if (this.ballInHand && this.current === 0) {
        e.preventDefault();
        this.tryPlaceCue(e);
        return;
      }
      if (!this.canHumanShoot()) return;
      e.preventDefault();
      this.updateAimFromEvent(e);
      this.beginCharge();
      try { this.stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }

    onPointerMove(e) {
      if (!this.isOpen) return;
      if (!this.charging && e.target && e.target.closest && e.target.closest('.dsh-bil-layer')) return;
      this.updateAimFromEvent(e);
      if (this.ballInHand && this.current === 0) this.updateGhostCue(e);
    }

    onPointerUp(e) {
      if (!this.isOpen) return;
      if (this.charging) {
        e.preventDefault();
        this.releaseCharge();
      }
    }

    updateAimFromEvent(e) {
      const cue = this.cueBall();
      if (!cue || !cue.active) return;
      const rect = this.stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.pointer = { x, y, inside: true };
      if (this.current !== 0 || this.gameOver || this.ballInHand || this.phase !== 'aiming') return;
      const dx = x - cue.x;
      const dy = y - cue.y;
      if (hypot(dx, dy) > this.geo.r * 1.2) this.aimAngle = Math.atan2(dy, dx);
    }

    beginCharge() {
      if (!this.canHumanShoot()) return;
      this.audio.unlock();
      this.charging = true;
      this.chargeStart = performance.now();
      this.power = 0;
      this.stage.dataset.charging = 'true';
      this.updateHud();
    }

    updateCharge(now) {
      if (!this.charging) return;
      const t = (now - this.chargeStart) / 1000;
      this.power = clamp(t / 1.05, 0, 1);
      this.stage.style.setProperty('--bil-power', this.power.toFixed(4));
      if (this.refs.powerLabel) this.refs.powerLabel.textContent = `${Math.round(this.power * 100)}%`;
      if (this.power >= 1) this.stage.dataset.maxPower = 'true';
      else delete this.stage.dataset.maxPower;
    }

    releaseCharge() {
      if (!this.charging) return;
      const power = Math.max(0.05, this.power);
      this.charging = false;
      this.stage.dataset.charging = 'false';
      delete this.stage.dataset.maxPower;
      this.updateHud();
      this.shoot(this.aimAngle, power);
    }

    cancelCharge(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!this.charging) return;
      this.charging = false;
      this.power = 0;
      this.stage.dataset.charging = 'false';
      delete this.stage.dataset.maxPower;
      this.stage.style.setProperty('--bil-power', '0');
      this.updateHud();
    }

    spinLabel() {
      const parts = [];
      if (this.spinY > 0.12) parts.push('高杆');
      else if (this.spinY < -0.12) parts.push('低杆');
      if (this.spinX > 0.12) parts.push('右塞');
      else if (this.spinX < -0.12) parts.push('左塞');
      return parts.length ? parts.join('') : '中杆';
    }

    setSpin(x, y) {
      const length = hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      this.spinX = clamp(x, -1, 1);
      this.spinY = clamp(y, -1, 1);
      this.applySpinUI();
    }

    applySpinUI() {
      if (!this.spinDot) return;
      const left = 50 + this.spinX * 41;
      const top = 50 - this.spinY * 41;
      this.spinDot.style.left = `${left}%`;
      this.spinDot.style.top = `${top}%`;
      const label = this.spinLabel();
      this.spinName.textContent = label;
      this.spinBall.setAttribute('aria-label', `击球点：${label}。上高杆跟进，下低杆拉回，左右加塞`);
    }

    setSpinFromEvent(e) {
      const rect = this.spinBall.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ny = -((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
      this.setSpin(nx, ny);
    }

    onSpinPointerDown(e) {
      if (!this.isOpen) return;
      e.preventDefault();
      e.stopPropagation();
      this.spinDragging = true;
      try { this.spinBall.setPointerCapture(e.pointerId); } catch { /* noop */ }
      this.setSpinFromEvent(e);
    }

    onSpinPointerMove(e) {
      if (!this.spinDragging) return;
      e.preventDefault();
      this.setSpinFromEvent(e);
    }

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
    }

    updateGhostCue(e) {
      const rect = this.stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const result = this.nearestValidCuePosition(x, y);
      this.ghostCue = { x: result.x, y: result.y, valid: result.valid };
    }

    tryPlaceCue(e) {
      if (!this.ballInHand || this.current !== 0) return;
      const rect = this.stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const result = this.nearestValidCuePosition(x, y);
      if (!result.valid) {
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
      this.ballInHand = false;
      this.ghostCue = null;
      this.phase = 'aiming';
      this.aimAngle = this.defaultAimAngle();
      this.stage.dataset.placing = 'false';
      this.updateHud();
      this.toast('白球放好了，开打。', 'good', 1200);
    }

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
    }

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
    }

    scheduleAI() {
      if (this.current !== 1 || this.gameOver) return;
      this.phase = 'ai';
      this.aiPlan = null;
      this.aiActionAt = performance.now() + 950;
    }

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
    }

    planAIShot() {
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
        let error = (Math.random() - 0.5) * 0.014;
        if (Math.random() < 0.16) error += (Math.random() < 0.5 ? -1 : 1) * rand(0.012, 0.032);
        angle = base + error;
        power = clamp(0.3 + best.pdist / 850 + best.cdist / 2400, 0.32, 0.94);
      } else {
        const target = targets[0] || this.balls.find((b) => b.number === 8 && b.active);
        const cue2 = this.cueBall();
        if (target && cue2) {
          const base = Math.atan2(target.y - cue2.y, target.x - cue2.x);
          angle = base + (Math.random() - 0.5) * 0.05;
          power = target.number === 8 ? 0.7 : 0.52;
        } else {
          angle = rand(-0.3, 0.3);
          power = 0.5;
        }
      }
      return { angle, power, spin: { x: 0, y: 0 }, target: best?.target || null, pocket: best?.pocket || null, score: best?.score ?? 9999 };
    }

    aiTargets() {
      const group = this.players[1].group;
      if (group === null) return this.balls.filter((b) => b.active && b.number !== 8 && b.number !== 0);
      if (this.remainingOf(group) === 0) return this.balls.filter((b) => b.active && b.number === 8);
      return this.balls.filter((b) => b.active && b.kind === group);
    }

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
      const old = { x: cue.x, y: cue.y };
      cue.active = true;
      for (const pos of candidates.slice(0, 26)) {
        cue.x = pos.x;
        cue.y = pos.y;
        const plan = this.planAIShot();
        if (!best || plan.score < best.plan.score) best = { pos, plan };
      }
      const spot = best?.pos || candidates[0] || { x: g.play.x0 + w * 0.25, y: g.play.y0 + h * 0.5 };
      cue.x = spot.x;
      cue.y = spot.y;
      cue.vx = 0;
      cue.vy = 0;
      cue.active = true;
      this.ballInHand = false;
      this.stage.dataset.placing = 'false';
      this.toast('DeepSeek 拿到自由球，重新摆白球。', 'ai', 1900);
    }

    segmentBlocked(from, to, ignore = []) {
      const g = this.geo;
      for (const ball of this.balls) {
        if (!ball.active) continue;
        if (ball.kind === 'cue') continue;
        if (ignore.includes(ball)) continue;
        if (dotDistToSegment(ball.x, ball.y, from.x, from.y, to.x, to.y) < g.r * 2 - 0.8) return true;
      }
      return false;
    }

    newGame() {
      if (this.destroyed) return;
      this.newRack({ silent: false });
      this.refs.result.hidden = true;
      this.toast('新的一局。整张 Harness 都是你的球桌。', 'good', 2000);
      this.updateHud();
      if (this.isOpen) {
        this.aiActionAt = 0;
        this.lastTs = 0;
        this.accum = 0;
      }
    }

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
      this.geo = this.computeGeometry(this.w, this.h);
      this.buildRack();
      this.aimAngle = this.defaultAimAngle();
      this.updateHud();
      this.render();
      if (!silent) this.toast('开球吧。', 'good', 1100);
    }

    buildRack() {
      const g = this.geo;
      const r = g.r;
      const cueX = g.play.x0 + (g.play.x1 - g.play.x0) * 0.25;
      const centerY = (g.play.y0 + g.play.y1) / 2;
      this.balls.push({ kind: 'cue', number: 0, color: '#f2ead8', x: cueX, y: centerY, vx: 0, vy: 0, active: true, pocketed: false });
      const apexX = g.play.x0 + (g.play.x1 - g.play.x0) * 0.7;
      const space = r * 2.03;
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
        this.balls.push({
          kind: groupOf(number),
          number,
          color: number === 8 ? '#161a19' : BALL_COLORS[number],
          x: slot.x,
          y: slot.y,
          vx: 0,
          vy: 0,
          active: true,
          pocketed: false,
        });
      }
    }

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
    }

    cueBall() {
      return this.balls.find((b) => b.kind === 'cue');
    }

    ballByNumber(number) {
      return this.balls.find((b) => b.number === number);
    }

    remainingOf(group) {
      return this.balls.filter((b) => b.active && b.kind === group).length;
    }

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
    }

    shoot(angle, power, opts = {}) {
      if (this.gameOver) return;
      if (this.phase !== 'aiming' && this.phase !== 'ai-aiming' && !opts.force) return;
      if (this.ballInHand) return;
      const cue = this.cueBall();
      if (!cue || !cue.active) return;
      const g = this.geo;
      const spin = opts.spin
        ? { x: clamp(opts.spin.x, -1, 1), y: clamp(opts.spin.y, -1, 1) }
        : opts.ai ? { x: 0, y: 0 } : { x: this.spinX, y: this.spinY };
      const spinAmount = Math.min(1, hypot(spin.x, spin.y));
      const speed = g.maxSpeed * (0.055 + 0.945 * Math.pow(clamp(power, 0, 1), 1.14)) * (1 - 0.04 * spinAmount);
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
      if (opts.ai) this.toast(AI_LINES[Math.floor(Math.random() * AI_LINES.length)], 'ai', 1800);
    }

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
      for (let i = 0; i < this.balls.length; i++) {
        const a = this.balls[i];
        if (!a.active) continue;
        for (let j = i + 1; j < this.balls.length; j++) {
          const b = this.balls[j];
          if (!b.active) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const minDist = r * 2;
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
          const overlap = (minDist - d) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const normalSpeed = rvx * nx + rvy * ny;
          if (normalSpeed < 0) {
            const cueBall = a.kind === 'cue' ? a : b.kind === 'cue' ? b : null;
            const objectBall = cueBall === a ? b : cueBall === b ? a : null;
            const cuePreVx = cueBall ? cueBall.vx : 0;
            const cuePreVy = cueBall ? cueBall.vy : 0;
            const impact = -normalSpeed;
            const impulse = -(1 + 0.955) * normalSpeed / 2;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
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
      }
    }

    pocketFor(ball) {
      const g = this.geo;
      for (const pocket of g.pockets) {
        const capture = pocket.r * (pocket.corner ? 1.08 : 0.92);
        if (hypot(ball.x - pocket.x, ball.y - pocket.y) < capture) return pocket;
      }
      return null;
    }

    cushionCollision(ball) {
      const g = this.geo;
      const r = g.r;
      let impact = 0;
      let railContact = false;
      let verticalRail = false;
      if (ball.x - r < g.play.x0) {
        ball.x = g.play.x0 + r;
        if (ball.vx < 0) { railContact = true; verticalRail = true; impact = Math.max(impact, Math.abs(ball.vx)); ball.vx = -ball.vx * g.cushion; ball.vy *= 0.985; }
      } else if (ball.x + r > g.play.x1) {
        ball.x = g.play.x1 - r;
        if (ball.vx > 0) { railContact = true; verticalRail = true; impact = Math.max(impact, Math.abs(ball.vx)); ball.vx = -ball.vx * g.cushion; ball.vy *= 0.985; }
      }
      if (ball.y - r < g.play.y0) {
        ball.y = g.play.y0 + r;
        if (ball.vy < 0) { railContact = true; impact = Math.max(impact, Math.abs(ball.vy)); ball.vy = -ball.vy * g.cushion; ball.vx *= 0.985; }
      } else if (ball.y + r > g.play.y1) {
        ball.y = g.play.y1 - r;
        if (ball.vy > 0) { railContact = true; impact = Math.max(impact, Math.abs(ball.vy)); ball.vy = -ball.vy * g.cushion; ball.vx *= 0.985; }
      }
      if (!railContact) return;
      if (ball.kind === 'cue' && (ball.spinX || ball.spinY)) {
        const speed = hypot(ball.vx, ball.vy);
        if (speed > 2 && ball.spinX) {
          // Side spin bends the rebound. The sign flips between a long rail
          // and a short rail because the tangent direction changes.
          const angle = Math.atan2(ball.vy, ball.vx) + ball.spinX * (verticalRail ? 0.27 : -0.27);
          ball.vx = Math.cos(angle) * speed;
          ball.vy = Math.sin(angle) * speed;
        }
        ball.spinX *= 0.55;
        ball.spinY *= 0.82;
      }
      // A legal shot only needs *contact* with a cushion after the first
      // object-ball contact, however softly the ball arrives. Sound and
      // particles still have an amplitude threshold so a slow roll is quiet.
      if (this.shot && this.shot.firstHit !== null) this.shot.railAfterContact = true;
      if (impact > 35) {
        const now = performance.now();
        if (now - this.lastCollisionSound > 28) {
          this.audio.rail(impact);
          this.lastCollisionSound = now;
        }
        this.spawnImpact(ball.x, ball.y, impact * 0.5);
      }
    }

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
    }

    allStopped() {
      return this.balls.every((b) => !b.active || (b.vx === 0 && b.vy === 0));
    }

    onBallsStopped() {
      if (this.phase !== 'shooting') return;
      this.phase = 'settling';
      this.stage.dataset.shooting = 'false';
      this.resolveAt = performance.now() + (this.reduceMotion ? 80 : 300);
      this.updateHud();
    }

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

      if (assignedNow && !fouls.length) {
        this.toast(this.players[shooter].group === 'solid' ? '你打全色球。' : '你打花色球。', 'good', 1800);
      }
    }

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
      this.updateHud();
    }

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
    }

    rebreak() {
      this.toast('开球黑八，重新摆球。', 'foul', 2000);
      const shooter = this.current;
      this.newRack({ silent: true });
      this.current = shooter;
      this.isBreak = true;
      this.phase = shooter === 0 ? 'aiming' : 'ai';
      if (shooter === 1) this.scheduleAI();
      this.aimAngle = this.defaultAimAngle();
      this.updateHud();
    }

    endGame(winner, reason, fouls = [], pocketed = []) {
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
      this.refs.resultTitle.innerHTML = won ? '清台，<em>你赢了</em>' : '这局，<em>DeepSeek 收下</em>';
      this.refs.resultCopy.textContent = won
        ? (this.prefs.streak > 1 ? `连胜 ${this.prefs.streak} 局。整张 Harness 都替你高兴。` : '黑八落袋，干干净净。Harness 还在后台等你。')
        : reason === 'eight-foul'
          ? (fouls.length ? `黑八落袋，但这杆犯规：${fouls[0]}。` : '黑八还没到时候。再来一局？')
          : 'DeepSeek 把黑八收走了。工作没停，球桌也还在。';
      this.refs.resultWins.textContent = String(this.prefs.wins);
      this.refs.resultLosses.textContent = String(this.prefs.losses);
      this.refs.resultStreak.textContent = String(this.prefs.streak);
      this.updateHud();
      if (won) this.audio.win();
      else this.audio.lose();
    }

    updateHud() {
      if (!this.refs) return;
      const human = this.players[0];
      const ai = this.players[1];
      const humanActive = !this.gameOver && this.current === 0;
      const aiActive = !this.gameOver && this.current === 1;
      this.refs.human.dataset.active = String(humanActive);
      this.refs.ai.dataset.active = String(aiActive);
      this.refs.humanSide.textContent = groupName(human.group) + (human.group ? ` · ${this.remainingOf(human.group)}` : '');
      this.refs.aiSide.textContent = ai.group ? `${groupName(ai.group)} · ${this.remainingOf(ai.group)}` : '待定';
      this.refs.humanWins.textContent = String(this.prefs.wins);
      this.refs.humanLosses.textContent = String(this.prefs.losses);
      this.renderPips(this.refs.humanPips, human.group, 0);
      this.renderPips(this.refs.aiPips, ai.group, 1);
      this.refs.turn.dataset.tone = this.gameOver ? 'foul' : this.current === 1 ? 'ai' : 'human';
      if (this.gameOver) {
        this.refs.turnKicker.textContent = 'RACK OVER';
        this.refs.turnStrong.textContent = this.result?.winner === 0 ? '清台成功' : 'DeepSeek 收杆';
        this.refs.turnSmall.textContent = '按 N 再来一局';
      } else if (this.phase === 'shooting' || this.phase === 'settling') {
        this.refs.turnKicker.textContent = 'IN PLAY';
        this.refs.turnStrong.textContent = '球在滚动';
        this.refs.turnSmall.textContent = '看球';
      } else if (this.current === 0 && this.ballInHand) {
        this.refs.turnKicker.textContent = 'BALL IN HAND';
        this.refs.turnStrong.textContent = '自由球';
        this.refs.turnSmall.textContent = '点击球桌放置白球';
      } else if (this.current === 1) {
        this.refs.turnKicker.textContent = 'DEEPSEEK';
        this.refs.turnStrong.textContent = this.phase === 'ai-aiming' ? '正在瞄准' : '思考下一杆';
        this.refs.turnSmall.textContent = 'Harness 后台照常运行';
      } else {
        this.refs.turnKicker.textContent = 'YOUR TURN';
        this.refs.turnStrong.textContent = '轮到你';
        this.refs.turnSmall.textContent = this.onEight(0) ? '目标：黑八' : human.group ? `目标：${groupName(human.group)}球` : '开放球桌 · 先碰任意非黑八';
      }
      const hint = this.bottomHint();
      this.refs.hintMain.textContent = hint[0];
      this.refs.hintSub.textContent = hint[1];
      this.refs.sr.textContent = `${this.refs.turnStrong.textContent}。${this.refs.turnSmall.textContent}`;
      this.stage.style.setProperty('--bil-power', String(this.power));
      if (this.refs.powerLabel && !this.charging) this.refs.powerLabel.textContent = 'POWER';
      this.refs.mute.innerHTML = this.prefs.muted ? ICONS.soundOff : ICONS.soundOn;
      this.refs.mute.setAttribute('aria-pressed', String(this.prefs.muted));
      this.refs.guide.setAttribute('aria-pressed', String(this.prefs.guide));
      this.refs.focus.setAttribute('aria-pressed', String(this.prefs.clarity === 2));
      this.refs.focus.innerHTML = this.prefs.clarity === 2 ? ICONS.eyeOff : ICONS.eye;
      this.refs.focus.setAttribute('aria-label', `背景：${['透视', '标准', '专注'][this.prefs.clarity]}`);
      if (this.refs.result && !this.refs.result.hidden) {
        this.refs.resultWins.textContent = String(this.prefs.wins);
        this.refs.resultLosses.textContent = String(this.prefs.losses);
        this.refs.resultStreak.textContent = String(this.prefs.streak);
      }
      this.updateLauncherState();
    }

    bottomHint() {
      if (this.gameOver) return ['这局结束', '按 N 开新局'];
      if (this.ballInHand && this.current === 0) return ['自由球', '点击放置白球'];
      if (this.current === 1) return ['DeepSeek 的回合', '球桌不会打扰后台'];
      if (this.phase === 'shooting' || this.phase === 'settling') return ['球在滚动', '等它停下来'];
      if (this.onEight(0)) return ['目标：黑八', '按住蓄力 · 松开击球'];
      return ['按住蓄力', '松开击球 · Alt+B 收起'];
    }

    onEight(playerIndex) {
      const group = this.players[playerIndex]?.group;
      return Boolean(group) && this.remainingOf(group) === 0;
    }

    renderPips(container, group, playerIndex) {
      const numbers = group === 'stripe' ? [9, 10, 11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6, 7];
      const signature = `${group === null ? 'open' : group}-${numbers.join(',')}`;
      if (container.dataset.signature !== signature) {
        container.dataset.signature = signature;
        container.innerHTML = '';
        for (const number of numbers) {
          const span = document.createElement('span');
          span.className = 'dsh-bil-pip' + (group ? (group === 'solid' ? '' : ' is-stripe') : '');
          span.dataset.number = String(number);
          span.style.setProperty('--ball', BALL_COLORS[number]);
          container.appendChild(span);
        }
        const eight = document.createElement('span');
        eight.className = 'dsh-bil-pip is-eight';
        eight.dataset.number = '8';
        eight.title = '黑八';
        container.appendChild(eight);
      }
      for (const pip of container.querySelectorAll('.dsh-bil-pip')) {
        const n = Number(pip.dataset.number);
        if (n === 8) {
          pip.classList.toggle('is-down', false);
          pip.classList.toggle('is-target', Boolean(group) && this.remainingOf(group) === 0 && this.current === playerIndex && !this.gameOver);
        } else {
          const ball = this.ballByNumber(n);
          pip.classList.toggle('is-down', !ball || !ball.active);
          pip.classList.remove('is-target');
        }
      }
    }

    setLauncherReturn(active) {
      this.host.dataset.passive = active ? 'true' : 'false';
      if (this.launcherCopyB) this.launcherCopyB.textContent = active ? '回到球桌' : '来一局台球';
      if (this.launcherCopySmall) this.launcherCopySmall.textContent = active ? 'ALT+H' : 'ALT+B';
      if (this.launcher) {
        this.launcher.setAttribute('aria-label', active ? '回到球桌（Alt+H）' : '打开台球（Alt+B）');
        this.launcher.title = active ? '回到球桌 · Alt+H' : '台球 · Alt+B';
      }
    }

    updateLauncherState() {
      if (!this.launcher) return;
      if (this.passive) {
        this.setLauncherReturn(true);
        return;
      }
      const live = this.hasStarted && !this.gameOver && (this.current === 1 || this.phase === 'shooting' || this.ballInHand);
      this.launcher.dataset.live = String(Boolean(live));
      this.launcher.setAttribute('aria-label', this.isOpen ? '收起台球' : '打开台球（Alt+B）');
    }

    toast(text, tone = 'good', duration = 1700) {
      if (!this.refs?.toast) return;
      this.refs.toast.textContent = text;
      this.refs.toast.dataset.tone = tone;
      this.refs.toast.classList.add('is-show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.refs?.toast.classList.remove('is-show');
      }, duration);
    }

    spawnImpact(x, y, speed) {
      if (this.reduceMotion) return;
      const count = clamp(Math.round(speed / 220), 1, 4);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * TAU;
        const v = rand(18, 60) * clamp(speed / 600, 0.4, 1.4);
        this.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, born: performance.now(), life: rand(220, 420), size: rand(0.8, 2), color: 'rgba(225,255,245,.7)' });
      }
    }

    spawnBurst(x, y) {
      if (this.reduceMotion) return;
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * TAU;
        const v = rand(20, 95);
        this.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, born: performance.now(), life: rand(300, 650), size: rand(0.7, 2.2), color: i % 3 === 0 ? 'rgba(240,202,132,.8)' : 'rgba(120,240,208,.65)' });
      }
    }

    resize() {
      if (!this.canvas) return;
      const w = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 1200);
      const h = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 800);
      const old = this.geo;
      this.w = w;
      this.h = h;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      const budget = Math.sqrt(8_000_000 / Math.max(1, w * h));
      this.dpr = Math.min(this.dpr, Math.max(0.8, budget));
      for (const canvas of [this.canvas, this.staticCanvas]) {
        canvas.width = Math.round(w * this.dpr);
        canvas.height = Math.round(h * this.dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.staticCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const next = this.computeGeometry(w, h);
      if (old && this.balls.length) {
        const oldPlay = old.play;
        const newPlay = next.play;
        const sx = (newPlay.x1 - newPlay.x0) / Math.max(1, oldPlay.x1 - oldPlay.x0);
        const sy = (newPlay.y1 - newPlay.y0) / Math.max(1, oldPlay.y1 - oldPlay.y0);
        for (const ball of this.balls) {
          ball.x = newPlay.x0 + (ball.x - oldPlay.x0) * sx;
          ball.y = newPlay.y0 + (ball.y - oldPlay.y0) * sy;
          ball.vx *= sx;
          ball.vy *= sy;
        }
      }
      this.geo = next;
      this.renderStatic();
      this.render();
    }

    onResize() {
      if (this.destroyed) return;
      if (window.innerWidth === this.w && window.innerHeight === this.h) return;
      this.resize();
    }

    startLoop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.lastTs = 0;
      this.accum = 0;
      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
    }

    loop(ts) {
      this.raf = null;
      if (!this.isOpen || this.destroyed) return;
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
      this.raf = requestAnimationFrame(this.loop);
    }

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
    }

    render() {
      if (!this.ctx || !this.geo) return;
      const ctx = this.ctx;
      const { w, h } = this.geo;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(this.staticCanvas, 0, 0, w, h);
      if (this.prefs.guide) this.drawAim(ctx);
      this.drawBalls(ctx);
      this.drawCue(ctx);
      this.drawAnimations(ctx);
      this.drawParticles(ctx);
      this.drawGhostCue(ctx);
    }

    drawAim(ctx) {
      if (!this.isOpen || this.gameOver) return;
      if (this.phase !== 'aiming' && this.phase !== 'ai-aiming') return;
      if (this.ballInHand) return;
      const cue = this.cueBall();
      if (!cue || !cue.active) return;
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
      const px = cue.x + dx * t;
      const py = cue.y + dy * t;
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
          ctx.arc(hit.x, hit.y, r + 7 + Math.sin(performance.now() / 280) * 2, 0, TAU);
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
    }

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
    }

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
    }

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
        ctx.beginPath();
        ctx.arc(x, y, r * 0.385, 0, TAU);
        ctx.fillStyle = '#f8f2e6';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.12)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#1b2420';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${ball.number > 9 ? r * 0.5 : r * 0.57}px "Inter", "Segoe UI", system-ui, sans-serif`;
        ctx.fillText(String(ball.number), x, y + r * 0.02);
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
    }

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
    }

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
    }

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
      ctx.arc(x, y, g.r + 9 + Math.sin(performance.now() / 250) * 2, 0, TAU);
      ctx.strokeStyle = valid ? 'rgba(95, 240, 196, .25)' : 'rgba(255, 138, 120, .25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    hexToRgba(hex, alpha) {
      const clean = hex.replace('#', '');
      const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
      const n = parseInt(value, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }

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
    }

    attachDebug() {
      if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname)) return;
      const self = this;
      window.__DSH_BILLIARDS__ = {
        game: self,
        open: () => self.open(),
        close: () => self.close(),
        newGame: () => self.newGame(),
        state: () => self.debugState(),
        shoot: (angle, power) => {
          self.current = 0;
          self.ballInHand = false;
          self.phase = 'aiming';
          self.shoot(angle, power, { force: true });
        },
        advance: (seconds) => self.debugAdvance(seconds),
        setBalls: (spec) => self.debugSetBalls(spec),
        setTurn: (index) => {
          self.current = index;
          self.phase = index === 0 ? 'aiming' : 'ai';
        },
        forceResult: (winner) => self.endGame(winner, 'debug'),
        toast: (text, tone = 'good') => self.toast(text, tone, 2500),
      };
    }

    debugState() {
      const cue = this.cueBall();
      return {
        phase: this.phase,
        current: this.current,
        ballInHand: this.ballInHand,
        gameOver: this.gameOver,
        groups: this.players.map((p) => p.group),
        stats: { ...this.prefs },
        cue: cue ? { x: cue.x, y: cue.y, active: cue.active } : null,
        balls: this.balls.map((b) => ({ number: b.number, kind: b.kind, x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, vx: Math.round(b.vx), vy: Math.round(b.vy), active: b.active, pocketed: b.pocketed })),
        geo: this.geo ? { w: this.geo.w, h: this.geo.h, r: this.geo.r, play: this.geo.play, pockets: this.geo.pockets.map((p) => ({ id: p.id, x: p.x, y: p.y, r: p.r })) } : null,
      };
    }

    debugAdvance(seconds) {
      const wasOpen = this.isOpen;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      const oldOpen = this.isOpen;
      this.isOpen = false;
      const steps = Math.max(1, Math.ceil(seconds / FIXED_STEP));
      for (let i = 0; i < steps; i++) {
        if (this.phase !== 'shooting') break;
        this.stepPhysics(FIXED_STEP);
        if (this.allStopped()) {
          this.phase = 'settling';
          this.resolveShot();
          break;
        }
      }
      this.isOpen = oldOpen;
      if (wasOpen) this.startLoop();
      return this.debugState();
    }

    debugSetBalls(spec) {
      for (const ball of this.balls) {
        ball.active = false;
        ball.pocketed = true;
      }
      const cue = this.cueBall();
      cue.active = true;
      cue.pocketed = false;
      cue.x = spec.cue?.x ?? (this.geo.play.x0 + this.geo.play.x1) / 2;
      cue.y = spec.cue?.y ?? (this.geo.play.y0 + this.geo.play.y1) / 2;
      cue.vx = 0;
      cue.vy = 0;
      for (const item of spec.balls || []) {
        const b = this.ballByNumber(item.number);
        if (!b) continue;
        b.active = true;
        b.pocketed = false;
        b.x = item.x;
        b.y = item.y;
        b.vx = 0;
        b.vy = 0;
      }
      this.updateHud();
      this.render();
    }

    destroy() {
      this.destroyed = true;
      this.isOpen = false;
      this.syncDesktopChrome(false);
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.abort.abort();
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.themeObserver) this.themeObserver.disconnect();
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.audio.setMuted(true);
      if (this.audio.ctx && this.audio.ctx.state !== 'closed') this.audio.ctx.close().catch(() => {});
      this.host.innerHTML = '';
      if (window.__DSH_BILLIARDS__?.game === this) delete window.__DSH_BILLIARDS__;
    }
  }

  function injectStyles() {
    const tag = 'dsh-billiards/style.css';
    let el = document.querySelector(`style[data-plugin-css="${tag}"]`);
    if (el) return () => {};
    el = document.createElement('style');
    el.dataset.plugin = PLUGIN_ID;
    el.dataset.pluginCss = tag;
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => {
      if (window.__DSH_BILLIARDS__?.game) return;
      el.remove();
    };
  }

  function apply(ctx) {
    ctx.effect(() => injectStyles(), 'dsh-billiards: styles');
    ctx.slots.inject('shell.overlay', function* () {
      yield ctx.slots.register(
        { name: 'shell.overlay', id: 'billiards', order: 900 },
        function BilliardsOverlay() {
          const ref = React.useRef(null);
          React.useEffect(() => {
            if (!ref.current) return undefined;
            const game = new BilliardsGame(ref.current);
            return () => game.destroy();
          }, []);
          return React.createElement('div', { ref, className: 'dsh-bil-host' });
        },
      );
    });
  }

  // React is seeded by the DSH shell and fetched inside the factory.
  let React;
  if (window.__DSH_BILLIARDS_PREVIEW__) {
    // Local visual harness: mount the same game against a mock Harness page
    // without needing the Cordis loader. Never reached inside DSH.
    injectStyles();
    const host = document.createElement('div');
    host.className = 'dsh-bil-host';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
    const game = new BilliardsGame(host);
    window.__BILLIARDS_PREVIEW_GAME__ = game;
    game.open();
  } else {
    window.__ModuleLoader__.load({
      id: PLUGIN_ID,
      factory: (require) => {
        React = require('react');
        return { name: 'billiards', inject: ['slots'], apply };
      },
    });
  }
})();
