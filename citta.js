// citta.js — Palermo made recognisable: the monuments modelled one by one on their real footprints,
// Monte Pellegrino with Castello Utveggio, the port, the three street markets, carriages and street lamps.
let A = null;
export const stalls = [];     // market stalls: { x, y, nx, ny, kind, market }  (nx, ny point into the street)
export const carriages = [];  // { x, y, a }
export const OWN_PRETORIA = true;

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// ---- small builders in world coords (x east, y north, heights up)
const bx = (b, x, y, y0, y1, len, wid, col, ang = 0) => A.addBox(b, x, (y0 + y1) / 2, y, len, y1 - y0, wid, col, ang);
const cy = (b, x, y, y0, y1, r, col, seg = 12) => A.addCyl(b, x, (y0 + y1) / 2, y, r, y1 - y0, col, seg);
function dm(b, x, y, up, r, ry, col) {
  const T = A.THREE;
  b.geom(A.domeGeo, new T.Matrix4().compose(new T.Vector3(x, up, -y), new T.Quaternion(), new T.Vector3(r, ry, r)), col);
}
function spire(b, x, y, up, r, h, col, ang = 0) {
  const T = A.THREE;
  b.geom(A.coneGeo, new T.Matrix4().compose(new T.Vector3(x, up + h / 2, -y), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ang + Math.PI / 4), new T.Vector3(r, h, r)), col);
}
const gable = (b, x, y, up, depth, h, wid, col, ang) => A.addGeo(b, A.prismGeo, x, up, y, depth, h, wid, col, ang);
function solidBox(x, y, len, wid, ang, h) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const c = [[-len / 2, -wid / 2], [len / 2, -wid / 2], [len / 2, wid / 2], [-len / 2, wid / 2]].map(([a, d]) => [x + ca * a - sa * d, y + sa * a + ca * d]);
  for (let j = 0; j < 4; j++) A.addSeg(c[j], c[(j + 1) % 4], h);
}
// a slender tiered tower with a spire
function tower(b, x, y, w, h1, h2, col, ang, cap) {
  bx(b, x, y, 0, h1, w, w, col, ang);
  bx(b, x, y, h1, h1 + 0.5, w + 0.5, w + 0.5, A.marble, ang);
  bx(b, x, y, h1 + 0.5, h2, w * 0.78, w * 0.78, col, ang);
  for (const s of [-1, 1]) for (const t of [-1, 1]) bx(b, x + Math.cos(ang) * s * w * 0.41 - Math.sin(ang) * t * w * 0.41, y + Math.sin(ang) * s * w * 0.41 + Math.cos(ang) * t * w * 0.41, h1 + 0.5, h1 + 3.2, 0.5, 0.5, A.marble, ang);
  spire(b, x, y, h2, w * 0.62, w * 1.25, cap || col, ang);
}
// the long axis of a footprint, with the reach of the polygon along it and across it
function frame(S) {
  const a = A.mainAxis(S.pts), f = { ux: Math.cos(a), uy: Math.sin(a) };
  return setP(f, S);
}
function setP(f, S) {
  f.px = -f.uy; f.py = f.ux; f.a = Math.atan2(f.uy, f.ux);
  f.e0 = A.reach(S.pts, S.cx, S.cy, f.ux, f.uy); f.e1 = A.reach(S.pts, S.cx, S.cy, -f.ux, -f.uy);
  f.w0 = A.reach(S.pts, S.cx, S.cy, f.px, f.py); f.w1 = A.reach(S.pts, S.cx, S.cy, -f.px, -f.py);
  f.at = (s, t) => [S.cx + f.ux * s + f.px * t, S.cy + f.uy * s + f.py * t];
  return f;
}
const flipU = (f, S) => { f.ux = -f.ux; f.uy = -f.uy; return setP(f, S); };
// make the +p side of a frame the one that faces a point
function faceP(f, S, x, y) { if ((x - S.cx) * f.px + (y - S.cy) * f.py < 0) { flipU(f, S); } return f; }
function nearRoad(x, y, names) {
  let best = null;
  for (const n of names) { const r = A.nearestRoadDir(x, y, 1, n); if (r.road && (!best || r.d < best.d)) best = r; }
  return best;
}
function body(buf, S, h, col, roof) {
  A.extrude(buf, S.pts, h, col, 3, (h - 0.5) / A.FLOOR, S.si * 7 + 3, null, roof || A.C('#cdbf9f'));
}
function merlons(buf, S, h, col) {
  const r = A.ccw(S.pts);
  for (let j = 0; j < r.length; j++) {
    const p = r[j], q = r[(j + 1) % r.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let s = 0.8; s < L - 0.5; s += 1.7) { const k = s / L; bx(buf, p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, h, h + 0.95, 0.75, 0.7, col, Math.atan2(q[1] - p[1], q[0] - p[0])); }
  }
}
const RED = '#c0452f';

