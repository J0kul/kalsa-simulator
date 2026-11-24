// giorgio.js — "La fame di Giorgio". Giorgio, large and always hungry, queues outside Tutto Compreso, an
// all-you-can-eat on Via Maqueda. Go in and eat, and you get to watch him eat: plate after plate, bigger and bigger,
// until he bursts out through the front of the restaurant and starts eating Palermo — cars, then buildings, growing with
// every bite. That part is a city event everyone online shares: one player's game runs Giorgio and publishes him in
// its presence ("gz"); everyone else draws him from that and reports the damage they do ("gd"). Beat him together.
let G = null, NET = null, T = null;
// ------------------------------------------------------------------ places
const QC = [-660, 75.2], MQ = [-0.458, 0.889];                 // Quattro Canti, and up Via Maqueda
const ST = [QC[0] + MQ[0] * 100, QC[1] + MQ[1] * 100];         // the street outside the restaurant
const IN_N = [0.889, 0.458];                                   // from the street into the building (east side)
const FAC = [ST[0] + IN_N[0] * 5, ST[1] + IN_N[1] * 5];        // the facade
const DOOR = [ST[0] + IN_N[0] * 3.6, ST[1] + IN_N[1] * 3.6];   // where you stand to go in
const R0 = [800, 1600], RW = 22, RD = 15;                     // the dining room, built out at sea where nothing else is
const SEAT_ME = [R0[0] - 5, R0[1] - 3], TABLE_G = [R0[0], R0[1] + 1], BUFFET = [R0[0], R0[1] + RD / 2 - 1.6], EXIT = [R0[0], R0[1] - RD / 2 + 0.9];
const KITCHEN = [R0[0] + RW / 2 - 1.5, R0[1] + RD / 2 - 1.2];
const LEASH = 280, PRICE = 14.9;
const LOOK = { name: 'Giorgio', kind: 'custom', behaviour: 'hang', skin: '#e9b68f', height: 1.02, build: 'belly', face: 'round', eyes: '#3a2a20', brows: 'thick',
  nose: 'big', mouth: 'open', hair: 'short', hairColor: '#2a211b', facial: 'mustache', facialColor: '#2a211b', glasses: 'none', hat: 'none', top: 'tee', c1: '#f4f1ea',
  c2: '#d7261e', pattern: 'solid', tie: 'none', bottom: 'trousers', bottomColor: '#3a4a6b', shoes: 'shoes', shoeColor: '#2a211b', blush: true };
const WAITER = { kind: 'custom', behaviour: 'hang', top: 'shirt', c1: '#f4f1ea', c2: '#f4f1ea', tie: 'bowtie', tieColor: '#141116', bottom: 'trousers', bottomColor: '#141116', shoes: 'shoes', shoeColor: '#141116', build: 'slim' };
const LINES_EAT = ['Un altro!', 'Picciotto, portami tutto!', 'Chi bontà!', 'Ancora panelle!', 'Il dolce? Tutto il carrello!', 'Questo era l\'antipasto.', 'Mmmh... ancora!', 'Ho appena cominciato!'];
const LINES_ROOM = ['Ma quantu mancia?!', 'Mizzica...', 'Chiama a so mamma!', 'Il tavolo! Il tavolo!', 'U ristoranti si sta squagghiannu!', 'Signore, basta!'];
const LINES_YUCK = ['BLEAH! VERDURA!', 'Che schifo! Broccoli!', 'NO! Le zucchine no!', 'Sa di salute! BLEAH!', 'Mamma! Mi fanno mangiare la verdura!', 'Portatemi un cannolo per togliermi il sapore!'];
const LINES_GIANT = ['ANCORA FAME!!!', 'GNAM GNAM!', 'MI MANCIU A CATTEDRALE!', 'PALERMO È UN BUFFET!', 'MI MANCIU TUTTU!', 'DOV\'È IL DOLCE?!', 'QUESTA MACCHINA SA DI ARANCINA!', 'NON MI FERMATE!'];
// ------------------------------------------------------------------ state
const S = {
  stage: 'off',        // my quest: off · go · inside · show · fight · done
  seated: false, plate: false, bites: 0,
  show: { t: 0, plates: 0, s: 1, waiter: 0, wT: 0, eatT: 0, lineT: 0, boom: false },
  ev: null,            // the city event I can see: { e, host, ph, x, y, a, s, hp, mx, bite, bk, bx, by, st, seen }
  hostEv: null,        // when my game runs Giorgio
  myDmg: 0, myE: null, dmgSeen: new Map(), lastBite: 0, lastStomp: 0, lastGz: 0, joinedE: null, rewardE: null,
  wins: 0, ruined: false, fixT: 0, hud: null, objText: '',
  qx: 0, qy: 0, holes: [], auth: null, vans: [], vegs: [], com: null, asked: false, suggested: false, lvl: 0, planSeen: null, vanT: 0, giant: null, small: null, room: null, front: null, waiters: [], patrons: [], plates: [], debris: [], rings: [], carried: [], anchor: null,
};
const store = { get() { try { return JSON.parse(localStorage.getItem('kalsa.giorgio') || '{}') || {}; } catch (e) { return {}; } }, set(o) { try { localStorage.setItem('kalsa.giorgio', JSON.stringify(o)); } catch (e) {} } };
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// three.js turn (people face +z) for a heading in game coordinates
// copies a person model without its userData: Object3D.clone() deep-copies userData through JSON, and a person's
// userData points back at its own parts, so a plain clone turns every texture into an image string (a long freeze)
function cloneLight(src) {
  const saved = [];
  src.traverse((o) => { saved.push([o, o.userData]); o.userData = {}; });
  try { return src.clone(); } finally { for (const [o, u] of saved) o.userData = u; }
}
const face = (a) => Math.atan2(Math.cos(a), -Math.sin(a)), faceTo = (x0, y0, x1, y1) => face(Math.atan2(y1 - y0, x1 - x0));

export function init(game, net) {
  G = game; NET = net; T = G.THREE;
  S.wins = store.get().wins || 0;
  buildFront(); buildRoom(); buildCast(); hud();
  return true;
}

// ------------------------------------------------------------------ building it
function M(c, o) { return new T.MeshStandardMaterial({ color: c, roughness: 0.8, ...(o || {}) }); }
function sign(text, sub, bg, fg, w = 1024, h = 256) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `italic 700 ${Math.round(h * 0.42)}px Georgia, serif`; c.fillText(text, w / 2, h * (sub ? 0.42 : 0.5));
  if (sub) { c.font = `800 ${Math.round(h * 0.16)}px system-ui, sans-serif`; c.fillText(sub, w / 2, h * 0.78); }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
