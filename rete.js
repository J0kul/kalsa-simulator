// rete.js — multiplayer. Everyone who has the game open at the same time shares the streets:
// you see each other walk, ride and drive, read each other's names, hit each other and throw things.
// It rides on the page's live "room": each player publishes one small presence object (where they are, what they
// look like, what they just did) and reads everybody else's. The city's own people and traffic stay local to each player.
let G = null, C = null, room = null, user = null, me = null;
const R = new Map();           // peer label -> remote player
const SHOUTS = ['Amunì!', 'Unni sì?', 'Veni ccà!', 'Minchia!', 'Forza Palermo!', 'Talìa!', 'Ti salutu!', 'Pigghialu!'];
const S = { sendT: 0, lookStr: '', lookSent: '', hitN: 0, shN: 0, sayN: 0, atkN: 0, chip: null, tags: null, names: new Map(), nameT: 0, joinI: 0, ramT: new Map(), online: false, P: { x: 0, y: 0 } };
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const r2 = (v) => Math.round(v * 100) / 100;

export async function init(game, caos) {
  G = game; C = caos;
  const css = document.createElement('style');
  css.textContent = `
#net { top: calc(212px + env(safe-area-inset-top, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); width: 168px; display: grid; gap: 4px; justify-items: center; text-align: center; }
#net b { font: 800 11px/1 var(--f-ui); letter-spacing: .1em; text-transform: uppercase; background: var(--ink-soft); color: var(--marmo); border-radius: 999px; padding: 6px 10px; display: inline-flex; gap: 6px; align-items: center; }
#net b i { width: 8px; height: 8px; border-radius: 50%; background: #6fbf73; }
#net.solo b i { background: #8a8d92; }
#net small { font-size: 10px; color: var(--marmo); opacity: .8; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
#netTags { inset: 0; }
.ptag { position: absolute; transform: translate(-50%, -100%); background: #6fd3ff; color: var(--nero); font: 800 12px/1 var(--f-ui); padding: 4px 8px; border-radius: 999px; border: 2px solid var(--nero); white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,.3); display: flex; gap: 6px; align-items: center; }
.ptag s { text-decoration: none; color: #b8860b; letter-spacing: .05em; }
.ptag u { text-decoration: none; display: inline-block; width: 34px; height: 5px; border-radius: 3px; background: rgba(20,17,22,.25); overflow: hidden; }
.ptag u i { display: block; height: 100%; background: #2f8a55; }
@media (max-width: 640px) { #net { top: calc(190px + env(safe-area-inset-top, 0px)); width: 112px; } #net small { display: none; } }`;
  document.head.appendChild(css);
  S.chip = document.createElement('div'); S.chip.id = 'net'; S.chip.className = 'hud solo'; S.chip.hidden = true;
  S.chip.innerHTML = '<b><i></i><span></span></b><small></small>';
  S.tags = document.createElement('div'); S.tags.id = 'netTags'; S.tags.className = 'hud';
  document.body.append(S.chip, S.tags);
  try { if (window.claude && typeof window.claude.use === 'function') [room, user] = await Promise.all([window.claude.use('room'), window.claude.use('user')]); } catch (e) { room = null; }
  if (!room) { S.solo = true; chip(); return false; }   // this view cannot join the live room: the game stays single-player, and says so
  S.online = true;
  room.onPeers((ch) => {
    for (const p of ch.left) drop(p.peer, true);
    for (const p of ch.peers) {
      if (p.isMe && p.sameTab) { me = p.peer; continue; }
      if (p.kind !== 'viewer') continue;
      take(p);
    }
    for (const p of ch.joined) if (!(p.isMe && p.sameTab) && p.kind === 'viewer' && G.game.started) G.toast('Someone joined', 'press J to go to them', 1800);
    chip();
  }, (e) => { S.online = false; S.solo = true; S.why = e && e.code; for (const k of [...R.keys()]) drop(k); chip(); });
  addEventListener('keydown', (e) => {
    if (!G.game.started || G.game.paused || e.repeat || !document.getElementById('menu').hidden) return;
    const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'KeyJ') joinNext();
    else if (e.code === 'KeyV') shout();
    else if (e.code === 'KeyH') horn();
  });
  chip();
  return true;
}
export const list = () => [...R.values()].filter((r) => r.ready);
// the players other people can hit (caos.js walks this list along with pedestrians and police)
export const targets = () => [...R.values()].filter((r) => r.ready && r.st !== 'ko' && r.st !== 'fly' && !(r.k && G.VSPEC[r.k] && G.VSPEC[r.k].car));

