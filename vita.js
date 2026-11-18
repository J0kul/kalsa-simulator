// vita.js — street life: people who deal with each other, not only with you.
// Arguments that turn into brawls, crowds that film them, vigili urbani who break them up and write fines,
// a pickpocket and his victim, market vendors and their customers, drivers who get out to argue,
// a kickabout in the piazza, friends walking together, witnesses who call 112, pigeons.
let G = null, C = null;
const S = { t: 0, brawl: null, nextBrawl: 26, vigili: [], vendors: [], cust: [], nextCust: 3, thief: null, nextThief: 50, jam: null, nextJam: 38, snitch: null, grudges: [], pairs: [], pairT: 0, ball: null, kids: [], birds: [], flocks: [], birdIM: null, tgT: 0 };
const P = { x: 0, y: 0 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const free = (p) => p.state === 'walk' && !p.vip && !p.custom && !p.temp && !p.convo && p.mesh.visible;
const near = (x, y, r, ok = free) => { let best = null, bd = r; for (const p of G.peds) { if (!ok(p)) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } } return best; };
const heard = (p) => dist(p, G.player) < 46;
const talk = (p, text, ms = 1700) => { if (heard(p)) G.say(p.mesh, text, ms); };
function take(p, state) {
  if (p.convo) G.endConvo(p.convo);
  if (G.talk.ped === p) G.closeTalk();
  p.state = state; p.pose = null; p.vt = 0; p.vnav = null; p._mv = 0;
}
const release = (p) => { if (p && G.peds.includes(p) && p.state.startsWith('v')) { p.vnav = null; G.afterSocial(p); } };
// move a person we control; finds a way round the block when there is no straight line
function go(p, tx, ty, dt, speed) {
  let wx = tx, wy = ty;
  const d = Math.hypot(tx - p.x, ty - p.y);
  if (d > 9) {
    const n = p.vnav || (p.vnav = { t: 0, los: true, route: null });
    n.t -= dt;
    if (n.t <= 0) { n.t = 0.5; n.los = d < 60 && G.rayWalls(p.x, p.y, 1, tx, ty, 1) >= 1; if (!n.los && (!n.route || !n.route.length || Math.hypot(n.gx - tx, n.gy - ty) > 8)) { n.route = G.routeOn(G.WG, p.x, p.y, tx, ty, true) || [[tx, ty]]; n.gx = tx; n.gy = ty; } }
    if (!n.los && n.route && n.route.length) { while (n.route.length > 1 && Math.hypot(n.route[0][0] - p.x, n.route[0][1] - p.y) < 1.3) n.route.shift(); [wx, wy] = n.route[0]; }
  }
  const dx = wx - p.x, dy = wy - p.y, l = Math.hypot(dx, dy);
  if (l > 0.06) {
    const st = Math.min(l, speed * dt);
    p.x += dx / l * st; p.y += dy / l * st; P.x = p.x; P.y = p.y; G.resolve(P, 0.32); p.x = P.x; p.y = P.y;
    p.a += G.angDiff(p.a, Math.atan2(dy, dx)) * Math.min(1, dt * 10); p.phase += speed * dt * 2.5; p._mv = speed > 3.4 ? 0.85 : 0.5;
  }
  return d;
}
const face = (p, x, y, dt) => { p.a += G.angDiff(p.a, Math.atan2(y - p.y, x - p.x)) * Math.min(1, dt * 9); };
function draw(p, pose, dt) {
  p.vt = (p.vt || 0) + dt;
  p.mesh.position.set(p.x, 0.09, -p.y); p.mesh.rotation.set(0, p.a + Math.PI / 2, 0);
  if (p._mv) { G.animatePerson(p.mesh, p.phase, p._mv); p._mv = 0; } else G.posePerson(p.mesh, pose || 'idle', p.vt, p.seed || 0);
}
function spawn(look, x, y, state, extra) {
  let base = G.randomLook(); for (let k = 0; k < 8 && base.kind !== 'local'; k++) base = G.randomLook();
  const L = G.fullLook({ ...base, ...look, v: 2 });
  const mesh = G.makePerson(L); G.scene.add(mesh);
  const p = { mesh, look: L, speed: 1.2, phase: 0, x, y, a: 0, state: 'walk', t: 0, seed: G.rand(0, 6), temp: true, ...extra };
  G.placePed(p, { x, y }); p.x = x; p.y = y; p.state = state;
  G.peds.push(p); return p;
}
function despawn(p) {
  if (!p) return;
  if (p.convo) G.endConvo(p.convo); if (G.talk.ped === p) G.closeTalk();
  G.scene.remove(p.mesh); const i = G.peds.indexOf(p); if (i >= 0) G.peds.splice(i, 1);
}
// a spot on the street network some way from the player, preferably round a corner
function farSpot(x, y, r0, r1) {
  const N = G.WG.nodes;
  for (let k = 0; k < 50; k++) { const n = N[(Math.random() * N.length) | 0], d = Math.hypot(n[0] - x, n[1] - y); if (d > r0 && d < r1 && G.inPlay(n[0], n[1])) return n; }
  return null;
}
const street = (x, y) => G.nearestStreetName(x, y) || 'centro';

