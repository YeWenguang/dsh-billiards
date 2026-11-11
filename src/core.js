  const PLUGIN_ID = 'dsh-billiards';
  const STORAGE_KEY = 'dsh-billiards.v1';
  const SESSION_KEY = 'dsh-billiards.session.v1';
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

  // Liang-Barsky segment / axis-aligned rectangle test, used to tell whether
  // the aim line is hidden behind a floating HUD panel.
  function segmentHitsRect(x1, y1, x2, y2, minX, minY, maxX, maxY) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
      if (p === 0) return q >= 0;
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
      return true;
    };
    return clip(-dx, x1 - minX)
      && clip(dx, maxX - x1)
      && clip(-dy, y1 - minY)
      && clip(dy, maxY - y1)
      && t0 <= t1;
  }

  function loadPrefs() {
    const fallback = { muted: false, guide: true, clarity: 1, difficulty: 'standard', fixedPower: 0, wins: 0, losses: 0, streak: 0, best: 0, games: 0 };
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        muted: Boolean(raw.muted),
        guide: raw.guide !== false,
        clarity: raw.clarity === 0 || raw.clarity === 1 || raw.clarity === 2 ? raw.clarity : raw.focus ? 2 : 1,
        difficulty: ['easy', 'standard', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'standard',
        fixedPower: Number.isFinite(raw.fixedPower) ? clamp(raw.fixedPower, 0, 1) : 0,
        wins: Number.isFinite(raw.wins) ? Math.max(0, Math.floor(raw.wins)) : 0,
        losses: Number.isFinite(raw.losses) ? Math.max(0, Math.floor(raw.losses)) : 0,
        streak: Number.isFinite(raw.streak) ? Math.max(0, Math.floor(raw.streak)) : 0,
        best: Number.isFinite(raw.best) ? Math.max(0, Math.floor(raw.best)) : 0,
        games: Number.isFinite(raw.games) ? Math.max(0, Math.floor(raw.games)) : 0,
      };
    } catch {
      return fallback;
    }
  }
