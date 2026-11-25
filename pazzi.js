// pazzi.js — Uomo di Palermo: every so often, somewhere near you, someone loses it completely.
// A man dancing on the roof of a parked car crowning himself king of Palermo, a man at war with the pigeons,
// a human spinning top with a traffic cone on his head, a fistfight with a bin, a prophet with a megaphone
// preaching that it's "arancino", a man sprinting through the centre in his pants with a frozen swordfish.
// Everyone around them stops, stares, films it and has something to say about it.
let G = null, T = null;
const S = { list: [], extras: [], nextT: 32, now: 0, roadGrid: null, seenBits: new Set() };
const MAX = 2;
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a), pick = (l) => l[Math.floor(Math.random() * l.length)];

// what each of them shouts, and the headline it makes
const BITS = {
  roof: { lines: ['SUGNU U RE DI PALERMU!', 'TALIATIMI! TALIATIMI TUTTI!', 'STA MACCHINA È A MIA... FORSI!', 'BALLATI CU MIA, VIGLIACCHI!'], head: 'balla sul tettuccio di un\'auto parcheggiata e si proclama re di Palermo' },
  pigeons: { lines: ['VUI! VUI M\'ARRUBBASTIVU U PANI!', 'TRU TRU! TRU TRU TRU!', 'SUGNU U RE DI PICCIUNA!', 'TURNATI CCÀ, CODARDI!'], head: 'sfida a duello i piccioni della piazza: «mi hanno rubato il pane»' },
  cone: { lines: ['SUGNU NA TROTTOLA!', 'U MUNNU GIRA... E IU CCHIÙ ASSAI!', 'NUN MI FERMA NUDDU!', 'WIIIIIIIIIII!'], head: 'gira su se stesso con un cono stradale in testa da venti minuti' },
  bin: { lines: ['TU M\'HA TALIATU STORTU!', 'CHI TALÌI?! CHI TALÌI?!', 'VENI CCÀ SE HAI CURAGGIU!', 'U SAI CU SUGNU IU?!'], head: 'fa a botte con un cassonetto: «mi ha guardato storto»' },
  prophet: { lines: ['È ARANCINO! ARANCINOOOO!', 'I PICCIUNA SUNNU SPIE DU GUVERNU!', 'U MUNNU FINISCI DUMANI!', 'U SULI È NA LAMPADINA!', 'PENTITEVI! A PASTA CU I SARDI È FINUTA!'], head: 'annuncia col megafono che si dice «arancino». Si cerca un esorcista' },
  runner: { lines: ['AAAAAAAAAAAAAH!', 'UN MI PIGGHIATI VIVU!', 'U PESCI SPADA È MIO!', 'SPOSTATIVI! SPOSTATIVIII!'], head: 'corre in mutande per il centro storico brandendo un pesce spada surgelato' },
};
const WATCH = ['Ma chi fa chistu?!', 'Talìa a chistu...', 'Mizzica, è pazzu!', 'Unn\'è a polizia quannu servi?', 'Fai u video, fai u video!', 'Ogni jornu a stissa cosa ccà.', 'Signuruzzu, aiutatilu.', 'Ma è u cucinu di Paolo?', 'Iddu è peju di me zia.', 'Ma pirchì sempre ccà?!', 'Chi vergogna...', 'Chiamati a so matri!'];
const WATCH_PROPHET = ['ARANCINO?! Vergogna!', 'Ma comu si permetti?!', 'Arancina! A-RAN-CI-NA!', 'Chistu è di Catania, cacciatilu!'];
const WATCH_TOURIST = ['Is this... normal?', 'Oh my god, film it!', 'Only in Palermo.', 'Should we call someone?'];
const REACT_POSES = ['shock', 'shock', 'shock', 'selfie', 'selfie', 'phone', 'facepalm', 'facepalm', 'point', 'laugh', 'shrug'];