// the shop front on Via Maqueda (and its ruins, when Giorgio has been through it)
function buildFront() {
  const g = new T.Group(), ang = Math.atan2(-IN_N[1], -IN_N[0]); // local +x faces the street
  g.position.set(FAC[0], 0, -FAC[1]); g.rotation.y = ang;
  const whole = new T.Group(), ruin = new T.Group(); g.add(whole, ruin); ruin.visible = false;
  const board = new T.Mesh(new T.PlaneGeometry(6.4, 1.3), new T.MeshBasicMaterial({ map: sign('Tutto Compreso', 'ALL YOU CAN EAT · €14,90 · MANGIA QUANTO VUOI', '#7a1f24', '#f6e7b6'), toneMapped: false }));
  board.position.set(0.12, 4.0, 0); board.rotation.y = Math.PI / 2; whole.add(board);
  // striped awning
  const aw = new T.Group(); aw.position.set(0.1, 3.1, 0);
  for (let i = 0; i < 9; i++) { const s = new T.Mesh(new T.BoxGeometry(1.5, 0.05, 0.66), M(i % 2 ? '#f4f1ea' : '#b8262a')); s.position.set(0.75, -0.25, -2.64 + i * 0.66); s.rotation.z = -0.32; aw.add(s); }
  whole.add(aw);
  const door = new T.Mesh(new T.BoxGeometry(0.1, 2.5, 1.7), M('#2a3440', { metalness: 0.3, roughness: 0.25 })); door.position.set(0.05, 1.25, 0); whole.add(door);
  const frame = new T.Mesh(new T.BoxGeometry(0.14, 2.62, 1.86), M('#c9a13c', { metalness: 0.6, roughness: 0.35 })); frame.position.set(0.02, 1.31, 0); whole.add(frame);
  for (const s of [-1, 1]) { const win = new T.Mesh(new T.PlaneGeometry(1.7, 1.6), new T.MeshBasicMaterial({ map: sign('Buffet', 'PANELLE · SUSHI · PASTA · DOLCI', '#f6e7b6', '#7a1f24', 512, 256), toneMapped: false })); win.position.set(0.11, 1.5, s * 2.0); win.rotation.y = Math.PI / 2; whole.add(win); }
  // a little menu stand on the pavement
  const stand = new T.Mesh(new T.BoxGeometry(0.08, 1.0, 0.62), M('#141116')); stand.position.set(1.5, 0.6, 2.6); stand.rotation.z = 0.12; whole.add(stand);
  // the queue rope
  for (const z of [-2.2, -0.9]) { const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.08, 0.95, 14), M('#c9a13c', { metalness: 0.6 })); post.position.set(1.0, 0.48, z - 1.6); whole.add(post); }
  // ruins: a dark hole where the front was, rubble, a dangling sign
  const hole = new T.Mesh(new T.CircleGeometry(3.4, 18), M('#120d0d', { roughness: 1 })); hole.position.set(0.14, 2.6, 0); hole.rotation.y = Math.PI / 2; hole.scale.set(1, 1.15, 1); ruin.add(hole);
  const rub = []; const cols = ['#cdbb92', '#b7a27a', '#8d7a5a', '#7a1f24', '#f4f1ea', '#6b6f75'];
  for (let i = 0; i < 26; i++) { const b = new T.Mesh(new T.BoxGeometry(0.4 + G.hash(i) * 0.9, 0.3 + G.hash(i * 3) * 0.6, 0.4 + G.hash(i * 7) * 0.8), M(cols[i % cols.length])); b.position.set(0.6 + G.hash(i * 11) * 3.4, 0.2 + G.hash(i * 13) * 0.4, -3 + G.hash(i * 17) * 6); b.rotation.set(G.hash(i * 19) * 3, G.hash(i * 23) * 3, G.hash(i * 29) * 3); b.castShadow = true; ruin.add(b); rub.push(b); }
  const hang = new T.Mesh(new T.PlaneGeometry(6.4, 1.3), new T.MeshBasicMaterial({ map: sign('Tutto Compreso', 'CHIUSO PER GIORGIO', '#7a1f24', '#f6e7b6'), toneMapped: false, side: T.DoubleSide }));
  hang.position.set(0.5, 3.7, 1.2); hang.rotation.set(0, Math.PI / 2, 0.42); ruin.add(hang);
  G.scene.add(g); S.front = { g, whole, ruin };
}
// the dining room, out at sea where nothing else is (only ever seen from inside)
function buildRoom() {
  const g = new T.Group(); g.position.set(R0[0], 0, -R0[1]);
  const x0 = -RW / 2, x1 = RW / 2, y0 = -RD / 2, y1 = RD / 2;
  // floor: black and white tiles
  { const v = [], c = []; const t = 1; for (let i = 0; i < RW; i++) for (let j = 0; j < RD; j++) { const a = x0 + i, b = y0 + j, k = (i + j) % 2 ? 0.92 : 0.12; v.push(a, 0.02, -b, a + t, 0.02, -b, a + t, 0.02, -(b + t), a, 0.02, -b, a + t, 0.02, -(b + t), a, 0.02, -(b + t)); for (let q = 0; q < 6; q++) c.push(k, k, k * 0.96); }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(v, 3)); fg.setAttribute('color', new T.Float32BufferAttribute(c, 3)); fg.computeVertexNormals();
    const f = new T.Mesh(fg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })); f.receiveShadow = true; g.add(f);
    const base = new T.Mesh(new T.BoxGeometry(RW + 1, 1.2, RD + 1), M('#5a4a3a')); base.position.y = -0.59; g.add(base); }
  // walls: wainscot, wallpaper, painted windows of a sunny Palermo, framed pictures
  const H = 3.2, wall = (ax, ay, bx, by, door) => {
    const len = hyp(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), cx = (ax + bx) / 2, cy = (ay + by) / 2;
    const segsW = door ? [[-len / 2, -1.2], [1.2, len / 2]] : [[-len / 2, len / 2]];
    for (const [s0, s1] of segsW) {
      const L = s1 - s0, mid = (s0 + s1) / 2, px = cx + Math.cos(ang) * mid, py = cy + Math.sin(ang) * mid;
      const up = new T.Mesh(new T.BoxGeometry(L, H - 1.1, 0.25), M('#e8c9a0')); up.position.set(px, 1.1 + (H - 1.1) / 2, -py); up.rotation.y = ang; g.add(up);
      const lo = new T.Mesh(new T.BoxGeometry(L, 1.1, 0.3), M('#7a1f24')); lo.position.set(px, 0.55, -py); lo.rotation.y = ang; g.add(lo);
      const rail = new T.Mesh(new T.BoxGeometry(L, 0.08, 0.36), M('#c9a13c', { metalness: 0.5 })); rail.position.set(px, 1.12, -py); rail.rotation.y = ang; g.add(rail);
      G.addSeg([R0[0] + cx + Math.cos(ang) * s0, R0[1] + cy + Math.sin(ang) * s0], [R0[0] + cx + Math.cos(ang) * s1, R0[1] + cy + Math.sin(ang) * s1], 3.2);
    }
    if (door) { const top = new T.Mesh(new T.BoxGeometry(2.4, 0.7, 0.25), M('#e8c9a0')); top.position.set(cx, H - 0.35, -cy); top.rotation.y = ang; g.add(top); }
  };
  wall(x0, y0, x1, y0, true); wall(x1, y0, x1, y1); wall(x1, y1, x0, y1); wall(x0, y1, x0, y0);
  const winT = sign('Palermo', 'MARE · SOLE · PANELLE', '#7fc4e8', '#ffffff', 512, 256);
  for (const [x, y, r] of [[x0 + 0.14, -3, Math.PI / 2], [x0 + 0.14, 3, Math.PI / 2], [x1 - 0.14, -3, -Math.PI / 2], [x1 - 0.14, 3, -Math.PI / 2]]) { const w = new T.Mesh(new T.PlaneGeometry(2.6, 1.4), new T.MeshBasicMaterial({ map: winT, toneMapped: false })); w.position.set(x, 2.1, -y); w.rotation.y = r; g.add(w); }
  const exitT = sign('Uscita', 'PREMI E PER USCIRE', '#2f8a55', '#ffffff', 512, 160); { const e = new T.Mesh(new T.PlaneGeometry(1.6, 0.5), new T.MeshBasicMaterial({ map: exitT, toneMapped: false })); e.position.set(0, 2.85, -(y0 + 0.14)); g.add(e); }
  // the buffet: a long counter of trays
  const counter = new T.Mesh(new T.BoxGeometry(12, 0.95, 1.2), M('#f4f1ea')); counter.position.set(0, 0.6, -(y1 - 1.0)); counter.castShadow = true; g.add(counter);
  const glass = new T.Mesh(new T.BoxGeometry(12, 0.05, 1.3), M('#bfe0ec', { transparent: true, opacity: 0.45 })); glass.position.set(0, 1.55, -(y1 - 1.0)); g.add(glass);
  const foods = ['#e3902f', '#f2d16b', '#c4372e', '#3e8a57', '#f4f1ea', '#8a5a3a', '#f59ac4', '#d9a47c'];
  for (let i = 0; i < 10; i++) { const tray = new T.Mesh(new T.BoxGeometry(1.0, 0.08, 0.8), M('#c9ccd1', { metalness: 0.6, roughness: 0.3 })); tray.position.set(-5.4 + i * 1.2, 1.12, -(y1 - 1.0)); g.add(tray);
    const heap = new T.Mesh(G.HDK ? G.HDK.lump(0.4, 1, 0.5, i * 3) : new T.SphereGeometry(0.4, 12, 8), M(foods[i % foods.length])); heap.position.set(-5.4 + i * 1.2, 1.2, -(y1 - 1.0)); heap.scale.set(1.1, 0.35, 0.85); g.add(heap); }
  const bsign = new T.Mesh(new T.PlaneGeometry(4, 0.8), new T.MeshBasicMaterial({ map: sign('Buffet', 'SERVITEVI · SELF SERVICE', '#7a1f24', '#f6e7b6', 768, 192), toneMapped: false })); bsign.position.set(0, 2.5, -(y1 - 0.15)); g.add(bsign);
  // tables
  const table = (x, y, r, big) => {
    const t = new T.Group(); t.position.set(x - R0[0], 0, -(y - R0[1]));
    const top = new T.Mesh(new T.CylinderGeometry(r, r, 0.06, 32), M('#f4f1ea')); top.position.y = 0.95; top.castShadow = true; t.add(top);
    const cloth = new T.Mesh(new T.CylinderGeometry(r + 0.04, r + 0.12, 0.5, 32, 1, true), M('#f4f1ea', { side: T.DoubleSide })); cloth.position.y = 0.72; t.add(cloth);
    const leg = new T.Mesh(new T.CylinderGeometry(0.08, 0.2, 0.9, 16), M('#3a2a20')); leg.position.y = 0.47; t.add(leg);
    if (!big) for (let k = 0; k < 3; k++) { const a = k * 2.1; const ch = new T.Mesh(new T.BoxGeometry(0.45, 0.06, 0.45), M('#7a1f24')); ch.position.set(Math.cos(a) * (r + 0.45), 0.5, Math.sin(a) * (r + 0.45)); t.add(ch); }
    g.add(t); return t;
  };
  S.myTable = table(SEAT_ME[0] + 0.9, SEAT_ME[1], 0.6);
  S.gTable = table(TABLE_G[0], TABLE_G[1], 1.0, true);
  for (const [x, y] of [[R0[0] + 5.5, R0[1] - 3], [R0[0] + 5.5, R0[1] + 3.5], [R0[0] - 5.5, R0[1] + 3.5], [R0[0] + 8, R0[1]]]) table(x, y, 0.6);
  G.scene.add(g); S.room = g;
  G.finalizeSegs();
}
function person(look, x, y, a) { const m = G.makePerson(G.fullLook({ v: 2, ...look })); m.position.set(x, 0.02, -y); m.rotation.y = a; if (G.noLod) G.noLod(m); G.scene.add(m); return m; }
function buildCast() {
  // Giorgio in line outside, with two others
  const ang = Math.atan2(IN_N[1], IN_N[0]), q = (k) => [DOOR[0] - IN_N[0] * 0.4 + MQ[0] * (2.2 + k * 1.1), DOOR[1] - IN_N[1] * 0.4 + MQ[1] * (2.2 + k * 1.1)];
  [S.qx, S.qy] = q(0);
  S.small = person(LOOK, S.qx, S.qy, face(Math.atan2(-MQ[1], -MQ[0])));
  S.queue = [person({ build: 'slim', top: 'polo', c1: '#2a5bd7' }, ...q(1), 0), person({ build: 'normal', top: 'shirt', c1: '#f59ac4', bottom: 'skirt', hair: 'long' }, ...q(2), 0)];
  for (const m of S.queue) m.rotation.y = S.small.rotation.y;
  // inside: two waiters and some diners
  S.waiters = [person(WAITER, KITCHEN[0], KITCHEN[1], 0), person({ ...WAITER, hair: 'bun', build: 'normal' }, KITCHEN[0] - 1, KITCHEN[1], 0)];
  S.waiters.forEach((w, i) => { w.userData.wx = KITCHEN[0] - i; w.userData.wy = KITCHEN[1]; const p = new T.Mesh(new T.CylinderGeometry(0.22, 0.18, 0.04, 24), M('#f4f1ea')); p.position.set(0, 1.25, 0.35); p.visible = false; w.add(p); w.userData.tray = p; });
  for (const [x, y, tx, ty] of [[R0[0] + 5.5, R0[1] - 3.9, R0[0] + 5.5, R0[1] - 3], [R0[0] + 5.5, R0[1] + 2.6, R0[0] + 5.5, R0[1] + 3.5], [R0[0] - 5.5, R0[1] + 2.6, R0[0] - 5.5, R0[1] + 3.5], [R0[0] + 8.9, R0[1], R0[0] + 8, R0[1]]]) { const m = person(G.randomLook(), x, y, faceTo(x, y, tx, ty)); m.userData.tf = faceTo(x, y, tx, ty); S.patrons.push(m); sit(m); }
  S.inGio = person(LOOK, TABLE_G[0], TABLE_G[1] - 1.5, 0); S.inGio.visible = false;
  S.anchor = new T.Object3D(); G.scene.add(S.anchor);
  // a stack of empty plates beside him
  const pg = new T.CylinderGeometry(0.2, 0.16, 0.035, 24), pm = M('#f4f1ea', { roughness: 0.4 });
  S.plateStack = new T.InstancedMesh(pg, pm, 120); S.plateStack.count = 0; G.scene.add(S.plateStack);
}
function sit(m, lift = 0) { const u = m.userData; m.position.y = 0.02 - 0.42 + lift; u.legL.rotation.x = -1.45; u.legR.rotation.x = -1.45; u.posedSit = true; }
// fatter: wider torso, arms pushed out, legs thicker
function fatten(m, f) {
  const u = m.userData; if (!u.fat0) u.fat0 = { ax: Math.abs(u.armL.position.x), lx: Math.abs(u.legL.position.x) };
  u.torso.scale.set(f, 1 + (f - 1) * 0.15, f * 1.18);
  u.armL.position.x = -u.fat0.ax * (0.6 + f * 0.4); u.armR.position.x = u.fat0.ax * (0.6 + f * 0.4);
  const lf = Math.sqrt(f); u.legL.scale.set(lf, 1, lf); u.legR.scale.set(lf, 1, lf); u.legL.position.x = -u.fat0.lx * lf; u.legR.position.x = u.fat0.lx * lf;
  u.armL.scale.set(lf, 1, lf); u.armR.scale.set(lf, 1, lf);
}

