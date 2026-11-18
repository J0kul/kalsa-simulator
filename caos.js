// caos.js — fists and absurd Palermo weapons, health, witnesses who call 112, a five-star wanted level with a helicopter
let G = null, V = null;
export const WEAPONS = [
  { id: 'pugni', name: 'Pugni', en: 'fists', melee: true, reach: 1.55, arc: 1.15, power: 4.2, dmg: 1, cd: 0.36 },
  { id: 'pane', name: 'Pane duro', en: 'a rock-hard loaf', melee: true, reach: 1.95, arc: 1.2, power: 6.4, dmg: 1.5, cd: 0.34, price: 2, shop: ['bakery', 'pastry', 'pane'], tip: 'three days old, harder than tufa' },
  { id: 'spada', name: 'Pesce spada', en: 'a frozen swordfish', melee: true, reach: 3.0, arc: 1.55, power: 11.5, dmg: 3, cd: 0.78, price: 18, shop: ['seafood', 'pesce'], cars: true, tip: 'frozen solid · sends cars flying' },
  { id: 'arancine', name: 'Arancine', en: 'arancine', thrown: true, speed: 19, power: 7, dmg: 2, cd: 0.42, pack: 6, price: 9, shop: ['fast_food', 'frittura', 'deli'], tip: 'throw them, or press G to eat one' },
  { id: 'fichi', name: 'Fichi d\'India', en: 'prickly pears', thrown: true, speed: 17, power: 2, dmg: 0.5, cd: 0.28, pack: 8, price: 4, shop: ['greengrocer', 'frutta', 'verdura'], hop: true, tip: 'full of spines · makes people dance' },
  { id: 'verdura', name: 'Broccoli', en: 'broccoli', thrown: true, speed: 18, power: 3, dmg: 0.5, cd: 0.3, pack: 12, tip: 'from the police · Giorgio hates vegetables' },
  { id: 'gazzosa', name: 'Gazzosa', en: 'a shaken gazzosa', spray: true, range: 7.5, power: 5, cd: 0.07, pack: 60, price: 3, shop: ['bar', 'cafe', 'pub', 'beverages', 'convenience', 'alcohol', 'general'], tip: 'hold F to spray' },
];
export const state = { hp: 100, weapon: 0, ammo: {}, owned: new Set(['pugni']), cd: 0, atkT: 0, atkKind: '', combo: 0, comboT: 0, lastHurt: -99, koT: 0, hits: 0, heli: null, heliOn: false, cover: false, coverT: 0, vend: null, vendT: 0, mouseHeld: false, punched: 0 };
const cur = () => WEAPONS[state.weapon];
const P = { x: 0, y: 0 };
let hud, bar, wepEl, ammoEl, comboEl, koEl, hurtEl, vendList = [], parts, partList = [], shots = [], handMesh = null, handFor = -1, geos = {};