// ------------------------------------------------------------------ witnesses and grudges
export function findWitness(x, y, victim, cb) {
  if (S.snitch) return true;
  let best = null, bd = 28;
  for (const p of G.peds) {
    if (p === victim || !free(p) || G.pedKind(p) === 'tourist') continue;
    const d = Math.hypot(p.x - x, p.y - y); if (d < bd && d > 2 && G.rayWalls(p.x, p.y, 1.5, x, y, 1.5) >= 1) { bd = d; best = p; }
  }
  if (!best) return false;
  take(best, 'vsnitch'); S.snitch = { p: best, t: 3.0, cb, x, y };
  talk(best, G.pick(['Pronto, polizia?! Curriti!', 'Chiamo u 112! Disgraziato!', 'Pronto? C\'è un pazzo ccà!']), 2600);
  return true;
}
export function vigileSees(x, y) {
  for (const v of S.vigili) if (v.state === 'vigile' && Math.hypot(v.x - x, v.y - y) < 26 && G.rayWalls(v.x, v.y, 1.6, x, y, 1.5) >= 1) { v.job = { kind: 'player', t: 9 }; talk(v, G.pick(['Fermo! Polizia Municipale!', 'Ehi tu! Fermati!']), 1600); G.sfx.whistle(); return true; }
  return false;
}
// what somebody does once they are back on their feet
export function onAssault(p, power, report) {
  if (p.temp || p.vigile || p.vendor || S.grudges.some((g) => g.p === p)) return;
  const k = G.pedKind(p), r = Math.random();
  const plan = p.vip ? 'flee' : k === 'tourist' ? 'flee' : k === 'nonna' ? (r < 0.65 ? 'fight' : 'flee') : k === 'nonno' ? (r < 0.3 ? 'fight' : 'flee') : r < 0.5 ? 'fight' : 'flee';
  S.grudges.push({ p, plan, t: 14, report });
}
function updateGrudges(dt) {
  const pl = G.player;
  for (let i = S.grudges.length - 1; i >= 0; i--) {
    const g = S.grudges[i], p = g.p;
    if (!G.peds.includes(p)) { S.grudges.splice(i, 1); continue; }
    if (p.state === 'fly' || p.state === 'down') continue;
    if (!g.on) {
      if (p.hp != null && p.hp <= 0) g.plan = 'flee';
      if (g.plan === 'flee' && g.report && !S.snitch && !p.vip && Math.random() < 0.7) {
        take(p, 'vsnitch'); S.snitch = { p, t: 3.4, cb: g.report, x: pl.x, y: pl.y };
        talk(p, G.pick(['Pronto, polizia?! Mi hanno aggredito!', 'U 112! Subito! Un pazzo mi vattiu!']), 2800); S.grudges.splice(i, 1); continue;
      }
      if (g.plan === 'flee') { p.prevState = 'walk'; p.state = 'flee'; p.t = 4.5; p.fleeFrom = [pl.x, pl.y]; talk(p, G.pick(['Aiutu! Aiutu!', 'Un pazzo! Scappate!', 'Polizia!!']), 1300); S.grudges.splice(i, 1); continue; }
      take(p, 'vfight'); g.on = true; g.cd = 0.5;
      talk(p, G.pedKind(p) === 'nonna' ? G.pick(['Ora ti fazzu vidiri iu!', 'Disgraziato! Veni ccà!']) : G.pick(['Ma chi ti senti?!', 'Ora ti rumpu i corna!', 'Veni ccà, veni!']), 1600);
    }
    if (p.state !== 'vfight') { S.grudges.splice(i, 1); continue; }
    g.t -= dt; g.cd -= dt;
    const d = dist(p, pl), gone = pl.cuffed || pl.ko || pl.inCar || (pl.vespa && pl.vespa.spec.car) || d > 34 || g.t <= 0;
    if (gone) { talk(p, G.pick(['E un turnari cchiù!', 'Vattinni!', 'Vigliacco!']), 1300); release(p); S.grudges.splice(i, 1); continue; }
    if (d > 1.15) { go(p, pl.x, pl.y, dt, G.pedKind(p) === 'nonna' ? 3.6 : 4.9); draw(p, 'argue', dt); }
    else {
      face(p, pl.x, pl.y, dt);
      if (g.cd <= 0) { g.cd = 0.85; p.vt = 0; g.hit = 0.25; C.punch(p, G.pedKind(p) === 'nonna' ? 6 : 9); }
      g.hit = Math.max(0, (g.hit || 0) - dt);
      draw(p, g.hit > 0 ? (p.look.bag === 'handbag' ? 'bag' : 'shove') : 'argue', dt);
    }
  }
  const s = S.snitch;
  if (s) {
    const p = s.p;
    if (p.state !== 'vsnitch') { S.snitch = null; if (dist(p, pl) < 40) G.toast('Call cut short', 'nobody else saw a thing', 1500); }
    else { s.t -= dt; face(p, s.x, s.y, dt); draw(p, 'phone', dt); if (s.t <= 0) { S.snitch = null; release(p); s.cb(); } }
  }
}