// ------------------------------------------------------------------ the Cathedral
function cattedrale(buf, gbuf, S) {
  const C = A.C, gold = C('#dfc590'), pale = C('#e9dcc0'), lead = C('#d6d2c4');
  const f = S.f, h = 19, L = f.e0 + f.e1, hw = Math.min(f.w0, f.w1, 20);
  body(buf, S, h, gold, C('#cdbf9f'));
  merlons(buf, S, h, gold);
  // raised nave with its own crenellated parapet
  const [nx, ny] = f.at((f.e0 - f.e1) / 2 - L * 0.04, 0);
  bx(buf, nx, ny, h, h + 6.5, L * 0.66, 15, gold, f.a);
  bx(buf, nx, ny, h + 6.5, h + 7.1, L * 0.66 + 0.6, 15.6, pale, f.a);
  for (let s = -L * 0.33 + 1; s < L * 0.33; s += 1.8) for (const t of [-7.6, 7.6]) bx(buf, nx + f.ux * s + f.px * t, ny + f.uy * s + f.py * t, h + 7.1, h + 8, 0.8, 0.5, gold, f.a);
  // the neoclassical dome over the crossing, towards the apses
  const [dx, dy] = f.at(f.e0 - L * 0.3, 0);
  cy(buf, dx, dy, h + 6, h + 15, 9.2, pale, 20);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; bx(buf, dx + Math.cos(a) * 9.25, dy + Math.sin(a) * 9.25, h + 8, h + 13.5, 0.5, 1.5, C('#3a4250'), a); }
  cy(buf, dx, dy, h + 15, h + 15.8, 9.9, lead, 20);
  dm(buf, dx, dy, h + 15.8, 9.4, 9.8, lead);
  cy(buf, dx, dy, h + 25, h + 29, 1.7, pale, 10); dm(buf, dx, dy, h + 29, 1.9, 2.2, lead); cy(buf, dx, dy, h + 31, h + 33.5, 0.12, C('#3a3a3e'), 5);
  // four corner towers; the two on the west front are the tall ones
  for (const [s, tall] of [[-f.e1 + 3.2, 1], [f.e0 - 3.2, 0]]) for (const t of [-1, 1]) {
    const [tx, ty] = f.at(s, t * (hw - 2.6));
    tower(buf, tx, ty, 4.6, h + (tall ? 15 : 9), h + (tall ? 27 : 17), gold, f.a, pale);
  }
  // the row of little majolica domes over the side aisles
  for (let s = -f.e1 + 17; s < f.e0 - L * 0.3 - 13; s += 8.6) for (const t of [-1, 1]) {
    const [qx, qy] = f.at(s, t * (hw - 5.6));
    cy(buf, qx, qy, h, h + 1.9, 2.5, pale, 10); dm(buf, qx, qy, h + 1.9, 2.7, 2.6, C(t > 0 ? '#bcd0c0' : '#c9d4c2')); cy(buf, qx, qy, h + 4.4, h + 5.4, 0.35, pale, 6);
  }
  // the Gothic-Catalan south portico on the piazza: three arches between two turrets, a gable on top
  const ps = (f.e0 - f.e1) / 2 - L * 0.1, pa = Math.atan2(f.py, f.px);
  const [gx, gy] = f.at(ps, hw + 3.3);
  for (const s of [-9.2, 9.2]) { const [tx, ty] = f.at(ps + s, hw + 3.4); tower(buf, tx, ty, 3.4, 15.5, 20, gold, f.a, pale); solidBox(tx, ty, 3.4, 3.4, f.a, 15); }
  for (const s of [-2.6, 2.6]) { const [qx, qy] = f.at(ps + s, hw + 5.6); cy(buf, qx, qy, 0.6, 7.2, 0.42, A.marble, 8); cy(buf, qx, qy, 0, 0.6, 0.7, pale, 8); cy(buf, qx, qy, 7.2, 7.8, 0.7, pale, 8); A.circles.push({ x: qx, y: qy, r: 0.6 }); }
  bx(buf, gx, gy, 0, 0.5, 6.8, 15.2, pale, pa);                                   // the steps
  bx(buf, ...f.at(ps, hw + 5.6), 7.8, 12.6, 1.3, 15, gold, pa);                   // wall over the arches
  for (const s of [-5.2, 0, 5.2]) bx(buf, ...f.at(ps + s, hw + 6.3), 7.8, 10.4, 0.2, 3.1, C('#6b5a48'), pa); // the pointed arch heads
  bx(buf, gx, gy, 12.6, 13.2, 7.2, 15.8, pale, pa);
  gable(buf, gx, gy, 13.2, 7, 4.4, 15.4, gold, pa);
  // the west front joins the bell tower across Via Bonello with two great pointed arches
  const [bxp, byp] = f.at(-f.e1 - 15.5, 0);
  bx(buf, bxp, byp, 0, 27, 13, 13, gold, f.a); bx(buf, bxp, byp, 27, 27.8, 13.8, 13.8, pale, f.a);
  solidBox(bxp, byp, 13, 13, f.a, 27);
  bx(buf, bxp, byp, 27.8, 38, 6.4, 6.4, gold, f.a); spire(buf, bxp, byp, 38, 4.4, 7.5, pale, f.a);
  for (const s of [-1, 1]) for (const t of [-1, 1]) tower(buf, bxp + f.ux * s * 5 + f.px * t * 5, byp + f.uy * s * 5 + f.py * t * 5, 2.6, 33, 36.5, gold, f.a, pale);
  for (const t of [-5.6, 5.6]) { bx(buf, ...f.at(-f.e1 - 4.6, t), 13.5, 17, 9.4, 1.5, gold, f.a); bx(buf, ...f.at(-f.e1 - 4.6, t), 17, 17.5, 9.4, 1.9, pale, f.a); }
  // Santa Rosalia on her pedestal in the piazza
  const [rx, ry] = S.rosalia;
  bx(buf, rx, ry, 0, 0.5, 3.4, 3.4, pale, f.a); bx(buf, rx, ry, 0.5, 4.2, 1.9, 1.9, A.marble, f.a); bx(buf, rx, ry, 4.2, 4.5, 2.3, 2.3, pale, f.a);
  bx(buf, rx, ry, 4.5, 6.6, 0.75, 0.6, A.marble, pa); bx(buf, rx, ry, 6.6, 7.15, 0.5, 0.5, A.marble, pa); bx(buf, rx + f.px * 0.3, ry + f.py * 0.3, 5.6, 5.85, 0.3, 1.5, A.marble, pa);
}

// ------------------------------------------------------------------ San Cataldo, the Martorana, San Giovanni degli Eremiti
function sanCataldo(buf, gbuf, S) {
  const C = A.C, stone = C('#d9c08e'), f = S.f, h = 11;
  A.extrude(buf, S.pts, h, stone, 0, 3, S.si, null, C('#cdbf9f'));
  merlons(buf, S, h, stone);
  bx(buf, S.cx, S.cy, h, h + 2, (f.e0 + f.e1) * 0.86, 5.4, stone, f.a);
  for (const s of [-1, 0, 1]) { const [x, y] = f.at((f.e0 - f.e1) / 2 + s * (f.e0 + f.e1) * 0.29, 0); cy(buf, x, y, h + 2, h + 2.9, 2.35, stone, 12); dm(buf, x, y, h + 2.9, 2.3, 2.45, C(RED)); }
  // blind arches on the long walls
  for (const t of [-1, 1]) for (let s = -1; s <= 1; s++) { const [x, y] = f.at((f.e0 - f.e1) / 2 + s * (f.e0 + f.e1) * 0.29, t * (Math.min(f.w0, f.w1) + 0.04)); bx(buf, x, y, 1.2, 8.6, 2.2, 0.12, C('#bfa672'), f.a); bx(buf, x, y, 4.8, 7.4, 0.9, 0.16, C('#3a3a40'), f.a); }
}
function martorana(buf, gbuf, S) {
  const C = A.C, stone = C('#e2cfa2'), f = S.f, h = 13;
  body(buf, S, h, stone);
  const [dx, dy] = f.at((f.e0 - f.e1) / 2 + 3, 0);
  cy(buf, dx, dy, h, h + 2.4, 2.9, stone, 12); dm(buf, dx, dy, h + 2.4, 3, 2.8, C('#d8d2c2'));
  // the four-storey Norman campanile at the entrance end, lighter and more open towards the top
  const [tx, ty] = S.camp;
  bx(buf, tx, ty, 0, 10, 6.2, 6.2, stone, f.a); bx(buf, tx, ty, 10, 10.5, 6.8, 6.8, A.marble, f.a);
  bx(buf, tx, ty, 10.5, 17, 5.6, 5.6, stone, f.a); bx(buf, tx, ty, 17, 17.4, 6.1, 6.1, A.marble, f.a);
  for (const [y0, y1, w] of [[17.4, 22.4, 4.6], [22.8, 27, 3.8]]) {
    bx(buf, tx, ty, y0, y1, w * 0.62, w * 0.62, stone, f.a); bx(buf, tx, ty, y1, y1 + 0.4, w + 0.5, w + 0.5, A.marble, f.a);
    for (const s of [-1, 1]) for (const t of [-1, 1]) cy(buf, tx + (f.ux * s + f.px * t) * w * 0.44, ty + (f.uy * s + f.py * t) * w * 0.44, y0, y1, 0.42, A.marble, 8);
  }
  for (const [y0, y1] of [[2.5, 7.5], [11.5, 15.5]]) for (const k of [0, 1]) bx(buf, tx, ty, y0, y1, k ? 6.3 : 2.2, k ? 2.2 : 6.3, C('#4a4038'), f.a);
  solidBox(tx, ty, 6.2, 6.2, f.a, 27);
}
function eremiti(buf, gbuf, S) {
  const C = A.C, stone = C('#d6bd8c'), f = S.f, h = 9.5, red = C(RED);
  A.extrude(buf, S.pts, h, stone, 0, 3, S.si, null, C('#cdbf9f'));
  const mid = (f.e0 - f.e1) / 2, L = f.e0 + f.e1;
  for (const [s, t, r] of [[-L * 0.2, -2, 3.5], [L * 0.08, -2, 3.5], [L * 0.3, -5.5, 2.1], [L * 0.3, 1.5, 2.1]]) {
    const [x, y] = f.at(mid + s, t); cy(buf, x, y, h, h + 1.6, r + 0.15, stone, 12); dm(buf, x, y, h + 1.6, r, r * 1.05, red);
  }
  const [tx, ty] = f.at(mid + L * 0.3, 7);
  bx(buf, tx, ty, h, 19, 4.4, 4.4, stone, f.a);
  for (const k of [0, 1]) bx(buf, tx, ty, 14, 17.6, k ? 4.5 : 1.5, k ? 1.5 : 4.5, C('#4a4038'), f.a);
  cy(buf, tx, ty, 19, 19.8, 2.3, stone, 10); dm(buf, tx, ty, 19.8, 2.15, 2.3, red);
}