export function init(game, vita) {
  G = game; V = vita;
  const T = G.THREE, { vcGeo, T: M4 } = G;
  // ---- HUD
  const css = document.createElement('style');
  css.textContent = `
#caos { right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(86px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 6px; justify-items: end; }
#caos .hp { width: 190px; height: 12px; background: rgba(20,17,22,.72); border: 2px solid var(--marmo); border-radius: 999px; overflow: hidden; }
#caos .hp i { display: block; height: 100%; width: 100%; background: #6fbf73; transition: width .15s, background .3s; }
#caos .wep { background: var(--marmo); color: var(--nero); border: 2px solid var(--nero); border-radius: 8px; padding: 5px 10px 4px; display: flex; gap: 10px; align-items: baseline; box-shadow: 0 3px 10px rgba(0,0,0,.3); }
#caos .wep b { font-family: var(--f-display); font-weight: 400; font-size: 22px; line-height: 1; }
#caos .wep span { font: 800 12px/1 var(--f-ui); font-variant-numeric: tabular-nums; color: var(--rosa-deep); }
#caos .keys2 { font-size: 10px; opacity: .85; }
#caos .combo { font: 800 13px/1 var(--f-ui); letter-spacing: .1em; background: var(--tg); color: var(--marmo); padding: 4px 8px; border-radius: 3px; }
#hurt { position: fixed; inset: 0; pointer-events: none; z-index: 9; opacity: 0; transition: opacity .5s; box-shadow: inset 0 0 120px 40px rgba(215,38,30,.75); }
#ko { position: fixed; inset: 0; z-index: 19; display: grid; place-items: center; background: rgba(20,17,22,.55); text-align: center; pointer-events: none; }
#ko b { font-family: var(--f-display); font-weight: 400; font-size: clamp(64px, 14vw, 140px); line-height: .9; color: var(--marmo); display: block; }
#ko small { font: 800 13px/1.4 var(--f-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--rosa); }
#tHit { right: max(170px, calc(env(safe-area-inset-right, 0px) + 148px)); bottom: calc(96px + env(safe-area-inset-bottom, 0px)); background: rgba(215,38,30,.85); color: #fff; }
#tWep { right: max(170px, calc(env(safe-area-inset-right, 0px) + 148px)); bottom: calc(30px + env(safe-area-inset-bottom, 0px)); width: 50px; height: 50px; background: rgba(251,248,242,.8); font-size: 11px; }
@media (max-width: 640px) { #caos { right: auto; left: max(16px, env(safe-area-inset-left, 0px)); bottom: auto; top: calc(96px + env(safe-area-inset-top, 0px)); justify-items: start; } #caos .hp { width: 130px; } #caos .keys2 { display: none; } #caos .wep b { font-size: 18px; } }`;
  document.head.appendChild(css);
  hud = document.createElement('div'); hud.id = 'caos'; hud.className = 'hud'; hud.hidden = true;
  hud.innerHTML = '<span class="combo" hidden></span><div class="hp" role="img" aria-label="Health"><i></i></div><div class="wep"><b></b><span></span></div><span class="keys2 caps shadow"><kbd>F</kbd> hit · <kbd>Q</kbd> swap · <kbd>G</kbd> eat</span>';
  document.body.appendChild(hud);
  bar = hud.querySelector('.hp i'); wepEl = hud.querySelector('.wep b'); ammoEl = hud.querySelector('.wep span'); comboEl = hud.querySelector('.combo');
  hurtEl = document.createElement('div'); hurtEl.id = 'hurt'; document.body.appendChild(hurtEl);
  koEl = document.createElement('div'); koEl.id = 'ko'; koEl.hidden = true; koEl.innerHTML = '<div><b>Svenuto</b><small></small></div>'; document.body.appendChild(koEl);
  const touch = document.getElementById('touch');
  if (touch) {
    const mk = (id, txt, fn) => { const d = document.createElement('div'); d.className = 'tbtn'; d.id = id; d.textContent = txt; d.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(true); }); d.addEventListener('pointerup', () => fn(false)); d.addEventListener('pointercancel', () => fn(false)); touch.appendChild(d); };
    mk('tHit', 'HIT', (on) => { state.mouseHeld = on; if (on) attack(); });
    mk('tWep', 'SWAP', (on) => { if (on) swap(1); });
  }
  // ---- input: F or a quick click hits, Q or the wheel-less number keys change weapon, G eats an arancina
  addEventListener('keydown', (e) => {
    if (!live() || e.repeat) return;
    const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'KeyF') attack();
    else if (e.code === 'KeyQ') swap(1);
    else if (e.code === 'KeyG') eat();
    else if (/^Digit[1-6]$/.test(e.code) && !G.talk.ped) pickWeapon(+e.code.slice(5) - 1);
  });
  let down = null;
  const cv = G.renderer.domElement;
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  cv.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 260 && live()) attack(); down = null; });
  // ---- things in the hand and in the air
  const Bx = (a, b, c) => new T.BoxGeometry(a, b, c), down90 = (x, y, z, sx = 1, sy = 1, sz = 1) => M4(x, y, z, sx, sy, sz);
  geos.pane = vcGeo([[Bx(0.13, 0.62, 0.13), '#c98a3d', down90(0, -0.3, 0)], [Bx(0.135, 0.06, 0.135), '#a8652a', down90(0, -0.14, 0)], [Bx(0.135, 0.06, 0.135), '#a8652a', down90(0, -0.34, 0)], [Bx(0.135, 0.06, 0.135), '#a8652a', down90(0, -0.52, 0)]]);
  geos.spada = vcGeo([[Bx(0.2, 1.25, 0.34), '#8fa3b5', down90(0, -0.7, 0)], [Bx(0.21, 1.25, 0.16), '#dfe7ec', down90(0, -0.7, 0.1)], [Bx(0.05, 0.95, 0.05), '#6f8496', down90(0, -1.78, 0.02)], [Bx(0.05, 0.3, 0.42), '#6f8496', down90(0, -0.4, -0.2)],
    [Bx(0.05, 0.14, 0.62), '#6f8496', down90(0, 0.02, 0)], [Bx(0.21, 0.07, 0.07), '#141116', down90(0, -1.2, 0.12)], [Bx(0.22, 0.2, 0.36), '#cfe3ee', down90(0, -0.9, 0)]]);
  geos.arancine = vcGeo([[new T.IcosahedronGeometry(0.13, 1), '#e3902f', M4(0, -0.08, 0.05)]]);
  geos.fichi = vcGeo([[new T.IcosahedronGeometry(0.1, 0), '#c0457a', M4(0, -0.08, 0.05, 1, 1.35, 1)], [Bx(0.03, 0.03, 0.03), '#e9e2c0', M4(0.06, -0.02, 0.1)]]);
  geos.gazzosa = vcGeo([[new T.CylinderGeometry(0.05, 0.055, 0.24, 8), '#cfe9d9', M4(0, -0.1, 0.05)], [new T.CylinderGeometry(0.02, 0.03, 0.09, 6), '#cfe9d9', M4(0, 0.06, 0.05)], [Bx(0.11, 0.09, 0.11), '#f7d23e', M4(0, -0.12, 0.05)]]);
  geos.shotA = new T.IcosahedronGeometry(0.15, 1); geos.shotF = new T.IcosahedronGeometry(0.11, 0); geos.shotV = new T.IcosahedronGeometry(0.17, 1);
  geos.verdura = vcGeo([[new T.IcosahedronGeometry(0.12, 1), '#3e8a57', M4(0, -0.02, 0.05, 1.1, 0.8, 1.1)], [new T.CylinderGeometry(0.03, 0.04, 0.14, 8), '#8fbf6a', M4(0, -0.12, 0.05)]]);
  parts = new T.InstancedMesh(Bx(0.09, 0.09, 0.09), new T.MeshStandardMaterial({ roughness: 0.8 }), 260);
  parts.count = 0; parts.frustumCulled = false; G.scene.add(parts);
  // ---- the helicopter that turns up at four stars
  {
    const body = vcGeo([[Bx(4.4, 1.9, 1.9), '#22409c', M4(0, 0, 0)], [Bx(1.6, 1.3, 1.7), '#9fc3d6', M4(1.9, 0.1, 0)], [Bx(4.6, 0.5, 0.5), '#22409c', M4(-4, 0.5, 0)], [Bx(0.3, 1.6, 0.12), '#f4f6f8', M4(-6.1, 1.1, 0)], [Bx(4.2, 0.12, 0.12), '#2b2d31', M4(0, -1.3, 0.9)], [Bx(4.2, 0.12, 0.12), '#2b2d31', M4(0, -1.3, -0.9)], [Bx(4.5, 0.5, 1.92), '#f4f6f8', M4(0, 0.2, 0)]]);
    const h = new T.Group(), b = new T.Mesh(body, G.vcMat), rot = new T.Mesh(Bx(11, 0.06, 0.4), G.M('#1d1d20'));
    rot.position.y = 1.25; h.add(b, rot);
    const beam = new T.Mesh(new T.ConeGeometry(9, 54, 16, 1, true), new T.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.13, depthWrite: false, side: T.DoubleSide }));
    beam.position.y = -27; h.add(beam);
    h.visible = false; G.scene.add(h); state.heli = { g: h, rot, a: 0, x: 0, y: 0 };
  }
  // ---- where things are sold: real shops by type, and the market stalls
  for (const s of G.shopSpots) { const w = WEAPONS.findIndex((q) => q.shop && q.shop.includes(s.kind)); if (w > 0) vendList.push({ x: s.x, y: s.y, w }); }
  for (const s of G.stalls || []) { const w = WEAPONS.findIndex((q) => q.shop && q.shop.includes(s.kind)); if (w > 0) vendList.push({ x: s.x + s.nx * 1.3, y: s.y + s.ny * 1.3, w, stall: s }); }
  renderHud();
}
const live = () => G && G.game.started && !G.game.paused && !G.player.cuffed && !G.player.inCar && !G.player.ko && document.getElementById('menu').hidden;