// ------------------------------------------------------------------ HUD
function hud() {
  const css = document.createElement('style');
  css.textContent = `
#gioBar { top: calc(54px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); width: min(460px, calc(100vw - 32px)); background: #141116; color: #fbf8f2; border: 3px solid #d7261e; border-radius: 10px; padding: 7px 12px 9px; display: grid; gap: 5px; box-shadow: 0 6px 18px rgba(0,0,0,.4); z-index: 6; }
#gioBar .t { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font: 800 13px/1.1 var(--f-ui, system-ui); letter-spacing: .1em; text-transform: uppercase; }
#gioBar .t small { font-weight: 700; letter-spacing: .02em; text-transform: none; color: #f59ac4; }
#gioBar .bar { height: 10px; border-radius: 5px; background: rgba(251,248,242,.15); overflow: hidden; }
#gioBar .bar i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #d7261e, #ff8a3d); transition: width .25s; }
#gioBar .s { font: 600 12px/1.2 var(--f-ui, system-ui); color: #efd9ad; }
#gioAlert { top: 40%; left: 50%; transform: translate(-50%, -50%); font: 900 clamp(34px, 7vw, 72px)/1 var(--f-display, Georgia, serif); color: #fbf8f2; text-shadow: 0 4px 0 #7a1f24, 0 0 30px rgba(0,0,0,.6); text-align: center; pointer-events: none; }
#gioAlert small { display: block; font: 800 14px/1.3 var(--f-ui, system-ui); letter-spacing: .12em; text-transform: uppercase; color: #f59ac4; text-shadow: 0 1px 2px #000; margin-top: 8px; }
body:has(#gioBar:not([hidden])) #wanted { top: calc(122px + env(safe-area-inset-top, 0px)); }`;
  document.head.appendChild(css);
  const mk = (id) => { const e = document.createElement('div'); e.id = id; e.className = 'hud'; e.hidden = true; document.body.appendChild(e); return e; };
  S.hud = mk('gioBar'); S.hud.innerHTML = '<div class="t"><span>Giorgio</span><small></small></div><div class="bar"><i></i></div><div class="s"></div>';
  S.alert = mk('gioAlert');
}
function alertBig(big, small, ms = 2600) { S.alert.innerHTML = ''; S.alert.append(document.createTextNode(big)); if (small) { const s = document.createElement('small'); s.textContent = small; S.alert.append(s); } S.alert.hidden = false; clearTimeout(S.alertT); S.alertT = setTimeout(() => { S.alert.hidden = true; }, ms); }
function flash() { const f = document.getElementById('flash'); if (!f) return; f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity 1.2s'; f.style.opacity = 0; }); }

// ------------------------------------------------------------------ quest API for the game
export const inside = () => S.stage === 'inside' || S.stage === 'show';
export const active = () => S.stage !== 'off' && S.stage !== 'done';
export function start() {           // picked from the menu
  if (S.ev && S.ev.ph === 'r') { S.stage = 'fight'; return; }
  if (inside()) return;
  S.stage = 'go';
}
export function stop() { if (inside()) leaveRoom(true); S.stage = 'off'; }
export function status() {
  const ev = S.ev && S.ev.ph === 'r' ? S.ev : null;
  if (ev) return ['live', 'Giorgio is loose', `${Math.round(ev.s * 1.8)} m tall · ${Math.max(0, Math.round(ev.hp))} / ${Math.round(ev.mx)} hunger left`];
  if (S.stage === 'go') return ['live', 'In progress', 'Eat at Tutto Compreso, Via Maqueda'];
  if (inside()) return ['live', 'In progress', 'Having lunch with Giorgio'];
  if (S.stage === 'done') return ['done', 'Palermo saved', S.wins ? `Giorgio stopped ${S.wins}×` : ''];
  return ['ready', 'Ready', S.wins ? `Giorgio stopped ${S.wins}×` : 'Giorgio is queueing on Via Maqueda'];
}
export function objective() {
  const ev = S.ev && S.ev.ph === 'r' ? S.ev : null;
  if (S.stage === 'fight' || (ev && S.stage !== 'off')) return { text: 'Stop Giorgio before he eats Palermo!', x: ev ? ev.x : FAC[0], y: ev ? ev.y : FAC[1], name: 'Giorgio', near: true };
  if (S.stage === 'go') return { text: 'Have lunch at Tutto Compreso · Via Maqueda', x: DOOR[0], y: DOOR[1], name: 'Tutto Compreso' };
  if (S.stage === 'inside') return { text: S.plate ? 'Sit at your table and eat' : 'Fill a plate at the buffet', x: S.plate ? SEAT_ME[0] : BUFFET[0], y: S.plate ? SEAT_ME[1] : BUFFET[1], name: S.plate ? 'your table' : 'the buffet', near: true };
  if (S.stage === 'show') return { text: 'Enjoy your meal… and watch Giorgio', x: TABLE_G[0], y: TABLE_G[1], name: 'Giorgio', near: true };
  return null;
}
export function mapInfo() { const ev = S.ev && (S.ev.ph === 'r' || S.ev.ph === 'd') ? S.ev : null; return { door: DOOR, giant: ev ? { x: ev.x, y: ev.y, s: ev.s } : null }; }
export function hint() {
  const P = G.player;
  if (S.ev && S.ev.plan && nearVan()) return P.vespa ? null : 'Press <kbd>E</kbd> to take vegetables from the police';
  if (P.vespa) return null;
  if (S.stage !== 'show' && !S.ruined && !inside() && hyp(P.x - DOOR[0], P.y - DOOR[1]) < 2.6) return `Press <kbd>E</kbd> to go in · all you can eat €${PRICE.toFixed(2).replace('.', ',')}`;
  if (inside()) {
    if (S.seated) return S.stage === 'show' ? 'Press <kbd>E</kbd> to take another bite · move to stand up' : 'Press <kbd>E</kbd> to eat · move to stand up';
    if (hyp(P.x - EXIT[0], P.y - EXIT[1]) < 2) return 'Press <kbd>E</kbd> to leave the restaurant';
    if (!S.plate && hyp(P.x - BUFFET[0], P.y - BUFFET[1]) < 2.4) return 'Press <kbd>E</kbd> to fill your plate';
    if (S.plate && hyp(P.x - SEAT_ME[0], P.y - SEAT_ME[1]) < 1.8) return 'Press <kbd>E</kbd> to sit down and eat';
  }
  return null;
}
export function interact() {
  const P = G.player;
  if (!P.vespa && S.ev && S.ev.plan && nearVan()) { if (S.vanT <= 0) { S.vanT = 2.5; G.giveWeapon('verdura', 15, true); G.toast('+15 broccoli', 'F to throw · aim for Giorgio', 1300); G.sfx.pick(); } return true; }
  if (P.vespa) return false;
  if (!inside() && !S.ruined && hyp(P.x - DOOR[0], P.y - DOOR[1]) < 2.6) { enterRoom(); return true; }
  if (!inside()) return false;
  if (S.seated) { bite(); return true; }
  if (hyp(P.x - EXIT[0], P.y - EXIT[1]) < 2) { leaveRoom(); return true; }
  if (!S.plate && hyp(P.x - BUFFET[0], P.y - BUFFET[1]) < 2.4) { S.plate = true; G.sfx.pick(); G.say(P.mesh, G.pick(['Panelle, pasta, sushi... tutto!', 'Un pochino di tutto.', 'Mi servo.']), 1400); return true; }
  if (S.plate && hyp(P.x - SEAT_ME[0], P.y - SEAT_ME[1]) < 1.8) { S.seated = true; P.x = SEAT_ME[0]; P.y = SEAT_ME[1]; P.a = 0; G.sfx.pick(); if (S.stage === 'inside') startShow(); return true; }
  return false;
}
function enterRoom() {
  const P = G.player;
  if (G.wallet.eur < PRICE) { G.toast('€14,90 to get in', 'you only have ' + G.fmtEur(G.wallet.eur), 1600); return; }
  G.addMoney(-PRICE); G.sfx.kaching && G.sfx.kaching();
  S.back = [P.x, P.y]; S.stage = 'inside'; S.plate = false; S.seated = false;
  P.x = EXIT[0]; P.y = EXIT[1] + 1.2; P.a = Math.PI / 2; G.cam.yaw = Math.PI / 2;
  G.perfWarm && G.perfWarm(3);
  S.inGio.visible = true; S.small.visible = false; resetShow();
  G.toast('Tutto Compreso', 'fill a plate and sit down · Giorgio got a table first', 2200);
  G.say(S.inGio, 'Cameriere! Il primo giro!', 2000);
}
function leaveRoom(quiet) {
  const P = G.player;
  S.seated = false; S.plate = false;
  if (S.stage === 'inside' || S.stage === 'show') S.stage = 'go';
  resetShow(); S.inGio.visible = false; S.small.visible = !S.ruined && !(S.ev && S.ev.ph === 'r');
  P.x = ST[0] - IN_N[0] * 1.5; P.y = ST[1] - IN_N[1] * 1.5; P.a = Math.atan2(-IN_N[1], -IN_N[0]);
  G.perfWarm && G.perfWarm(3);
  if (!quiet) G.toast('Back on Via Maqueda', '', 1200);
}
function bite() { S.bites++; G.sfx.pick(); if (S.bites % 3 === 0) G.say(G.player.mesh, G.pick(['Mmh!', 'Buonissimo.', 'Ancora un po\'...', 'Pieno. Quasi.']), 1000); }

// ------------------------------------------------------------------ the lunch: Giorgio eats, and eats, and grows
function resetShow() { const sh = S.show; sh.t = 0; sh.plates = 0; sh.s = 1; sh.waiter = 0; sh.wT = 0; sh.eatT = 0; sh.lineT = 3; sh.boom = false; S.plateStack.count = 0; if (S.inGio) { S.inGio.scale.setScalar(LOOK.height); fatten(S.inGio, 1); } for (const w of S.waiters) { w.userData.st = 'wait'; w.userData.tray.visible = false; } }
function startShow() { S.stage = 'show'; resetShow(); G.toast('Buon appetito!', 'Giorgio has started on the first course', 1800); }
function updateRoom(dt) {
  const P = G.player, sh = S.show, gm = S.inGio;
  // keep everyone in the room (walls also stop you)
  P.x = clamp(P.x, R0[0] - RW / 2 + 0.6, R0[0] + RW / 2 - 0.6); P.y = clamp(P.y, R0[1] - RD / 2 + 0.6, R0[1] + RD / 2 - 0.6);
  if (S.seated) {
    const k = G.keys, moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((c) => k.has(c)) || (G.PAD && G.PAD.active && hyp(G.PAD.lx, G.PAD.ly) > 0.3);
    if (moving) { S.seated = false; S.plate = false; P.x = SEAT_ME[0] - 0.6; }
    else { P.x = SEAT_ME[0]; P.y = SEAT_ME[1]; P.a = 0; P.speed = 0; sit(P.mesh); P.mesh.rotation.y = Math.PI / 2; const u = P.mesh.userData; u.armR.rotation.x = -1.2 + Math.sin(G.clock.elapsedTime * 6) * 0.25; }
  }
  // the diners
  S.patrons.forEach((m, i) => { sit(m); const u = m.userData; u.armR.rotation.x = -1 + Math.sin(G.clock.elapsedTime * 3 + i) * 0.4; m.rotation.y = sh.plates > 6 && S.stage === 'show' ? faceTo(m.position.x, -m.position.z, TABLE_G[0], TABLE_G[1]) : u.tf; });
  if (S.stage !== 'show') { sit(gm, 0.0); gm.position.set(TABLE_G[0], 0.02 - 0.42, -(TABLE_G[1] - 1.45)); gm.rotation.y = Math.PI; S.anchor.position.set(TABLE_G[0], 1.0, -(TABLE_G[1] - 1.45)); return; }
  sh.t += dt;
  // waiters shuttle plates from the kitchen; he grabs each one and it's gone
  const seat = [TABLE_G[0], TABLE_G[1] - 1.45 - (sh.s - 1) * 0.4];
  for (const w of S.waiters) {
    const u = w.userData; u.st = u.st || 'wait';
    const tgt = u.st === 'bring' ? [TABLE_G[0] + 1.1, TABLE_G[1] - 1.0] : [u.wx, u.wy];
    const dx = tgt[0] - w.position.x, dy = tgt[1] + w.position.z, d = hyp(dx, dy), sp = 2.6 + sh.plates * 0.08;
    if (d > 0.15) { w.position.x += dx / d * Math.min(d, sp * dt); w.position.z -= dy / d * Math.min(d, sp * dt); w.rotation.y = face(Math.atan2(dy, dx)); G.animatePerson(w, G.clock.elapsedTime * 10, 0.5, u.st === 'bring' ? -1.3 : 0); }
    else if (u.st === 'bring') { u.st = 'back'; u.tray.visible = false; sh.eatT = 1.3; G.sfx.pick(); }
    else if (u.st === 'back') u.st = 'wait';
    if (u.st === 'wait' && sh.wT <= 0 && !sh.boom) { u.st = 'bring'; u.tray.visible = true; sh.wT = Math.max(0.8, 2.6 - sh.plates * 0.11); }
  }
  sh.wT -= dt;
  // chewing
  const u = gm.userData;
  if (sh.eatT > 0) {
    sh.eatT -= dt; u.armR.rotation.x = -2.4 + Math.sin(sh.eatT * 18) * 0.3; u.armL.rotation.x = -1.6; u.mouth.scale.y = 1 + Math.abs(Math.sin(sh.eatT * 16)) * 1.8;
    if (sh.eatT <= 0) {
      sh.plates++; sh.s = 1 + sh.plates * 0.095;
      const i = S.plateStack.count; if (i < 120) { const d = G.dummy; d.position.set(TABLE_G[0] - 0.6 + (i % 3) * 0.42, 1.0 + Math.floor(i / 3) * 0.04, -(TABLE_G[1] + 0.2)); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); S.plateStack.setMatrixAt(i, d.matrix); S.plateStack.count = i + 1; S.plateStack.instanceMatrix.needsUpdate = true; }
      if (Math.random() < 0.6) G.say(S.anchor, G.pick(LINES_EAT), 1300);
    }
  } else { u.armR.rotation.x = -0.8; u.armL.rotation.x = -0.8; u.mouth.scale.y = 1.4; }
  sh.lineT -= dt; if (sh.lineT <= 0 && sh.plates > 4) { sh.lineT = 3.5; const p = G.pick(S.patrons); G.say(p, G.pick(LINES_ROOM), 1500); }
  // he grows; the room starts to shake; then it can't hold him
  gm.scale.setScalar(LOOK.height * sh.s); fatten(gm, 1 + (sh.s - 1) * 1.4); sit(gm); gm.position.set(seat[0], 0.02 - 0.42 * sh.s, -seat[1]); gm.rotation.y = Math.PI;
  S.anchor.position.set(seat[0], 1.0 * sh.s, -seat[1]);
  if (sh.s > 1.9) G.cam.shake = Math.max(G.cam.shake, (sh.s - 1.9) * 0.35);
  if (sh.plates === 13 && !sh.warned) { sh.warned = true; G.toast('Something is creaking', 'the table... the floor... the walls', 1800); }
  if (sh.plates < 13) sh.warned = false;
  if (sh.s >= 2.6 && !sh.boom) { sh.boom = true; sh.boomT = 1.6; G.say(S.anchor, 'NON BASTA!!!', 1600); G.sfx.thud(); }
  if (sh.boom) { sh.boomT -= dt; G.cam.shake = 1.2; if (sh.boomT <= 0) burst(); }
}
// he bursts out onto Via Maqueda and the city event begins
function burst() {
  const P = G.player;
  flash(); G.sfx.thud(); G.sfx.burst && G.sfx.burst(); G.cam.shake = 1.5;
  S.seated = false; S.plate = false; resetShow(); S.inGio.visible = false; S.wasInside = true;
  P.x = ST[0] - MQ[0] * 14 - IN_N[0] * 1.5; P.y = ST[1] - MQ[1] * 14 - IN_N[1] * 1.5; P.a = Math.atan2(MQ[1], MQ[0]); G.cam.yaw = P.a;
  G.perfWarm && G.perfWarm(4);
  S.stage = 'fight';
  // join a Giorgio already loose (another player got there first) or start one
  const other = remoteEvent();
  if (other) { adopt(other, false); }
  else hostNew(ST[0] + IN_N[0] * 2, ST[1] + IN_N[1] * 2, 8);
  alertBig('GIORGIO HA ANCORA FAME', 'he broke the restaurant · everyone online can see him · stop him together', 4200);
}