export function init(game) {
  G = game; T = G.THREE0 || G.THREE;
  // the drivable streets, in a grid, so they don't set up in the middle of the traffic
  S.roadGrid = new Map();
  for (const r of G.roads) {
    if (r.k > 4) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], seg = [a, b, (r.hw || 3) + 0.3, (r.hw || 3) - 1.1];
      for (const q of [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]) {
        const k = Math.floor(q[0] / 25) + ',' + Math.floor(q[1] / 25); let l = S.roadGrid.get(k); if (!l) S.roadGrid.set(k, l = []); if (!l.includes(seg)) l.push(seg);
      }
    }
  }
  return true;
}
// lane = true: only the middle of the carriageway, where the cars actually go
function inTraffic(x, y, lane = false) {
  for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) {
    const l = S.roadGrid.get((Math.floor(x / 25) + ix) + ',' + (Math.floor(y / 25) + iy)); if (!l) continue;
    for (const [a, b, w0, w1] of l) {
      const w = lane ? w1 : w0;
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1);
      if (hyp(x - a[0] - dx * t, y - a[1] - dy * t) < w) return true;
    }
  }
  return false;
}
const seen = (x, y) => G.rayWalls(G.player.x, G.player.y, 1.6, x, y, 1.4) >= 1;
function okSpot(x, y) { return G.inPlay(x, y) && !(G.insideFoot && G.insideFoot(x, y, 0)) && !inTraffic(x, y) && seen(x, y); }
// a spot in view, off the road, some way ahead of you
function findSpot(r0, r1, front = 0.2) {
  const P = G.player, fx = Math.cos(G.cam.yaw), fy = Math.sin(G.cam.yaw), cand = [];
  for (const n of G.WG.nodes) {
    const dx = n[0] - P.x, dy = n[1] - P.y; if (Math.abs(dx) > r1 || Math.abs(dy) > r1) continue;
    const d = hyp(dx, dy); if (d >= r0 && d <= r1 && (dx * fx + dy * fy) / d >= front) cand.push(n);
  }
  for (let k = 0; k < 40 && cand.length; k++) {
    const n = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
    // a little to one side of the path, onto the paving
    for (let j = 0; j < 5; j++) { const x = n[0] + rnd(-2.5, 2.5), y = n[1] + rnd(-2.5, 2.5); if (okSpot(x, y)) return [x, y]; }
  }
  return front > -1 ? findSpot(r0, r1, -1) : null;    // nothing ahead: anywhere around you
}

// ------------------------------------------------------------------ people and props
function mat(c, o) { return new T.MeshStandardMaterial({ color: c, roughness: 0.7, ...(o || {}) }); }
function person(look, x, y) {
  let base = G.randomLook(); for (let k = 0; k < 8 && base.kind !== 'local'; k++) base = G.randomLook();
  const L = G.fullLook({ ...base, ...look, v: 2 });
  const mesh = G.makePerson(L); G.scene.add(mesh);
  const p = { mesh, look: L, speed: 1.2, phase: 0, x, y, a: 0, state: 'walk', t: 0, seed: Math.random() * 6, temp: true, crazy: true };
  G.placePed(p, { x, y }); p.x = x; p.y = y; p.state = 'pz';
  G.peds.push(p); return p;
}
const SKIN = ['#e6b08a', '#d99a78', '#c88a64', '#efc7a8', '#b97a55'];
function lookFor(bit) {
  const skin = pick(SKIN), bare = { top: 'tank', c1: skin, c2: skin, pattern: 'solid' };
  switch (bit) {
    case 'roof': return { ...bare, skin, bottom: 'shorts', bottomColor: '#d7261e', shoes: 'sandals', hair: pick(['mullet', 'spiky', 'curly']), glasses: 'shades', necklace: 'chain', build: pick(['belly', 'broad']) };
    case 'pigeons': return { skin, top: 'track', c1: '#1d4f9c', c2: '#ffffff', bottom: 'track', bottomColor: '#1d4f9c', hair: 'afro', hairColor: '#3a2618', facial: 'beard', build: 'slim' };
    case 'cone': return { ...bare, skin, bottom: 'track', bottomColor: '#2b2b2e', hair: 'buzz', facial: 'stubble', build: 'normal', shoes: 'sneakers' };
    case 'bin': return { skin, top: 'tee', c1: '#e9e4da', pattern: 'solid', bottom: 'jeans', bottomColor: '#3c4f6e', hair: 'receding', facial: 'mustache', build: 'belly', hat: 'coppola' };
    case 'prophet': return { skin, top: 'apron', c1: '#f0e6d2', c2: '#f0e6d2', bottom: 'longskirt', bottomColor: '#f0e6d2', hair: 'long', hairColor: '#cfcfcf', facial: 'longbeard', facialColor: '#cfcfcf', shoes: 'sandals', hat: 'none', build: 'slim' };
    case 'runner': return { ...bare, skin, bottom: 'shorts', bottomColor: '#ffffff', shoes: 'sneakers', shoeColor: '#ffffff', hair: pick(['bald', 'buzz', 'mohawk']), build: pick(['belly', 'slim']), hat: 'headband' };
  }
  return {};
}
function cone() {
  const g = new T.Group();
  const c = new T.Mesh(new T.ConeGeometry(0.15, 0.44, 14), mat('#ff6a13')); c.position.y = 0.22; g.add(c);
  const band = new T.Mesh(new T.CylinderGeometry(0.105, 0.12, 0.08, 14), mat('#f4f4f2')); band.position.y = 0.2; g.add(band);
  const base = new T.Mesh(new T.BoxGeometry(0.34, 0.03, 0.34), mat('#ff6a13')); g.add(base);
  return g;
}
function bin() {
  const g = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(1.25, 1.15, 0.85), mat('#2f6b3a')); body.position.y = 0.66; g.add(body);
  const lid = new T.Mesh(new T.BoxGeometry(1.3, 0.1, 0.9), mat('#244f2c')); lid.position.y = 1.28; g.add(lid);
  for (const sx of [-0.45, 0.45]) { const w = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.05, 10), mat('#1c1c1e')); w.rotation.x = Math.PI / 2; w.position.set(sx, 0.08, 0.42); g.add(w); }
  const sign = new T.Mesh(new T.PlaneGeometry(0.7, 0.18), new T.MeshBasicMaterial({ color: '#f2c94c' })); sign.position.set(0, 0.95, 0.43); g.add(sign);
  for (const m of g.children) m.castShadow = true;
  return g;
}
function crate() { const m = new T.Mesh(new T.BoxGeometry(0.7, 0.45, 0.55), mat('#a6763f')); m.position.y = 0.225; m.castShadow = true; return m; }
function megaphone() {
  const g = new T.Group();
  const horn = new T.Mesh(new T.CylinderGeometry(0.12, 0.04, 0.3, 12, 1, true), new T.MeshStandardMaterial({ color: '#f2f2f0', side: T.DoubleSide, roughness: 0.5 }));
  horn.rotation.x = Math.PI / 2; horn.position.z = 0.2; g.add(horn);
  const grip = new T.Mesh(new T.BoxGeometry(0.04, 0.12, 0.05), mat('#d7261e')); grip.position.set(0, -0.06, 0.08); g.add(grip);
  return g;
}
function swordfish() {
  const g = new T.Group(), silver = mat('#8fa3b5', { metalness: 0.5, roughness: 0.35 });
  const body = new T.Mesh(new T.SphereGeometry(0.16, 12, 8), silver); body.scale.set(1, 1, 5.2); g.add(body);
  const bill = new T.Mesh(new T.ConeGeometry(0.035, 0.85, 8), mat('#5e6f80')); bill.rotation.x = Math.PI / 2; bill.position.z = 1.2; g.add(bill);
  const tail = new T.Mesh(new T.ConeGeometry(0.2, 0.3, 4), silver); tail.rotation.x = -Math.PI / 2; tail.scale.set(0.2, 1, 1.6); tail.position.z = -0.95; g.add(tail);
  const fin = new T.Mesh(new T.ConeGeometry(0.12, 0.35, 4), silver); fin.scale.set(0.15, 1, 1); fin.position.set(0, 0.22, 0.15); g.add(fin);
  return g;
}
function pigeonFlock(n) {
  const out = [], grey = mat('#7d8288'), dark = mat('#4b5056'), beak = mat('#c9a66b');
  for (let i = 0; i < n; i++) {
    const g = new T.Group();
    const b = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), grey); b.scale.set(0.85, 0.8, 1.35); b.position.y = 0.13; g.add(b);
    const h = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), dark); h.position.set(0, 0.24, 0.12); g.add(h);
    const k = new T.Mesh(new T.ConeGeometry(0.015, 0.05, 5), beak); k.rotation.x = Math.PI / 2; k.position.set(0, 0.23, 0.18); g.add(k);
    const wl = new T.Mesh(new T.BoxGeometry(0.22, 0.015, 0.14), dark), wr = wl.clone(); wl.position.set(-0.1, 0.17, 0); wr.position.set(0.1, 0.17, 0); g.add(wl, wr);
    G.scene.add(g);
    out.push({ g, wl, wr, x: 0, y: 0, z: 0, a: Math.random() * 6.28, fly: 0, hop: Math.random() * 2 });
  }
  return out;
}