// ------------------------------------------------------------------ brawls between two locals, with a crowd
const ROWS = [
  ['Ma unni u parcheggiasti stu cosu?!', 'In doppia fila, comu tutti!', 'Sposta sta machina!', 'Spostala tu, si si capaci!'],
  ['U Palermo quest\'annu fa schifu!', 'Chi dicisti?! Ripetilo!', 'Schifu! Schi-fu!', 'Ora ti fazzu vidiri iu u schifu!'],
  ['Ero prima io nella fila!', 'Ma quali fila, ma quali!', 'Maleducato!', 'A cu u dici, maleducato?!'],
  ['To cuçinu mi deve vinti euro!', 'E a mia chi mi cunti?', 'Pagami tu allura!', 'Ma va travagghia!'],
  ['Arancino si dice!', 'ArancinA! Semu a Palermo!', 'A Catania dicinu arancino!', 'E vattinni a Catania!'],
];
function startBrawl() {
  const pl = G.player;
  for (const a of G.peds) {
    if (!free(a) || ['nonna', 'tourist'].includes(G.pedKind(a))) continue;
    const da = dist(a, pl); if (da < 9 || da > 48) continue;
    const b = near(a.x, a.y, 9, (q) => q !== a && free(q) && !['nonna', 'tourist'].includes(G.pedKind(q)));
    if (!b) continue;
    take(a, 'vbrawl'); take(b, 'vbrawl');
    const ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    S.brawl = { a, b, x: mx, y: my, sa: [mx - Math.cos(ang) * 0.6, my - Math.sin(ang) * 0.6], sb: [mx + Math.cos(ang) * 0.6, my + Math.sin(ang) * 0.6], ph: 'meet', t: 0, i: -1, row: G.pick(ROWS), hp: [3, 3], crowdT: 0, vigile: null, turn: 0 };
    return true;
  }
  return false;
}
function endBrawl(msg) {
  const B = S.brawl; if (!B) return;
  for (const p of [B.a, B.b]) if (p.state === 'vbrawl') release(p);
  if (B.vigile && B.vigile.job && B.vigile.job.kind === 'brawl') B.vigile.job = null;
  S.brawl = null; S.nextBrawl = G.rand(40, 75);
  void msg;
}
function updateBrawl(dt) {
  const B = S.brawl;
  if (!B) { S.nextBrawl -= dt; if (S.nextBrawl <= 0) { S.nextBrawl = 6; startBrawl(); } return; }
  const { a, b } = B;
  if (B.ph === 'won' ? B.win.state !== 'vbrawl' : (a.state !== 'vbrawl' || b.state !== 'vbrawl')) { endBrawl(); return; }
  if (dist(B, G.player) > 120) { endBrawl(); return; }
  B.t += dt; B.crowdT -= dt;
  let pa = 'argue', pb = 'argue';
  if (B.ph === 'meet') {
    const d1 = go(a, B.sa[0], B.sa[1], dt, 1.8), d2 = go(b, B.sb[0], B.sb[1], dt, 1.8);
    if ((d1 < 0.2 && d2 < 0.2) || B.t > 4) { B.ph = 'row'; B.t = 0; B.lineT = 0; }
  } else if (B.ph === 'row') {
    face(a, b.x, b.y, dt); face(b, a.x, a.y, dt);
    B.lineT -= dt;
    if (B.lineT <= 0) {
      B.i++;
      if (B.i >= B.row.length) { B.ph = 'fight'; B.t = 0; B.cd = 0.4; if (heard(a)) G.sfx.thud(); }
      else { const who = B.i % 2 ? b : a; talk(who, B.row[B.i], 1900); B.lineT = 2.0; B.sp = B.i % 2; }
    }
    pa = B.sp === 0 ? (B.i > 1 ? 'argue' : 'gesture') : 'hips'; pb = B.sp === 1 ? 'argue' : 'hips';
  } else if (B.ph === 'fight') {
    face(a, b.x, b.y, dt); face(b, a.x, a.y, dt);
    B.cd -= dt; B.hitT = Math.max(0, (B.hitT || 0) - dt);
    if (B.cd <= 0) {
      B.cd = G.rand(0.55, 0.9); B.turn = 1 - B.turn; B.hitT = 0.28;
      const att = B.turn ? b : a, vic = B.turn ? a : b, k = B.turn ? 0 : 1;
      B.hp[k] -= Math.random() < 0.75 ? 1 : 0;
      const dx = vic.x - att.x, dy = vic.y - att.y, d = Math.hypot(dx, dy) || 1;
      P.x = vic.x + dx / d * 0.25; P.y = vic.y + dy / d * 0.25; G.resolve(P, 0.32); vic.x = P.x; vic.y = P.y;
      if (d > 1.5) { att.x += dx / d * 0.4; att.y += dy / d * 0.4; }
      if (heard(a)) G.sfx.boing(0.3);
      if (Math.random() < 0.3) talk(vic, G.pick(['Ahia!', 'Minchia!', 'Ora basta!', 'Me matri!']), 800);
      if (B.hp[k] <= 0) {
        G.launchPed(vic, att.x, att.y, 5.5, false);
        B.ph = 'won'; B.t = 0; B.win = att;
        talk(att, G.pick(['E ora cu è u schifu?!', 'Accussì impari!', 'Cu voli ancora?!']), 2000);
        if (heard(att) && S.tgT <= 0) { S.tgT = 60; G.showTG(`Rissa in ${street(att.x, att.y)}`, G.pick(['It started over a parking space. It always starts over a parking space.', 'Witnesses: "It was about football. Or arancine. Or both."']), 6); }
      }
    }
    pa = B.hitT > 0 && !B.turn ? 'shove' : 'argue'; pb = B.hitT > 0 && B.turn ? 'shove' : 'argue';
  } else if (B.ph === 'won') {
    if (B.win.state === 'vbrawl') { draw(B.win, B.t < 2.2 ? 'cheer' : 'hips', dt); }
    if (B.t > (B.vigile ? 9 : 3.5)) endBrawl();
    crowd(B);
    return;
  } else if (B.ph === 'stopped') {
    face(a, B.vigile.x, B.vigile.y, dt); face(b, B.vigile.x, B.vigile.y, dt);
    draw(a, B.t < 2 ? 'shrug' : 'listen', dt); draw(b, B.t < 2.6 ? 'point' : 'facepalm', dt);
    if (B.t > 6.5) { talk(a, 'Va bene, va bene…', 1200); endBrawl(); }
    return;
  }
  draw(a, pa, dt); draw(b, pb, dt);
  crowd(B);
  // the nearest vigile comes running
  if (!B.vigile && B.ph !== 'meet') { const v = S.vigili.find((q) => q.state === 'vigile' && !q.job && Math.hypot(q.x - B.x, q.y - B.y) < 110); if (v) { B.vigile = v; v.job = { kind: 'brawl', t: 40 }; } }
}
function crowd(B) {
  if (B.crowdT > 0) return;
  B.crowdT = 1.1;
  let n = 0;
  for (const q of G.peds) {
    if (!(q.state === 'walk' || q.state === 'react') || q === B.a || q === B.b) continue;
    const d = Math.hypot(q.x - B.x, q.y - B.y);
    if (d > 13 || d < 2.2) continue;
    const pose = G.pedKind(q) === 'tourist' ? 'selfie' : G.pick(['clap', 'point', 'shock', 'laugh', 'selfie', 'cheer']);
    if (G.setReact(q, pose, G.rand(2.5, 4), B.x, B.y) && n++ < 1 && Math.random() < 0.4) talk(q, G.pick(['Dacci! Dacci!', 'Video! Video!', 'Talìa chi su beddi!', 'Chiamati a quarcunu!', 'Dieci euro supra u pilatu!']), 1400);
  }
}

