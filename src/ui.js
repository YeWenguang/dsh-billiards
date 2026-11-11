  const CSS = `
  .dsh-bil-host {
    position: fixed; inset: 0; z-index: 40; pointer-events: none;
    color: #eafff8; font-family: "Inter", "Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;
    --bil-glass-sheen: linear-gradient(132deg, rgba(255, 255, 255, .055), rgba(255, 255, 255, 0) 64%);
    --bil-glass-dark: linear-gradient(152deg, rgba(17, 36, 30, .78), rgba(9, 22, 18, .68));
    --bil-glass-strong: linear-gradient(152deg, rgba(21, 48, 39, .88), rgba(9, 28, 22, .8));
    --bil-glass-border: rgba(212, 255, 244, .16);
    --bil-glass-shadow: 0 8px 24px rgba(0, 0, 0, .14), inset 0 1px 0 rgba(255, 255, 255, .06);
    --bil-glass-blur: blur(18px) saturate(1.08);
  }
  .dsh-bil-host *, .dsh-bil-host *::before, .dsh-bil-host *::after { box-sizing: border-box; }
  .dsh-bil-host button:focus-visible { outline: 2px solid #5ad9b3; outline-offset: 4px; }
  .dsh-bil-host[data-bil-theme="light"] .dsh-bil-launcher {
    background: rgba(249, 253, 251, .92); color: #173d2f; border-color: rgba(24, 74, 54, .18);
    box-shadow: 0 6px 24px rgba(22, 55, 42, .14), inset 0 1px 0 #fff;
  }
  .dsh-bil-host[data-bil-theme="light"] .dsh-bil-launcher-copy small { color: #557266; }

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
    --bil-muted: #bfd4cb;
    --bil-dim: #9bb6aa;
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
    cursor: crosshair; outline: none; -webkit-user-select: none; user-select: none; touch-action: none;
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
    --bil-glass-sheen: linear-gradient(132deg, rgba(255, 255, 255, .3), rgba(255, 255, 255, 0) 64%);
    --bil-glass-dark: linear-gradient(152deg, rgba(254, 255, 254, .94), rgba(240, 248, 243, .88));
    --bil-glass-strong: linear-gradient(152deg, rgba(248, 255, 251, .98), rgba(234, 248, 240, .94));
    --bil-glass-border: rgba(27, 76, 56, .18);
    --bil-glass-shadow: 0 8px 24px rgba(29, 64, 53, .09), inset 0 1px 0 rgba(255, 255, 255, .9);
    --bil-glass-blur: blur(18px) saturate(1.03);
  }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-brand { color: rgba(17, 43, 34, .88); text-shadow: none; }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-brand em { color: rgba(17, 43, 34, .72); }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-tool { color: #244c3c; text-shadow: none; }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-tool:hover { background: rgba(22, 98, 69, .08); color: #0d2f24; border-color: rgba(22, 98, 69, .18); }
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
    background: linear-gradient(160deg, #fcfffd, #ecf6ef); text-shadow: none;
  }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-btn:not([data-primary="true"]) { color: #244c3c; background: rgba(22, 98, 69, .06); border-color: rgba(22, 98, 69, .2); }
  .dsh-bil-stage::before {
    content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: var(--bil-veil), var(--bil-wash);
    backdrop-filter: blur(var(--bil-blur)) saturate(var(--bil-sat)) brightness(var(--bil-bright));
    -webkit-backdrop-filter: blur(var(--bil-blur)) saturate(var(--bil-sat)) brightness(var(--bil-bright));
    transition: background .4s ease, backdrop-filter .4s ease;
  }
  .dsh-bil-stage::after {
    content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background: radial-gradient(ellipse 80% 76% at 50% 48%, transparent 52%, rgba(0, 8, 6, var(--bil-vignette)) 100%);
  }
  .dsh-bil-stage[data-shooting="true"] { cursor: default; }
  .dsh-bil-stage[data-placing="true"] { cursor: grab; }
  .dsh-bil-stage[data-placing="true"]:active { cursor: grabbing; }
  .dsh-bil-stage[data-charging="true"] { cursor: none; }

  .dsh-bil-canvas { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; display: block; touch-action: none; }
  .dsh-bil-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
  .dsh-bil-layer > * { pointer-events: none; }

  .dsh-bil-brand {
    position: absolute; left: 64px; top: 28px; display: flex; align-items: center; gap: 9px;
    height: 32px; padding: 0 12px; border-radius: 12px;
    border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-dark);
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    font-size: 11px; letter-spacing: .09em; font-weight: 700; text-transform: uppercase; color: var(--bil-ink);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .28);
  }
  .dsh-bil-brand-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--bil-accent); }
  .dsh-bil-brand em { font-style: normal; color: var(--bil-muted); letter-spacing: 0; text-transform: none; font-weight: 500; font-size: 11px; }
  @keyframes dshBilPulse { 0%, 100% { opacity: .55; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.1); } }

  .dsh-bil-turn {
    position: absolute; left: 50%; top: 80px; transform: translateX(-50%);
    min-width: 212px; padding: 10px 18px; border-radius: 16px; text-align: center;
    border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-strong);
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .26);
    transition: border-color .25s ease, box-shadow .25s ease, opacity .18s ease;
  }
  .dsh-bil-turn[data-tone="ai"] { border-color: rgba(240, 202, 132, .32); box-shadow: var(--bil-glass-shadow), 0 0 24px rgba(240, 202, 132, .06); }
  .dsh-bil-turn[data-tone="foul"] { border-color: rgba(255, 138, 120, .38); }
  .dsh-bil-turn-kicker { display: block; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--bil-muted); font-weight: 650; margin-bottom: 4px; }
  .dsh-bil-turn strong { display: block; font-size: 17px; font-weight: 650; letter-spacing: .02em; line-height: 1.3; }
  .dsh-bil-turn small { display: block; margin-top: 5px; font-size: 11px; line-height: 1.45; color: var(--bil-muted); letter-spacing: 0; }

  .dsh-bil-actions {
    position: absolute; right: 64px; top: 22px; display: flex; align-items: center; gap: 3px; padding: 5px;
    pointer-events: auto; border: 1px solid var(--bil-glass-border); border-radius: 16px;
    background: var(--bil-glass-sheen), var(--bil-glass-dark); box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
  }
  .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-actions { right: 182px; }
  .dsh-bil-tool {
    width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; gap: 7px;
    border-radius: 11px; border: 1px solid transparent; position: relative;
    background: transparent; color: var(--bil-ink); cursor: pointer; font: inherit;
    transition: background .18s ease, color .18s ease, border-color .18s ease, transform .18s ease;
    -webkit-app-region: no-drag;
  }
  .dsh-bil-tool:hover { background: var(--bil-glass-sheen), rgba(24, 68, 56, .5); color: var(--bil-ink); border-color: rgba(190, 255, 235, .38); }
  .dsh-bil-tool:active { transform: scale(.95); }
  .dsh-bil-tool[aria-pressed="true"] { color: var(--bil-accent); border-color: rgba(95, 240, 196, .44); background: var(--bil-glass-sheen), rgba(15, 67, 54, .42); }
  .dsh-bil-tool svg { width: 16px; height: 16px; display: block; }
  .dsh-bil-tool[data-label] { width: auto; padding: 0 11px; }
  .dsh-bil-tool[data-label]::after { content: attr(data-label); font-size: 12px; font-weight: 550; white-space: nowrap; }
  .dsh-bil-tool[data-act="new"] { margin-left: 5px; }
  .dsh-bil-tool[data-act="new"]::before { content: ""; position: absolute; left: -5px; top: 8px; bottom: 8px; width: 1px; background: var(--bil-glass-border); }

  .dsh-bil-player {
    position: absolute; top: 86px; width: 190px; padding: 12px 14px;
    border-radius: 16px; border: 1px solid var(--bil-glass-border);
    background: var(--bil-glass-sheen), var(--bil-glass-dark);
    box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    text-shadow: 0 1px 2px rgba(0, 0, 0, .22);
    transition: border-color .3s ease, box-shadow .3s ease, background .3s ease, opacity .18s ease;
  }
  .dsh-bil-player[data-side="human"] { left: 64px; }
  .dsh-bil-player[data-side="ai"] { right: 64px; text-align: right; }
  .dsh-bil-player[data-active="true"] {
    border-color: rgba(95, 240, 196, .5);
    box-shadow: 0 0 0 1px rgba(95, 240, 196, .1), var(--bil-glass-shadow);
    background: var(--bil-glass-sheen), var(--bil-glass-strong);
  }
  .dsh-bil-player[data-side="ai"][data-active="true"] { border-color: rgba(240, 202, 132, .38); box-shadow: 0 0 0 1px rgba(240, 202, 132, .06), 0 10px 36px rgba(0, 0, 0, .22); }
  .dsh-bil-player-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .dsh-bil-player[data-side="ai"] .dsh-bil-player-top { flex-direction: row-reverse; }
  .dsh-bil-player-name { font-size: 12px; font-weight: 650; letter-spacing: .02em; white-space: nowrap; }
  .dsh-bil-player-name span { color: var(--bil-dim); font-weight: 500; letter-spacing: 0; font-size: 10px; margin-left: 4px; }
  .dsh-bil-player-side { font-size: 11px; color: var(--bil-muted); letter-spacing: 0; font-weight: 550; white-space: nowrap; }
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
  .dsh-bil-pip.is-down { opacity: .3; filter: grayscale(1); transform: scale(.72); }
  .dsh-bil-pip.is-target { box-shadow: 0 0 0 2px rgba(95, 240, 196, .55), 0 0 9px rgba(95, 240, 196, .35); }
  .dsh-bil-player[data-side="ai"] .dsh-bil-pip.is-target { box-shadow: 0 0 0 2px rgba(240, 202, 132, .5), 0 0 9px rgba(240, 202, 132, .28); }
  .dsh-bil-player-meta { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 11px; color: var(--bil-dim); letter-spacing: 0; }
  .dsh-bil-player[data-side="ai"] .dsh-bil-player-meta { justify-content: flex-end; }
  .dsh-bil-player-meta b { color: var(--bil-muted); font-weight: 600; }

  .dsh-bil-bottom {
    position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); display: block;
    border: 1px solid var(--bil-glass-border); border-radius: 12px; padding: 7px 10px; white-space: nowrap;
    background: var(--bil-glass-sheen), var(--bil-glass-dark); box-shadow: var(--bil-glass-shadow);
    backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
  }
  .dsh-bil-power { display: none; }
  .dsh-bil-hint { display: flex; align-items: center; gap: 9px; height: auto; padding: 3px 4px; font-size: 12px; color: var(--bil-muted); letter-spacing: 0; }
  .dsh-bil-hint b { color: var(--bil-ink); font-weight: 600; }
  .dsh-bil-hint-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--bil-dim); }
  .dsh-bil-hint kbd { font: inherit; font-size: 9px; color: rgba(224, 255, 245, .6); border: 1px solid rgba(174, 255, 232, .16); border-radius: 4px; padding: 1px 4px; background: rgba(0, 0, 0, .14); }

  .dsh-bil-spin-panel {
    position: absolute; left: 64px; bottom: 64px; display: flex; align-items: center; gap: 11px;
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
  .dsh-bil-spin-copy span { display: block; font-size: 11px; letter-spacing: 0; color: var(--bil-muted); font-weight: 500; }
  .dsh-bil-spin-copy b { display: block; margin-top: 3px; font-size: 14px; font-weight: 650; color: var(--bil-accent); letter-spacing: .02em; }
  .dsh-bil-spin-copy small { display: block; margin-top: 4px; font-size: 11px; line-height: 1.4; color: var(--bil-dim); letter-spacing: 0; white-space: nowrap; }

  .dsh-bil-corner { position: absolute; bottom: 40px; font-size: 11px; letter-spacing: 0; color: var(--bil-muted); line-height: 1.7; padding: 7px 11px; border: 1px solid var(--bil-glass-border); border-radius: 12px; background: var(--bil-glass-dark); backdrop-filter: var(--bil-glass-blur); }
  .dsh-bil-corner-left { left: 78px; }
  .dsh-bil-corner-right { right: 64px; text-align: right; }
  .dsh-bil-corner kbd { font: inherit; color: var(--bil-ink); }

  /* Panels step aside completely while they cover a ball or the aim path. */
  .dsh-bil-brand, .dsh-bil-actions, .dsh-bil-spin-panel, .dsh-bil-corner, .dsh-bil-bottom { transition: opacity .18s ease; }
  .dsh-bil-brand[data-occluded="true"],
  .dsh-bil-spin-panel[data-occluded="true"]:not(:focus-within),
  .dsh-bil-corner[data-occluded="true"],
  .dsh-bil-bottom[data-occluded="true"] {
    opacity: 0;
    pointer-events: none;
  }
  .dsh-bil-turn[data-occluded="true"], .dsh-bil-player[data-occluded="true"] { opacity: .6; }

  .dsh-bil-toast {
    position: absolute; left: 50%; top: 182px; transform: translate(-50%, -6px);
    width: max-content; max-width: min(460px, calc(100% - 80px)); padding: 10px 16px; border-radius: 12px;
    border: 1px solid var(--bil-glass-border); background: var(--bil-glass-sheen), var(--bil-glass-dark);
    box-shadow: var(--bil-glass-shadow); backdrop-filter: var(--bil-glass-blur); -webkit-backdrop-filter: var(--bil-glass-blur);
    font-size: 12px; color: var(--bil-ink); letter-spacing: 0; line-height: 1.6;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .25);
    opacity: 0; pointer-events: none; transition: opacity .22s ease, transform .22s ease; z-index: 4; text-align: center;
  }
  .dsh-bil-toast.is-show { opacity: 1; transform: translate(-50%, 0); }
  .dsh-bil-toast[data-tone="foul"] { border-color: rgba(255, 138, 120, .36); color: #ffd9d2; }
  .dsh-bil-toast[data-tone="good"] { border-color: rgba(95, 240, 196, .38); }
  .dsh-bil-toast[data-tone="ai"] { border-color: rgba(240, 202, 132, .3); }

  .dsh-bil-result { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; padding: 24px; pointer-events: auto; background: radial-gradient(ellipse at center, rgba(1, 10, 8, .16), rgba(0, 6, 5, .4)); backdrop-filter: blur(2.5px); -webkit-backdrop-filter: blur(2.5px); }
  .dsh-bil-result-card {
    width: min(420px, 100%); max-height: 100%; overflow-y: auto; padding: 28px 30px 24px; border-radius: 22px; text-align: center;
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
  .dsh-bil-result-card h2 { margin: 0; font-size: 26px; line-height: 1.3; letter-spacing: .01em; font-weight: 650; }
  .dsh-bil-result-card h2 em { color: var(--bil-accent); font-style: normal; }
  .dsh-bil-result-card p { margin: 12px auto 0; max-width: 300px; color: var(--bil-muted); font-size: 13px; line-height: 1.7; }
  .dsh-bil-result-stats { display: flex; justify-content: center; gap: 26px; margin: 20px 0 22px; padding: 13px 0; border-top: 1px solid var(--bil-glass-border); border-bottom: 1px solid var(--bil-glass-border); }
  .dsh-bil-result-stat { min-width: 56px; }
  .dsh-bil-result-stat b { display: block; font-size: 24px; font-weight: 600; color: var(--bil-ink); font-variant-numeric: tabular-nums; }
  .dsh-bil-result-stat span { display: block; margin-top: 5px; font-size: 12px; letter-spacing: 0; color: var(--bil-muted); }
  .dsh-bil-result-actions { display: flex; gap: 9px; justify-content: center; }
  .dsh-bil-btn { min-height: 44px; padding: 0 18px; border-radius: 12px; border: 1px solid rgba(174, 255, 232, .24); background: rgba(13, 43, 35, .45); color: var(--bil-ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .18s, border-color .18s, color .18s, transform .18s; -webkit-app-region: no-drag; }
  .dsh-bil-btn:hover { background: rgba(21, 65, 53, .6); border-color: rgba(174, 255, 232, .36); color: #fff; }
  .dsh-bil-btn:active { transform: scale(.97); }
  .dsh-bil-btn[data-primary="true"] { background: linear-gradient(135deg, #54ecc5, #30b997); border-color: transparent; color: #04211a; box-shadow: 0 6px 20px rgba(54, 210, 170, .2); }
  .dsh-bil-btn[data-primary="true"]:hover { background: linear-gradient(135deg, #6dffda, #3ccca8); }

  .dsh-bil-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

  @media (max-width: 1100px) {
    .dsh-bil-corner, .dsh-bil-brand em { display: none; }
    .dsh-bil-tool[data-label] { width: 36px; padding: 0; }
    .dsh-bil-tool[data-label]::after { display: none; }
  }
  @media (max-width: 940px) {
    .dsh-bil-brand { left: 48px; top: 26px; }
    .dsh-bil-actions { right: 48px; top: 20px; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-actions { right: 166px; }
    .dsh-bil-turn { min-width: 200px; }
    .dsh-bil-turn strong { font-size: 15px; }
    .dsh-bil-player { width: 172px; padding: 10px 12px; }
    .dsh-bil-player[data-side="human"] { left: 48px; }
    .dsh-bil-player[data-side="ai"] { right: 48px; }
    .dsh-bil-spin-panel { left: 48px; bottom: 56px; padding: 9px; }
    .dsh-bil-spin-ball { width: 46px; height: 46px; flex-basis: 46px; }
    .dsh-bil-spin-copy small { display: none; }
    .dsh-bil-bottom { font-size: 11px; }
  }
  @media (max-width: 700px) {
    .dsh-bil-brand { display: none; }
    .dsh-bil-turn { top: 84px; padding: 8px 14px; }
    .dsh-bil-turn-kicker { display: none; }
    .dsh-bil-player { top: 148px; width: calc((100vw - 76px) / 2); padding: 10px 9px; border-radius: 14px; }
    .dsh-bil-player[data-side="human"] { left: 32px; }
    .dsh-bil-player[data-side="ai"] { right: 32px; }
    .dsh-bil-player-name { font-size: 11px; }
    .dsh-bil-player-name span, .dsh-bil-player-meta { display: none; }
    .dsh-bil-player-side { font-size: 10px; }
    .dsh-bil-actions .dsh-bil-tool { width: 34px; height: 38px; border-radius: 10px; }
    .dsh-bil-actions { gap: 2px; padding: 4px; top: 24px; right: auto; left: 50%; transform: translateX(-50%); }
    .dsh-bil-tool[data-act="new"] { margin-left: 4px; }
    .dsh-bil-bottom { display: none; }
    .dsh-bil-spin-panel { left: 32px; bottom: 48px; padding: 9px; gap: 9px; border-radius: 14px; }
    .dsh-bil-spin-ball { width: 40px; height: 40px; flex-basis: 40px; }
    .dsh-bil-spin-copy { min-width: 62px; }
    .dsh-bil-spin-copy b { font-size: 13px; }
    .dsh-bil-launcher { top: auto; right: 14px; bottom: 18px; transform: none; }
    .dsh-bil-toast { top: 220px; max-width: calc(100% - 64px); }
    .dsh-bil-pips { gap: 2px; margin-top: 9px; }
    .dsh-bil-pip { width: 9px; height: 9px; flex-shrink: 0; }
    .dsh-bil-pip.is-eight { width: 13px; height: 13px; }
    .dsh-bil-pip.is-eight::after { inset: 2.5px; font-size: 6px; line-height: 8px; }
    .dsh-bil-player-top { gap: 4px; flex-wrap: wrap; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-actions { top: 48px; right: auto; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-turn { top: 108px; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-player { top: 172px; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-toast { top: 244px; }
    .dsh-bil-result { padding: 20px; }
    .dsh-bil-result-card { padding: 24px 18px; }
    .dsh-bil-result-card h2 { font-size: 23px; }
    .dsh-bil-result-stats { gap: 18px; }
    .dsh-bil-result-actions { flex-direction: column; }
  }
  @media (max-height: 500px) and (min-width: 701px) {
    .dsh-bil-brand { top: 22px; }
    .dsh-bil-actions { top: 14px; }
    .dsh-bil-player { top: 76px; }
    .dsh-bil-player-meta, .dsh-bil-turn-kicker { display: none; }
    .dsh-bil-turn { top: 76px; padding: 8px 14px; }
    .dsh-bil-spin-panel { bottom: 40px; padding: 8px; }
    .dsh-bil-spin-copy small { display: none; }
    .dsh-bil-bottom { bottom: 32px; }
    .dsh-bil-toast { top: 146px; }
    .dsh-bil-result-card { padding: 18px 24px; }
    .dsh-bil-result-ball { width: 44px; height: 44px; margin-bottom: 10px; }
    .dsh-bil-result-card h2 { font-size: 22px; }
    .dsh-bil-result-card p { font-size: 12px; margin-top: 8px; }
    .dsh-bil-result-stats { margin: 14px 0; padding: 10px 0; }
    .dsh-bil-result-stat b { font-size: 22px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dsh-bil-brand-dot, .dsh-bil-result-card { animation: none !important; }
    .dsh-bil-launcher, .dsh-bil-launcher-copy, .dsh-bil-tool, .dsh-bil-btn, .dsh-bil-pip { transition-duration: .01ms !important; }
  }
  .dsh-bil-panel { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; padding: 20px; pointer-events: auto; background: rgba(0,18,12,.55); backdrop-filter: blur(8px); }
  .dsh-bil-panel[hidden] { display: none; }
  .dsh-bil-panel-card { --panel-bg: #142e25; width: min(540px, 100%); max-height: calc(100dvh - 40px); overflow: auto; scrollbar-width: thin; border-radius: 22px; padding: 24px; color: #eafff8; background: var(--panel-bg); border: 1px solid #446658; box-shadow: 0 18px 70px #0006; }
  .dsh-bil-stage[data-bil-theme="light"] .dsh-bil-panel-card { --panel-bg: #f6fcf8; color: #183c2f; border-color: #b4cebf; }
  .dsh-bil-panel-header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--panel-bg); padding-bottom: 12px; }
  .dsh-bil-panel-header h2 { margin: 0; }
  .dsh-bil-panel-dismiss { width: 44px; flex-shrink: 0; border: 1px solid currentColor; border-radius: 12px; background: transparent; color: inherit; font-size: 22px; cursor: pointer; }
  .dsh-bil-panel h2 { margin: 0 0 16px; font-size: 22px; }
  .dsh-bil-panel p, .dsh-bil-panel li { font-size: 13px; line-height: 1.8; }
  .dsh-bil-panel label { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 14px 0; font-size: 14px; }
  .dsh-bil-panel select { font: inherit; padding: 8px; border-radius: 8px; color: #173d2f; background: #f5fff9; max-width: 65%; }
  .dsh-bil-panel button { min-height: 44px; }
  .dsh-bil-panel-footer { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
  .dsh-bil-help-title { font-size: 13px; font-weight: 650; margin-top: 18px; }
  .dsh-bil-spin-reset { padding: 0; border: 0; background: none; color: var(--bil-accent); font: inherit; cursor: pointer; text-decoration: underline; min-height: 28px; }
  @media (max-width: 700px) {
    .dsh-bil-actions .dsh-bil-tool { min-width: 44px; min-height: 44px; }
    .dsh-bil-actions [data-act="guide"], .dsh-bil-actions [data-act="focus"], .dsh-bil-actions [data-act="new"] { display: none; }
    .dsh-bil-actions [data-act="pass"] { width: auto; padding: 0 8px; }
    .dsh-bil-actions [data-act="pass"]::after { display: inline; content: '工作'; font-size: 12px; }
    .dsh-bil-actions [data-act="help"]::after { display: none; }
    .dsh-bil-turn { top: 90px; }
    .dsh-bil-player { top: 154px; padding: 8px 9px; }
    .dsh-bil-player .dsh-bil-pips { margin-top: 6px; }
    .dsh-bil-host[data-desktop-chrome="true"] .dsh-bil-player { top: 186px; }
    .dsh-bil-panel-card { padding: 20px; }
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
        <div class="dsh-bil-brand"><span class="dsh-bil-brand-dot"></span>Harness 8-Ball <em>随时来一杆</em></div>
        <div class="dsh-bil-turn" data-tone="human"><span class="dsh-bil-turn-kicker">YOUR TURN</span><strong>轮到你</strong><small>按住蓄力 · 松开击球</small></div>
        <div class="dsh-bil-actions">
          <button class="dsh-bil-tool" type="button" data-act="help" data-label="帮助" aria-label="帮助与设置" title="帮助与设置">?</button>
          <button class="dsh-bil-tool" type="button" data-act="mute" aria-label="静音" aria-pressed="false" title="静音（M）"></button>
          <button class="dsh-bil-tool" type="button" data-act="guide" aria-label="辅助线" aria-pressed="true" title="辅助线（G）"></button>
          <button class="dsh-bil-tool" type="button" data-act="focus" data-label="透视" aria-label="背景：透视" aria-pressed="false" title="背景：透视（点击切换）"></button>
          <button class="dsh-bil-tool" type="button" data-act="new" aria-label="新的一局" title="新的一局（N）"></button>
          <button class="dsh-bil-tool" type="button" data-act="pass" data-label="回到工作" aria-label="暂停球局，操作 Harness（Alt+H）" title="暂停球局，操作 Harness（Alt+H）"></button>
          <button class="dsh-bil-tool" type="button" data-act="close" aria-label="收起球桌" title="收起球桌（Esc）"></button>
        </div>

        <section class="dsh-bil-player" data-side="human" data-active="true">
          <div class="dsh-bil-player-top"><div class="dsh-bil-player-name">你 <span>PLAYER</span></div><div class="dsh-bil-player-side">待定</div></div>
          <div class="dsh-bil-pips"></div>
          <div class="dsh-bil-player-meta"><b class="dsh-bil-human-wins">0</b> 胜 · <b class="dsh-bil-human-losses">0</b> 负</div>
        </section>
        <section class="dsh-bil-player" data-side="ai" data-active="false">
          <div class="dsh-bil-player-top"><div class="dsh-bil-player-name">DeepSeek</div><div class="dsh-bil-player-side">待定</div></div>
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
            <span>击球点</span>
            <b class="dsh-bil-spin-name">中杆</b>
            <small>拖动调整</small><button type="button" class="dsh-bil-spin-reset" data-act="spin-reset">回中</button>
          </div>
        </div>
        <div class="dsh-bil-corner dsh-bil-corner-right"><kbd>N</kbd> 新局 &nbsp; <kbd>G</kbd> 辅助 &nbsp; <kbd>M</kbd> 静音<br><kbd>Esc</kbd> 收起 &nbsp; <kbd>Alt+H</kbd> 回到工作</div>
        <div class="dsh-bil-toast" role="status"></div>
        <div class="dsh-bil-panel" hidden>
          <section class="dsh-bil-panel-card" role="dialog" aria-modal="true" aria-labelledby="dshBilPanelTitle" tabindex="-1">
            <header class="dsh-bil-panel-header"><h2 id="dshBilPanelTitle">帮助与设置</h2><button type="button" class="dsh-bil-panel-dismiss" data-act="panel-close" aria-label="关闭面板，继续游戏">×</button></header>
            <div data-panel="help">
              <p>对手使用浏览器本地 AI，无需调用 DeepSeek API。</p>
              <label>对手难度 <select data-pref="difficulty"><option value="easy">简单</option><option value="standard">标准</option><option value="hard">困难</option></select></label>
              <label>背景 <select data-pref="clarity"><option value="0">透视</option><option value="1">标准</option><option value="2">专注</option></select></label>
              <label>辅助线 <select data-pref="guide"><option value="true">显示</option><option value="false">隐藏</option></select></label>
              <label>力度控制 <select data-pref="fixedPower"><option value="0">按住蓄力</option><option value="0.2">固定 20% · 轻推</option><option value="0.45">固定 45% · 中力</option><option value="0.8">固定 80% · 大力</option></select></label>
              <div class="dsh-bil-help-title">操作</div>
              <p>鼠标或手指瞄准，按住蓄力、松开出杆。固定力度时轻点即可击球。方向键调整瞄准，Shift 精调；空格按住蓄力。自由球用方向键移动白球，Enter 确认。击球点支持方向键，Home 回中。</p>
              <p>Esc 先取消蓄力，再收起球桌。Alt+B 开关，Alt+H 暂停并回到工作。窗口变化只调整显示，不改变当前球局。</p>
              <div class="dsh-bil-help-title">休闲 8 球规则</div>
              <ol><li>开球进球不定花色；开球后第一颗合法进球确定全色／花色。</li><li>先碰本方球；清完本方球后，下一杆才能打黑八。未进球时，碰球后须有球碰库。</li><li>白球落袋、空杆或先碰错误目标判犯规，对方获得全台自由球。</li><li>提前进黑八或打黑八时犯规判负；开球黑八重摆。不指袋、不要求开球四球碰库，不模拟跳球和推杆。</li></ol>
              <div class="dsh-bil-help-title">球局摘要</div><p class="dsh-bil-summary"></p>
              <div class="dsh-bil-panel-footer"><button type="button" class="dsh-bil-btn" data-act="new">重新开始</button><button type="button" class="dsh-bil-btn" data-act="panel-close" data-primary="true">继续游戏</button></div>
            </div>
            <div data-panel="confirm" hidden><p>重新开始会结束当前球局。保留当前球局可选择继续游戏。</p><div class="dsh-bil-panel-footer"><button type="button" class="dsh-bil-btn" data-act="panel-close">继续游戏</button><button type="button" class="dsh-bil-btn" data-act="new-confirm" data-primary="true">确认重新开始</button></div></div>
          </section>
        </div>
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
              <button class="dsh-bil-btn" type="button" data-act="close">回到工作</button>
            </div>
          </div>
        </div>
        <div class="dsh-bil-sr" aria-live="polite"></div>
      </div>
    </div>
  `;