// ------------------------------------------------------------------ the city event
function eid() { return (Date.now() % 1e9).toString(36) + Math.random().toString(36).slice(2, 5); }
function hostNew(x, y, s) {
  const players = 1 + (NET && NET.peersExt ? NET.peersExt().length : 0);
  const mx = 420 + 260 * (players - 1);
  S.hostEv = { e: eid(), ph: 'r', x, y, a: Math.atan2(-IN_N[1], -IN_N[0]), s, hp: mx, mx, bite: 0, bk: 'c', bx: x, by: y, st: 0, tx: x, ty: y, task: null, stompT: 6, eatT: 0, sayT: 2, dT: 0, life: 0 };
  S.dmgSeen = new Map(); S.myDmg = 0; S.myE = S.hostEv.e;
  S.ev = { ...S.hostEv, host: true, seen: S.now };
  ruin(true);
}
function adopt(gz, wasHost) {
  if (S.hostEv && S.hostEv.e !== gz.e) S.hostEv = null;
  if (S.myE !== gz.e) { S.myE = gz.e; S.myDmg = 0; }
  if (S.joinedE !== gz.e && gz.ph === 'r') {
    S.joinedE = gz.e;
    if (S.stage === 'off' || S.stage === 'go' || S.stage === 'done') S.stage = 'fight';
    if (!wasHost) { alertBig('GIORGIO STA MANGIANDO PALERMO', 'a giant is loose near Via Maqueda · help stop him', 3800); G.sfx.alarm && G.sfx.alarm(); }
  }
  ruin(true);
}
// the newest picture of Giorgio someone else is running
function remoteEvent() {
  if (!NET || !NET.peersExt) return null;
  let best = null;
  const hb = S.hbSeen || (S.hbSeen = new Map());
  for (const r of NET.peersExt()) {
    const z = r.ext && r.ext.gz; if (!z || (z.ph !== 'r' && z.ph !== 'd')) continue;
    // a player who has gone quiet (closed the tab, lost the connection) isn't running Giorgio any more
    const h = hb.get(r.peer); if (!h || h.hb !== z.hb) hb.set(r.peer, { hb: z.hb, t: S.now }); else if (S.now - h.t > 3.5) { S.staleHost = r.peer; continue; }
    if (!best || z.e < best.gz.e) best = { gz: z, peer: r.peer };
  }
  return best ? { ...best.gz, peer: best.peer } : null;
}
// cumulative damage everybody has reported for event e
function damageFrom(e) {
  let add = 0;
  const seen = S.dmgSeen;
  const tally = (who, d) => { const prev = seen.has(who) ? seen.get(who) : 0; if (d > prev) { add += d - prev; seen.set(who, d); } else if (!seen.has(who)) seen.set(who, d); };
  if (NET && NET.peersExt) for (const r of NET.peersExt()) { const q = r.ext && r.ext.gd; if (q && q.e === e) tally(r.peer, q.d || 0); }
  tally('me', S.myDmg);
  return add;
}
function primeDamage(e) { if (NET && NET.peersExt) for (const r of NET.peersExt()) { const q = r.ext && r.ext.gd; if (q && q.e === e) S.dmgSeen.set(r.peer, q.d || 0); } S.dmgSeen.set('me', S.myDmg); }
function participants() { let n = 1; if (NET && NET.peersExt && S.ev) for (const r of NET.peersExt()) { const q = r.ext && r.ext.gd, z = r.ext && r.ext.gz; if ((q && q.e === S.ev.e) || (z && z.e === S.ev.e)) n++; } return n; }
// my game runs Giorgio
function runHost(dt) {
  const H = S.hostEv; H.life += dt;
  if (H.ph === 'r') {
    // damage in from everyone, healing from what he eats
    const dmg = damageFrom(H.e); if (dmg > 0) { H.hp -= dmg; H.dT = 0.25; if (H.plan) H.s = Math.max(7, H.s - dmg * 0.004); }
    // nothing normal hurts him for long: until the police try the vegetables, he heals as he goes
    if (!H.plan) H.hp = Math.min(H.mx, H.hp + 5 * dt);
    // the plan: the police hand vegetables to the whole neighbourhood, and the neighbourhood throws them
    if (H.plan) { const civ = (6 + 2 * participants()) * dt; H.hp -= civ; H.s = Math.max(7, H.s - civ * 0.004); }
    if (!H.wit && (H.s >= 12 || H.life > 45)) H.wit = 1;
    if (!H.plan && planVotes(H.e)) H.plan = 1;
    if (H.hp <= 0) { H.ph = 'd'; H.hp = 0; H.downT = 0; H.s0 = H.s; return; }
    const speed = Math.min(9, 1.6 + H.s * 0.3), reach = 1.2 + H.s * 0.55;
    if (!H.task) H.task = pickTask(H);
    const tk = H.task;
    if (H.eatT > 0) { H.eatT -= dt; }
    else {
      if (tk.follow) { const q = tk.follow(); if (q) { tk.x = q[0]; tk.y = q[1]; } else H.task = null; }
      const dx = tk.x - H.x, dy = tk.y - H.y, d = hyp(dx, dy);
      if (d > reach) { const m = Math.min(d - reach * 0.9, speed * dt); H.x += dx / d * m; H.y += dy / d * m; H.a += G.angDiff(H.a, Math.atan2(dy, dx)) * Math.min(1, dt * 3); }
      else {
        // a bite: a car or a piece of a building; he grows and gets some hunger back
        H.bite++; H.bk = tk.k; H.bx = tk.x; H.by = tk.y; H.bt = tk.who || ''; H.eatT = 1.8;
        const gain = tk.k === 'b' ? 0.5 : tk.k === 'p' ? 0.25 : 0.35;
        H.s = Math.min(SMAX, H.s + gain); H.mx += 45; H.hp = Math.min(H.mx, H.hp + (tk.k === 'b' ? 70 : 50) * (H.plan ? 0.3 : 1));
        H.task = null;
      }
      if (tk.t != null) { tk.t -= dt; if (tk.t <= 0) H.task = null; }
    }
    H.stompT -= dt;
    if (H.stompT <= 0) { H.stompT = 6.5 + Math.random() * 3; H.st++; }
  } else if (H.ph === 'd') {
    H.downT += dt;
    H.s = Math.max(1, H.s0 * Math.max(0, 1 - H.downT / 6));
    if (H.downT > 14) { H.ph = 'x'; }
  }
}
const SMAX = 60;
// someone to eat: a player close by (any of us), or else whoever is walking past
function personTask(H) {
  const me = NET && NET.myPeer ? NET.myPeer() : 'me', P = G.player;
  const cands = [];
  if (!inside() && !P.ko) cands.push({ who: me, at: () => (inside() ? null : [P.x, P.y]) });
  if (NET && NET.list) for (const rp of NET.list()) cands.push({ who: rp.peer, at: () => { const q = NET.list().find((z) => z.peer === rp.peer); return q ? [q.x, q.y] : null; } });
  let best = null, bd = 55;
  for (const c of cands) { const q = c.at(); if (!q) continue; const d = hyp(q[0] - H.x, q[1] - H.y); if (d < bd) { bd = d; best = c; } }
  if (best && Math.random() < 0.45) { const q = best.at(); return { k: 'p', x: q[0], y: q[1], who: best.who, follow: best.at, t: 12 }; }
  let ped = null; bd = 60;
  for (const p of G.peds) { if (!p.mesh.visible || p.state === 'fly' || p.state === 'down') continue; const d = hyp(p.x - H.x, p.y - H.y); if (d < bd) { bd = d; ped = p; } }
  if (ped) return { k: 'p', x: ped.x, y: ped.y, who: '', follow: () => (ped.mesh.visible ? [ped.x, ped.y] : null), t: 12 };
  return null;
}
function planVotes(e) {
  if (S.suggested && S.myE === e) return true;
  if (NET && NET.peersExt) for (const rp of NET.peersExt()) { const q = rp.ext && rp.ext.gd; if (q && q.e === e && q.pl) return true; }
  return false;
}
function pickTask(H) {
  // stay near the old town
  if (hyp(H.x - FAC[0], H.y - FAC[1]) > LEASH) return { k: 'w', x: FAC[0] + (Math.random() - 0.5) * 80, y: FAC[1] + (Math.random() - 0.5) * 80, t: 20 };
  // the bigger he gets, the less he bothers with cars: people, and whole buildings
  const late = clamp((H.s - 8) / 14, 0, 1), roll = Math.random(), wP = 0.22 + 0.13 * late, wC = 0.45 - 0.3 * late;
  if (roll < wP) { const t = personTask(H); if (t) return t; }
  if (roll < wP + wC) {
    let best = null, bd = 70;
    for (const p of G.parked) { if (!p.alive) continue; const d = hyp(p.x - H.x, p.y - H.y); if (d < bd) { bd = d; best = p; } }
    for (const c of G.traffic) { if (c.state !== 'drive') continue; const d = hyp(c.x - H.x, c.y - H.y); if (d < bd) { bd = d; best = c; } }
    if (best) return { k: 'c', x: best.x, y: best.y, t: 16 };
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, L = 45, ex = H.x + Math.cos(a) * L, ey = H.y + Math.sin(a) * L;
    const f = G.rayWalls(H.x, H.y, 2, ex, ey, 2);
    if (f < 1 && f * L > 3) return { k: 'b', x: H.x + Math.cos(a) * L * f, y: H.y + Math.sin(a) * L * f, t: 18 };
  }
  return { k: 'w', x: H.x + (Math.random() - 0.5) * 40, y: H.y + (Math.random() - 0.5) * 40, t: 10 };
}
// the giant, drawn from whoever is running him
function updateGiant(dt, ev) {
  if (!S.giant) { S.giant = G.makePerson(G.fullLook({ v: 2, ...LOOK })); if (G.noLod) G.noLod(S.giant); S.giant.traverse((o) => { if (o.isMesh) o.castShadow = true; }); G.scene.add(S.giant); S.gs = { x: ev.x, y: ev.y, a: ev.a, s: ev.s, ph: 0 }; }
  const g = S.giant, gs = S.gs, k = Math.min(1, dt * 5);
  const moved = hyp(ev.x - gs.x, ev.y - gs.y);
  gs.x += (ev.x - gs.x) * k; gs.y += (ev.y - gs.y) * k; gs.a += G.angDiff(gs.a, ev.a) * k; gs.s += (ev.s - gs.s) * Math.min(1, dt * 2);
  g.visible = ev.ph === 'r' || ev.ph === 'd';
  const s = gs.s, u = g.userData;
  g.scale.setScalar(s); fatten(g, 1.9 + Math.min(1.2, s * 0.03));
  if (ev.ph === 'd') {
    // deflating: up he goes like a balloon, spinning, smaller and smaller, then down
    const t = ev.downT != null ? ev.downT : (S.now - (S.downAt || S.now));
    const up = Math.sin(Math.min(1, t / 7) * Math.PI) * 18;
    g.position.set(gs.x, up, -gs.y); g.rotation.set(Math.sin(t * 3) * 0.5, face(gs.a) + t * 4, Math.cos(t * 2.5) * 0.4);
    u.mouth.scale.y = 2.5;
  } else {
    g.position.set(gs.x, 0.1, -gs.y); g.rotation.set(0, face(gs.a), 0);
    gs.ph += moved * 0.9 / Math.max(1, s * 0.4) + dt * 0.5;
    G.animatePerson(g, gs.ph, moved > 0.02 ? 0.45 : 0.05, 0);
    if (S.chewT > 0) { S.chewT -= dt; u.armR.rotation.x = -2.6 + Math.sin(S.chewT * 14) * 0.2; u.armL.rotation.x = -2.2; u.mouth.scale.y = 1 + Math.abs(Math.sin(S.chewT * 12)) * 2.2; }
    if (S.hurtT > 0) { S.hurtT -= dt; g.rotation.z = Math.sin(S.hurtT * 40) * 0.03; }
    if (S.yuckT > 0) { S.yuckT -= dt; u.head.rotation.y = Math.sin(S.yuckT * 30) * 0.5; u.mouth.scale.y = 0.4; u.armL.rotation.x = -2.9; }
  }
  S.anchor.position.set(gs.x, 2.0 * s, -gs.y);
  // he speaks
  S.sayT = (S.sayT || 3) - dt; if (S.sayT <= 0 && ev.ph === 'r') { S.sayT = 6 + Math.random() * 5; G.say(S.anchor, G.pick(LINES_GIANT), 2200); }
  // bites: play them where they happened
  if (ev.bite > S.lastBite) { if (S.lastBite || ev.bite === 1) chomp(ev); S.lastBite = ev.bite; }
  if (ev.st > S.lastStomp) { if (S.lastStomp || ev.st === 1) stomp(gs, s); S.lastStomp = ev.st; }
  // you can't walk through his feet
  const P = G.player, fr = 0.55 * s + 0.4, dx = P.x - gs.x, dy = P.y - gs.y, d = hyp(dx, dy);
  if (ev.ph === 'r' && d < fr && d > 0.01 && !P.fly) {
    if (P.vespa && Math.abs(P.vespa.speed) > 5) {
      const v = P.vespa, dmg = Math.abs(v.speed) * (v.spec.car ? 4.5 : 2.5) * 0.5;
      dealt(dmg); G.sfx.thud(); G.cam.shake = 0.8; v.speed = -v.speed * 0.35; v.x = gs.x + dx / d * fr; v.y = gs.y + dy / d * fr;
      G.toast('-' + Math.round(dmg), G.pick(['dritto nella caviglia!', 'ram!', 'mizzica che botta']), 900);
    } else if (P.vespa) { P.vespa.x = gs.x + dx / d * fr; P.vespa.y = gs.y + dy / d * fr; }
    else { P.x = gs.x + dx / d * fr; P.y = gs.y + dy / d * fr; }
  }
}
function chomp(ev) {
  S.chewT = 1.7;
  const s = S.gs.s, mouth = [S.gs.x, 1.85 * s, S.gs.y];
  if (ev.bk === 'c') {
    // the nearest car to where he bit: lift it to his mouth and it's gone
    let best = null, bd = 14, type = null;
    for (const p of G.parked) { if (!p.alive) continue; const d = hyp(p.x - ev.bx, p.y - ev.by); if (d < bd) { bd = d; best = p; type = 'p'; } }
    for (const c of G.traffic) { if (c.state !== 'drive') continue; const d = hyp(c.x - ev.bx, c.y - ev.by); if (d < bd) { bd = d; best = c; type = 't'; } }
    let mesh = null, from = [ev.bx, ev.by];
    if (best && type === 'p') { best.alive = false; best.launched = true; G.hideParked(best); mesh = G.makeVehicleMesh(best.kind || 'hatch', best.col); from = [best.x, best.y]; }
    else if (best && type === 't') { mesh = G.makeVehicleMesh(best.kind, '#' + best.col.getHexString()); from = [best.x, best.y]; best.state = 'fly'; best.t = 4; best.vx = best.vy = best.vz = 0; best.ax = 0; best.z = 0; }
    else mesh = G.makeVehicleMesh(G.pick(['panda', 'c500', 'hatch']), G.pick(['#c4372e', '#2a5bd7', '#f2d16b', '#f4f1ea']));
    mesh.position.set(from[0], 0.1, -from[1]); G.scene.add(mesh);
    S.carried.push({ m: mesh, t: 0, from: [from[0], 0.1, from[1]], to: mouth });
    G.sfx.boing && G.sfx.boing(0.4);
  } else if (ev.bk === 'p') {
    const me = NET && NET.myPeer ? NET.myPeer() : 'me', P = G.player;
    if ((ev.bt && ev.bt === me.replace(/[^a-z0-9]/g, '').slice(0, 16)) || (!ev.bt && hyp(P.x - ev.bx, P.y - ev.by) < 2.5)) {
      // that was you: into his mouth, and out again
      alertBig('GNAM!', 'Giorgio ate you… and spat you out', 2000); G.cam.shake = 1.2;
      setTimeout(() => { const g = S.gs; if (g) G.launchPlayer(g.x + Math.cos(g.a) * 0.1, g.y + Math.sin(g.a) * 0.1, 12, false); G.say(S.anchor, G.pick(['PUAH! Troppo salato!', 'Sapeva di crema solare!', 'Questo non era cotto!']), 1600); }, 900);
    } else {
      // somebody walking past: lifted to his mouth (a copy of them; the real one turns up somewhere else later)
      let ped = null, bd = 14;
      for (const p of G.peds) { if (!p.mesh.visible || p.state === 'fly') continue; const d = hyp(p.x - ev.bx, p.y - ev.by); if (d < bd) { bd = d; ped = p; } }
      if (ped) {
        const m = cloneLight(ped.mesh); G.scene.add(m);
        S.carried.push({ m, t: 0, from: [ped.x, 0, ped.y], to: mouth, person: true });
        G.placePed(ped, G.player);
        if (Math.random() < 0.6) setTimeout(() => G.say(m, G.pick(['AIUTOOO!', 'Mettimi giù!', 'Non sono commestibile!', 'Mammaaa!']), 1000), 50);
      }
    }
    G.sfx.boing && G.sfx.boing(0.7);
  } else if (ev.bk === 'b') {
    // a bite out of a building: rubble, dust, and a crash
    const h = Math.min(14, 1.8 * s);
    const cols = ['#efd9ad', '#e8c9a0', '#cdbb92', '#b7a27a', '#f4f1ea', '#c4372e'];
    for (let i = 0; i < 26; i++) {
      if (!S.rubM) S.rubM = cols.map((c) => M(c));
      const m = new T.Mesh(S.rubG || (S.rubG = new T.BoxGeometry(0.6, 0.45, 0.5)), S.rubM[i % cols.length]); m.castShadow = true;
      m.position.set(ev.bx + (Math.random() - 0.5) * 3, h * (0.4 + Math.random() * 0.6), -(ev.by + (Math.random() - 0.5) * 3)); m.scale.setScalar(0.6 + Math.random() * 1.8);
      G.scene.add(m); S.debris.push({ m, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, vz: Math.random() * 6, t: 0, rx: Math.random() * 6, ry: Math.random() * 6 });
    }
    if (G.HDK) {
      const hole = new T.Mesh(G.HDK.lump(1, 1, 0.7, ev.bite), S.holeM || (S.holeM = M('#1a1210', { roughness: 1 })));
      const sc = 1.6 + s * 0.16; hole.scale.set(sc, sc * 0.8, sc); hole.position.set(ev.bx, Math.max(2.5, h), -ev.by); G.scene.add(hole); S.holes.push(hole);
      if (S.holes.length > 60) G.scene.remove(S.holes.shift());
    }
    if (hyp(G.player.x - ev.bx, G.player.y - ev.by) < 120) { G.sfx.thud(); G.cam.shake = Math.max(G.cam.shake, 0.7); }
  }
}
function stomp(gs, s) {
  G.sfx.thud();
  const R = 3 + s * 0.9, P = G.player, d = hyp(P.x - gs.x, P.y - gs.y);
  const ring = new T.Mesh(S.ringG || (S.ringG = new T.RingGeometry(0.85, 1, 48)), new T.MeshBasicMaterial({ color: '#f6e7b6', transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(gs.x, 0.3, -gs.y); G.scene.add(ring); S.rings.push({ m: ring, t: 0, R });
  if (d < R + 2) { G.cam.shake = Math.max(G.cam.shake, 1); if (d < R && !P.fly && !P.ko) G.launchPlayer(gs.x, gs.y, 9 + s * 0.2, false); }
  else if (d < 90) G.cam.shake = Math.max(G.cam.shake, 0.4 * (1 - d / 90));
  for (const p of G.peds) if (p.mesh.visible && hyp(p.x - gs.x, p.y - gs.y) < R) G.launchPed(p, gs.x, gs.y, 10, false);
}
function dealt(dmg) {
  if (!S.ev || S.ev.ph !== 'r') return;
  S.myDmg += dmg; S.hurtT = 0.35; S.lastHitT = S.now;
  if (S.hostEv && S.hostEv.e === S.ev.e) { /* counted next host step through damageFrom */ }
}
// called by combat (caos.js): what in reach of the player can be hit
export function targets() {
  const ev = S.ev; if (!ev || ev.ph !== 'r' || !S.gs) return [];
  const P = G.player, gs = S.gs, r = 0.5 * gs.s, dx = P.x - gs.x, dy = P.y - gs.y, d = hyp(dx, dy) || 1;
  // the nearest point of his ankles
  return [{ x: gs.x + dx / d * r, y: gs.y + dy / d * r, mesh: S.anchor, boss: true }];
}
export function hit(o, fx, fy, power, dmg, veg) {
  if (veg) { dealt(34); G.sfx.boing && G.sfx.boing(0.5); S.yuckT = 0.6; if (Math.random() < 0.45) G.say(S.anchor, G.pick(LINES_YUCK), 1300); return; }
  const d = Math.max(1.5, ((power || 6) * 1.6 + (dmg || 1) * 3) * 0.3);
  dealt(d); G.sfx.thud(); if (Math.random() < 0.25) G.say(S.anchor, G.pick(['Mi fai il solletico!', 'Hihihi!', 'Tutto qui?', 'Ancora fame...']), 1100);
}
// thrown things: a big target
export function shotHit(sh) {
  const ev = S.ev; if (!ev || ev.ph !== 'r' || !S.gs) return false;
  const gs = S.gs, r = 0.6 * gs.s + 0.4, d = hyp(sh.x - gs.x, sh.y - gs.y);
  if (d < r && sh.z < 2.3 * gs.s) { hit(null, sh.x, sh.y, sh.w ? sh.w.power : 6, sh.w ? sh.w.dmg : 1, sh.w && sh.w.id === 'verdura'); return true; }
  return false;
}

// ------------------------------------------------------------------ every frame
export function update(dt) {
  S.now = (S.now || 0) + dt; S.vanT -= dt;
  const P = G.player;
  // the dining room out at sea is only drawn while you're in it
  if (S.room) S.room.visible = inside();
  if (inside()) updateRoom(dt);
  // the city event: run it if it's mine, follow it if it's someone else's
  const remote = remoteEvent();
  if (S.hostEv) {
    // two Giorgios? the older one wins
    if (remote && remote.ph === 'r' && remote.e < S.hostEv.e && S.hostEv.ph === 'r') { S.hostEv = null; adopt(remote, true); }
    else runHost(dt);
  }
  if (S.hostEv) {
    const H = S.hostEv;
    S.ev = { ...H, seen: S.now, host: true };
    if (H.ph === 'x') { endEvent(H); S.hostEv = null; }
  } else if (remote && (remote.ph === 'r' || remote.ph === 'd')) {
    if (!S.ev || S.ev.e !== remote.e || remote.ph !== S.ev.ph || remote.bite !== S.ev.bite || remote.st !== S.ev.st || remote.x !== S.ev.x || remote.hp !== S.ev.hp || remote.hb !== S.ev.hb) {
      if (remote.ph === 'd' && (!S.ev || S.ev.ph !== 'd')) S.downAt = S.now;
      S.ev = { ...remote, seen: S.now, host: false, downT: remote.ph === 'd' ? S.now - (S.downAt || S.now) : null };
      adopt(remote, false);
    }
  } else if (S.ev && !S.ev.host) {
    // the player running Giorgio has gone: whoever of us is left with the smallest label takes over from the last picture
    if (S.now - S.ev.seen > 3.5) {
      if (S.ev.ph === 'r') {
        const me = NET && NET.myPeer ? NET.myPeer() : 'me';
        const others = NET && NET.peersExt ? NET.peersExt().filter((r) => r.ext && r.ext.gd && r.ext.gd.e === S.ev.e && r.peer !== S.staleHost && r.peer !== S.ev.peer).map((r) => r.peer) : [];
        if (!others.some((p) => p < me)) { S.hostEv = { ...S.ev, task: null, stompT: 5, eatT: 0, dT: 0, life: 0 }; delete S.hostEv.seen; delete S.hostEv.host; S.dmgSeen = new Map(); primeDamage(S.ev.e); }
        else if (S.now - S.ev.seen > 10) endEvent(S.ev, true);
      } else endEvent(S.ev, true);
    }
  }
  const ev = S.ev && (S.ev.ph === 'r' || S.ev.ph === 'd') ? S.ev : null;
  if (ev) { updateGiant(dt, ev); if (ev.ph === 'r') { authorities(dt, ev); witness(dt, ev); plan(dt, ev); } else { if (S.com) talkClose(); } } else if (S.giant) S.giant.visible = false;
  updateVegs(dt);
  // carried cars and falling rubble
  for (let i = S.carried.length - 1; i >= 0; i--) {
    const c = S.carried[i]; c.t += dt; const k = Math.min(1, c.t / 1.3), e = k * k * (3 - 2 * k);
    const mouth = S.gs ? [S.gs.x, 1.85 * S.gs.s, S.gs.y] : c.to;
    c.m.position.set(c.from[0] + (mouth[0] - c.from[0]) * e, c.from[1] + (mouth[1] - c.from[1]) * e + Math.sin(k * Math.PI) * 3, -(c.from[2] + (mouth[2] - c.from[2]) * e));
    if (!c.person) c.m.rotation.x += dt * 3; else { c.m.rotation.z = Math.sin(c.t * 20) * 0.5; c.m.rotation.x = Math.cos(c.t * 17) * 0.4; }
    c.m.scale.setScalar(Math.max(0.05, 1 - Math.max(0, k - 0.75) * 4));
    if (c.t > 1.6) { G.scene.remove(c.m); S.carried.splice(i, 1); }
  }
  for (let i = S.debris.length - 1; i >= 0; i--) {
    const b = S.debris[i]; b.t += dt; b.vz -= 18 * dt;
    b.m.position.x += b.vx * dt; b.m.position.z -= b.vy * dt; b.m.position.y = Math.max(0.2, b.m.position.y + b.vz * dt);
    if (b.m.position.y <= 0.2) { b.vx *= 0.6; b.vy *= 0.6; b.vz = Math.abs(b.vz) * 0.25; } else { b.m.rotation.x += b.rx * dt; b.m.rotation.y += b.ry * dt; }
    if (b.t > 7) { G.scene.remove(b.m); S.debris.splice(i, 1); }
  }
  for (let i = S.rings.length - 1; i >= 0; i--) { const r = S.rings[i]; r.t += dt; r.m.scale.setScalar(r.R * Math.min(1, r.t * 2.5)); r.m.material.opacity = Math.max(0, 0.8 - r.t * 0.9); if (r.t > 0.9) { G.scene.remove(r.m); r.m.material.dispose(); S.rings.splice(i, 1); } }
  // the restaurant front comes back some time after
  if (S.ruined && !ev) { S.fixT -= dt; if (S.fixT <= 0) ruin(false); }
  // Giorgio in the queue outside: shuffles and complains
  if (S.small.visible) { S.qT = (S.qT || 4) - dt; if (S.qT <= 0) { S.qT = 7 + Math.random() * 6; if (hyp(P.x - S.qx, P.y - S.qy) < 22) G.say(S.small, G.pick(['Quannu s\'apre?!', 'Ho fame...', 'Sono il primo in fila!', 'Un piattino solo... o venti.']), 1800); } G.animatePerson(S.small, S.now * 2, 0.04, 0); }
  // what other players see of my part in it
  publish();
  drawHud(ev);
}
function ruin(on) {
  if (on === S.ruined) { if (on) S.fixT = 25; return; }
  S.ruined = on; S.front.whole.visible = !on; S.front.ruin.visible = on;
  S.small.visible = !on && !inside(); for (const m of S.queue) m.visible = !on;
  if (on) { S.fixT = 25; if (inside() && S.stage !== 'show') leaveRoom(true); }
}
function endEvent(ev, quiet) {
  const won = ev.ph === 'x' || ev.ph === 'd' || ev.hp <= 0;
  if (won && S.rewardE !== ev.e && (S.myDmg > 0 || hyp(G.player.x - ev.x, G.player.y - ev.y) < 250)) {
    S.rewardE = ev.e; S.wins++; const st = store.get(); st.wins = S.wins; store.set(st);
    G.addMoney(60); G.sfx.jingle && G.sfx.jingle();
    alertBig('PALERMO È SALVA!', `Giorgio burped, shrank and said sorry · +€60${S.myDmg ? ' · you dealt ' + Math.round(S.myDmg) : ''}`, 4500);
    setTimeout(() => G.say(G.player.mesh, G.pick(['Mizzica, che pranzo.', 'E ora, un caffè.', 'Mai più all you can eat.']), 2000), 1500);
    if (S.stage === 'fight') S.stage = 'done';
  } else if (S.stage === 'fight') S.stage = 'go';
  S.ev = null; S.myDmg = 0; S.lastBite = 0; S.lastStomp = 0; S.suggested = false; S.asked = false; S.wasInside = false; S.lvl = 0; S.planSeen = null; clearAuthorities();
  for (const hm of S.holes) G.scene.remove(hm); S.holes.length = 0;
  if (S.giant) { S.giant.visible = false; }
  S.gs = null; if (S.giant) { G.scene.remove(S.giant); S.giant = null; }
}
function publish() {
  if (!NET || !NET.setExtra) return;
  const H = S.hostEv;
  const gz = H && (H.ph === 'r' || H.ph === 'd') ? { e: H.e, ph: H.ph, x: Math.round(H.x * 10) / 10, y: Math.round(H.y * 10) / 10, a: Math.round(H.a * 100) / 100, s: Math.round(H.s * 100) / 100, hp: Math.round(H.hp), mx: Math.round(H.mx), bite: H.bite, hb: Math.floor(H.life * 2), bk: H.bk, bt: (H.bt || '').replace(/[^a-z0-9]/g, '').slice(0, 16), wit: H.wit ? 1 : 0, plan: H.plan ? 1 : 0, bx: Math.round(H.bx), by: Math.round(H.by), st: H.st, dt: H.ph === 'd' ? Math.round(H.downT * 10) / 10 : 0 } : null;
  NET.setExtra('gz', gz);
  NET.setExtra('gd', S.ev && (S.ev.ph === 'r' || S.ev.ph === 'd') ? { e: S.ev.e, d: Math.round(S.myDmg), pl: S.suggested && S.myE === S.ev.e ? 1 : 0 } : null);
}
function drawHud(ev) {
  const show = ev && G.game.started && !inside();
  S.hud.hidden = !show;
  if (!show) return;
  const pct = Math.max(0, Math.min(100, (ev.hp / Math.max(1, ev.mx)) * 100));
  S.hud.querySelector('i').style.width = pct.toFixed(1) + '%';
  S.hud.querySelector('small').textContent = ev.ph === 'd' ? 'BUUUURP' : `${Math.round(ev.s * 1.8)} m tall`;
  const d = hyp(G.player.x - ev.x, G.player.y - ev.y), n = participants();
  const tip = ev.plan ? 'throw vegetables at him · police vans hand them out' : ev.wit ? 'the police are looking for witnesses' : 'punches barely tickle him';
  S.hud.querySelector('.s').textContent = ev.ph === 'd' ? 'Defeated! He is deflating…' : `Hunger ${Math.round(ev.hp)} / ${Math.round(ev.mx)} · ${n} ${n === 1 ? 'player' : 'players'} · ${Math.round(d)} m away · ${tip}`;
}
export const state = () => ({ lvl: S.lvl, plan: !!(S.ev && S.ev.plan), wit: !!(S.ev && S.ev.wit), asked: S.asked, suggested: S.suggested, vans: S.vans.length, talk: !!S.talkOpen, stage: S.stage, seated: S.seated, plate: S.plate, plates: S.show.plates, s: S.show.s, ev: S.ev && { e: S.ev.e, ph: S.ev.ph, hp: Math.round(S.ev.hp), mx: S.ev.mx, s: S.ev.s, x: S.ev.x, y: S.ev.y, bite: S.ev.bite, host: !!S.hostEv }, myDmg: S.myDmg, ruined: S.ruined, wins: S.wins });
export const debug = { S, DOOR, FAC, R0, SEAT_ME, BUFFET, EXIT };
// for tests: let Giorgio loose without the lunch
export function debugLoose() { S.stage = 'fight'; const other = remoteEvent(); if (other) adopt(other, false); else hostNew(ST[0] + IN_N[0] * 2, ST[1] + IN_N[1] * 2, 8); }

// ------------------------------------------------------------------ the authorities: the worse it gets, the more of them
// Each player's game draws them from how big Giorgio is (the same for everyone), so nothing extra travels.
const LVL_NEWS = [null,
  ['GIGANTE IN VIA MAQUEDA', 'La Polizia sul posto: "Signor Giorgio, si fermi"'],
  ['GIORGIO NON SI FERMA', 'Elicottero della Polizia sul centro storico · chiuse le strade'],
  ['ARRIVA L\'ESERCITO', 'Carri armati ai Quattro Canti · Giorgio: "Hanno un buon odore"']];
const MEGAPHONE = ['Signor Giorgio, si arrenda!', 'Sputi quella macchina!', 'Si allontani dalla Cattedrale!', 'È circondato! ...più o meno.', 'Non mangi gli agenti!', 'Mani in alto! Anche quella col panino!'];
function authLevel(s) { return s >= 21 ? 3 : s >= 15 ? 2 : s >= 9.5 ? 1 : 0; }
function ringSpot(gx, gy, R, a) {
  const ex = gx + Math.cos(a) * R, ey = gy + Math.sin(a) * R;
  const f = G.rayWalls(gx, gy, 1, ex, ey, 1);
  const k = f < 1 ? Math.max(0.35, f - 0.08) : 1;
  return [gx + Math.cos(a) * R * k, gy + Math.sin(a) * R * k];
}
function authorities(dt, ev) {
  const gs = S.gs; if (!gs) return;
  const lvl = authLevel(ev.s);
  // the units arrive one per frame, so a new level doesn't build ten people and a helicopter in a single frame
  if (S.authQ && S.authQ.length) { S.authQ.shift()(); S.authAt = null; }
  if (lvl > S.lvl) {
    for (let l = S.lvl + 1; l <= lvl; l++) addLevel(l);
    S.lvl = lvl;
    const n = LVL_NEWS[lvl]; if (n && G.showTG) G.showTG(n[0], n[1], 7);
    S.authAt = null; // place everything again
  }
  const A = S.auth; if (!A) return;
  // keep the cordon around him as he moves
  if (!S.authAt || hyp(gs.x - S.authAt[0], gs.y - S.authAt[1]) > 45) {
    S.authAt = [gs.x, gs.y];
    const R = 16 + gs.s * 1.1;
    A.cars.forEach((c, i) => { const [x, y] = ringSpot(gs.x, gs.y, R, (i / A.cars.length) * Math.PI * 2 + 0.4); c.position.set(x, 0.09, -y); c.rotation.y = Math.atan2(gs.y - y, gs.x - x); c.visible = true; c.userData.at = [x, y]; });
    A.cops.forEach((m, i) => { const c = A.cars[i % A.cars.length].userData.at, a = Math.atan2(gs.y - c[1], gs.x - c[0]); const x = c[0] + Math.cos(a) * 2.6 + Math.cos(a + 1.57) * (i % 2 ? 1.2 : -1.2), y = c[1] + Math.sin(a) * 2.6 + Math.sin(a + 1.57) * (i % 2 ? 1.2 : -1.2); m.position.set(x, 0, -y); m.userData.at = [x, y]; });
    A.army.forEach((m, i) => { const [x, y] = ringSpot(gs.x, gs.y, R + 10, (i / Math.max(1, A.army.length)) * Math.PI * 2 + 1.3); m.position.set(x, 0.09, -y); m.rotation.y = Math.atan2(gs.y - y, gs.x - x); m.userData.at = [x, y]; });
  }
  const t = S.now;
  for (const c of A.cars) { const L = c.userData.lamps; if (L) { const on = Math.floor(t * 6) % 2; L[0].emissiveIntensity = on ? 3 : 0; L[1].emissiveIntensity = on ? 0 : 3; } }
  A.cops.forEach((m, i) => { const at = m.userData.at; if (!at) return; m.rotation.y = faceTo(at[0], at[1], gs.x, gs.y); G.posePerson(m, ev.plan ? 'cheer' : 'point', t + i, i); });
  A.megaT = (A.megaT || 3) - dt;
  if (A.megaT <= 0 && A.cops.length) { A.megaT = 5 + Math.random() * 4; if (hyp(G.player.x - gs.x, G.player.y - gs.y) < 160) G.say(G.pick(A.cops), ev.plan ? G.pick(['Verdura! Tirategli la verdura!', 'Broccoli per tutti!', 'Forza Palermo, mira alla pancia!']) : G.pick(MEGAPHONE), 1800); }
  // the helicopter circles
  if (A.heli) { const a = t * 0.35, R = 30 + gs.s, h = gs.s * 2.3 + 16; A.heli.position.set(gs.x + Math.cos(a) * R, h, -(gs.y + Math.sin(a) * R)); A.heli.rotation.set(0.08, -a + Math.PI, 0.12); A.heli.userData.rotor.rotation.y += dt * 30; A.heli.userData.tail.rotation.x += dt * 40; }
  // the tank fires, and it does nothing at all
  for (const m of A.army) {
    if (!m.userData.tank) continue;
    const at = m.userData.at; if (!at) continue;
    m.userData.turret.rotation.y = Math.atan2(gs.y - at[1], gs.x - at[0]) - m.rotation.y;
    m.userData.fireT = (m.userData.fireT || 2) - dt;
    if (m.userData.fireT <= 0) {
      m.userData.fireT = 3 + Math.random() * 2;
      if (hyp(G.player.x - at[0], G.player.y - at[1]) < 200) { G.sfx.thud(); throwVeg(at[0], at[1], 2.6, gs.x, gs.y, gs.s * 1.2, '#4a4a46', 0.5, 0.5); if (Math.random() < 0.5) setTimeout(() => G.say(S.anchor, G.pick(['Non mi fa niente!', 'Sa di ferro. Bleah.', 'Hihihi, solletico!']), 1500), 600); }
    }
  }
}
function addLevel(l) {
  const A = S.auth || (S.auth = { cars: [], cops: [], army: [], heli: null });
  const Q = S.authQ || (S.authQ = []);
  if (l === 1 || l === 2) {
    const nCars = l === 1 ? 4 : 3, nCops = l === 1 ? 4 : 2;
    for (let i = 0; i < nCars; i++) Q.push(() => { const c = G.makePoliceCar(); c.visible = true; A.cars.push(c); });
    for (let i = 0; i < nCops; i++) Q.push(() => { const m = G.makePerson(G.policeLook(A.cops.length % 8)); if (G.noLod) G.noLod(m); G.scene.add(m); A.cops.push(m); });
  }
  if (l === 2) Q.push(() => { if (!A.heli) A.heli = makeHeli(); });
  if (l === 3) { for (let i = 0; i < 2; i++) Q.push(() => { const v = G.makeVehicleMesh('van', '#4b5a35'); G.scene.add(v); A.army.push(v); }); Q.push(() => A.army.push(makeTank())); }
}
function clearAuthorities() {
  const A = S.auth; if (A) {
    for (const c of A.cars) G.scene.remove(c);
    for (const m of A.cops) { G.scene.remove(m); if (G.disposeChar) G.disposeChar(m); }
    for (const m of A.army) G.scene.remove(m);
    if (A.heli) G.scene.remove(A.heli);
  }
  S.auth = null; S.authAt = null; S.authQ = [];
  for (const v of S.vans) G.scene.remove(v); S.vans.length = 0; S.vanAt = null;
  if (S.com) talkClose(true);
}
function makeHeli() {
  const g = new T.Group(), white = M('#f4f1ea', { roughness: 0.5 }), blue = M('#1c2440', { roughness: 0.5 }), glass = M('#2a3440', { roughness: 0.2, metalness: 0.3 }), dark = M('#2b2d31');
  const body = new T.Mesh(new T.CapsuleGeometry(1.1, 2.4, 8, 20), white); body.rotation.z = Math.PI / 2; g.add(body);
  const band = new T.Mesh(new T.CylinderGeometry(1.13, 1.13, 0.5, 24, 1, true), blue); band.rotation.z = Math.PI / 2; band.position.x = -0.4; g.add(band);
  const nose = new T.Mesh(new T.SphereGeometry(0.95, 20, 14), glass); nose.position.set(1.5, 0.15, 0); nose.scale.set(1, 0.85, 0.95); g.add(nose);
  const boom = new T.Mesh(new T.CylinderGeometry(0.22, 0.4, 4.2, 14), white); boom.rotation.z = Math.PI / 2; boom.position.set(-3.6, 0.4, 0); g.add(boom);
  const fin = new T.Mesh(new T.BoxGeometry(0.8, 1.1, 0.1), blue); fin.position.set(-5.6, 0.9, 0); g.add(fin);
  const tail = new T.Group(); tail.position.set(-5.6, 0.9, 0.15); g.add(tail);
  for (const r of [0, Math.PI / 2]) { const b = new T.Mesh(new T.BoxGeometry(0.08, 1.4, 0.12), dark); b.rotation.x = r; tail.add(b); }
  const rotor = new T.Group(); rotor.position.set(0, 1.45, 0); g.add(rotor);
  for (const r of [0, Math.PI / 2]) { const b = new T.Mesh(new T.BoxGeometry(9, 0.06, 0.3), dark); b.rotation.y = r; rotor.add(b); }
  const hub = new T.Mesh(new T.CylinderGeometry(0.25, 0.3, 0.5, 16), dark); hub.position.y = 1.2; g.add(hub);
  for (const z of [-0.8, 0.8]) { const sk = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 3.2, 10), dark); sk.rotation.z = Math.PI / 2; sk.position.set(0.2, -1.35, z); g.add(sk); }
  g.userData = { rotor, tail }; g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.scene.add(g); return g;
}
function makeTank() {
  const g = new T.Group(), ol = M('#4b5a35'), dk = M('#2b2d24');
  const hull = new T.Mesh(new T.BoxGeometry(6.2, 1.2, 3.2), ol); hull.position.y = 1.0; g.add(hull);
  for (const z of [-1.55, 1.55]) { const tr = new T.Mesh(new T.BoxGeometry(6.6, 1.0, 0.7), dk); tr.position.set(0, 0.55, z); g.add(tr); for (let i = 0; i < 6; i++) { const w = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.72, 18), dk); w.rotation.x = Math.PI / 2; w.position.set(-2.6 + i * 1.04, 0.5, z); g.add(w); } }
  const turret = new T.Group(); turret.position.y = 1.9; g.add(turret);
  const tb = new T.Mesh(new T.CylinderGeometry(1.3, 1.5, 0.9, 24), ol); turret.add(tb);
  const barrel = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 4.2, 14), ol); barrel.rotation.z = Math.PI / 2 - 0.25; barrel.position.set(2.3, 0.5, 0); turret.add(barrel);
  g.userData = { tank: true, turret }; g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.scene.add(g); return g;
}

