'use strict';
/* =====================================================================
   Drawing: a tiny "pen" over Canvas 2D that mirrors the shapes the
   desktop version used (rect, oval, polygon, line, text).
   ===================================================================== */
const CELL = 32, COLS = 30, ROWS = 20, WW = COLS * CELL, WH = ROWS * CELL;
const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

class Pen {
  constructor(ctx) { this.c = ctx; }
  paint(fill, stroke, w) {
    const c = this.c;
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = w || 1; c.stroke(); }
  }
  R(x0, y0, x1, y1, fill, stroke, w) {
    const c = this.c; c.beginPath();
    c.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    this.paint(fill, stroke, w);
  }
  O(x0, y0, x1, y1, fill, stroke, w) {
    const c = this.c; c.beginPath();
    c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    this.paint(fill, stroke, w);
  }
  P(pts, fill, stroke, w) {      // flat [x0,y0,x1,y1,...]
    const c = this.c; c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); this.paint(fill, stroke, w);
  }
  L(x0, y0, x1, y1, col, w) {
    const c = this.c; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.strokeStyle = col; c.lineWidth = w || 2; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
  }
  half(x0, y0, x1, y1, col, w) {  // right half of an ellipse (bows)
    const c = this.c; c.beginPath();
    c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, -Math.PI / 2, Math.PI / 2);
    c.strokeStyle = col; c.lineWidth = w || 2; c.stroke();
  }
  T(x, y, text, col, size, align) {
    const c = this.c; c.font = `bold ${size || 12}px ${FONT}`;
    c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(text, x, y);
  }
}
const flat = pts => { const o = []; for (const p of pts) o.push(p[0], p[1]); return o; };

/* ---------------- hero ---------------- */
function heroGear() {
  const w = eqDef('weapon');
  return { armor: gearTier('armor'), weapon: w.tier || 0, ranged: w.style === 'ranged' };
}
function drawHero(pen, cx, cy, s, g) {
  const armor = D.ARMOR_COLORS[Math.min(3, g.armor)], wcol = D.WEAPON_COLORS[Math.min(3, g.weapon)];
  const R = (a, b, c, d, f) => pen.R(cx + a * s, cy + b * s, cx + c * s, cy + d * s, f);
  const O = (a, b, c, d, f) => pen.O(cx + a * s, cy + b * s, cx + c * s, cy + d * s, f);
  O(-10, 6, 10, 13, '#31522a');
  R(-6, 0, -1, 10, '#3b3b52'); R(1, 0, 6, 10, '#3b3b52');
  R(-8, -13, 8, 2, armor); R(-12, -12, -8, 0, armor); R(8, -12, 12, 0, armor);
  O(-6, -26, 6, -12, '#f1c79a'); R(-7, -27, 7, -20, '#4a2f1b');
  O(-3, -20, -1, -17, '#222222'); O(1, -20, 3, -17, '#222222');
  if (g.ranged) {
    pen.half(cx + 8 * s, cy - 26 * s, cx + 26 * s, cy + 6 * s, wcol, Math.max(2, 3 * s));
    pen.L(cx + 17 * s, cy - 26 * s, cx + 17 * s, cy + 6 * s, '#e8e4d0', Math.max(1, s));
  } else {
    pen.L(cx + 14 * s, cy - 2 * s, cx + 14 * s, cy - 24 * s, wcol, Math.max(2, 3 * s));
    pen.L(cx + 10 * s, cy - 8 * s, cx + 18 * s, cy - 8 * s, '#5a4630', Math.max(2, 2 * s));
  }
}