// a point on a walking road, s metres along it, off to one side
function roadPoint(r, s, off) {
  let j = 0; while (j < r.pts.length - 2 && r.cum[j + 1] < s) j++;
  const a = r.pts[j], b = r.pts[j + 1], L = (r.cum[j + 1] - r.cum[j]) || 1, t = clamp((s - r.cum[j]) / L, 0, 1), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return [a[0] + (b[0] - a[0]) * t - Math.sin(ang) * off, a[1] + (b[1] - a[1]) * t + Math.cos(ang) * off];
}
// a few people who were already there when it started, keeping their distance and filming
function audience(x, y, n) {
  const out = [], near = [];
  // the pavements round about first (narrow streets don't leave much else), then anywhere in a ring
  for (const nd of G.WG.nodes) { if (Math.abs(nd[0] - x) > 10 || Math.abs(nd[1] - y) > 10) continue; const d = hyp(nd[0] - x, nd[1] - y); if (d > 3.8 && d < 10) near.push(nd); }
  for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
    let px, py;
    if (tries < 20 && near.length) { const nd = near[(Math.random() * near.length) | 0]; px = nd[0] + rnd(-1, 1); py = nd[1] + rnd(-1, 1); if (hyp(px - x, py - y) < 3.6) continue; }
    else { const a = Math.random() * 6.28, r = rnd(4.2, 8); px = x + Math.cos(a) * r; py = y + Math.sin(a) * r; }
    if (!G.inPlay(px, py) || (G.insideFoot && G.insideFoot(px, py, 0)) || inTraffic(px, py, true) || G.rayWalls(px, py, 1.4, x, y, 1.4) < 1) continue;
    if (G.parked.some((q) => q.alive && Math.abs(q.x - px) < 3 && Math.abs(q.y - py) < 3 && hyp(q.x - px, q.y - py) < 2.2) || out.some((q) => hyp(q.x - px, q.y - py) < 0.9)) continue;
    let base = G.randomLook(); for (let k = 0; k < 6 && base.kind === 'vip'; k++) base = G.randomLook();
    const L = G.fullLook({ ...base, v: 2 }), mesh = G.makePerson(L); G.scene.add(mesh);
    const q = { mesh, look: { ...L, lines: [] }, speed: 1.1 + Math.random() * 0.3, phase: 0, x: px, y: py, a: Math.atan2(y - py, x - px), t: 0, seed: Math.random() * 6, temp: true, pzExtra: true };
    G.placePed(q, { x: px, y: py });
    // their own pavement, for when they've seen enough and walk on
    let best = null;
    if (G.walkNear) for (const r of G.walkNear(px, py, 30)) { const pr = G.projectOnRoad(r, px, py); if (!best || pr.d < best.d) best = { r, ...pr }; }
    if (best && best.d < 12) { q.road = best.r; q.s = best.s; }
    // standing there, staring, phone out
    q.x = px; q.y = py; q.state = 'hang'; q.home = [px, py]; q.faceHome = [x, y]; q.vipPose = pick(['phone', 'selfie', 'hips', 'idle', 'phone', 'shock']); q.greeted = true; q.chatCool = 1e9;
    G.peds.push(q); out.push(q); i++;
  }
  return out;
}
// ------------------------------------------------------------------ starting one
function start() {
  const P = G.player;
  const order = ['roof', 'pigeons', 'cone', 'bin', 'prophet', 'runner'].sort(() => Math.random() - 0.5)
    .sort((a, b) => (S.seenBits.has(a) ? 1 : 0) - (S.seenBits.has(b) ? 1 : 0));   // ones you haven't seen yet first
  for (const bit of order) {
    if (S.list.some((c) => c.bit === bit)) continue;
    let c = null;
    if (bit === 'roof') c = startRoof();
    else if (bit === 'runner') c = startRunner();
    else { const sp = findSpot(20, 52); if (sp) c = make(bit, sp[0], sp[1]); }
    if (c) { S.list.push(c); return c; }
  }
  return null;
}
function make(bit, x, y, extra) {
  const p = person(lookFor(bit), x, y);
  p.a = Math.atan2(G.player.y - y, G.player.x - x);
  const c = { bit, p, x, y, t: 0, life: rnd(55, 80), props: [], sayT: rnd(0.5, 2), crowdT: 0, watchSayT: 2.5, headline: false, ...extra };
  const u = p.mesh.userData;
  if (bit === 'cone') { const k = cone(); k.position.set(0, 0.2, 0); u.head.add(k); c.props.push(k); }
  if (bit === 'bin') { const b = bin(); const a = rnd(0, 6.28); c.bin = { g: b, x: x + Math.cos(a) * 1.1, y: y + Math.sin(a) * 1.1, a: a + Math.PI / 2, tilt: 0, vx: 0, vy: 0, down: false }; G.scene.add(b); c.props.push(b); }
  if (bit === 'prophet') { const cr = crate(); cr.position.set(x, 0.09, -y); G.scene.add(cr); c.props.push(cr); p.floorY = 0.54; const m = megaphone(); m.position.set(0, -0.72, 0.06); m.rotation.x = -Math.PI / 2; u.armR.add(m); c.props.push(m); }
  if (bit === 'pigeons') { c.flock = pigeonFlock(7); c.flock.forEach((b, i) => { const a = i / 7 * 6.28; b.x = x + Math.cos(a) * rnd(1.2, 2.6); b.y = y + Math.sin(a) * rnd(1.2, 2.6); }); c.props.push(...c.flock.map((b) => b.g)); }
  if (bit !== 'runner') c.extras = audience(x, y, 2 + Math.floor(Math.random() * 3));
  if (bit === 'runner') { const f = swordfish(); f.position.set(0, -0.75, 0.05); f.rotation.set(-Math.PI / 2, 0, 0); u.armR.add(f); c.props.push(f); }
  return c;
}
const ROOF = { hatch: 1.45, panda: 1.55, c500: 1.48, van: 2.05 };   // roof heights of the parked cars he can climb
function startRoof() {
  // a parked car in view, its roof as the stage
  const P = G.player, cars = [];
  for (const q of G.parked) {
    if (!q.alive || !ROOF[q.kind] || !q.bk) continue;
    const d = hyp(q.x - P.x, q.y - P.y);
    if (d > 14 && d < 55 && G.rayWalls(P.x, P.y, 1.6, q.x, q.y, 2.2) >= 1) cars.push(q);
  }
  if (!cars.length) return null;
  const car = pick(cars), h = ROOF[car.kind];
  return make('roof', car.x, car.y, { car, roofH: h });
}
function startRunner() {
  // a stretch of street that passes near you; he comes sprinting along it
  const P = G.player, cands = [];
  for (const r of G.roads) {
    if (r.pts.length < 2) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], L = hyp(b[0] - a[0], b[1] - a[1]);
      if (L < 30) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, d = hyp(mx - P.x, my - P.y);
      if (d < 8 || d > 40) continue;
      cands.push([a, b, r]);
    }
  }
  for (let k = 0; k < 20 && cands.length; k++) {
    const [a, b, r] = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
    const [s, e] = Math.random() < 0.5 ? [a, b] : [b, a], L = hyp(e[0] - s[0], e[1] - s[1]), ux = (e[0] - s[0]) / L, uy = (e[1] - s[1]) / L;
    const off = Math.max(0, (r.hw || 3) - 1.0);                            // along the edge, out of the traffic lane
    const x0 = s[0] - uy * off, y0 = s[1] + ux * off, x1 = e[0] - uy * off + ux * 25, y1 = e[1] + ux * off + uy * 25;
    if (!G.inPlay(x0, y0) || G.rayWalls(x0, y0, 1, x1, y1, 1) < 0.99 || (G.insideFoot && G.insideFoot(x0, y0, 0))) continue;
    return make('runner', x0, y0, { path: [[x1, y1]], life: 30 });
  }
  return null;
}