// ------------------------------------------------------------------ the police look for witnesses of the restaurant
const COM_LOOK = { name: 'Commissario Ferrara', hair: 'receding', hairColor: '#8a847c', facial: 'mustache', facialColor: '#8a847c', build: 'broad', glasses: 'square', skin: '#e2ad84' };
const IDEAS = [
  { k: 'shoot', t: 'Sparategli addosso!', a: 'Ci abbiamo provato. Si è mangiato i proiettili. E due volanti.' },
  { k: 'mum', t: 'Chiamate sua madre.', a: 'La signora è a Mondello e non risponde al telefono.' },
  { k: 'cake', t: 'Offritegli un dolce, così si calma.', a: 'Così abbiamo già perso tre pasticcerie e una gelateria.' },
  { k: 'veg', t: 'Tiriamogli cibo sano: verdura! A lui fa schifo.', a: 'Verdura?! ...Ma certo! Al ristorante non ha toccato neanche una foglia d\'insalata! Distribuiamola a tutti!' },
];
function witness(dt, ev) {
  const P = G.player;
  if (!ev.wit || ev.plan || S.asked || inside() || P.ko || P.cuffed) { if (S.com && (ev.plan || S.asked) && !S.talkOpen) comLeave(); return; }
  S.comWait = (S.comWait || 0) - dt;
  if (!S.com && S.comWait <= 0) {
    // he walks up from somewhere near you
    const a = Math.atan2(P.y - (S.gs ? S.gs.y : P.y + 1), P.x - (S.gs ? S.gs.x : P.x)) + (Math.random() - 0.5);
    const x = P.x + Math.cos(a) * 9, y = P.y + Math.sin(a) * 9;
    const m = G.makePerson(G.fullLook({ v: 2, kind: 'police', top: 'jacket', c1: '#1c2440', c2: '#9fc3d6', back: 'POLIZIA', bottom: 'trousers', bottomColor: '#1c2440', shoes: 'boots', shoeColor: '#111111', ...COM_LOOK })); if (G.noLod) G.noLod(m); m.position.set(x, 0, -y); G.scene.add(m);
    S.com = { m, x, y, ph: 0, leave: 0, ideas: IDEAS.slice() };
    G.say(m, S.wasInside ? 'Lei! Lei era al Tutto Compreso!' : 'Lei! Lei ha visto tutto!', 2200);
    if (G.showTG) G.showTG('LA POLIZIA CERCA TESTIMONI', 'Chi era al Tutto Compreso di Via Maqueda è pregato di farsi avanti', 6);
  }
  const c = S.com; if (!c || c.leave) return;
  const dx = P.x - c.x, dy = P.y - c.y, d = hyp(dx, dy);
  if (!S.talkOpen) {
    if (d > 2.0) { const v = Math.min(d - 1.8, 3.6 * dt); c.x += dx / d * v; c.y += dy / d * v; c.ph += v * 3; G.animatePerson(c.m, c.ph, 0.5, 0); }
    else talkOpen();
    if (d > 60) { comLeave(); S.comWait = 8; }
  } else {
    G.posePerson(c.m, 'talk', S.now, 1);
    if (d > 7) { talkClose(); S.comWait = 15; }
  }
  c.m.position.set(c.x, 0, -c.y); c.m.rotation.y = faceTo(c.x, c.y, P.x, P.y);
}
function comLeave() { const c = S.com; if (!c) return; if (S.talkOpen) talkClose(true); c.leave = 1; setTimeout(() => { G.scene.remove(c.m); }, 2500); G.say(c.m, S.suggested ? 'Grazie! Squadre, verdura per tutti!' : 'Abbiamo un piano!', 1800); S.com = null; }
function talkPanel() {
  if (S.talkEl) return S.talkEl;
  const css = document.createElement('style');
  css.textContent = `#gioTalk { left: 50%; bottom: calc(62px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); pointer-events: auto; z-index: 9; width: min(640px, calc(100vw - 32px)); background: #fbf8f2; color: #141116; border-radius: 10px; border: 3px solid #1c2440; box-shadow: 0 8px 24px rgba(0,0,0,.35); padding: 10px 12px; display: grid; gap: 8px; }
#gioTalk .who { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; } #gioTalk .who small { font: 800 10px/1 var(--f-ui, system-ui); letter-spacing: .14em; text-transform: uppercase; color: #1c2440; } #gioTalk .who b { font: 400 22px/1 var(--f-display, Georgia, serif); }
#gioTalk p { margin: 0; font: 600 15px/1.35 var(--f-ui, system-ui); }
#gioTalk .opts { display: flex; flex-wrap: wrap; gap: 6px; } #gioTalk button { font: 700 13px/1.15 var(--f-ui, system-ui); background: #fff; color: #141116; border: 2px solid #141116; border-radius: 999px; padding: 7px 11px 7px 7px; display: flex; gap: 6px; align-items: center; cursor: pointer; text-align: left; }
#gioTalk button kbd { background: #141116; color: #fbf8f2; } #gioTalk button:hover, #gioTalk button:focus-visible { background: #f59ac4; outline: none; }`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'gioTalk'; el.className = 'hud'; el.hidden = true;
  el.innerHTML = '<div class="who"><small>Polizia di Stato</small><b>Commissario Ferrara</b></div><p></p><div class="opts"></div>';
  document.body.appendChild(el); S.talkEl = el;
  addEventListener('keydown', (e) => { if (!S.talkOpen) return; const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code]; if (n == null) return; const b = el.querySelectorAll('.opts button')[n]; if (b) { e.preventDefault(); b.click(); } });
  return el;
}
function talkOpen() {
  const el = talkPanel(), c = S.com; S.talkOpen = true;
  el.querySelector('p').textContent = S.wasInside ? 'Lei era al Tutto Compreso quando è cominciato. Lei l\'ha visto mangiare. Ci dica: come lo fermiamo?' : 'Lei era qui quando è cominciato. Nessuno sa cosa fare con questo... signore. Lei che dice?';
  renderIdeas();
  el.hidden = false;
  const b = el.querySelector('.opts button'); if (b && G.PAD && G.PAD.active) b.focus();
}
function renderIdeas() {
  const el = S.talkEl, c = S.com, box = el.querySelector('.opts'); box.innerHTML = '';
  c.ideas.forEach((idea, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<kbd>${i + 1}</kbd><span></span>`; b.querySelector('span').textContent = idea.t;
    b.addEventListener('click', () => answer(idea)); box.appendChild(b);
  });
}
function answer(idea) {
  const c = S.com, el = S.talkEl; if (!c) return;
  G.say(G.player.mesh, idea.t, 1800);
  el.querySelector('p').textContent = idea.a;
  if (idea.k === 'veg') {
    S.suggested = true; S.asked = true; el.querySelector('.opts').innerHTML = '';
    G.sfx.ding && G.sfx.ding();
    setTimeout(() => { talkClose(); comLeave(); }, 3200);
  } else { c.ideas = c.ideas.filter((q) => q !== idea); renderIdeas(); G.sfx.pick(); }
}
function talkClose(quiet) { S.talkOpen = false; if (S.talkEl) S.talkEl.hidden = true; }

// ------------------------------------------------------------------ the plan: vegetables for everyone
function plan(dt, ev) {
  if (!ev.plan) return;
  const gs = S.gs; if (!gs) return;
  if (S.planSeen !== ev.e) {
    S.planSeen = ev.e;
    alertBig('VERDURA PER TUTTI!', 'the police are handing out vegetables · throw them at Giorgio with F', 4200);
    if (G.showTG) G.showTG('LA POLIZIA DISTRIBUISCE VERDURA', 'Broccoli, zucchine e finocchi contro Giorgio · i palermitani rispondono all\'appello', 8);
    G.giveWeapon('verdura', 12, true);
    if (S.com) comLeave();
  }
  // police vans with crates of vegetables around him
  if (!S.vans.length) for (let i = 0; i < 3; i++) S.vans.push(makeVan());
  if (!S.vanAt || hyp(gs.x - S.vanAt[0], gs.y - S.vanAt[1]) > 60) {
    S.vanAt = [gs.x, gs.y];
    const R = 28 + gs.s * 0.8, P = G.player, base = Math.atan2(P.y - gs.y, P.x - gs.x);
    S.vans.forEach((v, i) => { const [x, y] = ringSpot(gs.x, gs.y, R, base + (i - 1) * 1.1); v.position.set(x, 0.09, -y); v.rotation.y = Math.atan2(gs.y - y, gs.x - x) + Math.PI / 2; v.userData.at = [x, y]; });
  }
  // the neighbourhood throws: a stream of vegetables from all around
  S.civT = (S.civT || 0) - dt;
  if (S.civT <= 0 && hyp(G.player.x - gs.x, G.player.y - gs.y) < 220) {
    S.civT = 0.22;
    let from = null;
    const near = G.peds.filter((p) => p.mesh.visible && p.state !== 'fly' && hyp(p.x - gs.x, p.y - gs.y) < 50);
    if (near.length && Math.random() < 0.6) { const p = G.pick(near); from = [p.x, p.y]; G.posePerson(p.mesh, 'cheer', S.now, 1); }
    else { const a = Math.random() * Math.PI * 2, R = 14 + gs.s * 0.8 + Math.random() * 18; from = [gs.x + Math.cos(a) * R, gs.y + Math.sin(a) * R]; }
    throwVeg(from[0], from[1], 1.6, gs.x, gs.y, gs.s * (0.9 + Math.random() * 0.9), G.pick(VEG_COLS), 1, 0.9 + Math.random() * 0.5);
  }
}
const VEG_COLS = ['#3e8a57', '#5aa34a', '#7ab648', '#2f6b3c', '#e8a33a', '#c4372e'];
function makeVan() {
  const g = new T.Group(), v = G.makeVehicleMesh('van', '#1c2440'); g.add(v);
  const crateM = M('#8a6a45');
  for (let i = 0; i < 4; i++) {
    const cr = new T.Mesh(new T.BoxGeometry(0.6, 0.36, 0.45), crateM); cr.position.set(-0.6 + (i % 2) * 0.66, 0.2 + Math.floor(i / 2) * 0.38, 1.6); g.add(cr);
    const veg = new T.Mesh(G.HDK ? G.HDK.lump(0.25, 1, 0.6, i) : new T.SphereGeometry(0.25, 10, 8), M(VEG_COLS[i % 3])); veg.scale.set(1, 0.6, 0.8); veg.position.set(cr.position.x, cr.position.y + 0.24, 1.6); g.add(veg);
  }
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = '#3e8a57'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#fff'; c.font = '800 54px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('VERDURA GRATIS', 256, 52); c.font = '700 26px system-ui, sans-serif'; c.fillText('POLIZIA DI STATO · PRENDI E LANCIA', 256, 100);
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
  const sg = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshBasicMaterial({ map: tex, toneMapped: false, side: T.DoubleSide })); sg.position.set(0, 2.9, 0); sg.rotation.y = Math.PI / 2; g.add(sg);
  G.scene.add(g); return g;
}
function nearVan() { const P = G.player; for (const v of S.vans) { const at = v.userData.at; if (at && hyp(P.x - at[0], P.y - at[1]) < 5) return v; } return null; }
// a thrown vegetable (or a tank shell), flying in an arc to Giorgio
function throwVeg(x0, y0, z0, x1, y1, z1, col, size, dur) {
  if (S.vegs.length > 80) return;
  const m = new T.Mesh(S.vegG || (S.vegG = G.HDK ? G.HDK.lump(0.3, 1, 0.6, 7) : new T.SphereGeometry(0.3, 10, 8)), S.vegM && S.vegM[col] || ((S.vegM || (S.vegM = {}))[col] = M(col)));
  m.scale.setScalar(size); m.position.set(x0, z0, -y0); G.scene.add(m);
  S.vegs.push({ m, x0, y0, z0, x1: x1 + (Math.random() - 0.5) * 2, y1: y1 + (Math.random() - 0.5) * 2, z1, t: 0, dur });
}
function updateVegs(dt) {
  for (let i = S.vegs.length - 1; i >= 0; i--) {
    const v = S.vegs[i]; v.t += dt; const k = Math.min(1, v.t / v.dur);
    v.m.position.set(v.x0 + (v.x1 - v.x0) * k, v.z0 + (v.z1 - v.z0) * k + Math.sin(k * Math.PI) * (4 + v.dur * 4), -(v.y0 + (v.y1 - v.y0) * k));
    v.m.rotation.x += dt * 8; v.m.rotation.y += dt * 5;
    if (k >= 1) { G.scene.remove(v.m); S.vegs.splice(i, 1); if (Math.random() < 0.05 && S.gs) { S.yuckT = 0.5; G.say(S.anchor, G.pick(LINES_YUCK), 1200); } }
  }
}