function renderHud() {
  if (!hud) return;
  const w = cur();
  bar.style.width = Math.max(0, state.hp) + '%'; bar.style.background = state.hp > 55 ? '#6fbf73' : state.hp > 25 ? '#f2c94c' : '#d7261e';
  wepEl.textContent = w.name; ammoEl.textContent = w.melee ? '' : '× ' + (state.ammo[w.id] || 0);
}
function pickWeapon(i) {
  const w = WEAPONS[i]; if (!w || !state.owned.has(w.id)) return;
  state.weapon = i; renderHud();
}
function swap(d) {
  for (let k = 1; k <= WEAPONS.length; k++) { const i = (state.weapon + d * k + WEAPONS.length) % WEAPONS.length; if (state.owned.has(WEAPONS[i].id)) { pickWeapon(i); G.sfx.pick(); return; } }
}
function eat() {
  if (!live() || !(state.ammo.arancine > 0) || state.hp >= 100) return;
  state.ammo.arancine--; state.hp = Math.min(100, state.hp + 30); G.sfx.pick(); G.say(G.player.mesh, G.pick(['Gnam!', 'Bona!', 'Cavura cavura!']), 1000); renderHud();
}
export function select(id) { const i = WEAPONS.findIndex((q) => q.id === id); if (i >= 0 && state.owned.has(id)) pickWeapon(i); }
export function give(id, n) { const w = WEAPONS.find((q) => q.id === id); if (!w) return; state.owned.add(id); if (!w.melee) state.ammo[id] = (state.ammo[id] || 0) + (n || w.pack); renderHud(); }