// ------------------------------------------------------------------ vigili urbani: on foot, a beat, a whistle and a book of fines
const VIG = [{ name: 'Vigile Mancuso', skin: '#e2ad84', hair: 'short', facial: 'mustache', build: 'belly' }, { name: 'Vigilessa La Rosa', skin: '#e8b48c', hair: 'ponytail', lashes: true, build: 'normal', facial: 'none' }];
function spawnVigili() {
  VIG.forEach((v, i) => {
    const n = farSpot(G.player.x, G.player.y, 40, 100) || [G.player.x + 30, G.player.y];
    const p = spawn({ kind: 'custom', hairColor: '#14110f', top: 'shirt', c1: '#a9cbe8', c2: '#1c2440', pattern: 'solid', tie: 'tie', tieColor: '#1c2440', hat: 'cap', hatColor: '#f6f3ee', bottom: 'trousers', bottomColor: '#1c2440', shoes: 'shoes', shoeColor: '#111111', back: 'P.M.', glasses: 'none', bag: 'none', necklace: 'none', earrings: 'none', mouth: 'neutral', lines: [], number: '', chest: '', ...v }, n[0], n[1], 'vigile', { custom: 'vigile:' + i, behaviour: 'vigile', vigile: true, temp: false, job: null, goal: null, wait: 0, hp: 4 });
    S.vigili.push(p);
  });
}
function updateVigili(dt) {
  const pl = G.player;
  for (const v of S.vigili) {
    if (v.state !== 'vigile') { if (v.state !== 'fly' && v.state !== 'down' && v.state !== 'react' && v.state !== 'chat' && v.state !== 'talk') v.state = 'vigile'; continue; }
    const dP = dist(v, pl);
    if (dP > 170 && !v.job) { const n = farSpot(pl.x, pl.y, 60, 110); if (n) { v.x = n[0]; v.y = n[1]; v.goal = null; } }
    const j = v.job; let pose = 'idle';
    if (j) j.t -= dt;
    if (j && j.t <= 0) v.job = null;
    else if (j && j.kind === 'brawl' && S.brawl) {
      const B = S.brawl, d = go(v, B.x, B.y, dt, 5.6);
      if (d < 3.2) {
        if (B.ph === 'row' || B.ph === 'fight') { B.ph = 'stopped'; B.t = 0; G.sfx.whistle(); talk(v, G.pick(['Basta! Fermi tutti! Documenti!', 'Finitela! Vi fazzu u verbale a tutti dui!']), 2400); }
        else if (B.ph === 'won' && !j.said) { j.said = true; G.sfx.whistle(); talk(v, 'E tu veni cu mia! Documenti!', 2200); if (B.win.state === 'vbrawl') talk(B.win, 'Ma iu un fici nenti!', 1800); }
        face(v, B.x, B.y, dt); pose = B.ph === 'stopped' && B.t > 2.6 ? 'sign' : 'point';
      }
    } else if (j && j.kind === 'thief' && S.thief && S.thief.p) {
      const t = S.thief.p; go(v, t.x, t.y, dt, 5.9);
      if (S.thief.ph === 'run' && dist(v, t) < 1.2 && t.state === 'vthief') { G.launchPed(t, v.x, v.y, 4.5, false); S.thief.by = 'vigile'; talk(v, 'Pigghiatu!', 1200); }
      if (t.state === 'down') { face(v, t.x, t.y, dt); pose = 'point'; }
    } else if (j && j.kind === 'player') {
      if (dP > 2.2) go(v, pl.x, pl.y, dt, 4.6); else face(v, pl.x, pl.y, dt);
      pose = 'point'; j.wt = (j.wt || 0) - dt;
      if (j.wt <= 0 && dP < 30) { j.wt = 3.2; G.sfx.whistle(); talk(v, G.pick(['Fermo! Documenti!', 'Ti vitti, sai! Ti vitti!', 'Chiamai i colleghi!']), 1500); }
    } else if (j && j.kind === 'ticket') {
      const d = go(v, j.x, j.y, dt, 1.5);
      if (d < 0.5) {
        face(v, j.cx, j.cy, dt); pose = 'sign';
        if (!j.said) { j.said = true; j.t = 7; talk(v, G.pick(['Doppia fila. Multa!', 'Divieto di sosta… quarantadue euro.', 'E chistu cu è? Multa!']), 2200); const q = near(v.x, v.y, 14); if (q && G.setReact(q, 'argue', 4.5, v.x, v.y)) setTimeout(() => talk(q, G.pick(['Cinque minuti, cinque!', 'Ma è di me cugnatu!', 'Vigile, ma propriu a mia?!']), 2000), 1500); }
      }
    } else {
      // the beat
      v.job = null;
      if (v.wait > 0) { v.wait -= dt; pose = v.wait > 2 ? 'lookout' : 'hips'; }
      else {
        if (!v.goal || Math.hypot(v.goal[0] - v.x, v.goal[1] - v.y) < 2) {
          v.wait = G.rand(2, 5);
          const n = farSpot(pl.x, pl.y, 14, 80); v.goal = n ? [n[0], n[1]] : [v.x, v.y];
          // a badly parked car on the way? out comes the book
          if (Math.random() < 0.45) { let car = null; G.propsNear(v.x, v.y, 12, (o) => { if (!car && !o.static && o.alive && o.kind && Math.hypot(o.x - v.x, o.y - v.y) < 14) car = o; }); if (car) { P.x = car.x - Math.sin(car.a) * 1.7; P.y = car.y + Math.cos(car.a) * 1.7; G.resolve(P, 0.4); v.job = { kind: 'ticket', t: 22, x: P.x, y: P.y, cx: car.x, cy: car.y }; } }
        } else go(v, v.goal[0], v.goal[1], dt, 1.35);
      }
    }
    draw(v, pose, dt);
  }
}

// ------------------------------------------------------------------ the pickpocket, the tourist and whoever catches him
function startThief() {
  const pl = G.player;
  const vic = near(pl.x, pl.y, 50, (q) => free(q) && G.pedKind(q) === 'tourist' && dist(q, pl) > 10) || near(pl.x, pl.y, 45, (q) => free(q) && dist(q, pl) > 10);
  if (!vic) return false;
  P.x = vic.x - Math.cos(vic.a) * 7; P.y = vic.y - Math.sin(vic.a) * 7; G.resolve(P, 0.4);
  const p = spawn({ kind: 'local', top: 'hoodie', c1: G.pick(['#2b2a35', '#3c3f45', '#3d5a40']), hat: 'cap', hatColor: '#141116', glasses: 'shades', mouth: 'smirk', bottom: 'track', bottomColor: '#2b2a35', bag: 'none', hair: 'buzz', facial: 'stubble' }, P.x, P.y, 'vthief', { hp: 2 });
  S.thief = { p, vic, ph: 'stalk', t: 0, by: null, route: null };
  return true;
}
function endThief(caught) {
  const T = S.thief; if (!T) return;
  if (T.vic && T.vic.state === 'vchase') release(T.vic);
  for (const v of S.vigili) if (v.job && v.job.kind === 'thief') v.job = null;
  despawn(T.p); S.thief = null; S.nextThief = G.rand(70, 120);
  void caught;
}
function updateThief(dt) {
  const T = S.thief, pl = G.player;
  if (!T) { S.nextThief -= dt; if (S.nextThief <= 0) { S.nextThief = 8; startThief(); } return; }
  const p = T.p, vic = T.vic; T.t += dt;
  if (!G.peds.includes(p)) { S.thief = null; return; }
  if (T.ph === 'stalk') {
    if (vic.state !== 'walk' || T.t > 14) { endThief(); return; }
    const d = go(p, vic.x, vic.y, dt, 2.5); draw(p, 'idle', dt);
    if (d < 0.9) {
      T.ph = 'run'; T.t = 0; take(vic, 'vchase');
      talk(vic, G.pick(['Il portafoglio!! Al ladro!', 'My wallet! Stop him!', 'Al ladro! Al ladro!']), 2200);
      const n = farSpot(p.x, p.y, 130, 260); T.goal = n ? [n[0], n[1]] : [p.x + 150, p.y];
      if (dist(p, pl) < 45) G.toast('Al ladro!', 'pickpocket · run into him or hit him to stop him', 2400);
      const v = S.vigili.find((q) => q.state === 'vigile' && !q.job && dist(q, p) < 120); if (v) { v.job = { kind: 'thief', t: 40 }; G.sfx.whistle(); }
      G.reactAround(vic.x, vic.y, 12, 1);
    }
    return;
  }
  if (T.ph === 'run') {
    if (p.state === 'vthief') {
      go(p, T.goal[0], T.goal[1], dt, 5.7); draw(p, 'idle', dt);
      if (!pl.vespa && !pl.fly && dist(p, pl) < 0.95 && pl.speed > 3.2) { G.launchPed(p, pl.x, pl.y, 4.5, false); T.by = 'player'; pl.pose = 'cheer'; pl.poseT = 0; }
      if (T.t > 38 || dist(p, pl) > 170 || Math.hypot(T.goal[0] - p.x, T.goal[1] - p.y) < 3) { if (vic.state === 'vchase') talk(vic, G.pick(['Nooo! I documenti!', 'My passport was in there…']), 2000); endThief(false); return; }
    } else if (p.state === 'fly' || p.state === 'down') { if (!T.by) T.by = 'player'; T.ph = 'caught'; T.t = 0; p.t = Math.max(p.t || 0, 9); }
    else { p.state = 'vthief'; }
    if (vic.state === 'vchase') { go(vic, p.x, p.y, dt, 4.1); draw(vic, 'argue', dt); T.shout = (T.shout || 2) - dt; if (T.shout <= 0) { T.shout = 3; talk(vic, G.pick(['Al ladro!', 'Fermatelo!', 'Stop! Thief!']), 1100); } }
    return;
  }
  // caught: the victim gets the wallet back, somebody gets thanked
  if (p.state === 'down') p.t = Math.max(p.t, 1);
  if (vic.state === 'vchase') { const d = go(vic, p.x, p.y, dt, 3.6); draw(vic, d < 2 ? (T.t > 3 ? 'cheer' : 'bag') : 'argue', dt); }
  if (!T.paid && T.t > 2.5) {
    T.paid = true;
    if (T.by === 'player') { G.addMoney(15); G.sfx.jingle(); G.toast('Portafoglio restituito', '+€15 from a very grateful tourist', 2600); if (vic.state === 'vchase') talk(vic, G.pick(['Grazie! Grazie mille!', 'You are a hero! Take this!']), 2400); G.showTG(`Borseggiatore placcato in ${street(p.x, p.y)}`, 'A passer-by stopped him. The wallet is back with its owner.', 6); }
    else if (vic.state === 'vchase') talk(vic, 'Grazie, vigile!', 2000);
  }
  if (T.t > 7.5) endThief(true);
}