/* ---------------- enemies ---------------- */
function drawEnemy(pen, sp, cx, cy, scale) {
  const s = scale !== undefined ? scale : (sp.scale || 1.5), k = sp.kind;
  const c1 = sp.c1 || '#888888', c2 = sp.c2 || '#cccccc';
  const O = (a, b, c, d, f, o, w) => pen.O(cx + a * s, cy + b * s, cx + c * s, cy + d * s, f, o, w);
  const R = (a, b, c, d, f) => pen.R(cx + a * s, cy + b * s, cx + c * s, cy + d * s, f);
  const Pg = (pts, f) => { const o = []; for (const p of pts) o.push(cx + p[0] * s, cy + p[1] * s); pen.P(o, f); };
  const L = (a, b, c, d, col, w = 2) => pen.L(cx + a * s, cy + b * s, cx + c * s, cy + d * s, col, Math.max(1, w * s));
  O(-34, 20, 34, 34, '#000000');
  if (k === 'slime') {
    O(-30, -24, 30, 24, c1, '#2e6b2e', 2); O(-18, -16, -2, -4, '#d6ffd6');
    O(-14, -6, -4, 6, '#ffffff'); O(6, -6, 16, 6, '#ffffff'); O(-11, -2, -6, 4, '#111111'); O(9, -2, 14, 4, '#111111');
    if (sp.crown) { Pg([[-20, -22], [-16, -42], [-8, -28], [0, -46], [8, -28], [16, -42], [20, -22]], '#ffd23f'); O(-3, -38, 3, -32, '#e63946'); }
  } else if (k === 'skeleton') {
    R(-4, -10, 4, 22, c1);
    for (let i = 0; i < 3; i++) R(-16, -6 + i * 8, 16, -2 + i * 8, c1);
    R(-24, -12, -16, 10, c1); R(16, -12, 24, 10, c1);
    O(-14, -36, 14, -10, c1); O(-9, -28, -2, -20, '#222222'); O(2, -28, 9, -20, '#222222');
    O(-6, -26, -4, -22, c2); O(4, -26, 6, -22, c2); R(-8, -14, 8, -10, '#222222');
    if (sp.club) O(20, -4, 44, 22, '#8a8274'); else { R(26, -34, 30, 12, '#c8d2dc'); R(22, 8, 34, 12, '#5a4630'); }
  } else if (k === 'dragon') {
    Pg([[-20, -10], [-60, -44], [-40, -4]], c1); Pg([[20, -10], [60, -44], [40, -4]], c1);
    O(-26, -16, 26, 26, c1); O(-14, -4, 14, 22, c2);
    Pg([[14, -4], [40, -30], [50, -22], [30, 4]], c1); O(30, -40, 58, -16, c1);
    Pg([[34, -40], [36, -54], [42, -40]], c2); Pg([[48, -40], [52, -54], [54, -38]], c2);
    O(46, -32, 52, -26, '#ffe066'); Pg([[-26, 14], [-60, 24], [-30, 24]], c1);
  } else if (k === 'beast') {
    for (const lx of [-24, -10, 8, 20]) R(lx, 12, lx + 6, 26, c1);
    Pg([[-30, -2], [-46, -14], [-34, 8]], c1); O(-32, -10, 26, 18, c1); O(-16, 2, 14, 18, c2);
    O(14, -22, 42, 4, c1); Pg([[18, -22], [22, -34], [28, -22]], c1); Pg([[30, -22], [36, -34], [40, -20]], c1);
    O(30, -14, 35, -9, '#111111'); O(36, -6, 44, 2, c2);
    if (sp.tusks) Pg([[34, 0], [40, 10], [36, 0]], '#f5efd8');
  } else if (k === 'bird') {
    L(-6, 14, -8, 26, '#d9a03a'); L(6, 14, 8, 26, '#d9a03a');
    O(-24, -16, 18, 16, c1); O(10, -30, 30, -10, c1);
    Pg([[28, -24], [42, -18], [28, -16]], '#f0a030'); O(18, -26, 23, -21, '#ffffff'); O(20, -25, 22, -23, '#111111');
    Pg([[-16, -8], [-34, -22], [-4, 4]], c2);
  } else if (k === 'spider') {
    for (const ang of [-60, -30, 30, 60]) for (const sg of [-1, 1]) L(sg * 10, 0, sg * (34 + Math.abs(ang) * 0.1), ang * 0.5, c1, 3);
    O(-16, -10, 16, 16, c1); O(8, -6, 26, 10, c1); O(14, -2, 18, 2, c2); O(20, -2, 24, 2, c2);
  } else if (k === 'bat') {
    Pg([[-8, -4], [-50, -28], [-36, 6], [-20, 0]], c2); Pg([[8, -4], [50, -28], [36, 6], [20, 0]], c2);
    O(-10, -14, 10, 14, c1); Pg([[-8, -14], [-10, -26], [-2, -14]], c1); Pg([[8, -14], [10, -26], [2, -14]], c1);
    O(-5, -6, -1, -2, '#ff4d4d'); O(1, -6, 5, -2, '#ff4d4d');
  } else if (k === 'golem') {
    R(-26, -20, 26, 22, c1); R(-36, -14, -26, 14, c1); R(26, -14, 36, 14, c1); R(-16, -42, 16, -20, c1);
    R(-10, -34, -4, -28, c2); R(4, -34, 10, -28, c2); L(-14, -10, 0, 8, c2); L(6, -14, 18, 10, c2);
    R(-20, 22, -6, 30, c1); R(6, 22, 20, 30, c1);
  } else if (k === 'ghost') {
    Pg([[-22, 20], [-26, -10], [-14, -32], [0, -38], [14, -32], [26, -10], [22, 20], [12, 12], [2, 22], [-8, 12]], c1);
    O(-12, -22, -3, -8, '#1a1a2a'); O(3, -22, 12, -8, '#1a1a2a'); O(-6, -4, 6, 8, '#1a1a2a');
    O(-30, -2, -20, 6, c2); O(20, -2, 30, 6, c2);
  } else if (k === 'humanoid') {
    R(-8, 6, -1, 26, '#33333f'); R(1, 6, 8, 26, '#33333f');
    R(-14, -14, 14, 10, c1); R(-20, -12, -14, 8, c1); R(14, -12, 20, 8, c1);
    O(-10, -34, 10, -12, c2); O(-6, -26, -2, -22, '#222222'); O(2, -26, 6, -22, '#222222');
    if (sp.hat) { R(-14, -38, 14, -32, c1); R(-8, -48, 8, -36, c1); }
    if (sp.horns) { Pg([[-10, -30], [-14, -46], [-4, -34]], '#ffd23f'); Pg([[10, -30], [14, -46], [4, -34]], '#ffd23f'); }
    L(24, -30, 24, 14, '#8a7a6a', 3);
  } else if (k === 'crab') {
    O(-26, -8, 26, 20, c1); O(-44, -22, -26, -4, c2); O(26, -22, 44, -4, c2);
    for (let i = 0; i < 3; i++) { L(-20 + i * 6, 16, -34 + i * 4, 28, c1, 3); L(20 - i * 6, 16, 34 - i * 4, 28, c1, 3); }
    L(-10, -8, -12, -20, c1, 3); L(10, -8, 12, -20, c1, 3); O(-16, -24, -8, -16, '#ffffff'); O(8, -24, 16, -16, '#ffffff');
  } else if (k === 'kraken') {
    for (let i = 0; i < 5; i++) { const x = -30 + i * 15; L(x, 6, x + (i % 2 ? -6 : 6), 30, c2, 5); }
    O(-30, -30, 30, 14, c1); O(-16, -14, -4, -2, '#ffffff'); O(4, -14, 16, -2, '#ffffff');
    O(-11, -10, -7, -4, '#111111'); O(9, -10, 13, -4, '#111111');
  } else O(-24, -24, 24, 24, c1);
}