// ------------------------------------------------------------------ poses: going completely off
function wild(u, t, k = 1) {
  u.armL.rotation.x = -1.6 + 1.5 * Math.sin(t * 13) * k; u.armR.rotation.x = -1.6 + 1.5 * Math.sin(t * 11 + 1.3) * k;
  u.armL.rotation.z = -0.6 - 0.6 * Math.sin(t * 7); u.armR.rotation.z = 0.6 + 0.6 * Math.sin(t * 9);
  u.head.rotation.y = 0.55 * Math.sin(t * 17); u.head.rotation.x = -0.2 + 0.15 * Math.sin(t * 9);
  if (u.mouth) u.mouth.scale.y = 1.6 + 0.6 * Math.abs(Math.sin(t * 15));
}
function draw(c, pose, dt) {
  const p = c.p;
  p.mesh.position.set(p.x, p.floorY || 0.09, -p.y);
  p.mesh.rotation.set(0, p.a + Math.PI / 2, 0);
  if (p._run) { G.animatePerson(p.mesh, p.phase, p._run); p._run = 0; } else G.posePerson(p.mesh, pose, c.t, p.seed);
}
const shout = (c, text, ms = 1900) => { if (hyp(c.p.x - G.player.x, c.p.y - G.player.y) < 50) G.say(c.p.mesh, text, ms); };