// ------------------------------------------------------------------ the markets: vendors shouting their wares, people stopping to haggle
const CRY = {
  frutta: ['Aranci! Aranci duci! Un euro!', 'Talìa chi beddi sti fragoli!', 'Ficudinnia! Ficudinnia frischi!'], pesce: ['Pisci friscu! Vivu è!', 'U piscispata! Talìa chi beddu!', 'Sardi! Sardi a du euro!'],
  verdura: ['Cacocciuli! Deci un euro!', 'Milinciani! Pumadoru!', 'Tinnirumi! Cu voli i tinnirumi?'], frittura: ['Panelle e crocchè! Cavuri cavuri!', 'Arancine! Accarne e abburro!', 'U pani ca meusa!'],
  olive: ['Alivi cunzati! Assaggia!', 'Chiappari! Pumadoru sicchi!', 'Assaggia, assaggia, un si paga!'], pane: ['Pani cavuru! Ora ora u sfurnai!', 'U sfinciuni! Chi ciavuru!', 'Mafalde! Pani ca giuggiulena!'],
};
const HAGGLE = [['Quantu veni?', 'Pi tia? Du euro!', 'Du euro?! Ma si pazzu!', 'Un euro e mezzu, va\'.'], ['È friscu?', 'Friscu?! Ancora si movi!', 'Mi ni duna menzu chilu.', 'Menzu chilu abbondante!'], ['How much is this?', 'For you, special price!', 'Is that… good?', 'Bonissimu! Assaggia!'], ['Mi fa u scontu?', 'U scontu? Ti dugnu u pisu giustu!', 'Sempre u solitu…', 'A domani, signò!']];
function updateMarket(dt) {
  const pl = G.player, st = G.stalls || [];
  if (!st.length) return;
  S.mkT = (S.mkT || 0) - dt;
  if (S.mkT <= 0) {
    S.mkT = 1.2;
    // staff the stalls around the player, send home the ones left behind
    for (let i = S.vendors.length - 1; i >= 0; i--) { const v = S.vendors[i]; if (dist(v, pl) > 95 && v.state === 'vendor') { v.stall.staff = null; despawn(v); S.vendors.splice(i, 1); } }
    if (S.vendors.length < 9) {
      let best = null, bd = 70;
      for (const s of st) { if (s.staff) continue; const d = Math.hypot(s.x - pl.x, s.y - pl.y); if (d < bd && d > 6) { bd = d; best = s; } }
      if (best) {
        const look = best.kind === 'pesce' || best.kind === 'frittura' ? { top: 'apron', c1: '#f6f3ee', shoes: 'boots', build: G.pick(['broad', 'belly']) } : { top: G.pick(['tee', 'polo', 'tank', 'shirt']) };
        const hx = best.x - best.nx * 0.95, hy = best.y - best.ny * 0.95;
        const v = spawn({ kind: 'local', bag: 'none', hat: G.pick(['none', 'coppola', 'cap', 'none']), ...look }, hx, hy, 'vendor', { custom: 'vendor:' + st.indexOf(best), behaviour: 'vendor', vendor: true, temp: false, stall: best, home: [hx, hy], cry: G.rand(1, 8) });
        v.a = Math.atan2(best.ny, best.nx); best.staff = v; S.vendors.push(v);
      }
    }
  }
  for (const v of S.vendors) {
    if (v.state !== 'vendor') continue;
    const s = v.stall, away = Math.hypot(v.x - v.home[0], v.y - v.home[1]);
    if (away > 0.4) { go(v, v.home[0], v.home[1], dt, 1.6); draw(v, 'idle', dt); continue; }
    if (v.busy) { draw(v, v.pose2 || 'talk', dt); face(v, v.busy.x, v.busy.y, dt); continue; }
    face(v, s.x + s.nx * 3, s.y + s.ny * 3, dt);
    v.cry -= dt;
    if (v.cry <= 0) { v.cry = G.rand(7, 15); v.cryT = 2.4; talk(v, G.pick(CRY[s.kind] || CRY.frutta), 2300); }
    v.cryT = Math.max(0, (v.cryT || 0) - dt);
    draw(v, v.cryT > 0 ? 'gesture' : 'idle', dt);
  }
  // customers
  S.nextCust -= dt;
  if (S.nextCust <= 0 && S.cust.length < 3) {
    S.nextCust = G.rand(2.5, 6);
    for (const v of S.vendors) {
      if (v.busy || v.state !== 'vendor' || dist(v, pl) > 45) continue;
      const s = v.stall, q = near(s.x + s.nx * 1.5, s.y + s.ny * 1.5, 32);
      if (!q) continue;
      take(q, 'vbuy'); v.busy = q;
      S.cust.push({ p: q, v, spot: [s.x + s.nx * 1.25, s.y + s.ny * 1.25], i: -1, lineT: 0, row: G.pedKind(q) === 'tourist' ? HAGGLE[2] : G.pick(HAGGLE), t: 0 });
      break;
    }
  }
  for (let i = S.cust.length - 1; i >= 0; i--) {
    const c = S.cust[i], { p, v } = c; c.t += dt;
    if (p.state !== 'vbuy' || v.state !== 'vendor' || c.t > 45) { if (v.busy === p) v.busy = null; release(p); S.cust.splice(i, 1); continue; }
    if (c.i < 0 && go(p, c.spot[0], c.spot[1], dt, 1.4) > 0.3) { draw(p, 'idle', dt); continue; }
    face(p, v.x, v.y, dt); c.lineT -= dt;
    if (c.lineT <= 0) {
      c.i++;
      if (c.i >= c.row.length) { v.busy = null; if (heard(p) && Math.random() < 0.5) G.sfx.kaching(); release(p); S.cust.splice(i, 1); continue; }
      const who = c.i % 2 ? v : p; talk(who, c.row[c.i], 1800); c.lineT = 2.1; who.vt = 0;
      c.pp = c.i % 2 ? 'listen' : G.pick(['point', 'talk', 'shrug']); v.pose2 = c.i % 2 ? G.pick(['gesture', 'talk', 'laugh']) : 'listen';
    }
    draw(p, c.pp || 'listen', dt);
  }
}
export function vendorSay(x, y, text) { const v = S.vendors.find((q) => Math.hypot(q.x - x, q.y - y) < 4.5 && q.state === 'vendor'); if (v) { v.cryT = 2; v.cry = 9; G.say(v.mesh, text, 1900); } }