function chip() {
  if (!S.chip) return;
  const n = list().length;
  S.chip.hidden = !G.game.started || (!S.online && !S.solo);
  S.chip.classList.toggle('solo', n === 0);
  if (!S.online) {
    S.chip.querySelector('span').textContent = 'Single-player';
    S.chip.querySelector('small').textContent = 'cannot reach the multiplayer server right now';
    return;
  }
  S.chip.querySelector('span').textContent = n ? `${n + 1} players online` : 'Online · just you';
  S.chip.querySelector('small').innerHTML = n ? '<kbd>J</kbd> go to a player · <kbd>V</kbd> shout' : 'send friends this page\'s link to play together';
}
function drop(peer, said) {
  const r = R.get(peer); if (!r) return;
  if (r.mesh) G.scene.remove(r.mesh); if (r.veh) G.scene.remove(r.veh); if (r.tag) r.tag.remove();
  R.delete(peer);
  if (said && r.ready && G.game.started) G.toast(nameOf(r) + ' left', '', 1200);
}
const nameOf = (r) => (r.by && S.names.get(r.by)) || 'Picciotto ' + (r.n || '?');

// ---- reading what another player published. Everything in it is untrusted: numbers are clamped, text never comes from them.
function take(p) {
  const d = p.presence || {};
  if (d.v !== 1 || typeof d.x !== 'number') return;
  let r = R.get(p.peer);
  if (!r) {
    r = { peer: p.peer, by: p.by, n: R.size + 2, ready: false, x: num(d.x), y: num(d.y), z: 0, a: 0, phase: 0, lookStr: null, mesh: null, veh: null, vk: null, vc: null, hitN: null, shN: null, sayN: null, atkN: null, atkT: 0, hp: 100, lastHit: 0 };
    r.tag = document.createElement('div'); r.tag.className = 'ptag'; r.tag.hidden = true; r.tag.innerHTML = '<span></span><s></s><u><i></i></u>'; S.tags.appendChild(r.tag);
    R.set(p.peer, r);
  }
  r.tx = G.clamp(num(d.x), -9000, 9000); r.ty = G.clamp(num(d.y), -9000, 9000); r.tz = G.clamp(num(d.z), 0, 60); r.ta = num(d.a);
  r.sp = G.clamp(num(d.s), 0, 40); r.st = typeof d.st === 'string' ? d.st.slice(0, 8) : '';
  r.k = typeof d.k === 'string' && G.VSPEC[d.k] ? d.k : null; r.c = typeof d.c === 'string' && /^#[0-9a-f]{6}$/i.test(d.c) ? d.c : '#f59ac4';
  { const q = d.rc; r.rc = q && typeof q === 'object' && typeof q.g === 'string' && /^[a-z0-9]{4,12}$/.test(q.g) && ['w', 'r', 'f'].includes(q.s)
      ? { g: q.g, s: q.s, w: G.clamp(num(q.w), 0, 10), l: G.clamp(num(q.l) | 0, 0, 9), c: G.clamp(num(q.c) | 0, 0, 40), ft: G.clamp(num(q.ft), 0, 3600) } : null; }
  r.h = num(d.h); r.hp = G.clamp(num(d.hp, 100), 0, 100); r.heat = G.clamp(num(d.heat) | 0, 0, 5); r.w = typeof d.w === 'string' ? d.w.slice(0, 12) : '';
  if (typeof d.look === 'string' && d.look !== r.lookStr && d.look.length < 3000) {
    r.lookStr = d.look;
    let L = null; try { L = G.fullLook(JSON.parse(d.look)); } catch (e) { L = G.randomLook(); }
    if (L) { for (const k in L) if (typeof L[k] === 'string') L[k] = L[k].replace(/[^\w #.àèéìòù'-]/gi, '').slice(0, 24); L.lines = []; }
    const old = r.mesh; try { r.mesh = G.makePerson(L || G.randomLook()); } catch (e) { r.mesh = G.makePerson(G.randomLook()); }
    G.scene.add(r.mesh); if (old) G.scene.remove(old);
  }
  if (!r.mesh) { r.mesh = G.makePerson(G.randomLook()); G.scene.add(r.mesh); }
  if (!r.ready) { r.ready = true; r.x = r.tx; r.y = r.ty; r.a = r.ta; }
  // moments: a counter that moved means something just happened
  const ev = (key, cur) => { const n = cur && typeof cur.n === 'number' ? cur.n : null; const was = r[key]; r[key] = n; return was !== null && n !== null && n !== was; };
  if (ev('hitN', d.hit) && d.hit.to === me) gotHit(r, d.hit);
  if (ev('shN', d.sh)) remoteShot(r, d.sh);
  if (ev('sayN', d.say)) { const i = num(d.say.i) | 0; if (i === -1) { if (near(r, 60)) G.sfx.carHorn(); } else if (SHOUTS[i] && near(r, 60) && r.mesh) G.say(r.mesh, SHOUTS[i], 1800); }
  const an = num(d.atk, -1); if (r.atkN !== null && an !== r.atkN) r.atkT = 0.3; r.atkN = an;
}
const near = (r, d) => Math.hypot(r.x - G.player.x, r.y - G.player.y) < d;

// ---- being hit by another player
function gotHit(r, h) {
  const now = G.clock.elapsedTime, pl = G.player;
  if (now - r.lastHit < 0.25 || pl.cuffed || pl.ko || pl.inCar) return;
  r.lastHit = now;
  const fx = num(h.x, r.x), fy = num(h.y, r.y);
  if (Math.hypot(fx - pl.x, fy - pl.y) > 40) return;            // they are nowhere near: ignore
  const p = G.clamp(num(h.p, 4), 1, 12), dmg = G.clamp(num(h.d, 1), 0, 4);
  if (pl.vespa && pl.vespa.spec.car && p < 9) return;           // safe inside a car, unless it was the swordfish
  C.hurt(6 + dmg * 7, fx, fy);
  if (!pl.ko) G.launchPlayer(fx, fy, Math.max(3.5, p * 0.75), true);
  G.sfx.thud();
}
export function hit(r, fx, fy, power, dmg) {
  if (!room || !r) return;
  room.presence({ hit: { n: ++S.hitN, to: r.peer, x: r2(fx), y: r2(fy), p: r2(power), d: dmg } }).catch(() => {});
  if (r.mesh) G.say(r.mesh, G.pick(['Ahia!', 'Oh!', 'Minchia!']), 700);
}
export function shotFired(s) {
  if (!room) return;
  room.presence({ sh: { n: ++S.shN, x: r2(s.x), y: r2(s.y), z: r2(s.z), vx: r2(s.vx), vy: r2(s.vy), vz: r2(s.vz), w: s.w.id } }).catch(() => {});
}
// somebody else's arancina in the air: just the picture, the thrower's game decides what it hits
const fly = [];
function remoteShot(r, d) {
  if (!near(r, 90) || fly.length > 24) return;
  const T = G.THREE, m = new T.Mesh(new T.IcosahedronGeometry(d.w === 'arancine' ? 0.15 : 0.11, 1), G.M(d.w === 'arancine' ? '#e3902f' : '#c0457a'));
  G.scene.add(m);
  fly.push({ m, x: num(d.x, r.x), y: num(d.y, r.y), z: G.clamp(num(d.z, 1.5), 0, 30), vx: G.clamp(num(d.vx), -40, 40), vy: G.clamp(num(d.vy), -40, 40), vz: G.clamp(num(d.vz), -20, 20), t: 0 });
}
function shout() {
  if (!room) return;
  const i = (S.shoutI = (S.shoutI || 0) + 1) % SHOUTS.length;
  G.say(G.player.mesh, SHOUTS[i], 1800);
  room.presence({ say: { n: ++S.sayN, i } }).catch(() => {});
}
export function horn() { if (room) room.presence({ say: { n: ++S.sayN, i: -1 } }).catch(() => {}); }
function joinNext() {
  const L = list(), pl = G.player; if (!L.length) { G.toast('Nobody else is online', 'send friends this page\'s link', 1800); return; }
  if (pl.cuffed || pl.ko || pl.fly || G.police.wanted) { G.toast('Not now', G.police.wanted ? 'lose the police first' : '', 1300); return; }
  const r = L[S.joinI++ % L.length];
  if (pl.vespa) G.dismount(true);
  S.P.x = r.x + Math.cos(r.a + 2.4) * 2.2; S.P.y = r.y + Math.sin(r.a + 2.4) * 2.2; G.resolve(S.P, 0.45);
  pl.x = S.P.x; pl.y = S.P.y; pl.a = Math.atan2(r.y - pl.y, r.x - pl.x); G.cam.yaw = pl.a;
  G.toast(nameOf(r), G.nearestStreetName(pl.x, pl.y) || 'Palermo', 1800);
}
// the big map and the minimap ask where everybody is
export function mapDots(fn) { for (const r of list()) fn(r, nameOf(r)); }

// ---- per frame
export function update(dt) {
  if (!room) { if (S.chip && S.solo && S.chip.hidden === G.game.started) chip(); return; }
  const pl = G.player, now = G.clock.elapsedTime, v = pl.vespa;
  if (S.chip.hidden === ((S.online || S.solo) && G.game.started)) chip();
  // publish myself, about 12 times a second
  S.sendT -= dt;
  if (S.sendT <= 0) {
    S.sendT = 0.08;
    const patch = { v: 1, x: r2(v ? v.x : pl.x), y: r2(v ? v.y : pl.y), z: r2(pl.fly ? pl.mesh.position.y : pl.z || 0), a: r2(v ? v.heading : pl.a), s: r2(v ? Math.abs(v.speed) : pl.speed),
      st: pl.ko ? 'ko' : pl.cuffed ? 'cuffed' : pl.fly ? 'fly' : '', k: v ? v.kind : null, c: v && v.col ? '#' + (v.col.getHexString ? v.col.getHexString() : 'f59ac4') : null, h: v ? r2(v.heading) : null,
      hp: Math.round(C.state.hp), heat: G.police.wanted ? G.police.heat : 0, w: C.WEAPONS[C.state.weapon].id, atk: S.atkN };
    const L = pl.mesh.userData.look;
    if (L && L !== S.lookObj) { S.lookObj = L; try { S.lookStr = JSON.stringify({ ...L, lines: undefined }); } catch (e) { S.lookStr = ''; } if (S.lookStr.length > 2800) S.lookStr = ''; }
    if (S.lookStr !== S.lookSent) { patch.look = S.lookStr; S.lookSent = S.lookStr; }
    if (S.rc !== S.rcSent) { patch.rc = S.rc; S.rcSent = S.rc; }
    room.presence(patch).catch(() => {});
  }
  // names, as this viewer is allowed to see them
  S.nameT -= dt;
  if (S.nameT <= 0 && user && user.profiles) {
    S.nameT = 4;
    const ids = [...new Set(list().map((r) => r.by).filter((id) => id && !S.names.has(id)))];
    if (ids.length) user.profiles(ids).then((ps) => { for (const id of ids) { const nm = ((ps && ps[id] && ps[id].name) || '').split(' ')[0].slice(0, 18); if (nm) S.names.set(id, nm); } }).catch(() => {});
  }
  // draw everybody else
  for (const r of R.values()) {
    if (!r.ready || !r.mesh) continue;
    const d = Math.hypot(r.tx - r.x, r.ty - r.y), k = d > 30 ? 1 : Math.min(1, dt * 11);
    r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * Math.min(1, dt * 12); r.a += G.angDiff(r.a, r.ta) * Math.min(1, dt * 12);
    const dist = Math.hypot(r.x - pl.x, r.y - pl.y), vis = dist < 260;
    const spec = r.k ? G.VSPEC[r.k] : null;
    // their vehicle
    if (r.k !== r.vk || (r.k && r.c !== r.vc)) { if (r.veh) G.scene.remove(r.veh); r.veh = null; r.vk = r.k; r.vc = r.c; if (r.k) { try { r.veh = G.makeVehicleMesh(r.k, new G.THREE.Color(r.c)); G.scene.add(r.veh); } catch (e) { r.veh = null; } } }
    if (r.veh) { r.veh.visible = vis; r.veh.position.set(r.x, 0.09, -r.y); r.veh.rotation.set(0, r.a, 0); }
    const m = r.mesh, u = m.userData;
    m.visible = vis && !(spec && spec.car);
    if (m.visible) {
      if (r.st === 'ko') { m.position.set(r.x, 0.3, -r.y); m.rotation.set(-Math.PI / 2, r.a, 0); }
      else if (spec) {
        m.position.set(r.x - Math.cos(r.a) * spec.seatBack, spec.seatY + 0.09, -(r.y - Math.sin(r.a) * spec.seatBack)); m.rotation.set(0, r.a + Math.PI / 2, 0);
        G.animatePerson(m, 0, 0); u.legL.rotation.x = -1.25; u.legR.rotation.x = -1.25; u.armL.rotation.x = -1.2; u.armR.rotation.x = -1.2;
      } else {
        m.position.set(r.x, 0.09 + r.z, -r.y); m.rotation.set(r.st === 'fly' ? now * 7 : 0, r.a + Math.PI / 2, 0);
        r.phase += r.sp * dt * 2.5;
        if (r.st === 'cuffed') G.posePerson(m, 'cuffed', now, 0); else G.animatePerson(m, r.phase, r.sp > 5.5 ? 0.85 : r.sp > 0.4 ? 0.5 : 0);
      }
      if (r.atkT > 0) { r.atkT -= dt; const q = 1 - Math.max(0, r.atkT) / 0.3; u.armR.rotation.x = -2.9 + q * 2.6; u.posed = true; }
    }
    // name tag with health and stars
    const pos = vis && dist < 120 ? G.project(r.x, r.y, (spec && spec.car ? 2.3 : 2.25) + r.z) : null;
    r.tag.hidden = !pos || !G.game.started;
    if (pos) {
      r.tag.style.left = pos[0] + 'px'; r.tag.style.top = pos[1] + 'px';
      const txt = nameOf(r), stars = '★'.repeat(r.heat);
      if (r.tagTxt !== txt) { r.tagTxt = txt; r.tag.children[0].textContent = txt; }
      if (r.tagSt !== stars) { r.tagSt = stars; r.tag.children[1].textContent = stars; }
      if (r.tagHp !== r.hp) { r.tagHp = r.hp; r.tag.children[2].firstChild.style.width = r.hp + '%'; }
    }
    // run them over and they feel it
    if (v && Math.abs(v.speed) > 4.5 && !spec && r.st !== 'ko' && r.st !== 'fly' && dist < (v.spec.hitR || 1.3) && now - (S.ramT.get(r.peer) || 0) > 1.2) {
      S.ramT.set(r.peer, now); hit(r, v.x, v.y, Math.min(11, 3 + Math.abs(v.speed) * 0.45), 2); G.sfx.thud(); v.speed *= 0.6;
    }
    // on foot you cannot walk through each other
    if (!v && !spec && !pl.fly && r.st !== 'ko' && dist < 0.62 && dist > 1e-3) { pl.x = r.x + (pl.x - r.x) / dist * 0.62; pl.y = r.y + (pl.y - r.y) / dist * 0.62; }
  }
  for (let i = fly.length - 1; i >= 0; i--) {
    const s = fly[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vz -= 20 * dt;
    if (s.z < 0.15 || s.t > 4 || G.rayWalls(s.x - s.vx * dt, s.y - s.vy * dt, s.z, s.x, s.y, s.z) < 1) { G.scene.remove(s.m); fly.splice(i, 1); continue; }
    s.m.position.set(s.x, s.z, -s.y);
  }
}
export function attacked() { S.atkN++; }
// the race (corsa.js) publishes its state through my presence and reads everyone else's
export function setRace(o) { S.rc = o; }
export const racers = () => list().filter((r) => r.rc);
export const myPeer = () => me;
export { nameOf };
export const debug = { R, S, take, state: () => ({ online: S.online, me, peers: R.size }) };