function updateBit(c, dt) {
  const p = c.p, u = p.mesh.userData, P = G.player, dP = hyp(p.x - P.x, p.y - P.y), t = c.t;
  // shouting at the world, and at you if you come close
  if ((c.sayT -= dt) <= 0) {
    c.sayT = rnd(2.6, 4.2);
    if (dP < 3.2 && !c.yelledAtYou) { c.yelledAtYou = true; shout(c, pick(['E TU? CHI VOI?!', 'TU! TU SI CHIDDU DI L\'ARANCINA!', 'UN MI TALIARI CU CHIDDI OCCHI!', 'VATTINNI, CA È U ME POSTU!']), 1900); }
    else shout(c, pick(BITS[c.bit].lines));
  }
  switch (c.bit) {
    case 'roof': {
      // dancing on the roof of somebody's car; if the car goes, he jumps down and runs off
      if (!c.car.alive || hyp(c.car.x - c.x, c.car.y - c.y) > 0.5) { c.life = Math.min(c.life, c.t + 4); p.floorY = 0.09; }
      else { p.x = c.car.x + Math.sin(t * 1.3) * 0.25; p.y = c.car.y + Math.cos(t * 1.1) * 0.15; p.floorY = 0.09 + c.roofH; }
      p.a += dt * (Math.sin(t * 0.7) > 0 ? 1.6 : -1.2);
      draw(c, 'dance', dt);
      const b = Math.abs(Math.sin(t * 7)); p.mesh.position.y += 0.12 * b; u.body.rotation.x = 0.35 * Math.sin(t * 14);
      if (Math.sin(t * 0.9) > 0.6) { u.armL.rotation.x = -2.9; u.armR.rotation.x = -2.9; u.armL.rotation.z = -0.3 - 0.4 * b; u.armR.rotation.z = 0.3 + 0.4 * b; }
      break;
    }
    case 'pigeons': {
      // charging the pigeons, flapping like one of them
      const phase = Math.floor(t / 3.2) % 3;
      if (phase === 1) {
        const tx = c.x + Math.cos(t * 1.9) * 3, ty = c.y + Math.sin(t * 1.9) * 3, dx = tx - p.x, dy = ty - p.y, l = hyp(dx, dy) || 1;
        p.x += dx / l * Math.min(l, 4.2 * dt); p.y += dy / l * Math.min(l, 4.2 * dt); p.a = Math.atan2(dy, dx); p.phase += dt * 11; p._run = 0.9;
        draw(c, 'idle', dt);
        u.armL.rotation.z = -1.4 - 0.6 * Math.sin(t * 16); u.armR.rotation.z = 1.4 + 0.6 * Math.sin(t * 16); u.armL.rotation.x = 0; u.armR.rotation.x = 0;
        scareFlock(c, p.x, p.y);
      } else {
        draw(c, 'idle', dt);
        // squatting and bobbing his head like a pigeon
        u.body.position.y = -0.12 - 0.05 * Math.abs(Math.sin(t * 8)); u.head.rotation.x = 0.35 * Math.max(0, Math.sin(t * 8));
        u.armL.rotation.z = -0.6 - 0.3 * Math.sin(t * 10); u.armR.rotation.z = 0.6 + 0.3 * Math.sin(t * 10); u.armL.rotation.x = 0.4; u.armR.rotation.x = 0.4;
        if (u.mouth) u.mouth.scale.y = 1.4;
      }
      updateFlock(c, dt);
      break;
    }
    case 'cone': {
      // a human spinning top; every so often he's too dizzy, falls over, gets up and starts again
      const cyc = t % 9;
      if (cyc < 6.5) {
        p.a += dt * (4 + 6 * Math.min(1, cyc / 2));
        p.x = c.x + Math.cos(t * 0.8) * 0.6; p.y = c.y + Math.sin(t * 0.8) * 0.6;
        draw(c, 'idle', dt);
        u.armL.rotation.z = -1.5; u.armR.rotation.z = 1.5; u.armL.rotation.x = 0; u.armR.rotation.x = 0; u.head.rotation.z = 0.25 * Math.sin(t * 3);
        if (u.mouth) u.mouth.scale.y = 1.7;
      } else {
        draw(c, 'idle', dt);
        const fall = Math.min(1, (cyc - 6.5) * 3), up = cyc > 8.3 ? (cyc - 8.3) / 0.7 : 0;
        p.mesh.rotation.x = -Math.PI / 2 * fall * (1 - up); p.mesh.position.y = 0.09 + 0.18 * fall * (1 - up);
        if (cyc > 7.2 && !c.saidDizzy) { c.saidDizzy = true; shout(c, '...unni sugnu?', 1400); }
        if (cyc < 7) c.saidDizzy = false;
      }
      break;
    }
    case 'bin': {
      // a fistfight with a bin, which loses and eventually goes over
      const B = c.bin;
      if (!B.down) { const dx = B.x - p.x, dy = B.y - p.y, l = hyp(dx, dy) || 1; if (l > 1.05) { p.x += dx / l * Math.min(l - 1.0, 1.5 * dt); p.y += dy / l * Math.min(l - 1.0, 1.5 * dt); } p.a = Math.atan2(dy, dx); }
      const beat = t % 2.2;
      if (beat < 1.2) { draw(c, 'shove', dt); wild(u, t, 0.7); }
      else { draw(c, 'argue', dt); u.legR.rotation.x = -1.3 * Math.max(0, Math.sin((beat - 1.2) * 6)); }
      if (beat < dt * 1.5 && !B.down) { B.tilt = 0.35; B.vx += Math.cos(p.a) * 1.1; B.vy += Math.sin(p.a) * 1.1; G.sfx && G.sfx.thud && G.sfx.thud(); c.hits = (c.hits || 0) + 1; if (c.hits > 9) { B.down = true; shout(c, 'E CU VINCIU?! IU!', 1800); } }
      B.x += B.vx * dt; B.y += B.vy * dt; B.vx *= Math.pow(0.05, dt); B.vy *= Math.pow(0.05, dt);
      B.tilt = B.down ? Math.min(Math.PI / 2, B.tilt + dt * 3) : B.tilt * Math.pow(0.02, dt);
      B.g.position.set(B.x, 0.09, -B.y); B.g.rotation.set(B.tilt, B.a, 0, 'YXZ');
      if (B.down) { draw(c, 'cheer', dt); }
      break;
    }
    case 'prophet': {
      // on a crate with a megaphone, preaching heresy to the passers-by
      p.a += G.angDiff(p.a, Math.atan2(P.y - p.y, P.x - p.x) + Math.sin(t * 0.5) * 1.2) * Math.min(1, dt * 2);
      draw(c, 'mic', dt);
      u.armL.rotation.x = -2.5 + 0.3 * Math.sin(t * 3); u.armL.rotation.z = -0.3; if (u.mouth) u.mouth.scale.y = 1.4 + 0.6 * Math.abs(Math.sin(t * 12));
      break;
    }
    case 'runner': {
      // flat out down the street, swordfish over his head, then gone
      const tgt = c.path[0], dx = tgt[0] - p.x, dy = tgt[1] - p.y, l = hyp(dx, dy);
      if (l < 1) { c.life = Math.min(c.life, c.t); break; }
      const sp = 6.8;
      p.x += dx / l * sp * dt; p.y += dy / l * sp * dt; p.a = Math.atan2(dy, dx); p.phase += sp * dt * 2.6; p._run = 1.0;
      draw(c, 'idle', dt);
      u.armR.rotation.x = -3.0; u.armR.rotation.z = 0.2 + 0.2 * Math.sin(t * 14); if (u.mouth) u.mouth.scale.y = 1.9;
      // people jump out of his way
      for (const q of G.peds) if (q !== p && !q.crazy && q.state === 'walk' && hyp(q.x - p.x, q.y - p.y) < 2.4) { G.setReact(q, 'shock', 2.2, p.x, p.y); q.x += (q.x - p.x) * 0.4; q.y += (q.y - p.y) * 0.4; }
      break;
    }
  }
}
function scareFlock(c, x, y) { for (const b of c.flock) if (!b.fly && hyp(b.x - x, b.y - y) < 2.2) { b.fly = rnd(2.2, 3.4); b.vx = (b.x - x) * 2 + rnd(-1, 1); b.vy = (b.y - y) * 2 + rnd(-1, 1); } }
function updateFlock(c, dt) {
  for (const b of c.flock) {
    if (b.fly > 0) {
      b.fly -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.pow(0.4, dt); b.vy *= Math.pow(0.4, dt);
      b.z = Math.min(3, b.z + dt * 3) * (b.fly > 0.6 ? 1 : b.fly / 0.6);
      const f = Math.sin(c.t * 40) * 0.9; b.wl.rotation.z = f; b.wr.rotation.z = -f;
      // come back to strut round him again
      if (b.fly <= 0) { b.z = 0; const a = Math.random() * 6.28; b.tx = c.x + Math.cos(a) * rnd(1.5, 3); b.ty = c.y + Math.sin(a) * rnd(1.5, 3); }
    } else {
      b.hop -= dt; b.wl.rotation.z = 0; b.wr.rotation.z = 0;
      if (b.hop <= 0) { b.hop = rnd(0.4, 1.4); b.a += rnd(-1.4, 1.4); }
      const sp = 0.35; b.x += Math.cos(b.a) * sp * dt; b.y += Math.sin(b.a) * sp * dt;
      if (hyp(b.x - c.x, b.y - c.y) > 3.5) b.a = Math.atan2(c.y - b.y, c.x - b.x);
    }
    b.g.position.set(b.x, 0.09 + b.z + (b.fly > 0 ? 0 : 0.02 * Math.abs(Math.sin(c.t * 9 + b.a))), -b.y);
    b.g.rotation.y = Math.atan2(Math.cos(b.a), -Math.sin(b.a)) + (b.fly > 0 ? 0 : 0);
    if (b.fly > 0) b.g.rotation.y = Math.atan2(b.vx, -b.vy) + Math.PI;
  }
}