// ------------------------------------------------------------------ a driver gets out to settle it face to face
const ROAD = [['Ma comu camini?! Mmenzu a strata!', 'E tu comu guidi?! Ca è zona pedonale!', 'Pedonale?! Ma unni u viristi scrittu!', 'Talìa u cartellu, sceccu!', 'Vabbè, vabbè… a prossima vota!']];
function startJam() {
  const pl = G.player;
  for (const c of G.traffic) {
    if (c.state !== 'drive' || c.hold || c.speed < 2.5) continue;
    const d = Math.hypot(c.x - pl.x, c.y - pl.y); if (d < 12 || d > 55) continue;
    const q = near(c.x + Math.cos(c.a) * 5, c.y + Math.sin(c.a) * 5, 11); if (!q) continue;
    c.hold = true;
    P.x = c.x - Math.sin(c.a) * 1.7; P.y = c.y + Math.cos(c.a) * 1.7; G.resolve(P, 0.35);
    const drv = spawn({ kind: 'local', bag: 'none', glasses: G.pick(['shades', 'none']) }, P.x, P.y, 'vdriver', {});
    drv.a = c.a; take(q, 'vjam');
    S.jam = { c, drv, q, door: [P.x, P.y], ph: 'out', t: 0, i: -1, lineT: 0.8, row: ROAD[0], honk: 2 };
    if (d < 40) G.sfx.carHorn();
    return true;
  }
  return false;
}
function endJam() {
  const J = S.jam; if (!J) return;
  J.c.hold = false; if (J.q.state === 'vjam') release(J.q); despawn(J.drv);
  S.jam = null; S.nextJam = G.rand(45, 90);
}
function updateJam(dt) {
  const J = S.jam;
  if (!J) { S.nextJam -= dt; if (S.nextJam <= 0) { S.nextJam = 7; startJam(); } return; }
  const { c, drv, q } = J; J.t += dt;
  if (drv.state === 'fly' || drv.state === 'down') return;   // somebody flattened the driver: the car waits
  if (c.state !== 'drive' || drv.state !== 'vdriver' || (J.ph !== 'back' && q.state !== 'vjam') || J.t > 40 || !G.peds.includes(drv)) { endJam(); return; }
  J.honk -= dt; if (J.honk <= 0) { J.honk = G.rand(2.5, 4.5); if (Math.hypot(c.x - G.player.x, c.y - G.player.y) < 35 && G.traffic.some((o) => o !== c && o.state === 'drive' && o.speed < 0.5 && Math.hypot(o.x - c.x, o.y - c.y) < 14)) G.sfx.carHorn(); }
  if (J.ph === 'out') {
    const mx = (drv.x + q.x) / 2, my = (drv.y + q.y) / 2, ang = Math.atan2(q.y - drv.y, q.x - drv.x);
    const d1 = go(drv, mx - Math.cos(ang) * 0.65, my - Math.sin(ang) * 0.65, dt, 2.2), d2 = go(q, mx + Math.cos(ang) * 0.65, my + Math.sin(ang) * 0.65, dt, 1.3);
    draw(drv, 'argue', dt); draw(q, 'hips', dt);
    if ((d1 < 0.3 && d2 < 0.3) || J.t > 4) J.ph = 'row';
  } else if (J.ph === 'row') {
    face(drv, q.x, q.y, dt); face(q, drv.x, drv.y, dt);
    J.lineT -= dt;
    if (J.lineT <= 0) { J.i++; if (J.i >= J.row.length) { J.ph = 'back'; talk(q, G.pick(['Ma va, va!', 'Cose da pazzi…']), 1300); release(q); } else { talk(J.i % 2 ? q : drv, J.row[J.i], 2100); J.lineT = 2.3; } }
    draw(drv, J.i % 2 ? 'hips' : 'argue', dt); if (q.state === 'vjam') draw(q, J.i % 2 ? 'gesture' : 'facepalm', dt);
    if (Math.random() < dt * 0.6) for (const o of G.peds) if (o.state === 'walk' && Math.hypot(o.x - drv.x, o.y - drv.y) < 9 && Math.random() < 0.3) G.setReact(o, G.pick(['point', 'laugh', 'shock']), 2.5, drv.x, drv.y);
  }
  if (J.ph === 'back') { const d = go(drv, J.door[0], J.door[1], dt, 2.4); draw(drv, 'idle', dt); if (d < 0.5) endJam(); }
}