// ---- buying
function nearVend() {
  const p = G.player; let best = null, bd = 2.7;
  for (const v of vendList) { const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bd) { bd = d; best = v; } }
  return best;
}
export function hint() {
  if (!G || G.player.vespa || G.player.fly || !state.vend) return '';
  const w = WEAPONS[state.vend.w];
  if (w.melee && state.owned.has(w.id)) return '';
  return `${G.isTouch ? 'Tap' : 'Press'} <kbd>E</kbd> to buy ${w.melee ? w.name : w.pack + ' × ' + w.name} · ${G.fmtEur(w.price)}`;
}
export function interact() {
  if (G.player.vespa || !state.vend) return false;
  const v = state.vend, w = WEAPONS[v.w];
  if (w.melee && state.owned.has(w.id)) return false;
  if (G.wallet.eur + 1e-6 < w.price) { G.toast('Not enough money', `${w.name} costs ${G.fmtEur(w.price)}`, 1500); return true; }
  G.addMoney(-w.price); give(w.id); pickWeapon(v.w); G.sfx.kaching();
  G.toast(w.name, w.tip, 2200);
  if (V) V.vendorSay(v.x, v.y, G.pick(['Grazie! Bon appetitu!', 'Pi tia, prezzu d\'amicu!', 'Talìa chi robba!']));
  return true;
}