// ------------------------------------------------------------------ everyone around stops and stares
function crowd(c, dt) {
  if ((c.crowdT -= dt) > 0) return;
  c.crowdT = 1.0;
  const p = c.p, R = c.bit === 'runner' ? 10 : 22;
  let said = false;
  for (const q of G.peds) {
    if (q === p || q.crazy || q.vip || q.custom || (q.temp && !(c.extras && c.extras.includes(q)))) continue;
    if (!(q.state === 'walk' || q.state === 'react' || (q.state === 'hang' && q.pzExtra))) continue;
    const d = hyp(q.x - p.x, q.y - p.y);
    if (d > R) continue;
    if (q.state === 'react' && q.pzBy === c) { q.t = Math.max(q.t, 1.5); continue; }   // still staring
    const pose = G.pedKind(q) === 'tourist' ? pick(['selfie', 'selfie', 'shock', 'point']) : pick(REACT_POSES);
    if (G.setReact(q, pose, rnd(4, 7), p.x, p.y)) {
      q.pzBy = c;
      if (!said && (c.watchSayT -= 1) <= 0 && d < 12) {
        said = true; c.watchSayT = rnd(2, 4);
        const lines = G.pedKind(q) === 'tourist' ? WATCH_TOURIST : c.bit === 'prophet' && Math.random() < 0.6 ? WATCH_PROPHET : WATCH;
        if (hyp(q.x - G.player.x, q.y - G.player.y) < 40) G.say(q.mesh, pick(lines), 1900);
      }
    }
  }
}
// the ones standing right next to it edge away
function keepAway(c, dt) {
  const p = c.p, gap = c.bit === 'bin' || c.bit === 'cone' ? 3.6 : 3.0;
  for (const q of G.peds) {
    if (q.pzBy !== c || q.state !== 'react') continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy) || 1;
    if (d < gap) {
      const st = Math.min(gap - d, 1.3 * dt), nx = q.x + dx / d * st, ny = q.y + dy / d * st;
      if (!(G.insideFoot && G.insideFoot(nx, ny, 0)) && G.rayWalls(q.x, q.y, 1, nx, ny, 1) >= 1) { q.x = nx; q.y = ny; if (q.home) q.home = [nx, ny]; }
    }
  }
}