// ------------------------------------------------------------------ a kickabout: three kids and a ball, wherever there is a square
function setupBall() {
  const T = G.THREE;
  const m = new T.Mesh(new T.IcosahedronGeometry(0.22, 1), new T.MeshStandardMaterial({ color: '#f6f3ee', roughness: 0.6 }));
  m.castShadow = true; G.scene.add(m);
  S.ball = { m, x: 0, y: 0, z: 0.22, vx: 0, vy: 0, vz: 0, cx: 0, cy: 0, on: false, last: null, cool: 0 };
  for (let i = 0; i < 3; i++) {
    const k = spawn({ kind: 'fan', height: 0.84, top: 'jersey', c1: i === 1 ? '#f6f3ee' : '#f59ac4', c2: '#141116', number: String([10, 7, 9][i]), back: ['TOTÒ', 'PEPPE', 'NINO'][i], bottom: 'shorts', bottomColor: '#141116', hair: G.pick(['buzz', 'curly', 'short']), facial: 'none', hat: 'none', glasses: 'none', bag: 'none', wrinkles: false, build: 'slim' }, 0, 0, 'vkid', { custom: 'kid:' + i, behaviour: 'vkid', temp: false, kid: i });
    k.mesh.visible = false; S.kids.push(k);
  }
}
function pitchFor(x, y) {
  let best = null, bd = 150;
  for (const a of G.areas) {
    if (a.k !== 's' && a.k !== 'g') continue;
    const c = a.c || (a.c = G.centroid(a.pts)); if (c[2] < 500) continue;
    const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd && d > 18) { P.x = c[0]; P.y = c[1]; if (G.resolve(P, 3).hit) continue; bd = d; best = c; }
  }
  return best;
}
function updateBall(dt) {
  const b = S.ball, pl = G.player; if (!b) return;
  if (!b.on) { b.m.visible = false; for (const k of S.kids) k.mesh.visible = false; }
  if (!b.on || Math.hypot(b.cx - pl.x, b.cy - pl.y) > 190) {
    b.seekT = (b.seekT || 0) - dt; if (b.seekT > 0) return; b.seekT = 4;
    const c = pitchFor(pl.x, pl.y); if (!c) { if (b.on) { b.on = false; b.m.visible = false; for (const k of S.kids) k.mesh.visible = false; } return; }
    b.on = true; b.cx = c[0]; b.cy = c[1]; b.x = c[0]; b.y = c[1]; b.vx = b.vy = 0; b.m.visible = true;
    S.kids.forEach((k, i) => { const a = i / 3 * Math.PI * 2; k.x = c[0] + Math.cos(a) * 4.5; k.y = c[1] + Math.sin(a) * 4.5; k.home = [k.x, k.y]; k.state = 'vkid'; });
  }
  // ball
  b.cool -= dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= 18 * dt;
  if (b.z < 0.22) { b.z = 0.22; b.vz = b.vz < -2 ? -b.vz * 0.45 : 0; const f = Math.pow(0.35, dt); b.vx *= f; b.vy *= f; }
  P.x = b.x; P.y = b.y; const r = G.resolve(P, 0.25);
  if (r.hit) { const vn = b.vx * r.nx + b.vy * r.ny; if (vn < 0) { b.vx -= 1.7 * vn * r.nx; b.vy -= 1.7 * vn * r.ny; } b.x = P.x; b.y = P.y; }
  const sp = Math.hypot(b.vx, b.vy);
  b.m.position.set(b.x, b.z, -b.y); b.m.rotation.x += sp * dt * 3; b.m.rotation.z += sp * dt * 2;
  // you can join in: walk or drive into it
  const pd = Math.hypot(b.x - pl.x, b.y - pl.y), ps = pl.vespa ? Math.abs(pl.vespa.speed) : pl.speed;
  if (pd < (pl.vespa ? 1.3 : 0.6) && b.z < 1 && ps > 0.8 && !pl.fly) { const a = pl.a; b.vx = Math.cos(a) * (ps * 1.5 + 3); b.vy = Math.sin(a) * (ps * 1.5 + 3); b.vz = 2 + ps * 0.3; b.last = 'you'; if (b.cool <= 0) { b.cool = 3; talk(S.kids[0], G.pick(['Passa! Passa!', 'Tira! Tira!', 'Bravu, picciò!']), 1100); } G.sfx.boing(0.25); }
  // it hits a passer-by: the eternal argument
  if (sp > 4 && b.z < 1.6) for (const q of G.peds) if (q.state === 'walk' && !q.kid && Math.hypot(q.x - b.x, q.y - b.y) < 0.5) { b.vx *= -0.4; b.vy *= -0.4; if (G.setReact(q, 'argue', 3, b.cx, b.cy)) talk(q, G.pick(['U palluni! Vi lu tagghiu!', 'Iti a ghiucari a n\'atra banna!', 'Me, picciotti!']), 1800); break; }
  // the kids
  let chaser = null, cd = 1e9;
  for (const k of S.kids) { if (k.state !== 'vkid') continue; const d = Math.hypot(k.x - b.x, k.y - b.y); if (d < cd && k !== b.lastKid) { cd = d; chaser = k; } }
  const far = Math.hypot(b.x - b.cx, b.y - b.cy) > 16;
  for (const k of S.kids) {
    k.mesh.visible = b.on && dist(k, pl) < 150;
    if (k.state !== 'vkid') continue;
    if (k === chaser && (sp < 2.5 || far)) {
      const d = go(k, b.x, b.y, dt, 4.4);
      if (d < 0.7 && b.z < 0.6) {
        const others = S.kids.filter((o) => o !== k && o.state === 'vkid'), to = far || !others.length ? { x: b.cx, y: b.cy } : G.pick(others);
        const a = Math.atan2(to.y - b.y, to.x - b.x) + G.rand(-0.25, 0.25), v = G.rand(6.5, 9.5);
        b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.vz = Math.random() < 0.3 ? 4 : 1; b.lastKid = k;
        if (heard(k)) G.sfx.boing(0.18);
        if (Math.random() < 0.12) talk(k, G.pick(['Goool!', 'Passa!', 'Miiii chi tiru!', 'Fallo!']), 1000);
      }
      draw(k, 'idle', dt);
    } else {
      if (Math.hypot(k.x - k.home[0], k.y - k.home[1]) > 5) go(k, k.home[0], k.home[1], dt, 2.6); else face(k, b.x, b.y, dt);
      draw(k, sp > 5 ? 'cheer' : 'idle', dt);
    }
  }
}
// weapons and thrown things can hit the ball and scatter the pigeons
export function hitAt(x, y, r, a, power, z = 1) {
  let n = 0; const b = S.ball;
  if (b && b.on && Math.hypot(b.x - x, b.y - y) < r + 0.4 && z < 2) { b.vx = Math.cos(a) * power * 2.4; b.vy = Math.sin(a) * power * 2.4; b.vz = 5 + power * 0.4; n++; }
  scare(x, y, r + 5);
  return n;
}

