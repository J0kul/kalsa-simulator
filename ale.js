// Ale Minore: you spot him on a street corner, but the closer you get the more he fades,
// and when you walk up to him he slips round the corner and is gone.
// Very rarely he stays: up close he turns out to be a hologram, an AI, who has to run off to a party.
let G = null, T = null;
const S = {
  a: null,          // the current Ale: { m, x, y, state, ... }
  nextT: 40,        // seconds until the next sighting
  corners: [],      // street corners he can be found at
  store: null, talkEl: null, talkOpen: false, now: 0,
};
const HOLO_CHANCE = 0.08, HOLO_PITY = 14; // about 1 sighting in 12, and never more than 14 in a row without
const LOOK = {
  v: 2, name: 'Ale Minore', kind: 'custom', behaviour: 'hang', skin: '#e6b08a', height: 1.03, build: 'slim', face: 'long',
  eyes: '#3b2a1e', brows: 'normal', nose: 'normal', mouth: 'smile', hair: 'quiff', hairColor: '#241a14',
  facial: 'stubble', facialColor: '#241a14', glasses: 'none', hat: 'none', top: 'hoodie', c1: '#22283a', c2: '#e9e4da',
  pattern: 'solid', tie: 'none', bottom: 'jeans', bottomColor: '#3c4f6e', shoes: 'sneakers', shoeColor: '#f2f0ea',
};
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const face = (a) => Math.atan2(Math.cos(a), -Math.sin(a)); // game heading -> model rotation (people face +z)
const KEY = 'kalsa.ale.v1';
const mem = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return S.store || {}; } },
  set(o) { S.store = o; try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} },
};

export function init(game) {
  G = game; T = G.THREE0 || G.THREE;
  findCorners();
  return true;
}

// ------------------------------------------------------------------ street corners
// a corner is where two streets meet at a real angle; he stands just short of it and escapes down the other street
// walk d metres along pts from vertex i, forwards (dir 1) or backwards (dir -1)
function walk(pts, i, dir, d) {
  let left = d;
  for (let j = i + dir; j >= 0 && j < pts.length; j += dir) {
    const ax = pts[j - dir][0], ay = pts[j - dir][1], L = hyp(pts[j][0] - ax, pts[j][1] - ay);
    if (L >= left) return [ax + (pts[j][0] - ax) * left / L, ay + (pts[j][1] - ay) * left / L];
    left -= L;
  }
  return null;
}
function findCorners() {
  // every point where two different streets share a vertex: crossings, T-junctions and street ends
  const nodes = new Map(), key = (x, y) => Math.round(x / 2.5) + ',' + Math.round(y / 2.5);
  for (const r of G.roads) {
    if (r.k > 7 || r.pts.length < 2) continue;
    r.pts.forEach((q, i) => { const k = key(q[0], q[1]); let l = nodes.get(k); if (!l) nodes.set(k, l = []); l.push({ r, i, x: q[0], y: q[1] }); });
  }
  for (const l of nodes.values()) {
    if (new Set(l.map((o) => o.r)).size < 2) continue;
    const arms = [];
    for (const o of l) for (const dir of [1, -1]) {
      const p3 = walk(o.r.pts, o.i, dir, 3), p12 = walk(o.r.pts, o.i, dir, 12);
      if (!p3 || !p12) continue;
      arms.push({ a: Math.atan2(p3[1] - o.y, p3[0] - o.x), p12, hw: o.r.hw || 3 });
    }
    if (arms.length >= 2) S.corners.push({ x: l[0].x, y: l[0].y, arms });
  }
}