// ------------------------------------------------------------------ ending one
function finish(c) {
  const p = c.p;
  for (const o of c.props) { if (o.parent) o.parent.remove(o); o.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } }); }
  if (G.peds.includes(p)) {
    G.scene.remove(p.mesh);
    const i = G.peds.indexOf(p); if (i >= 0) G.peds.splice(i, 1);
    if (G.disposeChar) G.disposeChar(p.mesh);
  }
  for (const q of G.peds) if (q.pzBy === c) q.pzBy = null;
  if (c.extras) for (const q of c.extras) S.extras.push({ q, t: 0, walkT: rnd(1, 5) });
  S.list.splice(S.list.indexOf(c), 1);
}

export function update(dt) {
  S.now += dt;
  const P = G.player;
  const busy = (G.boss && G.boss.active && G.boss.active()) || (G.STORE && G.STORE.inside) || (G.boss && G.boss.inside && G.boss.inside()) || (G.lib && G.lib.inside && G.lib.inside());
  if (!busy && G.game.started && S.list.length < MAX && (S.nextT -= dt) <= 0) {
    S.nextT = start() ? rnd(30, 60) : 6;
  }
  // the audience of a finished show leaves once nobody's looking
  for (let i = S.extras.length - 1; i >= 0; i--) {
    const e = S.extras[i], q = e.q; e.t += dt;
    if (!G.peds.includes(q)) { S.extras.splice(i, 1); continue; }
    if (q.state === 'fly' || q.state === 'down' || q.state === 'talk') continue;
    // seen enough: back on their way
    if (e.walkT != null && e.t > e.walkT && q.state === 'hang') {
      e.walkT = null; q.vipPose = null; q.chatCool = 0; q.pose = null;
      if (q.road && q.road.cum) { q.ret = roadPoint(q.road, q.s, q.off || 0); q.state = 'return'; }
    }
    if (hyp(q.x - P.x, q.y - P.y) > 45 || (e.t > 40 && !seen(q.x, q.y))) {
      G.scene.remove(q.mesh); G.peds.splice(G.peds.indexOf(q), 1); if (G.disposeChar) G.disposeChar(q.mesh); S.extras.splice(i, 1);
    }
  }
  for (const c of S.list.slice()) {
    const p = c.p, dP = hyp(p.x - P.x, p.y - P.y);
    c.t += dt;
    // punched, swordfished, knocked over: he's not ours any more; tidy up once he's out of the way
    if (p.state !== 'pz') {
      if (!c.loose) { p.floorY = 0; for (const o of c.props) if (o.parent && o.parent !== G.scene) o.visible = c.bit === 'cone'; }
      c.loose = (c.loose || 0) + dt;
      if (p.state !== 'fly' && p.state !== 'down' && (dP > 30 || c.loose > 20)) finish(c);
      continue;
    }
    // the headline, the first time you get a proper look
    if (!c.headline && dP < 32 && seen(p.x, p.y)) {
      c.headline = true; S.seenBits.add(c.bit);
      G.toast('UOMO DI PALERMO', BITS[c.bit].head, 3400);
    }
    // he can be run over like anyone else: by you, on foot or on wheels, or by the traffic
    if (!P.fly && dP < 2.2) {
      const v = P.vespa;
      if (v && Math.abs(v.speed) > 3.5 && dP < (v.spec.hitR || 1.2) + (c.bit === 'roof' ? 0.6 : 0)) G.launchPed(p, v.x, v.y, 4 + Math.abs(v.speed) * 0.65);
      else if (!v && dP < 0.8 && P.speed > 5.5) G.launchPed(p, P.x, P.y, 5);
    }
    if (p.state === 'pz' && c.bit === 'runner') for (const q of G.traffic) if (q.speed > 4 && Math.abs(q.x - p.x) < 2 && Math.abs(q.y - p.y) < 2 && hyp(q.x - p.x, q.y - p.y) < 1.7) { G.launchPed(p, q.x, q.y, 6, false); break; }
    if (p.state !== 'pz') continue;
    updateBit(c, dt);
    crowd(c, dt); keepAway(c, dt);
    // show's over when he's done (and you're not right there) or you've walked away
    if (dP > 110 || (c.t > c.life && (dP > 25 || c.bit === 'runner' || c.t > c.life + 25))) finish(c);
  }
}
export function debugHit() { const c = S.list[0]; if (!c) return null; G.launchPed(c.p, c.p.x - 1, c.p.y, 6); return c.p.state; }
export function status() { return { n: S.list.length, nextT: S.nextT, list: S.list.map((c) => ({ bit: c.bit, x: c.p.x, y: c.p.y, t: c.t, state: c.p.state, headline: c.headline })) }; }
// testing: start a particular one now
export function debugStart(bit) {
  if (bit === 'roof') { const c = startRoof(); if (c) S.list.push(c); return !!c; }
  if (bit === 'runner') { const c = startRunner(); if (c) S.list.push(c); return !!c; }
  const sp = findSpot(14, 40); if (!sp) return false;
  S.list.push(make(bit, sp[0], sp[1])); return true;
}
export function debugClear() { for (const c of S.list.slice()) finish(c); }
export const debug = { S, get G() { return G; }, inTraffic };