// ------------------------------------------------------------------ friends who walk together
function updatePairs(dt) {
  S.pairT -= dt; if (S.pairT > 0) return; S.pairT = 2.5;
  if (!S.pairs.length) { const pool = G.peds.filter((p) => !p.vip && !p.custom && !p.temp); for (let i = 0; i + 1 < pool.length && S.pairs.length < 9; i += 4) S.pairs.push([pool[i], pool[i + 1]]); }
  for (const [a, b] of S.pairs) {
    if (a.state !== 'walk' || b.state !== 'walk' || a.convo || b.convo) continue;
    if (b.road !== a.road || Math.abs(b.s - a.s) > 1.5 || b.dir !== a.dir) {
      if (dist(a, b) > 22 && dist(b, G.player) < 60 && dist(a, G.player) < 60) continue; // don't teleport in plain sight
      b.road = a.road; b.s = a.s; b.dir = a.dir; b.speed = a.speed; b.off = G.clamp(a.off + 0.95, -2, 2); if (Math.abs(b.off - a.off) < 0.6) b.off = a.off - 0.95;
    }
    a.chatCool = Math.max(a.chatCool || 0, 6); b.chatCool = Math.max(b.chatCool || 0, 6);
    if (Math.random() < 0.12 && heard(a)) talk(Math.random() < 0.5 ? a : b, G.pick(['…e iddu chi ti dissi?', 'Amunì, ca è tardu.', 'Stasira pizza?', 'Me matri mi chiamò tri voti.', 'Ma u viristi u derby?', 'Chi caudu, mizzica.', 'Ti pigghi un cafè?']), 1500);
  }
}

// ------------------------------------------------------------------ pigeons
function setupBirds() {
  const T = G.THREE, g = G.vcGeo([[new T.BoxGeometry(0.2, 0.12, 0.1), '#8d939c', G.T(0, 0.1, 0)], [new T.BoxGeometry(0.07, 0.08, 0.07), '#5d6670', G.T(0.11, 0.18, 0)], [new T.BoxGeometry(0.1, 0.02, 0.34), '#a9afb8', G.T(-0.02, 0.15, 0)]]);
  S.birdIM = new T.InstancedMesh(g, G.vcMat, 54); S.birdIM.frustumCulled = false; S.birdIM.count = 0; G.scene.add(S.birdIM);
  for (let f = 0; f < 3; f++) { const fl = { x: 0, y: 0, on: false, birds: [] }; for (let i = 0; i < 18; i++) fl.birds.push({ x: 0, y: 0, z: 0, a: G.rand(0, 6.28), fly: 0, vx: 0, vy: 0, hop: G.rand(0, 3) }); S.flocks.push(fl); }
}
function scare(x, y, r) { for (const fl of S.flocks) if (fl.on && Math.hypot(fl.x - x, fl.y - y) < r + 4) for (const b of fl.birds) if (b.fly <= 0 && Math.hypot(b.x - x, b.y - y) < r) { const a = Math.atan2(b.y - y, b.x - x) + G.rand(-0.6, 0.6); b.fly = G.rand(2.6, 4.2); b.vx = Math.cos(a) * G.rand(4, 7); b.vy = Math.sin(a) * G.rand(4, 7); b.a = a; } }
function updateBirds(dt) {
  const pl = G.player, d = G.dummy; let n = 0;
  S.birdT = (S.birdT || 0) - dt;
  if (S.birdT <= 0) {
    S.birdT = 3;
    for (const fl of S.flocks) {
      if (fl.on && Math.hypot(fl.x - pl.x, fl.y - pl.y) < 130) continue;
      fl.on = false;
      let best = null, bd = 120;
      for (const a of G.areas) {
        if (a.k === 'w') continue;
        const c = a.c || (a.c = G.centroid(a.pts)), dd = Math.hypot(c[0] - pl.x, c[1] - pl.y);
        if (c[2] < 150 || dd > bd || dd < 14 || S.flocks.some((o) => o.on && Math.hypot(o.x - c[0], o.y - c[1]) < 20)) continue;
        bd = dd; best = c;
      }
      if (best) {
        fl.on = true; fl.x = best[0]; fl.y = best[1];
        for (const b of fl.birds) { b.x = best[0] + G.rand(-4, 4); b.y = best[1] + G.rand(-4, 4); b.z = 0; b.fly = 0; }
      }
    }
  }
  const ps = pl.vespa ? Math.abs(pl.vespa.speed) : pl.speed;
  for (const fl of S.flocks) {
    if (!fl.on) continue;
    if (ps > 1 && Math.hypot(fl.x - pl.x, fl.y - pl.y) < 12) scare(pl.x, pl.y, pl.vespa ? 6 : 2.6);
    for (const b of fl.birds) {
      if (b.fly > 0) {
        b.fly -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
        b.z = Math.max(0, b.z + (b.fly > 1.1 ? 5 : -6) * dt);
        if (b.fly <= 0 || (b.fly < 1.1 && b.z <= 0)) { b.fly = 0; b.z = 0; if (Math.hypot(b.x - fl.x, b.y - fl.y) > 9) { b.x = fl.x + G.rand(-4, 4); b.y = fl.y + G.rand(-4, 4); } }
      } else { b.hop -= dt; if (b.hop <= 0) { b.hop = G.rand(0.6, 3); b.a += G.rand(-1.4, 1.4); b.x += Math.cos(b.a) * 0.25; b.y += Math.sin(b.a) * 0.25; } }
      d.position.set(b.x, 0.1 + b.z + (b.fly > 0 ? 0 : Math.max(0, Math.sin(b.hop * 9)) * 0.03), -b.y); d.rotation.set(0, b.a, b.fly > 0 ? Math.sin(S.t * 26 + b.hop) * 0.5 : 0); d.scale.setScalar(1); d.updateMatrix();
      S.birdIM.setMatrixAt(n++, d.matrix);
    }
  }
  S.birdIM.count = n; S.birdIM.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ wiring
export function init(game, caos) {
  G = game; C = caos;
  spawnVigili(); setupBall(); setupBirds();
}
export function reset() {
  if (S.brawl) endBrawl(); if (S.thief) endThief(false); if (S.jam) endJam();
  S.grudges.length = 0; S.snitch = null;
  for (const c of S.cust) { if (c.v.busy === c.p) c.v.busy = null; } S.cust.length = 0;
  for (const p of G.peds) if (typeof p.state === 'string' && /^v(fight|snitch|brawl|chase|buy|jam)$/.test(p.state)) G.afterSocial(p);
}
export const debug = { S, startBrawl, startThief, startJam };
export function update(dt) {
  S.t += dt; S.tgT -= dt;
  updateGrudges(dt);
  updateBrawl(dt);
  updateVigili(dt);
  updateThief(dt);
  updateMarket(dt);
  updateJam(dt);
  updateBall(dt);
  updatePairs(dt);
  updateBirds(dt);
}