// ------------------------------------------------------------------ him
function seen(x, y) { const P = G.player; return G.rayWalls(P.x, P.y, 1.6, x, y, 1.6) >= 1; }
function spawn(forceHolo) {
  const P = G.player, cf = G.cam ? G.cam.yaw : 0, fx = Math.cos(cf), fy = Math.sin(cf);
  const cands = [];
  for (const c of S.corners) {
    const d = hyp(c.x - P.x, c.y - P.y);
    if (d < 22 || d > 70) continue;
    if (((c.x - P.x) * fx + (c.y - P.y) * fy) / d < 0.25) continue; // in front of the camera
    cands.push(c);
  }
  for (let tries = 0; tries < 30 && cands.length; tries++) {
    const c = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
    for (const A of c.arms) for (const B of c.arms) {
      if (A === B) continue;
      let turn = Math.abs(((B.a - A.a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (turn < 0.9) continue; // not really a corner
      const ux = Math.cos(A.a), uy = Math.sin(A.a), vx = Math.cos(B.a), vy = Math.sin(B.a);
      const x = c.x + ux * 3 + vx * Math.min(1.4, B.hw * 0.4), y = c.y + uy * 3 + vy * Math.min(1.4, B.hw * 0.4);
      // you can see him, but not the street he'll escape down
      if (!seen(x, y) || seen(B.p12[0], B.p12[1])) continue;
      if (G.insideFoot && G.insideFoot(x, y)) continue;
      return make(x, y, [[c.x + vx * 1.2, c.y + vy * 1.2], [c.x + vx * 7, c.y + vy * 7], B.p12], forceHolo);
    }
  }
  return null;
}
function make(x, y, path, forceHolo) {
  const st = mem.get(), dry = st.dry || 0;
  const holo = forceHolo != null ? !!forceHolo : (Math.random() < HOLO_CHANCE || dry >= HOLO_PITY);
  const m = G.makePerson(G.fullLook(LOOK));
  if (G.noLod) G.noLod(m);
  const mats = [];
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone(); o.material.transparent = true;
    mats.push(o);
  });
  m.position.set(x, 0.09, -y);
  G.scene.add(m);
  const tag = nameTag();
  m.add(tag); tag.position.set(0, 2.35, 0);
  const P = G.player;
  S.a = { m, x, y, a: Math.atan2(P.y - y, P.x - x) + (Math.random() - 0.5) * 0.8, path, pi: 0, state: 'idle', holo, t: 0, dPrev: hyp(P.x - x, P.y - y), mats, tag, op: 1, lostT: 0 };
  return S.a;
}
function nameTag() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(20,17,22,.78)'; c.beginPath(); c.roundRect(8, 10, 240, 44, 22); c.fill();
  c.fillStyle = '#f59ac4'; c.font = '800 26px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Ale Minore', 128, 33);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
  sp.scale.set(1.5, 0.375, 1); sp.renderOrder = 5;
  return sp;
}
function setOpacity(a, op) {
  a.op = op;
  for (const o of a.mats) { o.material.opacity = op; o.material.depthWrite = op > 0.97; }
  a.tag.material.opacity = Math.min(1, op * 1.1);
  a.m.visible = op > 0.01;
}
function remove() {
  const a = S.a; if (!a) return;
  G.scene.remove(a.m);
  // free the clone materials, the name tag and the model itself (each sighting builds a fresh one)
  a.m.traverse((o) => { if (o.isMesh && o.material) o.material.dispose(); });
  if (a.tag) { a.tag.material.map && a.tag.material.map.dispose(); a.tag.material.dispose(); a.m.remove(a.tag); }
  if (G.disposeChar) G.disposeChar(a.m);
  if (a.base) { G.scene.remove(a.base); a.base.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  S.a = null;
}
function vanished(how) {
  const st = mem.get();
  st.seen = (st.seen || 0) + 1;
  if (how === 'talk') { st.talked = (st.talked || 0) + 1; st.dry = 0; } else st.dry = (st.dry || 0) + 1;
  mem.set(st);
  if (how === 'corner') G.toast(st.seen === 1 ? 'Was that Ale Minore?' : 'Ale Minore is gone again', `round the corner, like always · seen ${st.seen}×`, 1900);
  S.nextT = 70 + Math.random() * 80;
}

// ------------------------------------------------------------------ the hologram
function toHolo(a) {
  if (a.isHolo) return;
  a.isHolo = true;
  for (const o of a.mats) {
    const vc = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
    o.material = new T.MeshBasicMaterial({ color: 0x8ff6ff, vertexColors: vc, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false });
  }
  // the projector on the ground and its beam
  const g = new T.Group();
  const disc = new T.Mesh(new T.CircleGeometry(0.62, 40), new T.MeshBasicMaterial({ color: 0x46e6ff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.11; g.add(disc);
  const ring = new T.Mesh(new T.RingGeometry(0.62, 0.72, 40), new T.MeshBasicMaterial({ color: 0xcffbff, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; g.add(ring);
  const beam = new T.Mesh(new T.CylinderGeometry(0.5, 0.66, 2.3, 32, 1, true), new T.MeshBasicMaterial({ color: 0x46e6ff, transparent: true, opacity: 0.1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  beam.position.y = 1.2; g.add(beam);
  g.position.set(a.x, 0, -a.y); G.scene.add(g); a.base = g; a.beam = beam;
  if (G.sfx && G.sfx.ding) G.sfx.ding();
  G.say(a.m, '*bzzt*', 900);
}
function holoFlicker(a, dt) {
  const n = Math.sin(S.now * 37) * Math.sin(S.now * 13.7) * Math.sin(S.now * 5.1);
  const glitch = a.leaving ? 1 : (Math.random() < 0.02 ? 1 : 0);
  const op = (a.leaving ? Math.max(0, 1 - a.leaveT / 0.9) : 1) * (0.5 + n * 0.12) * (glitch ? 0.4 + Math.random() * 0.5 : 1);
  for (const o of a.mats) o.material.opacity = op;
  a.tag.material.opacity = a.leaving ? 0 : 0.9;
  a.m.position.x = a.x + (glitch ? (Math.random() - 0.5) * 0.18 : 0);
  if (a.beam) a.beam.material.opacity = 0.08 + Math.abs(n) * 0.08;
  if (a.leaving) {
    // squeezed back into the projector
    a.m.scale.set(1 + a.leaveT * 0.6, Math.max(0.02, 1 - a.leaveT / 0.9), 1 + a.leaveT * 0.6);
    a.base.scale.setScalar(Math.max(0.01, 1 - a.leaveT / 1.2));
  }
}

// ------------------------------------------------------------------ talking (only to the hologram)
function talkPanel() {
  if (S.talkEl) return S.talkEl;
  const css = document.createElement('style');
  css.textContent = `#aleTalk { left: 50%; bottom: calc(62px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); pointer-events: auto; z-index: 9; width: min(600px, calc(100vw - 32px)); background: #071a22; color: #dffbff; border-radius: 10px; border: 2px solid #46e6ff; box-shadow: 0 0 0 1px rgba(70,230,255,.25), 0 8px 28px rgba(0,0,0,.45), 0 0 24px rgba(70,230,255,.25); padding: 12px 14px 12px; display: flex; flex-direction: column; gap: 9px; position: fixed; background-image: repeating-linear-gradient(0deg, rgba(70,230,255,.06) 0 1px, transparent 1px 4px); }
#aleTalk[hidden] { display: none; }
#aleTalk .who { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; } #aleTalk .who small { font: 800 10px/1 var(--f-ui, system-ui); letter-spacing: .14em; text-transform: uppercase; color: #46e6ff; } #aleTalk .who b { font: 400 22px/1 var(--f-display, Georgia, serif); color: #fff; }
#aleTalk p { margin: 0; font: 600 15px/1.35 var(--f-ui, system-ui); }
#aleTalk .opts { display: flex; flex-wrap: wrap; gap: 6px; } #aleTalk button { font: 700 13px/1.15 var(--f-ui, system-ui); background: transparent; color: #dffbff; border: 2px solid #46e6ff; border-radius: 999px; padding: 7px 11px 7px 7px; display: flex; gap: 6px; align-items: center; cursor: pointer; text-align: left; }
#aleTalk button kbd { background: #46e6ff; color: #071a22; border-radius: 5px; padding: 1px 5px; font: 800 11px/1.2 var(--f-ui, system-ui); } #aleTalk button:hover, #aleTalk button:focus-visible { background: #46e6ff; color: #071a22; outline: none; }`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'aleTalk'; el.className = 'hud'; el.hidden = true;
  el.innerHTML = '<div class="who"><small>Ologramma · IA</small><b>Ale Minore</b></div><p></p><div class="opts"></div>';
  document.body.appendChild(el); S.talkEl = el;
  addEventListener('keydown', (e) => { if (!S.talkOpen) return; const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code]; if (n == null) return; const b = el.querySelectorAll('.opts button')[n]; if (b) { e.preventDefault(); b.click(); } });
  return el;
}
const pickOne = (l) => l[Math.floor(Math.random() * l.length)];
function party() {
  return pickOne([
    'Scusa, devo scappare: c\'è una festa di 18 anni.',
    'Scusa, devo andare: c\'è una festa di laurea.',
    'Non posso fermarmi, stasera c\'è un diciottesimo.',
    'Devo proprio andare, c\'è una festa di laurea e sono già in ritardo.',
  ]);
}
function say(text, opts) {
  const el = S.talkEl; el.querySelector('p').textContent = text;
  const box = el.querySelector('.opts'); box.innerHTML = '';
  (opts || []).forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<kbd>${i + 1}</kbd><span></span>`; b.querySelector('span').textContent = o.t;
    b.addEventListener('click', () => { G.say(G.player.mesh, o.t, 1600); if (G.sfx && G.sfx.pick) G.sfx.pick(); o.go(); });
    box.appendChild(b);
  });
  const b = box.querySelector('button'); if (b && G.PAD && G.PAD.active) b.focus();
}
function bye(text) {
  say(text);
  const a = S.a; if (a) a.byeT = 2.6;
}
function talkOpen() {
  const a = S.a; if (!a) return;
  talkPanel(); S.talkOpen = true; S.talkEl.hidden = false; a.talking = true;
  const end = [
    { t: 'Di chi è la festa?', go: () => bye(pickOne(['Non lo so. Ce n\'è sempre una. Ciao!', 'Di un cugino di un amico. Mi aspettano, ciao!', 'Boh. Ma c\'è la torta. Ciao ciao!'])) },
    { t: 'Portami con te!', go: () => bye('Gli ologrammi non hanno il più uno. Ciao!') },
  ];
  say(pickOne([
    'Oh! Mi hai visto davvero. Non dirlo in giro: non sono proprio Ale. Sono un ologramma, un\'intelligenza artificiale.',
    'Eh... ciao. Sì, sono io. Cioè, quasi: sono un ologramma. Un\'IA con la faccia di Ale.',
  ]), [
    { t: 'Ale! Finalmente! Dove scappi sempre?', go: () => say(party(), end) },
    { t: 'Sei un\'intelligenza artificiale?', go: () => say('Sì. Mi proiettano in giro per la città, così sembra che Ale ci sia. ' + party(), end) },
    { t: 'Ciao Ale.', go: () => bye('Ciao! ' + party()) },
  ]);
}
function talkClose() { S.talkOpen = false; if (S.talkEl) S.talkEl.hidden = true; }
function leave(a) {
  if (a.leaving) return;
  a.leaving = true; a.leaveT = 0;
  if (S.talkOpen) talkClose();
  if (G.sfx && G.sfx.pick) G.sfx.pick();
}

// ------------------------------------------------------------------ every frame
export function update(dt) {
  S.now += dt;
  const P = G.player;
  const busy = (G.boss && G.boss.active && G.boss.active()) || (G.STORE && G.STORE.inside) || (G.boss && G.boss.inside && G.boss.inside());
  if (!S.a) {
    if (busy || !G.game.started) return;
    if ((S.nextT -= dt) <= 0) { if (!spawn()) S.nextT = 6; }
    return;
  }
  const a = S.a; a.t += dt;
  const d = hyp(P.x - a.x, P.y - a.y), closing = (a.dPrev - d) / Math.max(dt, 1e-3);
  a.dPrev = d;

  if (a.holo) {
    // the rare one: he waits for you, and up close he's a hologram
    if (!a.isHolo && d < 9) toHolo(a);
    if (a.isHolo) {
      if (!a.leaving) a.a += G.angDiff(a.a, Math.atan2(P.y - a.y, P.x - a.x)) * Math.min(1, dt * 3);
      a.m.rotation.y = face(a.a);
      G.posePerson(a.m, a.talking ? 'talk' : 'wave', S.now, 3);
      holoFlicker(a, dt);
      if (a.byeT != null && (a.byeT -= dt) <= 0) { a.byeT = null; leave(a); }
      if (a.talking && d > 8 && !a.leaving) leave(a);
      if (!a.talking && d > 40 && !a.leaving) leave(a);
      if (a.leaving && (a.leaveT += dt) > 1.2) { const talked = a.talking; remove(); vanished(talked ? 'talk' : 'missed'); if (talked) G.toast('Ale Minore went to a party', `it was an AI hologram all along · seen ${mem.get().seen}×, spoken to ${mem.get().talked}×`, 2600); }
    } else {
      G.posePerson(a.m, 'phone', S.now, 3); a.m.rotation.y = face(a.a);
      setOpacity(a, 1);
      if (d > 110 || a.t > 90) { remove(); S.nextT = 30; }
    }
    return;
  }

  // the usual one: the closer you get the more he fades, and then he's off round the corner
  if (a.state === 'idle') {
    G.posePerson(a.m, 'phone', S.now, 3); a.m.rotation.y = face(a.a);
    setOpacity(a, Math.pow(clamp((d - 4) / 22, 0, 1), 0.8));
    if (d < 10 || (d < 17 && closing > 0.6)) { a.state = 'flee'; G.say(a.m, '…', 700); }
    else if (d > 110 || a.t > 75) { remove(); S.nextT = 30; }
  } else if (a.state === 'flee') {
    const tgt = a.path[a.pi], dx = tgt[0] - a.x, dy = tgt[1] - a.y, L = hyp(dx, dy), sp = 3.8;
    if (L < 0.3) { if (++a.pi >= a.path.length) a.state = 'gone'; }
    else {
      const k = Math.min(L, sp * dt);
      a.x += dx / L * k; a.y += dy / L * k;
      a.a += G.angDiff(a.a, Math.atan2(dy, dx)) * Math.min(1, dt * 10);
    }
    a.m.position.set(a.x, 0.09, -a.y); a.m.rotation.y = face(a.a);
    G.animatePerson(a.m, S.now * 9, 0.55, 0);
    const fade = Math.pow(clamp((d - 4) / 22, 0, 1), 0.8) * 0.85;
    setOpacity(a, Math.min(a.op, fade));
    // out of sight round the corner: gone
    if (a.pi >= 1) { a.lostT = seen(a.x, a.y) ? 0 : a.lostT + dt; if (a.lostT > 0.25) a.state = 'gone'; }
  } else if (a.state === 'gone') {
    setOpacity(a, Math.max(0, a.op - dt * 2.2));
    a.m.position.set(a.x, 0.09, -a.y);
    if (a.op <= 0.01) { remove(); vanished('corner'); }
  }
}

export function hint() {
  const a = S.a;
  if (a && a.isHolo && !a.talking && !a.leaving && !G.player.vespa && hyp(G.player.x - a.x, G.player.y - a.y) < 3.4) return 'Press <kbd>E</kbd> to talk to Ale Minore';
  return null;
}
export function interact() {
  const a = S.a;
  if (a && a.isHolo && !a.talking && !a.leaving && !G.player.vespa && hyp(G.player.x - a.x, G.player.y - a.y) < 3.4) { talkOpen(); return true; }
  return false;
}
export function status() {
  const a = S.a;
  return { corners: S.corners.length, nextT: S.nextT, mem: mem.get(), a: a ? { x: a.x, y: a.y, state: a.state, holo: a.holo, isHolo: !!a.isHolo, op: a.op, talking: !!a.talking, leaving: !!a.leaving } : null };
}
// testing: put him somewhere now
export function debugSpawn(holo) { remove(); return !!spawn(holo); }
export const debug = { S };
// testing: why a sighting can or can't be placed from here
export function why() {
  const P = G.player, o = { inRange: 0, front: 0, corner: 0, visible: 0, ok: 0 }, cf = G.cam ? G.cam.yaw : 0;
  for (const c of S.corners) {
    const d = hyp(c.x - P.x, c.y - P.y); if (d < 22 || d > 70) continue; o.inRange++;
    if (((c.x - P.x) * Math.cos(cf) + (c.y - P.y) * Math.sin(cf)) / d >= 0.25) o.front++;
    for (const A of c.arms) for (const B of c.arms) {
      if (A === B) continue;
      const turn = Math.abs(((B.a - A.a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (turn < 0.9) continue; o.corner++;
      const vx = Math.cos(B.a), vy = Math.sin(B.a), x = c.x + Math.cos(A.a) * 3 + vx * Math.min(1.4, B.hw * 0.4), y = c.y + Math.sin(A.a) * 3 + vy * Math.min(1.4, B.hw * 0.4);
      if (!seen(x, y)) continue; o.visible++;
      if (!seen(B.p12[0], B.p12[1])) o.ok++;
    }
  }
  return o;
}