// ---- hitting things
function aimDir() {
  const p = G.player;
  return p.vespa ? p.vespa.heading : p.a;
}
function eachTarget(fn) {
  for (const p of G.peds) if (p.state !== 'fly' && p.state !== 'down' && p.mesh.visible) fn(p, 'ped');
  for (const u of G.police.units) for (const o of u.officers) if (o.mesh.visible && o.state !== 'car' && o.state !== 'fly' && o.state !== 'down') fn(o, 'cop');
  const t = G.police.thief; if (t && (t.state === 'run' || t.state === 'flee' || t.state === 'browse')) fn(t, 'thief');
  if (G.net) for (const r of G.net.targets()) fn(r, 'net');   // other players
  if (G.boss) for (const o of G.boss.targets()) fn(o, 'boss');
}
function strike(o, type, fx, fy, w, power) {
  if (type === 'ped') { o.hp = (o.hp == null ? (o.vigile ? 4 : 3) : o.hp) - w.dmg; G.player.striking = true; try { G.launchPed(o, fx, fy, power); } finally { G.player.striking = false; } if (w.hop && o.state === 'fly') o.hopAfter = true; }
  else if (type === 'cop') { if (G.knockWalker(o, fx, fy, power)) { G.say(o.mesh, G.pick(['Ahia! Resistenza a pubblico ufficiale!', 'Questo è oltraggio!']), 1600); G.reportCrime('officer', o.x, o.y, { victim: o.name }); } }
  else if (type === 'net') G.net.hit(o, fx, fy, power, w.dmg);
  else if (type === 'boss') G.boss.hit(o, fx, fy, power, w.dmg);
  else if (type === 'thief') { o.state = 'down'; o.t = 4.5; o.tackled = (o.tackled || 0) + 1; G.sfx.thud(); G.toast('Tackled!', 'keep him down until the police get here', 1600); }
  bumpCombo();
}
function bumpCombo() {
  state.combo = state.comboT > 0 ? state.combo + 1 : 1; state.comboT = 4; state.hits++;
  if (state.combo >= 3) { comboEl.hidden = false; comboEl.textContent = 'CAOS × ' + state.combo; }
  if (state.combo === 5 || state.combo === 10 || state.combo === 20) G.toast('Caos × ' + state.combo, G.pick(['mizzica', 'TG Kalsa 24 is on its way', 'your mother would be proud. Or not.']), 1500);
}
function attack() {
  if (!live() || state.cd > 0) return;
  const p = G.player, w = cur();
  if (p.fly || (p.vespa && p.vespa.spec.car)) return;
  if (G.STORE && G.STORE.cart.held) return;
  if (G.talk.ped) G.closeTalk();
  if (!w.melee && !(state.ammo[w.id] > 0)) { G.toast('No ' + w.name + ' left', 'buy more at a shop or a market stall', 1300); pickWeapon(0); return; }
  if (p.vespa && w.melee && w.id !== 'spada' && w.id !== 'pane') return;
  if (G.net && !w.spray) G.net.attacked();
  state.cd = w.cd; state.atkT = w.spray ? 0.12 : 0.3; state.atkKind = w.melee ? 'swing' : w.spray ? 'spray' : 'throw';
  let a = aimDir();
  const ox = p.x, oy = p.y;
  // a little aim help: turn towards whoever is in front
  const range = w.melee ? w.reach + 0.4 : w.spray ? w.range : 22;
  let best = null, bs = 1e9;
  eachTarget((o) => { const dx = o.x - ox, dy = o.y - oy, d = Math.hypot(dx, dy); if (d > range || d < 0.05) return; const da = Math.abs(G.angDiff(a, Math.atan2(dy, dx))); if (da < (w.melee ? 1.3 : 0.5)) { const s = d + da * 6; if (s < bs) { bs = s; best = o; } } });
  if (best) { a = Math.atan2(best.y - oy, best.x - ox); if (!p.vespa) p.a = a; }
  if (w.melee) {
    let hit = 0;
    eachTarget((o, type) => { const dx = o.x - ox, dy = o.y - oy, d = Math.hypot(dx, dy); if (d < w.reach && Math.abs(G.angDiff(a, Math.atan2(dy, dx))) < w.arc) { strike(o, type, ox, oy, w, w.power); hit++; } });
    // cars: the swordfish sends them flying, anything else just makes the driver furious
    const hx = ox + Math.cos(a) * 1.6, hy = oy + Math.sin(a) * 1.6;
    for (const c of G.traffic) if (c.state === 'drive' && Math.hypot(c.x - hx, c.y - hy) < 2.3) { if (w.cars) { G.launchTraffic(c, ox, oy, 11); crime('vandal', c.x, c.y); } else { c.speed = 0; G.sfx.carHorn(); } hit++; }
    if (w.cars) G.propsNear(hx, hy, 2.2, (o) => { if (!o.static && o.alive && Math.hypot(o.x - hx, o.y - hy) < 2.4) { G.launchParked(o, ox, oy, 10); crime('vandal', o.x, o.y); hit++; } });
    if (V) hit += V.hitAt(hx, hy, 1.6, a, w.power) || 0;
    if (hit) { G.sfx.thud(); G.cam.shake = Math.max(G.cam.shake, w.cars ? 0.35 : 0.15); } else G.sfx.pick();
  } else if (w.thrown) {
    state.ammo[w.id]--;
    const sp = p.vespa ? p.vespa.speed : p.speed, m = new G.THREE.Mesh(w.id === 'arancine' ? geos.shotA : w.id === 'verdura' ? geos.shotV : geos.shotF, G.M(w.id === 'arancine' ? '#e3902f' : w.id === 'verdura' ? '#3e8a57' : '#c0457a'));
    m.castShadow = true; G.scene.add(m);
    const d = best ? Math.hypot(best.x - ox, best.y - oy) : 14;
    shots.push({ m, w, x: ox + Math.cos(a) * 0.5, y: oy + Math.sin(a) * 0.5, z: 1.55 + (p.z || 0), vx: Math.cos(a) * (w.speed + sp * 0.6), vy: Math.sin(a) * (w.speed + sp * 0.6), vz: 1.2 + d * 0.28, t: 0 });
    if (G.net) G.net.shotFired(shots[shots.length - 1]);
    G.sfx.pick();
  } else if (w.spray) {
    state.ammo[w.id]--;
    for (let k = 0; k < 4; k++) { const s = a + G.rand(-0.16, 0.16), v = G.rand(10, 15); spark(ox + Math.cos(a) * 0.6, oy + Math.sin(a) * 0.6, 1.3, Math.cos(s) * v, Math.sin(s) * v, G.rand(0.5, 2.5), k % 2 ? '#ffffff' : '#cfe9f5', 0.5); }
    eachTarget((o, type) => {
      const dx = o.x - ox, dy = o.y - oy, d = Math.hypot(dx, dy);
      if (d > w.range || Math.abs(G.angDiff(a, Math.atan2(dy, dx))) > 0.32) return;
      o.soak = (o.soak || 0) + 1;
      if (o.soak > 7) { o.soak = 0; strike(o, type, ox, oy, w, w.power); if (type === 'ped') G.say(o.mesh, G.pick(['Sugnu tuttu vagnatu!', 'A gazzosa no!', 'Mizzica, appiccicusu!']), 1400); }
    });
  }
  renderHud();
}
function spark(x, y, z, vx, vy, vz, col, life = 0.9, s = 1) {
  if (partList.length >= 260) partList.shift();
  partList.push({ x, y, z, vx, vy, vz, life, s, col: new G.THREE.Color(col) });
}
function splat(s, x, y, z) {
  const cols = s.w.id === 'arancine' ? ['#f6e7b6', '#e3902f', '#c4372e', '#f6e7b6'] : ['#c0457a', '#7ab648', '#e9e2c0'];
  for (let k = 0; k < 16; k++) spark(x, y, Math.max(0.2, z), G.rand(-4, 4), G.rand(-4, 4), G.rand(1, 6), G.pick(cols), G.rand(0.6, 1.2), G.rand(0.8, 1.6));
  G.sfx.boing(0.35);
  G.scene.remove(s.m);
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.t += dt;
    const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt, nz = s.z + s.vz * dt; s.vz -= 20 * dt;
    let done = false;
    const tw = G.rayWalls(s.x, s.y, s.z, nx, ny, nz);
    if (tw < 1) { splat(s, s.x + (nx - s.x) * tw, s.y + (ny - s.y) * tw, s.z); done = true; }
    else {
      s.x = nx; s.y = ny; s.z = nz;
      if (s.z < 0.15 || s.t > 4) { splat(s, s.x, s.y, 0.2); done = true; }
      else {
        eachTarget((o, type) => { if (!done && s.z < 2.4 && Math.hypot(o.x - s.x, o.y - s.y) < 0.75) { strike(o, type, s.x - s.vx * 0.1, s.y - s.vy * 0.1, s.w, s.w.power); if (s.w.hop && type === 'ped') G.say(o.mesh, G.pick(['Ahi! Ahi! I spini!', 'Ficudinnia?!', 'Punge! Punge!']), 1500); splat(s, s.x, s.y, s.z); done = true; } });
        if (!done) for (const c of G.traffic) if (c.state === 'drive' && s.z < 2 && Math.hypot(c.x - s.x, c.y - s.y) < 1.9) { c.speed = 0; c.honk = 0; G.sfx.carHorn(); splat(s, s.x, s.y, s.z); crime('vandal', c.x, c.y); done = true; break; }
        if (!done && V && V.hitAt(s.x, s.y, 0.6, Math.atan2(s.vy, s.vx), 6, s.z)) { splat(s, s.x, s.y, s.z); done = true; }
        if (!done && G.boss && G.boss.shotHit(s)) { splat(s, s.x, s.y, s.z); done = true; }
      }
    }
    if (done) shots.splice(i, 1); else { s.m.position.set(s.x, s.z, -s.y); s.m.rotation.x += dt * 9; }
  }
  const d = G.dummy;
  for (let i = partList.length - 1; i >= 0; i--) {
    const q = partList[i]; q.life -= dt;
    if (q.life <= 0) { partList.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 16 * dt;
    if (q.z < 0.06) { q.z = 0.06; q.vx *= 0.5; q.vy *= 0.5; q.vz = 0; }
  }
  partList.forEach((q, i) => { d.position.set(q.x, q.z, -q.y); d.rotation.set(q.x * 3, q.y * 3, 0); d.scale.setScalar(q.s * Math.min(1, q.life * 3)); d.updateMatrix(); parts.setMatrixAt(i, d.matrix); parts.setColorAt(i, q.col); });
  parts.count = partList.length; parts.instanceMatrix.needsUpdate = true; if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
}