// ------------------------------------------------------------------ San Domenico and the Colonna dell'Immacolata
function sanDomenico(buf, gbuf, S) {
  const C = A.C, cream = C('#ead9ad'), white = C('#f1ead8'), f = S.f, h = 21;
  body(buf, S, h, cream);
  const [fx, fy] = S.frontPt, a = S.fa, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
  // baroque front: a tall centre with a broken pediment, two bell towers with little domes
  bx(buf, fx - ux * 1.2, fy - uy * 1.2, 0, 27, 3, 17, cream, a);
  bx(buf, fx + ux * 0.4, fy + uy * 0.4, 12.6, 13.4, 1.2, 18.4, white, a); bx(buf, fx + ux * 0.4, fy + uy * 0.4, 27, 27.8, 1.2, 18, white, a);
  gable(buf, fx - ux * 1.2, fy - uy * 1.2, 27.8, 3, 4.2, 12, cream, a);
  for (const s of [-6.2, -2.6, 2.6, 6.2]) { cy(buf, fx + ux * 0.55 + px * s, fy + uy * 0.55 + py * s, 0.8, 12.6, 0.55, white, 8); cy(buf, fx + ux * 0.55 + px * s, fy + uy * 0.55 + py * s, 13.4, 27, 0.5, white, 8); }
  bx(buf, fx + ux * 0.36, fy + uy * 0.36, 0, 6.4, 0.3, 3.4, C('#4a3526'), a); bx(buf, fx + ux * 0.36, fy + uy * 0.36, 16, 22.5, 0.3, 3, C('#2e3440'), a);
  for (const s of [-1, 1]) {
    const tx = fx - ux * 1.6 + px * s * 12.4, ty = fy - uy * 1.6 + py * s * 12.4;
    bx(buf, tx, ty, 0, 26, 5.6, 5.6, cream, a); bx(buf, tx, ty, 26, 26.7, 6.3, 6.3, white, a);
    bx(buf, tx, ty, 26.7, 34.5, 4.6, 4.6, cream, a); bx(buf, tx, ty, 34.5, 35.1, 5.2, 5.2, white, a);
    for (const k of [0, 1]) bx(buf, tx, ty, 28, 33, k ? 4.7 : 1.6, k ? 1.6 : 4.7, C('#3c3a40'), a);
    cy(buf, tx, ty, 35.1, 36.6, 2.1, cream, 10); dm(buf, tx, ty, 36.6, 2.2, 2.6, C('#b9c3b2')); cy(buf, tx, ty, 39, 40.6, 0.14, C('#3a3a3e'), 5);
  }
  // the column of the Immacolata in the middle of the piazza
  const [cx, cyy] = S.column;
  bx(buf, cx, cyy, 0, 1, 7, 7, white, a); bx(buf, cx, cyy, 1, 5.2, 3.6, 3.6, A.marble, a); bx(buf, cx, cyy, 5.2, 5.7, 4.2, 4.2, white, a);
  cy(buf, cx, cyy, 5.7, 21, 0.75, A.marble, 10); cy(buf, cx, cyy, 21, 21.7, 1.2, white, 10);
  bx(buf, cx, cyy, 21.7, 24.4, 0.8, 0.7, C('#6f6a52'), a); bx(buf, cx, cyy, 24.4, 25, 0.5, 0.5, C('#6f6a52'), a);
  for (const s of [-1, 1]) for (const t of [-1, 1]) bx(buf, cx + (ux * s + px * t) * 2.6, cyy + (uy * s + py * t) * 2.6, 1, 3.3, 0.6, 0.6, A.marble, a);
}

// ------------------------------------------------------------------ Palazzo dei Normanni, the station, the post office
function normanni(buf, gbuf, S) {
  const C = A.C, gold = C('#dcc08a'), f = S.f, h = 21;
  A.extrudeLot(buf, A.ccw(S.pts), h, gold, 4, (h - 0.5) / A.FLOOR, S.si * 7 + 3, null, C('#cdbf9f'), null, C('#efe4cc'));
  // Torre Pisana with the observatory domes, at the Porta Nuova end
  const [tx, ty] = S.torre, a = f.a;
  bx(buf, tx, ty, 0, 33, 19, 19, gold, a); solidBox(tx, ty, 19, 19, a, 33);
  for (let k = -2; k <= 2; k++) for (const [ox, oy, ra] of [[1, 0, a + Math.PI / 2], [-1, 0, a + Math.PI / 2], [0, 1, a], [0, -1, a]]) {
    const lx = ox * 9.56 + (oy ? k * 3.5 : 0), ly = oy * 9.56 + (ox ? k * 3.5 : 0);
    bx(buf, tx + Math.cos(a) * lx - Math.sin(a) * ly, ty + Math.sin(a) * lx + Math.cos(a) * ly, 6, 29, 1.5, 0.14, C('#c9aa72'), ra);
  }
  merlons(buf, { pts: [[-9.5, -9.5], [9.5, -9.5], [9.5, 9.5], [-9.5, 9.5]].map(([p, q]) => [tx + Math.cos(a) * p - Math.sin(a) * q, ty + Math.sin(a) * p + Math.cos(a) * q]) }, 33, gold);
  cy(buf, tx, ty, 33, 36, 4.2, C('#e9e2cf'), 12); dm(buf, tx, ty, 36, 4.3, 4.2, C('#7d9486'));
  cy(buf, tx + Math.cos(a) * 5.5, ty + Math.sin(a) * 5.5, 33, 34.6, 2, C('#e9e2cf'), 10); dm(buf, tx + Math.cos(a) * 5.5, ty + Math.sin(a) * 5.5, 34.6, 2.05, 2, C('#7d9486'));
}
function stazione(buf, gbuf, S) {
  const C = A.C, cream = C('#e6d3aa'), f = S.f, h = 17;
  A.extrudeLot(buf, A.ccw(S.pts), h, cream, 8, (h - 0.5) / A.FLOOR, S.si * 7 + 3, null, C('#cdbf9f'), null, C('#efe4cc'));
  const [fx, fy] = S.frontPt, a = S.fa, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
  for (const [s, w, hh] of [[0, 26, 23], [-34, 13, 20.5], [34, 13, 20.5]]) {
    bx(buf, fx - ux * 2 + px * s, fy - uy * 2 + py * s, 0, hh, 6, w, cream, a); bx(buf, fx - ux * 2 + px * s, fy - uy * 2 + py * s, hh, hh + 0.8, 6.8, w + 0.8, C('#efe4cc'), a);
    const n = s ? 1 : 3;
    for (let k = 0; k < n; k++) { const o = s + (k - (n - 1) / 2) * 7.4; bx(buf, fx + ux * 1.02 + px * o, fy + uy * 1.02 + py * o, 0, 10.5, 0.2, 4.6, C('#2e3440'), a); bx(buf, fx + ux * 1.04 + px * o, fy + uy * 1.04 + py * o, 13, 18, 0.2, 3, C('#2e3440'), a); }
  }
  bx(buf, fx + ux * 3.4, fy + uy * 3.4, 5.6, 6, 5, 62, C('#3c4046'), a);                // the iron canopy
  for (let s = -30; s <= 30; s += 6) cy(buf, fx + ux * 5.6 + px * s, fy + uy * 5.6 + py * s, 0, 5.6, 0.13, C('#2b2d31'), 6);
  bx(buf, fx + ux * 1.08, fy + uy * 1.08, 19.6, 22, 0.25, 2.4, A.marble, a); bx(buf, fx + ux * 1.2, fy + uy * 1.2, 20.7, 20.9, 0.1, 1.3, C('#141116'), a);
}
function poste(buf, gbuf, S) {
  const C = A.C, grey = C('#dcd8cc'), f = S.f, h = 27;
  A.extrudeLot(buf, A.ccw(S.pts), h, grey, 7, 4, S.si * 7 + 3, null, C('#cfc9bb'), null, C('#eeeae0'));
  const [fx, fy] = S.frontPt, a = S.fa, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux, W = S.frontW;
  for (let k = 0; k < 5; k++) bx(buf, fx + ux * (4.6 - k * 0.45), fy + uy * (4.6 - k * 0.45), k * 0.42, (k + 1) * 0.42, 5.4 - k * 0.9, W, C('#cfcabc'), a);
  for (let s = -W / 2 + 2.4; s <= W / 2 - 2.3; s += 5.2) cy(buf, fx + ux * 3.3 + px * s, fy + uy * 3.3 + py * s, 2.1, 25.4, 1.45, grey, 14);
  bx(buf, fx + ux * 2.6, fy + uy * 2.6, 25.4, 29, 5.6, W + 1, grey, a); bx(buf, fx + ux * 2.6, fy + uy * 2.6, 29, 29.6, 6.2, W + 1.8, C('#eeeae0'), a);
  bx(buf, fx + ux * 0.2, fy + uy * 0.2, 2.1, 25.4, 0.3, W - 3, C('#3a3d44'), a);
  solidBox(fx + ux * 3.3, fy + uy * 3.3, 3.2, W, a, 25);
}