/* ---------------- item icons (~34px box) ---------------- */
function iconSpec(id) { return D.ICON_SPECS[id] || ['rock', '#888888', '#bbbbbb']; }
function drawIcon(pen, spec, cx, cy, s = 1) {
  const [kind, c1, c2] = spec;
  const R = (a, b, c, d, f, o) => pen.R(cx + a * s, cy + b * s, cx + c * s, cy + d * s, f, o);
  const O = (a, b, c, d, f, o) => pen.O(cx + a * s, cy + b * s, cx + c * s, cy + d * s, f, o);
  const P = (pts, f, o) => pen.P(pts.map((v, i) => i % 2 ? cy + v * s : cx + v * s), f, o);
  const L = (a, b, c, d, col, w = 2) => pen.L(cx + a * s, cy + b * s, cx + c * s, cy + d * s, col, Math.max(1, w * s));
  switch (kind) {
    case 'log': R(-13, -7, 9, 7, c1, '#4a2f1b'); O(4, -7, 15, 7, c2, '#4a2f1b'); O(8, -3, 12, 3, c1); break;
    case 'rock': P([-12, 9, -14, -1, -6, -11, 6, -10, 13, -1, 12, 9], c1, '#444444'); P([-6, -8, 4, -8, 0, -2], c2); break;
    case 'ore': P([-12, 9, -14, -1, -6, -11, 6, -10, 13, -1, 12, 9], c1, '#444444'); O(-7, -3, -2, 2, c2); O(2, -6, 7, -1, c2); O(1, 2, 6, 7, c2); break;
    case 'bar': P([-13, 7, -9, -3, 13, -3, 9, 7], c1, '#333333'); P([-9, -3, -5, -8, 9, -8, 13, -3], c2, '#333333'); break;
    case 'gem': P([-11, -4, -5, -11, 5, -11, 11, -4, 0, 12], c1, '#222222'); P([-5, -11, 5, -11, 0, -4], c2); L(-11, -4, 11, -4, c2, 1); break;
    case 'bone': L(-9, 6, 9, -6, c1, 5); O(-14, 3, -7, 10, c1); O(-12, 6, -5, 13, c1); O(7, -12, 14, -5, c1); O(5, -14, 12, -7, c1); break;
    case 'blob': O(-12, -8, 12, 10, c1, '#2e8b2e'); O(-7, -5, -1, 0, c2); O(-4, 0, -1, 4, '#111111'); O(3, 0, 6, 4, '#111111'); break;
    case 'mushroom': R(-3, 0, 3, 11, c2); P([-13, 1, -10, -9, 0, -13, 10, -9, 13, 1], c1, '#222222'); O(-6, -8, -2, -4, c2); O(3, -6, 7, -2, c2); break;
    case 'scale': P([-11, 0, -6, -10, 6, -10, 11, 0, 6, 10, -6, 10], c1, '#222222'); P([-6, 0, -3, -6, 3, -6, 6, 0, 3, 6, -3, 6], c2); break;
    case 'ring': O(-10, -4, 10, 14, '', c1); O(-8, -2, 8, 12, '', c1); O(-5, -12, 5, -2, c2, '#222222'); break;
    case 'amulet': L(-12, -12, 0, 2, c1); L(12, -12, 0, 2, c1); P([0, -2, 8, 5, 0, 14, -8, 5], c2, c1); break;
    case 'seed': O(-10, -3, -2, 7, c1); O(0, -9, 8, 1, c1); O(0, 1, 9, 10, c2); break;
    case 'nest': O(-13, 0, 13, 12, c1, '#4a2f1b'); O(-6, -4, -1, 2, c2); O(1, -5, 6, 1, c2); break;
    case 'drop': P([0, -13, 9, 2, 6, 10, 0, 12, -6, 10, -9, 2], c1, '#222222'); O(-3, 1, 1, 6, c2); break;
    case 'geode': O(-12, -10, 12, 11, c1, '#444444'); O(-7, -5, 7, 7, c2); L(-3, -3, 3, 5, '#ffffff', 1); break;
    case 'fish': O(-12, -7, 8, 7, c1, '#333333'); P([8, 0, 15, -8, 15, 8], c1); O(-8, -3, -4, 1, '#ffffff'); L(-2, -6, -2, 6, c2); break;
    case 'feather': P([-12, 11, -4, -2, 4, -12, 12, -11, 8, -2, 0, 6], c1, '#555555'); L(-12, 11, 10, -10, c2); break;
    case 'tusk': P([-8, 10, -6, -8, 4, -12, 0, -2, 2, 10], c1, c2); break;
    case 'pelt': P([-12, -8, 12, -8, 14, 4, 8, 12, -8, 12, -14, 4], c1, '#333333'); L(-8, 12, -8, 15, c2); L(0, 12, 0, 15, c2); L(8, 12, 8, 15, c2); break;
    case 'silk': for (let a = 0; a < 360; a += 60) L(0, 0, 12 * Math.cos(a * Math.PI / 180), 12 * Math.sin(a * Math.PI / 180), c1, 1); O(-6, -6, 6, 6, '', c1); break;
    case 'wing': P([-13, 8, -8, -8, 0, -2, 8, -10, 13, 8, 4, 2, 0, 8, -4, 2], c1, c2); break;
    case 'shard': P([-6, 11, -10, -2, -2, -12, 6, -6, 10, 4, 3, 12], c1, '#222222'); P([-2, -12, 6, -6, 0, 0], c2); break;
    case 'orb': O(-11, -11, 11, 11, c1, '#222222'); O(-6, -8, 0, -2, c2); break;
    case 'flower': for (const [ox, oy] of [[-7, -2], [7, -2], [0, -9], [-4, 6], [4, 6]]) O(ox - 5, oy - 5, ox + 5, oy + 5, c1); O(-4, -3, 4, 5, c2); break;
    case 'coin': O(-11, -11, 11, 11, c1, c2); O(-6, -6, 6, 6, '', c2); break;
    case 'shell': P([0, 11, -13, -2, -8, -10, 0, -12, 8, -10, 13, -2], c1, '#8b5a2b'); for (const x of [-6, 0, 6]) L(0, 11, x * 1.6, -10, c2, 1); break;
    case 'crown': P([-12, 8, -12, -8, -6, 0, 0, -11, 6, 0, 12, -8, 12, 8], c1, '#6b4a00'); O(-3, -3, 3, 3, c2); break;
    case 'heart': O(-12, -10, 0, 2, c1); O(0, -10, 12, 2, c1); P([-12, -3, 12, -3, 0, 12], c1); O(-8, -7, -4, -3, c2); break;
    case 'arrow': L(-12, 10, 8, -10, '#8b5a2b'); P([8, -10, 13, -13, 11, -6], c1); P([-12, 10, -16, 8, -10, 6], c2); P([-12, 10, -14, 14, -8, 12], c2); break;
    case 'axe': L(-9, 12, 8, -10, c2, 3); P([2, -12, 13, -8, 13, 3, 6, -2], c1, '#333333'); break;
    case 'pickaxe': L(-9, 12, 8, -8, c2, 3); P([-8, -8, 0, -12, 12, -6, 6, -4, 0, -7, -6, -3], c1, '#333333'); break;
    case 'sword': P([6, -13, 10, -9, -6, 7, -9, 4], c1, '#333333'); L(-10, 2, -2, 10, c2, 3); L(-12, 12, -6, 6, c2, 3); break;
    case 'bow': pen.half(cx - 10 * s, cy - 14 * s, cx + 12 * s, cy + 14 * s, c1, Math.max(2, 3 * s)); L(1, -14, 1, 14, c2, 1); break;
    case 'armor': P([-13, -8, -6, -12, 6, -12, 13, -8, 10, 0, 8, 12, -8, 12, -10, 0], c1, '#222222'); P([-5, -12, 5, -12, 0, -6], c2); L(0, -6, 0, 10, c2); break;
    case 'potion': R(-3, -12, 3, -6, c2); R(-4, -7, 4, -3, '#9aa4b2'); O(-11, -5, 11, 13, c1, '#333333'); O(-6, -1, -2, 4, '#ffffff'); break;
    default: O(-10, -10, 10, 10, c1);
  }
}
const iconCache = {};
function iconURL(id) {     // data-URL of a 46x46 icon (cached)
  if (!iconCache[id]) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 46;
    drawIcon(new Pen(cv.getContext('2d')), iconSpec(id), 23, 23, 1);
    iconCache[id] = cv.toDataURL();
  }
  return iconCache[id];
}
const spriteCache = {};
function spriteURL(sp) {   // data-URL of a small monster picture (cached)
  const key = JSON.stringify(sp);
  if (!spriteCache[key]) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 56;
    drawEnemy(new Pen(cv.getContext('2d')), sp, 28, 33, 0.62);
    spriteCache[key] = cv.toDataURL();
  }
  return spriteCache[key];
}