// ---- crime: somebody has to see it and call it in
const CRIMES = {
  assault: { heat: 2, what: 'Assault in the street', head: (s) => `Rissa in ${s}`, sub: 'A witness called 112. A patrol car is on its way.', arrest: (s) => `Rissa in ${s}: fermato il responsabile` },
  hitrun: { heat: 2, what: 'You ran someone over', head: (s) => `Pedone investito in ${s}`, sub: 'The driver did not stop. Witnesses gave a description.', arrest: (s) => `Pirata della strada fermato in ${s}` },
  carjack: { heat: 2, what: 'Car theft', head: (s) => `Auto rubata in pieno giorno in ${s}`, sub: 'The owner was left on the pavement, shouting.', arrest: (s) => `Ladro d'auto fermato in ${s}` },
  vandal: { heat: 1, what: 'Vandalism', head: (s) => `Auto volante in ${s}`, sub: 'Residents report a car where a car should not be.', arrest: (s) => `Vandalo fermato in ${s}` },
};
let lastCrimeT = -9;
function file(kind, x, y) {
  const c = CRIMES[kind] || CRIMES.assault, s = G.nearestStreetName(x, y) || 'centro';
  G.reportCrime('street', x, y, { street: true, heat: c.heat, what: c.what, head: c.head(s), sub: c.sub, arrestHead: c.arrest(s), arrestSub: 'Several witnesses gave a very colourful description.' });
}
export function crime(kind, x, y, victim) {
  if (!G || !G.game.started || G.player.cuffed || G.player.ko) return true;
  if (G.STORE && G.STORE.insideXY(x, y, 2.5)) return true;   // the supermarket has its own guard
  const now = G.clock.elapsedTime;
  // already wanted and in sight, or a vigile is watching: no phone call needed
  if ((G.police.wanted && G.police.seen) || (V && V.vigileSees(x, y))) { if (now - lastCrimeT > 1.5) { lastCrimeT = now; file(kind, x, y); } return true; }
  if (now - lastCrimeT < 2.5) return true;
  if (V && V.findWitness(x, y, victim, () => { lastCrimeT = G.clock.elapsedTime; file(kind, x, y); })) { lastCrimeT = now; return true; }
  return false;
}
// called by the game whenever anyone is sent flying
export function pedHit(p, byPlayer, power) {
  if (!byPlayer) return;
  const pl = G.player;
  // bumping into someone, or knocking them over with a car or a scooter, is an accident: nobody calls 112 for it.
  // Only a deliberate attack (fists, weapons) is a crime.
  if (!pl.striking) { if (V && !p.vigile) V.onAssault(p, power, null); return; }
  if (p.vigile) { G.reportCrime('officer', p.x, p.y, { victim: 'a vigile urbano' }); return; }
  const kind = pl.vespa && Math.abs(pl.vespa.speed) > 3 ? 'hitrun' : 'assault', seen = crime(kind, p.x, p.y, p);
  // nobody saw it: the victim may well call it in once they are back on their feet
  if (V) V.onAssault(p, power, seen ? null : () => { lastCrimeT = G.clock.elapsedTime; file(kind, p.x, p.y); });
}
// ---- getting hurt
export function hurt(dmg, fx, fy) {
  if (!G || state.koT > 0 || G.player.cuffed || G.player.inCar || !G.game.started) return;
  state.hp -= dmg; state.lastHurt = G.clock.elapsedTime;
  hurtEl.style.transition = 'none'; hurtEl.style.opacity = Math.min(1, 0.35 + dmg / 30); void hurtEl.offsetWidth; hurtEl.style.transition = 'opacity .6s'; hurtEl.style.opacity = 0;
  if (state.hp <= 0) knockOut();
  renderHud();
}
// a punch from somebody who has had enough of you
export function punch(p, dmg = 8) {
  const pl = G.player; if (pl.fly || pl.cuffed || pl.ko) return;
  state.punched++;
  hurt(dmg, p.x, p.y); G.sfx.thud(); G.cam.shake = Math.max(G.cam.shake, 0.25);
  if (pl.vespa) return;
  if (state.punched % 3 === 0 && !pl.ko) G.launchPlayer(p.x, p.y, 4, true);
  else { const dx = pl.x - p.x, dy = pl.y - p.y, d = Math.hypot(dx, dy) || 1; P.x = pl.x + dx / d * 0.55; P.y = pl.y + dy / d * 0.55; G.resolve(P, 0.42); pl.x = P.x; pl.y = P.y; }
}
function knockOut() {
  const pl = G.player;
  state.hp = 0; state.koT = 4.6; pl.ko = true; pl.fly = null; pl.speed = 0; pl.pose = null;
  if (pl.vespa) G.dismount(true);
  if (pl.carry) G.dropArancina();
  if (G.talk.ped) G.closeTalk();
  G.keys.clear();
  const fee = Math.min(G.wallet.eur, 15);
  koEl.querySelector('small').textContent = `you come round outside the nearest farmacia · ${fee > 0 ? G.fmtEur(fee) + ' for the plasters' : 'the plasters are on the house'}`;
  koEl.hidden = false; G.sfx.burst && G.sfx.thud();
  G.reactAround(pl.x, pl.y, 14, 2);
  state.fee = fee;
}
function wakeUp() {
  const pl = G.player;
  let best = null, bd = 1e9;
  for (const s of G.shopSpots) if (s.kind === 'pharmacy') { const d = Math.hypot(s.x - pl.x, s.y - pl.y); if (d < bd) { bd = d; best = s; } }
  if (best) { P.x = best.x + best.nx * 1.5; P.y = best.y + best.ny * 1.5; G.resolve(P, 0.5); pl.x = P.x; pl.y = P.y; pl.a = Math.atan2(best.ny, best.nx); G.cam.yaw = pl.a; }
  pl.ko = false; pl.z = 0; pl.mesh.rotation.set(0, pl.a + Math.PI / 2, 0);
  G.addMoney(-state.fee); G.resetPolice();
  state.hp = 100; state.koT = 0; koEl.hidden = true; renderHud();
  G.toast('Farmacia', 'patched up · the police have lost interest', 2200);
}
export function reset() {
  state.hp = 100; state.koT = 0; state.combo = 0; state.comboT = 0; if (G) G.player.ko = false; if (koEl) koEl.hidden = true;
  for (const s of shots) G.scene.remove(s.m); shots.length = 0; renderHud();
}