// ------------------------------------------------------------------ Fontana Pretoria: tiers of white marble, a ring of statues, four stairways
function pretoria(b, x, y) {
  const C = A.C, m = A.marble, w = C('#59aede'), iron = C('#2b2d31');
  cy(b, x, y, 0, 0.5, 14.2, C('#e6dfd0'), 32);
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; if (i % 12 === 0) continue; cy(b, x + Math.cos(a) * 14, y + Math.sin(a) * 14, 0.5, 1.7, 0.07, iron, 4); }
  cy(b, x, y, 0.5, 1.5, 11.6, m, 32); cy(b, x, y, 1.5, 1.58, 11, w, 32);
  cy(b, x, y, 1.5, 2.3, 8.6, m, 28);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; for (let k = 0; k < 4; k++) bx(b, x + Math.cos(a) * (12.6 - k * 0.55), y + Math.sin(a) * (12.6 - k * 0.55), 0.5, 0.75 + k * 0.25, 0.6, 3.4, m, a); bx(b, x + Math.cos(a) * 9.8, y + Math.sin(a) * 9.8, 1.5, 1.75, 2.9, 3.4, m, a); }
  for (let i = 0; i < 24; i++) {
    const a = (i + 0.5) / 24 * Math.PI * 2; if (i % 6 === 2 || i % 6 === 3) continue;
    const px = x + Math.cos(a) * 11.3, py = y + Math.sin(a) * 11.3;
    bx(b, px, py, 1.5, 2.5, 0.75, 0.75, m, a); bx(b, px, py, 2.5, 4.1, 0.5, 0.42, m, a); bx(b, px, py, 4.1, 4.5, 0.34, 0.34, m, a); bx(b, px, py, 3.3, 3.5, 0.3, 1.05, m, a);
  }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; bx(b, x + Math.cos(a) * 8.5, y + Math.sin(a) * 8.5, 2.3, 3.1, 0.5, 0.6, m, a); }
  cy(b, x, y, 2.3, 3.2, 5.6, m, 20); cy(b, x, y, 3.2, 3.27, 5.1, w, 20);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; bx(b, x + Math.cos(a) * 5.4, y + Math.sin(a) * 5.4, 3.2, 4.6, 0.45, 0.4, m, a); }
  cy(b, x, y, 3.2, 5.6, 1, m, 10); cy(b, x, y, 5.6, 6, 2.7, m, 16); cy(b, x, y, 6, 6.06, 2.4, w, 16);
  cy(b, x, y, 6, 7.9, 0.55, m, 8); cy(b, x, y, 7.9, 8.2, 1.5, m, 12); cy(b, x, y, 8.2, 9.3, 0.3, m, 8);
  bx(b, x, y, 9.3, 10.5, 0.45, 0.4, m, 0.6); bx(b, x, y, 10.5, 10.85, 0.3, 0.3, m, 0.6);
}