/* ---------------- world terrain + static scenery ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function buildTerrain() {
  const rng = mulberry32(11);
  const solid = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (x === 0 || x === COLS - 1 || y < 2 || y >= ROWS - 2) solid[y][x] = true;
  }
  const path = new Set();
  for (let x = 1; x < COLS - 1; x++) { path.add(x + ',9'); path.add(x + ',10'); }
  for (let y = 5; y < ROWS - 2; y++) { path.add('14,' + y); path.add('15,' + y); }
  const blocked = new Set(), rects = {};
  for (const [sid, label, [tx, ty, tw, th]] of D.STATIONS) {
    rects[sid] = [tx * CELL, ty * CELL, (tx + tw) * CELL, (ty + th) * CELL];
    for (let i = 0; i < tw; i++) for (let j = 0; j < th; j++) solid[ty + j][tx + i] = true;
    for (let i = -1; i <= tw; i++) for (let j = -1; j <= th; j++) blocked.add((tx + i) + ',' + (ty + j));
  }
  const decor = [];
  for (let y = 2; y < ROWS - 2; y++) for (let x = 1; x < COLS - 1; x++) {
    const key = x + ',' + y;
    if (path.has(key) || blocked.has(key) || solid[y][x]) continue;
    const r = rng();
    if (r < 0.07) { decor.push(['tree', x, y]); solid[y][x] = true; }
    else if (r < 0.10) { decor.push(['rock', x, y]); solid[y][x] = true; }
    else if (r < 0.17) decor.push(['flower', x, y]);
  }
  return { solid, rects, decor };
}
function drawTree(pen, x, y) {
  pen.R(x + 13, y + 18, x + 19, y + 31, '#6b4423');
  pen.O(x + 2, y + 1, x + 30, y + 24, '#2e6b2b'); pen.O(x + 7, y - 3, x + 25, y + 15, '#3a8a35'); pen.O(x + 11, y, x + 19, y + 7, '#4fa646');
}
function drawRock(pen, x, y) {
  pen.P([x + 4, y + 26, x + 8, y + 10, x + 18, y + 5, x + 28, y + 12, x + 29, y + 26], '#8a8a92', '#55555c');
  pen.P([x + 10, y + 12, x + 18, y + 7, x + 22, y + 14], '#a9a9b2');
}
function stationLabel(pen, cx, y, text) {
  pen.T(cx + 1, y + 1, text, '#000000', 11); pen.T(cx, y, text, '#ffffff', 11);
}
/* Static scenery. Animated bits are registered in `dyn` and drawn each frame. */
function drawWorldStatic(pen, T, dyn) {
  const rng = mulberry32(23), pick = a => a[Math.floor(rng() * a.length)];
  pen.R(0, 0, WW, WH, '#4f8a3c');
  for (let i = 0; i < 520; i++) { const x = rng() * WW, y = rng() * WH; pen.R(x, y, x + 3, y + 2, pick(['#5a9944', '#447a33', '#589a45'])); }
  for (const [x0, y0, x1, y1] of [[CELL, 9 * CELL, (COLS - 1) * CELL, 11 * CELL], [14 * CELL, 5 * CELL, 16 * CELL, (ROWS - 2) * CELL]]) {
    pen.R(x0, y0, x1, y1, '#cdb07a');
    for (let i = 0; i < 60; i++) { const sx = x0 + rng() * (x1 - x0 - 3), sy = y0 + rng() * (y1 - y0 - 2); pen.R(sx, sy, sx + 3, sy + 2, pick(['#b99b63', '#dcc08a'])); }
  }
  for (const [kind, x, y] of T.decor) if (kind === 'flower') {
    const fx = x * CELL + 6 + rng() * 18, fy = y * CELL + 6 + rng() * 18;
    pen.O(fx, fy, fx + 5, fy + 5, pick(['#ff7eb6', '#ffd23f', '#ffffff', '#9b8cff']));
  }
  pen.R(0, 0, WW, 2 * CELL, '#1f4a1f'); pen.R(0, (ROWS - 2) * CELL, WW, WH, '#1f4a1f');
  pen.R(0, 0, CELL, WH, '#1f4a1f'); pen.R((COLS - 1) * CELL, 0, WW, WH, '#1f4a1f');
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (x === 0 || x === COLS - 1 || y < 2 || y >= ROWS - 2) drawTree(pen, x * CELL, y * CELL);
  for (const [kind, x, y] of T.decor) { if (kind === 'tree') drawTree(pen, x * CELL, y * CELL); else if (kind === 'rock') drawRock(pen, x * CELL, y * CELL); }
  for (const [sid, label, [tx, ty, tw, th]] of D.STATIONS) {
    STATION_DRAW[sid](pen, tx * CELL, ty * CELL, tw * CELL, th * CELL, dyn);
    stationLabel(pen, (tx + tw / 2) * CELL, ty * CELL - 7, label);
  }
}
const STATION_DRAW = {
  forest(p, x, y, w, h) { p.R(x, y, x + w, y + h, '#2f6a2c'); for (let i = 0; i < w / CELL; i++) for (let j = 0; j < h / CELL; j++) drawTree(p, x + i * CELL, y + j * CELL); },
  quarry(p, x, y, w, h) {
    p.R(x, y, x + w, y + h, '#7a756e', '#4a4640', 2);
    for (let i = 0; i < w / CELL; i++) for (let j = 0; j < h / CELL; j++) drawRock(p, x + i * CELL, y + j * CELL);
    for (const [ox, oy, col] of [[20, 20, '#d4a02b'], [70, 40, '#c46b2f'], [100, 18, '#d4a02b'], [50, 74, '#c46b2f']]) p.O(x + ox, y + oy, x + ox + 7, y + oy + 7, col);
  },
  pond(p, x, y, w, h, dyn) {
    p.R(x, y, x + w, y + h, '#3b8fd9', '#2a6db0', 3); p.O(x + 10, y + 10, x + w - 10, y + h - 10, '#4aa3ee');
    for (let i = 0; i < 7; i++) dyn.waves.push([x + 14 + (i % 3) * 46, y + 22 + Math.floor(i / 3) * 34]);
    p.O(x + w - 40, y + 12, x + w - 24, y + 22, '#7cc4ff');
  },
  furnace(p, x, y, w, h, dyn) {
    p.R(x + 40, y + 2, x + 52, y + 18, '#6e6e76', '#4a4a52'); p.R(x + 6, y + 14, x + 58, y + 62, '#8a8a92', '#4a4a52', 2);
    for (let j = 0; j < 4; j++) p.L(x + 6, y + 26 + j * 10, x + 58, y + 26 + j * 10, '#6e6e76', 1);
    p.R(x + 20, y + 32, x + 44, y + 62, '#111111');
    dyn.flames.push([x + 25, y + 42, x + 39, y + 60], [x + 28, y + 48, x + 36, y + 60]);
  },
  anvil(p, x, y) {
    p.R(x + 20, y + 36, x + 44, y + 62, '#7a5230', '#4a3018', 2);
    p.P([x + 6, y + 24, x + 56, y + 24, x + 46, y + 32, x + 40, y + 38, x + 24, y + 38, x + 18, y + 32], '#3d4452', '#1f2430');
    p.R(x + 14, y + 20, x + 52, y + 26, '#5b6475');
  },
  cauldron(p, x, y, w, h, dyn) {
    p.R(x + 14, y + 52, x + 22, y + 62, '#333333'); p.R(x + 42, y + 52, x + 50, y + 62, '#333333');
    p.O(x + 8, y + 20, x + 56, y + 60, '#222222', '#000000', 2); p.O(x + 8, y + 16, x + 56, y + 34, '#444444', '#000000', 2);
    p.O(x + 13, y + 19, x + 51, y + 31, '#7be04a');
    for (let i = 0; i < 3; i++) dyn.bubbles.push([x + 18 + i * 12, y + 24, i * 2.1, '#b9f58f']);
  },
  kitchen(p, x, y, w, h, dyn) {
    p.R(x + 4, y + 24, x + 60, y + 62, '#a86b3c', '#6b4423', 2);
    p.P([x - 2, y + 26, x + 32, y + 2, x + 66, y + 26], '#b03a2e', '#7a2118');
    p.R(x + 26, y + 40, x + 38, y + 62, '#4a2f1b'); p.R(x + 44, y + 6, x + 54, y + 18, '#6e6e76');
    for (let i = 0; i < 2; i++) dyn.bubbles.push([x + 46, y + 4 - i * 6, i * 3.0, '#dddddd']);
  },
  farm(p, x, y, w, h, dyn) {
    dyn.farm = [x, y, w, h]; p.R(x, y, x + w, y + h, '#6b4423', '#8b5a2b', 4);
    for (let j = 1; j < 5; j++) p.L(x + 8, y + j * h / 5, x + w - 8, y + j * h / 5, '#573618', 3);
  },
  shop(p, x, y) {
    p.R(x + 4, y + 22, x + 60, y + 62, '#d9b36c', '#8b6a2b', 2);
    for (let i = 0; i < 4; i++) p.R(x + 2 + i * 15, y + 12, x + 17 + i * 15, y + 28, i % 2 === 0 ? '#d63a3a' : '#ffffff', '#8b2020');
    p.R(x + 8, y + 36, x + 56, y + 46, '#8b5a2b'); p.T(x + 32, y + 54, '$', '#ffd23f', 14);
  },
  quests(p, x, y, w, h, dyn) {
    p.R(x + 8, y + 30, x + 14, y + 62, '#6b4423'); p.R(x + 50, y + 30, x + 56, y + 62, '#6b4423');
    p.R(x + 2, y + 8, x + 62, y + 40, '#9c6b3a', '#5a3a1a', 3);
    for (const [px, py, col] of [[8, 12, '#f5f0dc'], [26, 14, '#fff3b0'], [44, 12, '#f5f0dc'], [16, 26, '#fff3b0']]) p.R(x + px, y + py, x + px + 12, y + py + 12, col, '#bbbbbb');
    dyn.qmark = [x + 32, y - 8];
  },
  factory(p, x, y, w, h) {
    p.R(x + 4, y + 18, x + w - 4, y + h - 2, '#6c7a89', '#3f4955', 2);
    p.R(x + 14, y + 2, x + 26, y + 20, '#555f6b', '#3f4955'); p.R(x + w - 30, y + 6, x + w - 18, y + 20, '#555f6b', '#3f4955');
    for (let i = 0; i < 3; i++) p.R(x + 14 + i * 28, y + 28, x + 30 + i * 28, y + 42, '#ffd986', '#3f4955');
    const gx = x + w - 24, gy = y + h - 14;
    p.O(gx - 9, gy - 9, gx + 9, gy + 9, '#aab4c0', '#3f4955', 2); p.O(gx - 3, gy - 3, gx + 3, gy + 3, '#3f4955');
  },
  altar(p, x, y, w, h, dyn) {
    p.O(x + 2, y + 24, x + 62, y + 62, '#8c8c99', '#55555f', 3); p.O(x + 10, y + 30, x + 54, y + 56, '#6c6c7a');
    p.R(x + 4, y + 20, x + 12, y + 50, '#a3a3b0', '#55555f'); p.R(x + 52, y + 20, x + 60, y + 50, '#a3a3b0', '#55555f');
    dyn.crystal = [x, y];
  },
  dungeon(p, x, y, w, h) {
    p.P([x, y + h, x + 10, y + 30, x + 48, y + 8, x + 86, y + 30, x + w, y + h], '#6e6a64', '#3b3834');
    p.O(x + 28, y + 40, x + 68, y + h + 20, '#0b0b0f', '#000000', 2); p.O(x + 38, y + 62, x + 44, y + 68, '#ff3b3b'); p.O(x + 52, y + 62, x + 58, y + 68, '#ff3b3b');
  },
  boss(p, x, y, w, h, dyn) {
    p.R(x + 2, y + 10, x + 22, y + h, '#3a3347', '#1e1a26', 2); p.R(x + w - 22, y + 10, x + w - 2, y + h, '#3a3347', '#1e1a26', 2);
    p.R(x + 22, y + 30, x + w - 22, y + h, '#120f18'); p.O(x + 28, y + 6, x + w - 28, y + 38, '#cfc7b8', '#6b6458', 2);
    p.O(x + 34, y + 16, x + 42, y + 26, '#111111'); p.O(x + w - 42, y + 16, x + w - 34, y + 26, '#111111');
    p.O(x + 40, y + 62, x + 48, y + 70, '#b44dff'); p.O(x + w - 48, y + 62, x + w - 40, y + 70, '#b44dff');
    dyn.bmark = [x + w / 2, y - 8];
  },
};
function drawWorker(pen, x, y, color) {
  pen.O(x - 5, y - 18, x + 5, y - 8, '#f1c79a'); pen.R(x - 6, y - 8, x + 6, y + 6, color); pen.L(x + 8, y - 12, x + 8, y + 4, '#5a4630', 2);
}