// ---- per frame (runs right after the player has moved)
export function update(dt) {
  const pl = G.player, now = G.clock.elapsedTime;
  if (hud.hidden) hud.hidden = false;
  state.cd = Math.max(0, state.cd - dt);
  if (state.comboT > 0) { state.comboT -= dt; if (state.comboT <= 0) { state.combo = 0; comboEl.hidden = true; } }
  // knocked out: flat on the stones until the timer runs down
  if (state.koT > 0) {
    state.koT -= dt;
    pl.mesh.position.set(pl.x, 0.3, -pl.y); pl.mesh.rotation.set(-Math.PI / 2, pl.a, 0);
    if (state.koT <= 0) wakeUp();
    updateShots(dt);
    return;
  }
  if (now - state.lastHurt > 7 && state.hp < 100) { state.hp = Math.min(100, state.hp + dt * 2.2); if ((state.hp | 0) % 5 === 0) renderHud(); }
  // hold to keep spraying
  if (cur().spray && (G.keys.has('KeyF') || state.mouseHeld) && state.cd <= 0) attack();
  // the weapon in the hand, and the swing
  const u = pl.mesh.userData;
  if (handFor !== state.weapon || (handMesh && handMesh.parent !== u.armR)) {
    if (handMesh && handMesh.parent) handMesh.parent.remove(handMesh);
    const g = geos[cur().id]; handMesh = g ? new G.THREE.Mesh(g, G.vcMat) : null; handFor = state.weapon;
    if (handMesh) { handMesh.position.set(0, -0.7, 0.04); handMesh.castShadow = true; u.armR.add(handMesh); }
  }
  if (state.atkT > 0 && !pl.fly) {
    state.atkT -= dt;
    const k = 1 - Math.max(0, state.atkT) / 0.3;
    if (state.atkKind === 'swing') { u.armR.rotation.x = -2.9 + k * 2.6; u.armR.rotation.z = -0.25; u.body.rotation.y = 0.5 - k; }
    else if (state.atkKind === 'throw') { u.armR.rotation.x = -3.0 + k * 2.2; u.body.rotation.x = 0.1 * k; }
    else { u.armR.rotation.x = -1.5; u.armL.rotation.x = -1.2; }
    u.posed = true;
  } else if (handMesh && cur().id === 'spada' && !pl.vespa && pl.speed < 6.5 && !u.posed) { u.armR.rotation.x = -0.55; }
  // tidy up people who have been knocked out cold
  for (const p of G.peds) {
    if (p.hp != null && p.hp <= 0 && p.state === 'down' && !p.koSet) { p.koSet = true; p.t = 7; }
    else if (p.koSet && p.state !== 'down' && p.state !== 'fly') { p.koSet = false; p.hp = null; }
    if (p.hopAfter && p.state !== 'fly' && p.state !== 'down') { p.hopAfter = false; G.setDance(p, 3.5); }
  }
  // what is on sale here
  state.vendT -= dt; if (state.vendT <= 0) { state.vendT = 0.2; state.vend = pl.vespa ? null : nearVend(); }
  updateShots(dt);
  // four stars: the helicopter. It keeps finding you unless you duck into an alley or a building.
  const H = state.heli, want = G.police.wanted && G.police.heat >= 4 && !pl.cuffed;
  if (want !== state.heliOn) { state.heliOn = want; H.g.visible = want; if (want) { H.x = pl.x + 180; H.y = pl.y + 120; G.toast('Elicottero!', 'hide in a narrow alley or indoors to lose it', 2400); } }
  if (want) {
    H.a += dt * 0.55;
    const tx = pl.x + Math.cos(H.a) * 26, ty = pl.y + Math.sin(H.a) * 26;
    H.x += (tx - H.x) * Math.min(1, dt * 0.8); H.y += (ty - H.y) * Math.min(1, dt * 0.8);
    H.g.position.set(H.x, 52 + Math.sin(now * 0.7) * 2, -H.y); H.g.rotation.y = H.a + Math.PI / 2; H.rot.rotation.y += dt * 30;
    state.coverT -= dt;
    if (state.coverT <= 0) {
      state.coverT = 0.5; let blocked = 0;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (G.rayWalls(pl.x, pl.y, 3, pl.x + Math.cos(a) * 4.6, pl.y + Math.sin(a) * 4.6, 3) < 1) blocked++; }
      state.cover = blocked >= 5 || (G.STORE && G.STORE.inside);
    }
    if (!state.cover && Math.hypot(H.x - pl.x, H.y - pl.y) < 60) { G.police.lastSeen = [pl.x, pl.y]; G.police.escape = Math.max(0, G.police.escape - dt * 1.4); }
  }
}