// ------------------------------------------------------------------ register everything that sits on a real footprint
export function landmarks(api) {
  A = api;
  const byName = (re) => A.SPECIALS.find((S) => S && S.name && re.test(S.name));
  const set = (S, fn) => { if (S) S.custom = fn; return S; };
  let S;
  if ((S = byName(/^Cattedrale di Palermo/))) {
    S.f = frame(S);
    const bon = A.nearestRoadDir(S.cx, S.cy, 1, 'Via Matteo Bonello');
    if (bon.road && (bon.x - S.cx) * S.f.ux + (bon.y - S.cy) * S.f.uy > 0) flipU(S.f, S);
    // +p must face the Cassaro without turning the nave round: mirror p only
    const cas = nearRoad(S.cx, S.cy, ['Via Vittorio Emanuele', 'Corso Vittorio Emanuele']);
    if (cas && (cas.x - S.cx) * S.f.px + (cas.y - S.cy) * S.f.py < 0) {
      const f = S.f, Sc = S; f.px = -f.px; f.py = -f.py; [f.w0, f.w1] = [f.w1, f.w0]; f.at = (s, t) => [Sc.cx + f.ux * s + f.px * t, Sc.cy + f.uy * s + f.py * t];
    }
    const f = S.f, hw = Math.min(f.w0, f.w1, 20);
    S.rosalia = f.at((f.e0 - f.e1) / 2 - (f.e0 + f.e1) * 0.1, hw + 30);
    A.circles.push({ x: S.rosalia[0], y: S.rosalia[1], r: 1.8 });
    set(S, cattedrale);
    A.labelTargets.push({ name: 'Santa Rosalia', x: S.rosalia[0], y: S.rosalia[1], h: 8.5 });
  }
  if ((S = byName(/San Cataldo/))) { S.f = frame(S); set(S, sanCataldo); A.labelTargets.push({ name: 'San Cataldo', x: S.cx, y: S.cy, h: 16 }); }
  const cat = S;
  if ((S = byName(/Martorana/))) {
    S.f = frame(S);
    // the campanile stands at the end nearest San Cataldo, on Piazza Bellini
    const tgt = cat || { cx: S.cx - 30, cy: S.cy };
    if ((tgt.cx - S.cx) * S.f.ux + (tgt.cy - S.cy) * S.f.uy < 0) flipU(S.f, S);
    S.camp = S.f.at(S.f.e0 + 2.2, 0);
    set(S, martorana);
  }
  if ((S = byName(/San Giovanni degli Eremiti/))) { S.f = frame(S); set(S, eremiti); }
  const front = (S, tx, ty) => {
    // the point of the footprint that reaches furthest towards (tx, ty), and the direction to it
    const d = Math.hypot(tx - S.cx, ty - S.cy) || 1, ux = (tx - S.cx) / d, uy = (ty - S.cy) / d;
    const r = A.reach(S.pts, S.cx, S.cy, ux, uy);
    // snap the facade to the nearest footprint edge direction
    let best = 0, bd = 9;
    for (let j = 0; j < S.pts.length; j++) { const p = S.pts[j], q = S.pts[(j + 1) % S.pts.length]; const a = Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.PI / 2; for (const aa of [a, a + Math.PI]) { const dd = Math.abs(A.angDiff(aa, Math.atan2(uy, ux))); if (dd < bd && Math.hypot(q[0] - p[0], q[1] - p[1]) > 8) { bd = dd; best = aa; } } }
    S.fa = bd < 0.7 ? best : Math.atan2(uy, ux);
    const rr = A.reach(S.pts, S.cx, S.cy, Math.cos(S.fa), Math.sin(S.fa));
    // slide along the facade so the centre sits opposite the target
    const lat = (tx - S.cx) * -Math.sin(S.fa) + (ty - S.cy) * Math.cos(S.fa);
    S.frontPt = [S.cx + Math.cos(S.fa) * rr - Math.sin(S.fa) * lat, S.cy + Math.sin(S.fa) * rr + Math.cos(S.fa) * lat];
    void r;
  };
  const areaC = (name) => { const a = A.areas.find((q) => q.n === name); return a ? A.centroid(a.pts) : null; };
  if ((S = byName(/^Chiesa di San Domenico/))) {
    const pz = areaC('Piazza San Domenico') || [S.cx, S.cy - 60];
    S.f = frame(S); front(S, pz[0], pz[1]);
    S.column = [pz[0], pz[1]];
    A.circles.push({ x: pz[0], y: pz[1], r: 3.7 });
    set(S, sanDomenico);
    A.labelTargets.push({ name: 'Colonna dell\'Immacolata', x: pz[0], y: pz[1], h: 26 });
  }
  if ((S = byName(/^Palazzo dei Normanni/))) {
    S.f = frame(S);
    const pn = A.LM.portaNuova || [S.cx, S.cy + 100];
    let best = S.pts[0], bd = 1e9;
    for (const p of S.pts) { const d = Math.hypot(p[0] - pn[0], p[1] - pn[1]); if (d < bd) { bd = d; best = p; } }
    const k = 26 / (Math.hypot(S.cx - best[0], S.cy - best[1]) || 1);
    S.torre = [best[0] + (S.cx - best[0]) * k, best[1] + (S.cy - best[1]) * k];
    set(S, normanni);
    A.labelTargets.push({ name: 'Palazzo dei Normanni · Torre Pisana', x: S.torre[0], y: S.torre[1], h: 42 });
  }
  if ((S = byName(/^Stazione di Palermo Centrale/))) {
    const pz = areaC('Piazza Giulio Cesare') || [S.cx, S.cy + 90];
    S.f = frame(S); front(S, pz[0], pz[1]); set(S, stazione);
  }
  if ((S = byName(/^Palazzo delle Poste/))) {
    const vr = A.nearestRoadDir(S.cx, S.cy, 1, 'Via Roma');
    S.f = frame(S); front(S, vr.x, vr.y);
    S.frontW = Math.min(46, Math.max(24, A.reach(S.pts, S.cx, S.cy, -Math.sin(S.fa), Math.cos(S.fa)) + A.reach(S.pts, S.cx, S.cy, Math.sin(S.fa), -Math.cos(S.fa)) - 14));
    S.frontPt = [S.cx + Math.cos(S.fa) * A.reach(S.pts, S.cx, S.cy, Math.cos(S.fa), Math.sin(S.fa)), S.cy + Math.sin(S.fa) * A.reach(S.pts, S.cx, S.cy, Math.cos(S.fa), Math.sin(S.fa))];
    set(S, poste);
    A.labelTargets.push({ name: 'Palazzo delle Poste', x: S.frontPt[0], y: S.frontPt[1], h: 32 });
  }
  // Teatro Massimo: the two bronze lions at the foot of the steps
  if ((S = A.SPECIALS.find((q) => q && q.t === 'tm')) && S.front) {
    const [ux, uy, ext] = S.front, px = -uy, py = ux, rot = Math.atan2(uy, ux), bronze = A.C('#4f4a3c');
    for (const s of [-1, 1]) {
      const x = S.cx + ux * (ext + 13.5) + px * s * 20.5, y = S.cy + uy * (ext + 13.5) + py * s * 20.5;
      A.job(x, y, (b) => {
        bx(b, x, y, 0, 2.6, 6.4, 3, A.C('#eadfc6'), rot);
        bx(b, x, y, 2.6, 4.3, 4.2, 1.5, bronze, rot); bx(b, x + ux * 1.9, y + uy * 1.9, 3.6, 5.6, 1.5, 1.6, bronze, rot); bx(b, x + ux * 2.5, y + uy * 2.5, 4.9, 5.9, 1.2, 1.1, bronze, rot);
        bx(b, x - ux * 2.3, y - uy * 2.3, 3.2, 3.5, 1.8, 0.3, bronze, rot); bx(b, x, y, 4.3, 6.1, 0.7, 0.8, bronze, rot); bx(b, x, y, 6.1, 6.7, 0.5, 0.5, bronze, rot);
      });
      solidBox(x, y, 6.4, 3, rot, 2.6);
    }
  }
  if (A.LM.fontanaPretoria) {
    const [x, y] = A.LM.fontanaPretoria;
    A.job(x, y, (b) => pretoria(b, x, y));
    A.circles.push({ x, y, r: 11.9 });
    A.labelTargets.push({ name: 'Fontana Pretoria', x, y, h: 12 });
  }
}

// ------------------------------------------------------------------ the mountains of the Conca d'Oro
// Monte Pellegrino is a flat-topped limestone massif with cliffs all round; the others are long ridges behind the city.
function massif(o) {
  const T = A.THREE, { cx, cy, rx, ry, top, seed, plateau } = o, NU = o.n || 44, NV = o.n || 44;
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, h = (i, j) => A.hash(i * 57.3 + j * 131.7 + seed * 9.1), sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return A.lerp(A.lerp(h(xi, yi), h(xi + 1, yi), sx), A.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), sx), sy); };
  const H = plateau ? (u, v) => {
    const d = Math.pow(Math.pow(Math.abs(u), 2.5) + Math.pow(Math.abs(v), 2.5), 1 / 2.5);
    const edge = 0.74 + 0.1 * vn(u * 2.6 + 4, v * 2.6);
    const t = top * (0.8 + 0.22 * vn(u * 1.7 + 9, v * 1.7 + 3)) + 60 * vn(u * 5, v * 5) - 110 * ss(0.1, 0.9, -v) * (u > 0 ? 0.4 : 1);
    const talus = 130 * ss(1.38, 0.98, d) * (0.7 + 0.5 * vn(u * 4, v * 4 + 7));
    return A.lerp(talus, t, ss(1.0, edge, d));
  } : (u, v) => {
    const d = Math.hypot(u, v); if (d >= 1.3) return 0;
    const r = 1 - Math.abs(2 * vn(u * 2.1 + 3, v * 2.1) - 1), r2 = 1 - Math.abs(2 * vn(u * 4.7, v * 4.7 + 5) - 1);
    return top * Math.pow(Math.max(0, 1 - d / 1.3), 0.85) * (0.5 + 0.55 * r + 0.18 * r2);
  };
  o.H = H;
  const haze = new T.Color('#cfe2ec'), k = Math.min(0.5, Math.max(0.14, Math.hypot(cx, cy) / 15000));
  const mk = (list) => list.map((c) => new T.Color(c).lerp(haze, k));
  const rock = mk(['#cfc0a3', '#c4b496', '#d8cab0']), scrub = mk(['#a3a67c', '#aeab86', '#959d72']), low = mk(['#93a56c', '#a2a678', '#8b9c66']);
  const P = [], Cc = [], vtx = (i, j) => { const u = (i / NU * 2 - 1) * 1.42, v = (j / NV * 2 - 1) * 1.42; return [cx + u * rx, H(u, v), -(cy + v * ry)]; };
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i + 1, j + 1), d = vtx(i, j + 1);
    for (const [p, q, r] of [[a, c, b], [a, d, c]]) {
      if (p[1] < 2 && q[1] < 2 && r[1] < 2) continue;
      const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n) || 1;
      const up = Math.abs(n[1]) / nl, hm = (p[1] + q[1] + r[1]) / 3, kk = (A.hash(i * 3.1 + j * 7.7 + seed) * 3) | 0;
      const col = up < (plateau ? 0.72 : 0.6) || hm > top * 0.72 ? rock[kk] : hm > top * 0.3 ? scrub[kk] : low[kk];
      for (const w of n[1] > 0 ? [p, q, r] : [p, r, q]) { P.push(w[0], w[1] - 10, w[2]); Cc.push(col.r, col.g, col.b); }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); g.computeVertexNormals();
  A.scene.add(new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false })));
}
export function pellegrino(api) {
  A = api;
  const T = A.THREE, pel = { cx: -1150, cy: 5650, rx: 1350, ry: 1750, top: 560, seed: 1, plateau: true, n: 56 };
  massif(pel);
  massif({ cx: -5600, cy: 2400, rx: 2500, ry: 1800, top: 1050, seed: 2 });   // Monte Cuccio and the western rim
  massif({ cx: -6300, cy: -2700, rx: 2800, ry: 2100, top: 1150, seed: 3 });
  massif({ cx: -2600, cy: -7300, rx: 3500, ry: 1900, top: 900, seed: 5 });   // Monreale side
  massif({ cx: 3000, cy: -6500, rx: 2700, ry: 1700, top: 830, seed: 6 });    // Monte Grifone
  // Castello Utveggio, pink on its spur above the city
  const u = 0.34, v = -0.78, y = pel.H(u, v) - 10, x0 = pel.cx + u * pel.rx, z0 = -(pel.cy + v * pel.ry);
  const grp = new T.Group(), pink = new T.MeshStandardMaterial({ color: '#dba294', roughness: 0.9, fog: false }), roofM = new T.MeshStandardMaterial({ color: '#b3705e', roughness: 0.9, fog: false });
  const add = (w, h, d, px, py, pz, m = pink) => { const me = new T.Mesh(new T.BoxGeometry(w, h, d), m); me.position.set(px, py, pz); grp.add(me); };
  add(110, 44, 46, 0, 22, 0); add(114, 4, 50, 0, 46, 0, roofM); add(24, 70, 24, -43, 35, 12); add(24, 70, 24, 43, 35, 12); add(27, 5, 27, -43, 72, 12, roofM); add(27, 5, 27, 43, 72, 12, roofM); add(30, 58, 28, 0, 29, 14);
  grp.position.set(x0, y + 4, z0); grp.rotation.y = -0.3; A.scene.add(grp);
}

// ------------------------------------------------------------------ props that need the instancing helpers
export function props(api) {
  A = api;
  const T = A.THREE, { vcGeo, T: M4, vcMat, dummy, roads } = A;
  const Bx = (a, b, c) => new T.BoxGeometry(a, b, c), Cy = (r, h, s = 8, r2 = r) => new T.CylinderGeometry(r, r2, h, s);
  const inst = (geo, list, mat = vcMat, shadow = true) => {
    if (!list.length) return null;
    const im = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => { dummy.position.set(o.x, o.h || 0.09, -o.y); dummy.rotation.set(0, o.a || 0, 0); dummy.scale.set(o.sx || 1, o.sy || 1, o.sz || 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); if (o.col) im.setColorAt(i, o.col); });
    im.castShadow = shadow; im.receiveShadow = true; A.scene.add(im); return im;
  };
  // ---- the markets: Ballarò, the Capo, the Vucciria. Stalls down both sides, tarps overhead.
  const MARKETS = [
    ['Ballarò', ['Piazza Ballarò', 'Via Chiappara al Carmine'], 0], ['Il Capo', ['Via Porta Carini', 'Via Beati Paoli', 'Via Sant\'Agostino'], 1], ['La Vucciria', ['Piazza Caracciolo', 'Via Coltellieri', 'Via Pannieri'], 2],
  ];
  const KINDS = ['frutta', 'pesce', 'verdura', 'frittura', 'olive', 'pane'];
  const tarps = [], lists = KINDS.map(() => []);
  const TARP = ['#d9453b', '#f2c94c', '#3d7fd9', '#4f8f3a', '#f6f3ee', '#e86c4f'].map((c) => new T.Color(c));
  for (const [mname, names, mi] of MARKETS) {
    let cxs = 0, cys = 0, n = 0;
    for (const r of roads) {
      if (!names.includes(r.n) || r.hw < 2.2) continue;
      r.market = true;
      let carry = 3, side = 1;
      for (let j = 0; j < r.pts.length - 1; j++) {
        const a = r.pts[j], b = r.pts[j + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.5) continue;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, ang = Math.atan2(uy, ux);
        let s = carry;
        for (; s < L - 1; s += 3.6) {
          side = -side;
          const off = r.hw - 0.75, x = a[0] + ux * s - uy * off * side, y = a[1] + uy * s + ux * off * side;
          if (A.hash(x * 3.3 + y * 1.7) < 0.22) continue;
          const kind = (A.hash(x * 0.71 + y * 2.3 + mi) * KINDS.length) | 0;
          const st = { x, y, nx: uy * side, ny: -ux * side, kind: KINDS[kind], market: mname, a: ang + (side > 0 ? Math.PI : 0) };
          stalls.push(st); lists[kind].push({ x, y, a: st.a });
          A.circles.push({ x, y, r: 0.85 });
          cxs += x; cys += y; n++;
        }
        carry = s - L;
        for (let t = 4; t < L - 2; t += 9) if (r.hw <= 3.6) tarps.push({ x: a[0] + ux * t, y: a[1] + uy * t, a: ang, h: 4.6 + A.hash(t + a[0]) * 0.8, sx: 4.2, sz: r.hw * 2 + 0.5, col: TARP[(A.hash(t * 1.3 + a[1]) * TARP.length) | 0] });
      }
    }
    if (n) A.labelTargets.push({ name: 'Mercato · ' + mname, x: cxs / n, y: cys / n, h: 6.5 });
  }
  // a stall: trestle table, crates of goods, striped awning on two poles (x runs along the street, +z faces the customers)
  const stallGeo = (goods, awn) => {
    const P = [[Bx(2.3, 0.08, 1.05), '#b08a5e', M4(0, 0.86, 0)], [Bx(0.08, 0.86, 0.08), '#6b513a', M4(-1, 0.43, 0.4)], [Bx(0.08, 0.86, 0.08), '#6b513a', M4(1, 0.43, 0.4)], [Bx(0.08, 0.86, 0.08), '#6b513a', M4(-1, 0.43, -0.4)], [Bx(0.08, 0.86, 0.08), '#6b513a', M4(1, 0.43, -0.4)],
      [Cy(0.035, 2.5, 5), '#3a3a3e', M4(-1.1, 1.25, -0.5)], [Cy(0.035, 2.5, 5), '#3a3a3e', M4(1.1, 1.25, -0.5)], [Bx(1.6, 0.34, 0.03), '#f6efe1', M4(0, 1.75, -0.5)]];
    for (let i = 0; i < 6; i++) P.push([A.HDK.rbox(0.42, 0.06, 1.5, 0.025, 1), awn[i % awn.length], M4(-1.05 + i * 0.42, 2.42, 0.1, 1, 1, 1, 0, 0.2, 0)]);
    const H = A.HDK;
    for (let k = 0; k < 4; k++) P[k] = [k ? H.rbox(0.08, 0.86, 0.08, 0.02, 1) : H.rbox(2.3, 0.08, 1.05, 0.03), P[k][1], P[k][2]];
    goods.forEach((c, i) => {
      const cx = -0.78 + (i % 3) * 0.78, cz = i < 3 ? -0.22 : 0.27, tl = i < 3 ? -0.25 : 0;
      P.push([H.rbox(0.7, 0.16, 0.44, 0.02, 1), '#9a744c', M4(cx, 0.98, cz, 1, 1, 1, 0, tl, 0)]);
      for (const s of [-1, 1]) P.push([Bx(0.71, 0.02, 0.02), '#7a5a38', M4(cx, 0.96, cz + s * 0.221, 1, 1, 1, 0, tl, 0)]);
      P.push([H.lump(0.34, 1, 0.5, i * 3.1 + c.length), c, M4(cx, 1.06 + (i < 3 ? 0.03 : 0), cz, 0.92, 0.32, 0.56, 0, tl, 0)]);
    });
    return vcGeo(P);
  };
  const GOODS = [
    [['#f08c1c', '#f7d23e', '#d9362b', '#8fbf3f', '#6a2f6e', '#e7542f'], ['#d9453b', '#f6f3ee']],
    [['#c9d6de', '#e9eef2', '#b8c4cc', '#f19a9a', '#dfe7ec', '#9fb3c4'], ['#2f6d9b', '#f6f3ee']],
    [['#4f8f3a', '#8fbf3f', '#6a2f6e', '#d9362b', '#3d7a2e', '#e9e2c0'], ['#4f8f3a', '#f2c94c']],
    [['#e3902f', '#d97f24', '#eba045', '#f0d88c', '#c96e1e', '#e8c98f'], ['#f59ac4', '#f2d68e']],
    [['#5d6b2e', '#2b2a22', '#7a8a3a', '#c4372e', '#3d4a22', '#e2c14a'], ['#7a3d2a', '#f6f3ee']],
    [['#c98a3d', '#a8652a', '#e2b36a', '#d9a05a', '#b87a36', '#efd9ad'], ['#e2c14a', '#c4372e']],
  ];
  KINDS.forEach((k, i) => inst(stallGeo(GOODS[i][0], GOODS[i][1]), lists[i]));
  const tg = Bx(1, 0.03, 1);
  const tm = inst(tg, tarps.map((t) => ({ ...t })), new T.MeshStandardMaterial({ roughness: 0.9, side: T.DoubleSide }), false);
  if (tm) tm.castShadow = true;

  // ---- horse carriages waiting for tourists
  {
    const H = A.HDK, RBx = (a, b, cc) => H.rbox(a, b, cc, 0.045), Lb = (p, q, r0, r1, col, seg = 12) => { const [g, m] = H.limb(p, q, r0, r1, seg); return [g, col, m]; };
    const COAT = '#6b4a32', DARK = '#2a1f1a';
    const horse = [[H.loft([[1.7, 0.12, 1.05, 1.3, 2.4], [1.84, 0.27, 0.92, 1.62, 2.4], [2.3, 0.29, 0.9, 1.67, 2.4], [2.9, 0.27, 0.95, 1.66, 2.4], [3.3, 0.24, 1.05, 1.76, 2.4], [3.46, 0.13, 1.22, 1.7, 2.4]], 28, 3), COAT, M4(0, 0, 0)],
      Lb([3.28, 1.55, 0], [3.74, 2.32, 0], 0.25, 0.14, COAT), Lb([3.7, 2.4, 0], [4.12, 1.98, 0], 0.15, 0.09, COAT), [H.lump(0.11, 2, 0.1, 3), '#4e3524', M4(4.13, 1.96, 0, 1.1, 0.9, 1)],
      Lb([3.22, 1.78, 0], [3.69, 2.5, 0], 0.06, 0.045, DARK, 8), Lb([1.72, 1.46, 0], [1.56, 0.78, 0], 0.09, 0.035, DARK, 10)];
    for (const s of [-1, 1]) horse.push([new T.ConeGeometry(0.045, 0.15, 10), COAT, M4(3.69, 2.55, s * 0.07, 1, 1, 1, 0, 0, -0.2)], [new T.SphereGeometry(0.03, 12, 8), '#0b0b0d', M4(3.86, 2.3, s * 0.1)]);
    horse.push([new T.TorusGeometry(0.21, 0.055, 10, 24), '#1d1d20', M4(3.36, 1.62, 0, 1, 1, 1, Math.PI / 2, 0, -0.55)], [RBx(0.42, 0.06, 0.64), '#8a1f24', M4(2.7, 1.68, 0)], [H.lump(0.1, 2, 0.2, 5), '#c4372e', M4(3.66, 2.66, 0, 1, 1.6, 1)],
      [RBx(1.6, 0.05, 0.6), '#1d1d20', M4(2.6, 1.3, 0, 1, 1, 1.04)]);
    for (const [x, z] of [[1.98, 0.15], [1.98, -0.15], [3.2, 0.15], [3.2, -0.15]]) horse.push(Lb([x, 1.1, z], [x + 0.03, 0.55, z], 0.095, 0.06, COAT), Lb([x + 0.03, 0.56, z], [x, 0.14, z], 0.052, 0.045, COAT, 10), [new T.CylinderGeometry(0.06, 0.075, 0.13, 14), '#1b1714', M4(x, 0.065, z)], [new T.SphereGeometry(0.06, 12, 8), COAT, M4(x + 0.03, 0.56, z)]);
    const cab = [[RBx(2.0, 0.5, 1.25), '#1d1d20', M4(0, 0.95, 0)], [RBx(0.9, 0.5, 1.15), '#8a1f24', M4(-0.35, 1.35, 0)], [RBx(0.12, 0.75, 1.2), '#8a1f24', M4(-0.85, 1.6, 0)], [RBx(0.7, 0.3, 1.1), '#1d1d20', M4(0.75, 1.45, 0)],
      [RBx(1.1, 0.06, 1.35), '#1d1d20', M4(-0.45, 2.35, 0)], [RBx(0.06, 0.75, 1.3), '#1d1d20', M4(-0.98, 2.0, 0)], [RBx(2.2, 0.06, 0.06), '#3a2a20', M4(1.9, 1.1, 0.4)], [RBx(2.2, 0.06, 0.06), '#3a2a20', M4(1.9, 1.1, -0.4)]];
    for (const [wx, r] of [[-0.55, 0.62], [0.8, 0.45]]) for (const wz of [0.68, -0.68]) {
      cab.push([new T.TorusGeometry(r - 0.03, 0.035, 8, 36), '#c9a13c', M4(wx, r, wz)], [new T.TorusGeometry(r - 0.005, 0.02, 6, 36), '#1d1d20', M4(wx, r, wz)], [new T.CylinderGeometry(r * 0.16, r * 0.16, 0.14, 16), '#1d1d20', M4(wx, r, wz, 1, 1, 1, 0, Math.PI / 2, 0)]);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; cab.push([new T.CylinderGeometry(0.014, 0.018, r * 0.82, 6), '#c9a13c', M4(wx + Math.sin(a) * r * 0.5, r + Math.cos(a) * r * 0.5, wz, 1, 1, 1, 0, 0, -a)]); }
    }
    const geo = vcGeo([...horse, ...cab]);
    const spots = [];
    const want = [];
    const cat = A.SPECIALS.find((S) => S && S.rosalia); if (cat) want.push([cat.rosalia[0], cat.rosalia[1], 14], [cat.rosalia[0] + 9, cat.rosalia[1] + 4, 14]);
    if (A.LM.quattroCanti) want.push([A.LM.quattroCanti[0] + 26, A.LM.quattroCanti[1] + 14, 5]);
    const tm2 = A.SPECIALS.find((S) => S && S.t === 'tm'); if (tm2 && tm2.front) want.push([tm2.cx + tm2.front[0] * (tm2.front[2] + 34), tm2.cy + tm2.front[1] * (tm2.front[2] + 34), 6], [tm2.cx + tm2.front[0] * (tm2.front[2] + 34) + 8, tm2.cy + tm2.front[1] * (tm2.front[2] + 34) + 6, 6]);
    if (A.LM.ficus) want.push([A.LM.ficus[0] + 34, A.LM.ficus[1] - 30, 6]);
    for (const [x, y] of want) {
      const r = A.nearestRoadDir(x, y, 2.6);
      if (!r.road || r.d > 60) continue;
      const off = Math.max(0, r.road.hw - 1.5), sx = -Math.sin(r.dir), sy = Math.cos(r.dir);
      const side = (x - r.x) * sx + (y - r.y) * sy > 0 ? 1 : -1;
      const p = { x: r.x + sx * off * side, y: r.y + sy * off * side, a: r.dir };
      if (spots.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 7)) { p.x += Math.cos(r.dir) * 8; p.y += Math.sin(r.dir) * 8; }
      spots.push(p); carriages.push(p);
      for (const s of [-0.3, 1.6, 3.1]) A.circles.push({ x: p.x + Math.cos(p.a) * s, y: p.y + Math.sin(p.a) * s, r: 0.75 });
    }
    inst(geo, spots);
  }

  // ---- street lamps down the avenues
  {
    const lamp = vcGeo([[Cy(0.09, 7.4, 6, 0.13), '#2b3a34', M4(0, 3.7, 0)], [Cy(0.2, 0.7, 6), '#2b3a34', M4(0, 0.35, 0)], [Bx(1.5, 0.07, 0.07), '#2b3a34', M4(0.7, 7.3, 0)], [Bx(0.55, 0.14, 0.26), '#2b3a34', M4(1.35, 7.22, 0)], [Bx(0.42, 0.05, 0.2), '#fff2c4', M4(1.35, 7.13, 0)]]);
    const list = [];
    for (const r of roads) {
      if (r.hw < 5.5 || r.k > 4) continue;
      let carry = 9, side = 1;
      for (let j = 0; j < r.pts.length - 1; j++) {
        const a = r.pts[j], b = r.pts[j + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
        let s = carry;
        for (; s < L; s += 26) { side = -side; const off = r.hw + 0.4; if (list.length < 1500) list.push({ x: a[0] + ux * s - uy * off * side, y: a[1] + uy * s + ux * off * side, a: Math.atan2(uy, ux) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) }); }
        carry = s - L;
      }
    }
    const im = inst(lamp, list); if (im) im.castShadow = false;
  }

  // ---- the port: a ferry and a cruise ship at the piers, cranes behind them
  {
    const sea = A.W.sea && A.W.sea.length ? A.ring(A.W.sea[0].o) : null;
    const mar = A.SPECIALS.find((S) => S && /Stazione Marittima/.test(S.name || ''));
    const ship = (len, wid, hull, band, decks, funnel) => {
      const HL = (o, y0, y1) => A.HDK.loft([[-len / 2, wid * 0.4 + o, y0 + 1, y1, 6], [-len / 2 + 2.5, wid / 2 + o, y0, y1, 7], [len * 0.25, wid / 2 + o, y0, y1, 7], [len * 0.44, wid * 0.36 + o, y0 + 0.6, y1 + 0.4, 5], [len * 0.56, wid * 0.04 + o, y0 + 3, y1 + 0.8, 4]], 24, 3);
      const P = [[HL(0, -1, 8), hull, M4(0, 0, 0)], [HL(0.15, 6.2, 7.8), band, M4(0, 0, 0)]];
      for (let k = 0; k < Math.floor(len / 6); k++) for (const s of [-1, 1]) P.push([new T.CylinderGeometry(0.35, 0.35, 0.2, 14), '#2a3440', M4(-len * 0.42 + k * 6, 4.6, s * (wid / 2 + 0.03), 1, 1, 1, 0, Math.PI / 2, 0)]);
      for (let k = 0; k < decks; k++) P.push([Bx(len * (0.8 - k * 0.07), 3.1, wid * (0.92 - k * 0.05)), '#ffffff', M4(-len * 0.04 - k * len * 0.015, 9.6 + k * 3.2, 0)], [Bx(len * (0.78 - k * 0.07), 1.1, wid * (0.92 - k * 0.05) + 0.2), '#2f4a66', M4(-len * 0.04 - k * len * 0.015, 9.9 + k * 3.2, 0)]);
      P.push([Bx(len * 0.07, 9, wid * 0.4), funnel, M4(-len * 0.24, 12.5 + decks * 3.2, 0)], [Bx(len * 0.072, 2, wid * 0.41), '#141116', M4(-len * 0.24, 16 + decks * 3.2, 0)]);
      return vcGeo(P);
    };
    const place = (tx, ty, len, wid) => {
      if (!sea) return null;
      let best = null;
      for (let gx = -260; gx <= 260; gx += 20) for (let gy = -260; gy <= 260; gy += 20) {
        const x = tx + gx, y = ty + gy;
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 6; let ok = true;
          for (let s = -len / 2; s <= len / 2 && ok; s += len / 6) { const p = { x: x + Math.cos(a) * s, y: y + Math.sin(a) * s }; if (!A.pip(p.x, p.y, sea) || A.resolve(p, wid / 2 + 3).hit) ok = false; }
          if (!ok) continue;
          // close to the quay on one side
          const q = { x: x - Math.sin(a) * (wid / 2 + 10), y: y + Math.cos(a) * (wid / 2 + 10) }, q2 = { x: x + Math.sin(a) * (wid / 2 + 10), y: y - Math.cos(a) * (wid / 2 + 10) };
          const near = A.resolve(q, 5).hit || A.resolve(q2, 5).hit || !A.pip(q.x, q.y, sea) || !A.pip(q2.x, q2.y, sea);
          const sc = Math.hypot(gx, gy) + (near ? 0 : 400);
          if (!best || sc < best.sc) best = { x, y, a, sc };
        }
      }
      return best;
    };
    const base = mar ? [mar.cx, mar.cy] : [-256, 1328];
    const taken = [];
    for (const [dx, dy, len, wid, hull, band, decks, fun] of [[70, 60, 150, 24, '#f4f4f0', '#1d3f6e', 3, '#e2b93c'], [-60, 160, 210, 30, '#ffffff', '#e9e6df', 5, '#1d4f9c'], [120, -120, 110, 20, '#1d3f6e', '#f4f4f0', 2, '#c4372e']]) {
      const b = place(base[0] + dx, base[1] + dy, len, wid);
      if (!b || taken.some((t) => Math.hypot(t.x - b.x, t.y - b.y) < (len + t.len) / 2)) continue;
      taken.push({ ...b, len });
      const m = new T.Mesh(ship(len, wid, hull, band, decks, fun), vcMat); m.position.set(b.x, -0.85, -b.y); m.rotation.y = b.a; m.castShadow = true; A.scene.add(m);
    }
    const crane = vcGeo([[Bx(1.2, 34, 1.2), '#e2b93c', M4(-5, 17, -5)], [Bx(1.2, 34, 1.2), '#e2b93c', M4(5, 17, -5)], [Bx(1.2, 34, 1.2), '#e2b93c', M4(-5, 17, 5)], [Bx(1.2, 34, 1.2), '#e2b93c', M4(5, 17, 5)], [Bx(12, 3, 12), '#e2b93c', M4(0, 35, 0)], [Bx(46, 2.4, 2.4), '#1d3f6e', M4(10, 38, 0)], [Bx(5, 5, 5), '#f4f4f0', M4(-2, 39.5, 0)], [Bx(0.4, 20, 0.4), '#2b2d31', M4(26, 27, 0)]]);
    const piers = (A.pierLots || []).slice().sort((p, q) => q[2] - p[2]);
    const cranes = [], boxes = [], CCOL = ['#c4372e', '#2f6d9b', '#e2b93c', '#3f8f5a', '#e9e6df', '#b0562c', '#1d3f6e'].map((c) => new T.Color(c));
    piers.forEach(([x, y, area], i) => {
      const a = A.hash(Math.round(x / 60) * 3.7 + 1) * Math.PI;
      if (i % 9 === 0 && cranes.length < 5 && !cranes.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) { cranes.push({ x, y, a }); A.circles.push({ x, y, r: 6 }); return; }
      if (A.hash(x * 1.3 + y * 0.7) > 0.5 || area < 60) return;
      const n = 1 + ((A.hash(x + y) * 3) | 0);
      for (let k = 0; k < n; k++) boxes.push({ x, y, a, h: 0.09 + 1.3 + k * 2.6, sx: 12, sy: 2.6, sz: 2.5, col: CCOL[(A.hash(x * 7 + y * 3 + k) * CCOL.length) | 0] });
      for (const s of [-3.6, 3.6]) A.circles.push({ x: x + Math.cos(a) * s, y: y + Math.sin(a) * s, r: 2.6 });
    });
    inst(crane, cranes);
    inst(Bx(1, 1, 1), boxes, new T.MeshStandardMaterial({ roughness: 0.7 }));
  }
}
