// corsa.js — the Kalsa Grand Prix: a closed circuit on the Foro Italico lawn, by the sea.
// Drive in with any car, scooter or motorbike and press R: everyone else on the circuit with a vehicle joins the
// countdown, lines up on the grid and races three laps. Positions, laps and finishing times travel through the same
// live room the rest of the multiplayer uses (one small "rc" field in each player's presence); alone, it is a time trial.
let G = null, NET = null, TR = null;
const LAPS = 3, NCP = 12, ZONE = 34, COUNT = 6;
const S = {
  st: 'idle', g: null, now: 0, cdEnd: 0, t0: 0, lap: 0, next: 1, lapT0: 0, ft: 0, laps: [], resT: 0, seen: new Set(), lastW: -1,
  best: null, bestLap: null, hud: null, msg: null, res: null, btn: null, prompt: null, gate: null, lamps: [], crowd: null, crowdBase: null, lastSent: '', beep: -1,
};
const fmt = (t) => { if (!isFinite(t) || t <= 0) return '–'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const store = { get() { try { return JSON.parse(localStorage.getItem('kalsa.gp') || '{}') || {}; } catch (e) { return {}; } }, set(o) { try { localStorage.setItem('kalsa.gp', JSON.stringify(o)); } catch (e) {} } };

export function init(game, net) {
  G = game; NET = net; TR = G.RACE;
  const b = store.get(); S.best = b.best || null; S.bestLap = b.lap || null;
  build();
  hud();
  return true;
}

// ------------------------------------------------------------------ the circuit
function build() {
  const T = G.THREE, P = TR.pts, N = P.length, hw = TR.hw;
  const pos = (i, off, y) => { const p = P[(i + N) % N], n = TR.nrm[(i + N) % N]; return [p[0] + n[0] * off, y, -(p[1] + n[1] * off)]; };
  // a ribbon between two offsets, one colour per strip piece
  const ribbon = (o0, o1, y, colAt, every = 1) => {
    const v = [], c = [], col = new T.Color();
    for (let i = 0; i < N; i += every) {
      const j = i + every;
      const a = pos(i, o0, y), b = pos(i, o1, y), cc = pos(j, o1, y), d = pos(j, o0, y);
      col.set(colAt(i)); const k = [col.r, col.g, col.b];
      v.push(...a, ...b, ...cc, ...a, ...cc, ...d); for (let q = 0; q < 6; q++) c.push(...k);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); g.computeVertexNormals();
    // keep the faces upward whichever way the loop runs
    if (g.attributes.normal.getY(0) < 0) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; } g.computeVertexNormals(); }
    return g;
  };
  const flat = (po) => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: po, polygonOffsetUnits: po });
  const add = (m, shadow) => { m.receiveShadow = true; if (shadow) m.castShadow = true; G.scene.add(m); return m; };
  const asph = (i) => { const h = G.hash(i * 0.37); return h < 0.5 ? '#46484d' : h < 0.8 ? '#4a4c52' : '#424449'; };
  add(new T.Mesh(ribbon(-hw - 0.2, hw + 0.2, 0.172, asph), flat(-2)));
  // run-off: a band of gravel beyond the kerbs
  add(new T.Mesh(ribbon(hw + 0.2, hw + 2.6, 0.168, (i) => (G.hash(i * 1.3) < 0.5 ? '#cdbb92' : '#c6b386')), flat(-1)));
  add(new T.Mesh(ribbon(-hw - 2.6, -hw - 0.2, 0.168, (i) => (G.hash(i * 1.3) < 0.5 ? '#cdbb92' : '#c6b386')), flat(-1)));
  // kerbs, red and white, and the white edge lines
  const kerb = (i) => (Math.floor(i / 2) % 2 ? '#d7261e' : '#f4f1ea');
  add(new T.Mesh(ribbon(hw - 0.9, hw + 0.2, 0.182, kerb), flat(-3)));
  add(new T.Mesh(ribbon(-hw - 0.2, -hw + 0.9, 0.182, kerb), flat(-3)));
  add(new T.Mesh(ribbon(hw - 1.25, hw - 1.0, 0.178, () => '#f4f1ea'), flat(-3)));
  add(new T.Mesh(ribbon(-hw + 1.0, -hw + 1.25, 0.178, () => '#f4f1ea'), flat(-3)));
  // the start line: a chequered band right across, and the grid boxes behind it
  {
    const s = TR.start, p = P[s], t = TR.tan[s], n = TR.nrm[s], v = [], c = [], sq = (2 * hw) / 12;
    for (let row = 0; row < 2; row++) for (let k = 0; k < 12; k++) {
      const o0 = -hw + k * sq, o1 = o0 + sq, a0 = row * sq - sq, a1 = a0 + sq, y = 0.186;
      const P4 = [[a0, o0], [a0, o1], [a1, o1], [a1, o0]].map(([a, o]) => [p[0] + t[0] * a + n[0] * o, y, -(p[1] + t[1] * a + n[1] * o)]);
      v.push(...P4[0], ...P4[1], ...P4[2], ...P4[0], ...P4[2], ...P4[3]);
      const k2 = (row + k) % 2 ? 0.08 : 0.95; for (let q = 0; q < 6; q++) c.push(k2, k2, k2);
    }
    for (let k = 0; k < 8; k++) {
      const [gx, gy, , gt, gn] = gridSpot(k);
      const box = [[-0.15, -1.3], [-0.15, 1.3], [0.15, 1.3], [0.15, -1.3]];
      for (const [a0, o0] of [[0, 0]]) {
        const P4 = box.map(([a, o]) => [gx + gt[0] * (a + a0) + gn[0] * (o + o0), 0.184, -(gy + gt[1] * (a + a0) + gn[1] * (o + o0))]);
        v.push(...P4[0], ...P4[1], ...P4[2], ...P4[0], ...P4[2], ...P4[3]); for (let q = 0; q < 6; q++) c.push(0.95, 0.95, 0.95);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) g.scale(1, 1, 1), g.index = null;
    const m = add(new T.Mesh(g, flat(-4))); m.material.side = T.DoubleSide;
  }
  // barriers: painted concrete on both sides, with a gap on the road side to drive in and out
  const wall = (off, skip) => {
    const v = [], c = [], col = new T.Color(), H = 0.95, th = 0.5, side = Math.sign(off);
    for (let i = 0; i < N; i++) {
      if (skip(i)) continue;
      const j = i + 1;
      const q = (k, o, y) => pos(k, o, y);
      const iA = q(i, off, 0), iB = q(j, off, 0), iC = q(j, off, H), iD = q(i, off, H);
      const oA = q(i, off + side * th, 0), oB = q(j, off + side * th, 0), oC = q(j, off + side * th, H), oD = q(i, off + side * th, H);
      col.set(Math.floor(i / 2) % 2 ? '#d7261e' : '#f4f1ea'); const k1 = [col.r, col.g, col.b];
      const quad = (a, b, cc, d, k) => { v.push(...a, ...b, ...cc, ...a, ...cc, ...d); for (let z = 0; z < 6; z++) c.push(...k); };
      quad(iA, iB, iC, iD, k1); quad(oB, oA, oD, oC, [0.72, 0.72, 0.7]); quad(iD, iC, oC, oD, [0.8, 0.8, 0.78]);
      if (skip(i - 1)) quad(oA, iA, iD, oD, [0.7, 0.7, 0.68]);
      if (skip(j)) quad(iB, oB, oC, iC, [0.7, 0.7, 0.68]);
      G.addSeg([P[i][0] + TR.nrm[i][0] * (off + side * th / 2), P[i][1] + TR.nrm[i][1] * (off + side * th / 2)], [P[j % N][0] + TR.nrm[j % N][0] * (off + side * th / 2), P[j % N][1] + TR.nrm[j % N][1] * (off + side * th / 2)], 1.0);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); g.computeVertexNormals();
    const m = add(new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: T.DoubleSide })), true);
    return m;
  };
  const gapAt = (i) => { const d = ((TR.gap0 - i) % N + N) % N; return d < TR.gapN; };
  wall(TR.outer * (hw + 2.6), gapAt);
  wall(-TR.outer * (hw + 2.6), () => false);
  G.finalizeSegs();
  // tyre stacks where the corners are tightest
  {
    const spots = [];
    for (let i = 0; i < N; i += 1) if (Math.abs(TR.curv[i]) > 0.035) spots.push(pos(i, -Math.sign(TR.curv[i]) * (hw + 1.95), 0));
    const tyre = new T.CylinderGeometry(0.4, 0.4, 0.26, 18); const band = new T.TorusGeometry(0.4, 0.04, 6, 18);
    const im = new T.InstancedMesh(tyre, new T.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.9 }), spots.length * 3);
    const im2 = new T.InstancedMesh(band, new T.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.7 }), spots.length);
    const d = new T.Object3D(); let n = 0;
    spots.forEach((p, k) => { for (let h = 0; h < 3; h++) { d.position.set(p[0], 0.13 + h * 0.27, p[2]); d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(n++, d.matrix); } d.position.set(p[0], 0.4, p[2]); d.rotation.set(Math.PI / 2, 0, 0); d.updateMatrix(); im2.setMatrixAt(k, d.matrix); });
    im.castShadow = true; im.receiveShadow = true; G.scene.add(im, im2);
  }
  // the gantry over the start line, with five red lights
  {
    const s = TR.start, p = P[s], n = TR.nrm[s], ang = Math.atan2(TR.tan[s][1], TR.tan[s][0]);
    const grp = new T.Group(); grp.position.set(p[0], 0, -p[1]); grp.rotation.y = ang;
    const steel = new T.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.5, metalness: 0.4 });
    for (const sgn of [-1, 1]) { const col = new T.Mesh(new T.BoxGeometry(0.6, 7.2, 0.6), steel); col.position.set(0, 3.6, sgn * (hw + 3.6)); col.castShadow = true; grp.add(col); }
    const beam = new T.Mesh(new T.BoxGeometry(1.2, 1.6, 2 * hw + 7.8), steel); beam.position.set(0, 7.0, 0); beam.castShadow = true; grp.add(beam);
    const ban = banner('KALSA GRAND PRIX', '#f59ac4', '#141116', 1024, 160, true);
    for (const f of [-1, 1]) { const pl = new T.Mesh(new T.PlaneGeometry(2 * hw + 6, 1.3), new T.MeshBasicMaterial({ map: ban, toneMapped: false })); pl.position.set(f * 0.61, 7.0, 0); pl.rotation.y = f * Math.PI / 2 * (f > 0 ? 1 : 1) + (f > 0 ? 0 : Math.PI); pl.rotation.y = f > 0 ? Math.PI / 2 : -Math.PI / 2; grp.add(pl); }
    const lampG = new T.SphereGeometry(0.28, 16, 12);
    for (let k = 0; k < 5; k++) {
      const m = new T.MeshStandardMaterial({ color: '#3a0d0d', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: 0.3 });
      const l = new T.Mesh(lampG, m); l.position.set(-0.75, 5.75, (k - 2) * 0.8); grp.add(l); S.lamps.push(m);
      const hood = new T.Mesh(new T.BoxGeometry(0.4, 0.7, 0.7), steel); hood.position.set(-0.5, 5.75, (k - 2) * 0.8); grp.add(hood);
    }
    G.scene.add(grp);
  }
  // the grandstand along the main straight, full of people
  {
    const s = (TR.start + Math.round(22 / TR.step) + N) % N, p = P[s], ang = Math.atan2(TR.tan[s][1], TR.tan[s][0]), side = TR.outer;
    const grp = new T.Group(); grp.position.set(p[0] + TR.nrm[s][0] * side * (hw + 9), 0, -(p[1] + TR.nrm[s][1] * side * (hw + 9))); grp.rotation.y = ang + (side > 0 ? 0 : Math.PI);
    const conc = new T.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.9 }), seat = new T.MeshStandardMaterial({ color: '#f59ac4', roughness: 0.7 }), dark = new T.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.6 });
    const L = 46;
    for (let r = 0; r < 6; r++) {
      const st = new T.Mesh(new T.BoxGeometry(L, 0.5 + r * 0.55, 1.1), conc); st.position.set(0, (0.5 + r * 0.55) / 2, r * 1.1 + 0.55); st.castShadow = st.receiveShadow = true; grp.add(st);
      const sb = new T.Mesh(new T.BoxGeometry(L - 0.4, 0.12, 0.45), r % 2 ? seat : dark); sb.position.set(0, 0.56 + r * 0.55, r * 1.1 + 0.7); grp.add(sb);
    }
    for (let k = 0; k <= 4; k++) for (const z of [0.3, 6.9]) { const post = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, z < 1 ? 5.4 : 7.0, 12), dark); post.position.set(-L / 2 + k * (L / 4), (z < 1 ? 5.4 : 7.0) / 2, z); grp.add(post); }
    const roof = new T.Mesh(new T.BoxGeometry(L + 1, 0.25, 7.6), new T.MeshStandardMaterial({ color: '#141116', roughness: 0.6 })); roof.position.set(0, 6.3, 3.6); roof.rotation.x = -0.12; roof.castShadow = true; grp.add(roof);
    const sign = new T.Mesh(new T.PlaneGeometry(L * 0.7, 1.4), new T.MeshBasicMaterial({ map: banner('TRIBUNA FORO ITALICO', '#141116', '#f59ac4', 1024, 96), toneMapped: false })); sign.position.set(0, 7.0, -0.45); sign.rotation.y = Math.PI; grp.add(sign);
    // the crowd
    const nC = 260, body = new T.CapsuleGeometry(0.2, 0.32, 4, 10), head = new T.SphereGeometry(0.15, 14, 10);
    const cb = new T.InstancedMesh(body, new T.MeshStandardMaterial({ roughness: 0.8 }), nC), ch = new T.InstancedMesh(head, new T.MeshStandardMaterial({ roughness: 0.7 }), nC);
    const shirts = ['#f59ac4', '#141116', '#f4f1ea', '#2a5bd7', '#d7261e', '#ffd23f', '#3e8a57', '#f59ac4'], skins = ['#f1c7a3', '#d9a47c', '#b07a52', '#8a5a3a', '#f5d6bc'];
    const d = new T.Object3D(), col = new T.Color(); S.crowdBase = [];
    for (let k = 0; k < nC; k++) {
      const r = k % 6, x = -L / 2 + 0.8 + G.hash(k * 3.1) * (L - 1.6), y = 0.56 + r * 0.55 + 0.42, z = r * 1.1 + 0.8;
      S.crowdBase.push([x, y, z, G.hash(k * 7.7) * 6.28]);
      d.position.set(x, y, z); d.updateMatrix(); cb.setMatrixAt(k, d.matrix); col.set(shirts[k % shirts.length]); cb.setColorAt(k, col);
      d.position.set(x, y + 0.42, z); d.updateMatrix(); ch.setMatrixAt(k, d.matrix); col.set(skins[k % skins.length]); ch.setColorAt(k, col);
    }
    cb.castShadow = true; grp.add(cb, ch); S.crowd = [cb, ch];
    G.scene.add(grp);
  }
  // sponsor boards (all made up) and flags along the main straight
  {
    const names = [['ARANCINE DA ZIO PINO', '#ffd23f', '#141116'], ['PANELLE & CRÔCCHÈ', '#141116', '#f59ac4'], ['FORZA PALERMO', '#f59ac4', '#141116'], ['GELATERIA KALSA', '#2a5bd7', '#f4f1ea'], ['CANNOLI DI SAN DOMENICO', '#f4f1ea', '#d7261e'], ['TRATTORIA DA TOTÒ', '#3e8a57', '#f4f1ea']];
    const tex = names.map(([t, bg, fg]) => banner(t, bg, fg, 512, 80));
    const boardG = new T.PlaneGeometry(6, 0.85), poleG = new T.CylinderGeometry(0.06, 0.06, 6, 10), flagG = new T.PlaneGeometry(1.6, 1.0, 6, 2);
    const fm = [new T.MeshStandardMaterial({ color: '#f59ac4', side: T.DoubleSide }), new T.MeshStandardMaterial({ color: '#141116', side: T.DoubleSide })], pm = new T.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.5, roughness: 0.4 });
    let k = 0;
    for (let i = 0; i < N; i += Math.round(9 / TR.step)) {
      if (gapAt(i)) continue;
      const near = Math.abs(((i - TR.start + N / 2) % N + N) % N - N / 2) * TR.step;
      for (const sd of [TR.outer, -TR.outer]) {
        const o = sd * (hw + 2.6 - 0.02), p = pos(i, o, 0.48), a = Math.atan2(TR.tan[i][1], TR.tan[i][0]);
        if (k % 2 === 0) { const m = new T.Mesh(boardG, new T.MeshBasicMaterial({ map: tex[(k / 2) % tex.length], toneMapped: false })); m.position.set(p[0], 0.5, p[2]); m.rotation.y = a + (sd === TR.outer ? Math.PI : 0) + (TR.outer > 0 ? 0 : 0); m.rotation.y = sd > 0 ? a : a + Math.PI; G.scene.add(m); }
        k++;
      }
      if (near < 70) {
        const p = pos(i, TR.outer * (hw + 3.6), 0), pole = new T.Mesh(poleG, pm); pole.position.set(p[0], 3, p[2]); G.scene.add(pole);
        const fl = new T.Mesh(flagG, fm[k % 2]); fl.position.set(p[0] + 0.8, 5.4, p[2]); fl.userData.ph = k; G.scene.add(fl); (S.flags || (S.flags = [])).push(fl);
      }
    }
  }
  // the entrance, in the gap on the road side
  {
    const i = (TR.gap0 - Math.floor(TR.gapN / 2) + N) % N, p = pos(i, TR.outer * (hw + 3.5), 0), a = Math.atan2(TR.tan[i][1], TR.tan[i][0]);
    const grp = new T.Group(); grp.position.set(p[0], 0, p[2]); grp.rotation.y = a;
    const steel = new T.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.5, metalness: 0.4 }), w2 = TR.gapN * TR.step / 2 - 1;
    for (const sgn of [-1, 1]) { const c = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 5.2, 14), steel); c.position.set(sgn * w2, 2.6, 0); grp.add(c); }
    const top = new T.Mesh(new T.PlaneGeometry(2 * w2, 1.0), new T.MeshBasicMaterial({ map: banner('INGRESSO PISTA · PREMI R', '#f59ac4', '#141116', 1024, 110), toneMapped: false, side: T.DoubleSide })); top.position.set(0, 4.8, 0); grp.add(top);
    G.scene.add(grp);
  }
  // the next checkpoint: a pink arch that moves around the lap
  {
    const grp = new T.Group(), m = new T.MeshStandardMaterial({ color: '#f59ac4', emissive: '#f59ac4', emissiveIntensity: 0.6, transparent: true, opacity: 0.75 });
    for (const sgn of [-1, 1]) { const c = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 5, 14), m); c.position.set(0, 2.5, sgn * (hw + 0.6)); grp.add(c); }
    const top = new T.Mesh(new T.BoxGeometry(0.4, 0.5, 2 * hw + 1.6), m); top.position.set(0, 5, 0); grp.add(top);
    grp.visible = false; G.scene.add(grp); S.gate = grp;
  }
}
// a painted banner as a texture
function banner(text, bg, fg, w, h, cheq) {
  const T = G.THREE, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  if (cheq) { const q = h / 4; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { c.fillStyle = (x + y) % 2 ? '#141116' : '#f4f1ea'; c.fillRect(x * q, y * q, q, q); c.fillRect(w - (x + 1) * q, y * q, q, q); } }
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  let fs = Math.round(h * 0.62); c.font = `800 ${fs}px system-ui, sans-serif`;
  const maxW = cheq ? w - h * 3.3 : w * 0.92; while (c.measureText(text).width > maxW && fs > 10) { fs -= 2; c.font = `800 ${fs}px system-ui, sans-serif`; }
  c.fillText(text, w / 2, h / 2 + 2);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
// where grid slot k is: two columns, staggered, behind the line
function gridSpot(k) {
  const N = TR.pts.length, back = Math.round((7 + Math.floor(k / 2) * 8 + (k % 2) * 4) / TR.step), i = (TR.start - back + N) % N;
  const p = TR.pts[i], n = TR.nrm[i], t = TR.tan[i], o = (k % 2 ? 1 : -1) * 3.2;
  return [p[0] + n[0] * o, p[1] + n[1] * o, Math.atan2(t[1], t[0]), t, n];
}

// ------------------------------------------------------------------ HUD
function hud() {
  const css = document.createElement('style');
  css.textContent = `
#gpHud { top: calc(64px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); z-index: 6; display: flex; gap: 6px; align-items: stretch; }
#gpHud div { background: var(--ink-soft, rgba(20,17,22,.82)); color: var(--marmo, #fbf8f2); border-radius: 12px; padding: 7px 12px; text-align: center; font: 800 18px/1.05 var(--f-ui, system-ui); min-width: 74px; }
#gpHud small { display: block; font: 700 10px/1.2 var(--f-ui, system-ui); letter-spacing: .08em; text-transform: uppercase; opacity: .75; margin-bottom: 3px; }
#gpHud .pos { background: #f59ac4; color: #141116; }
#gpMsg { inset: 0; display: grid; place-items: center; pointer-events: none; font: 900 clamp(64px, 14vw, 150px)/1 var(--f-ui, system-ui); color: #fbf8f2; text-shadow: 0 4px 0 #141116, 0 0 24px rgba(0,0,0,.5); }
#gpMsg.go { color: #6fbf73; }
#gpRes { top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(380px, 92vw); background: #fbf8f2; color: #141116; border: 3px solid #141116; border-radius: 16px; padding: 16px 18px 14px; box-shadow: 0 8px 0 #141116; font: 600 15px/1.35 var(--f-ui, system-ui); }
#gpRes h3 { margin: 0 0 8px; font: 900 22px/1.1 var(--f-ui, system-ui); }
#gpRes ol { margin: 0 0 10px; padding: 0; list-style: none; display: grid; gap: 4px; }
#gpRes li { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; padding: 6px 8px; border-radius: 8px; background: #efe9dd; }
#gpRes li.me { background: #f59ac4; }
#gpRes li b { font-variant-numeric: tabular-nums; }
#gpRes p { margin: 0; font-size: 13px; opacity: .8; }
#gpPrompt { bottom: calc(120px + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%); background: #f59ac4; color: #141116; border: 3px solid #141116; border-radius: 999px; padding: 9px 16px; font: 800 15px/1 var(--f-ui, system-ui); box-shadow: 0 4px 0 #141116; white-space: nowrap; pointer-events: auto; cursor: pointer; }
#gpPrompt kbd { background: #141116; color: #fbf8f2; border-radius: 6px; padding: 2px 6px; margin-right: 4px; font: inherit; }
@media (max-width: 640px) { #gpHud div { font-size: 15px; min-width: 58px; padding: 6px 8px; } #gpPrompt { bottom: calc(190px + env(safe-area-inset-bottom, 0px)); } }`;
  document.head.appendChild(css);
  const mk = (id, tag = 'div') => { const e = document.createElement(tag); e.id = id; e.className = 'hud'; e.hidden = true; document.body.appendChild(e); return e; };
  S.hud = mk('gpHud'); S.hud.innerHTML = '<div><small>Lap</small><span></span></div><div class="pos"><small>Pos</small><span></span></div><div><small>Time</small><span></span></div><div><small>Best lap</small><span></span></div>';
  S.msg = mk('gpMsg'); S.res = mk('gpRes');
  S.prompt = mk('gpPrompt', 'button'); S.prompt.type = 'button';
  S.prompt.addEventListener('click', (e) => { e.preventDefault(); key(); });
  S.prompt.addEventListener('touchend', (e) => { e.preventDefault(); key(); });
}

// ------------------------------------------------------------------ race logic
const me = () => (NET && NET.myPeer ? NET.myPeer() : null) || 'me';
const veh = () => G.player.vespa;
const myPos = () => { const v = veh(); return v ? [v.x, v.y] : [G.player.x, G.player.y]; };
function inZone() { const [x, y] = myPos(); return TR.near(x, y).d < TR.hw + ZONE; }
function canStart() { return !!veh() && !G.player.cuffed && !G.player.ko && !G.player.fly && inZone() && !(G.police && G.police.wanted); }
function rivals() { return NET && NET.racers ? NET.racers().filter((r) => r.rc && r.rc.g === S.g) : []; }
// called by the game when R is pressed: true if the race took it
export function key() {
  if (!G.game.started) return false;
  if (S.st === 'w' || S.st === 'r') { abandon('Race abandoned'); return true; }
  if (S.st === 'f') { finishIdle(); if (canStart()) start(); return true; }
  if (canStart()) { start(); return true; }
  return false;
}
function start(g, wait) {
  S.g = g || Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, 'x').padEnd(6, 'k');
  S.st = 'w'; S.cdEnd = S.now + (wait != null ? wait : COUNT); S.seen.add(S.g); S.beep = -1;
  S.res.hidden = true;
  G.toast(g ? 'Joining the race' : 'Kalsa Grand Prix', 'to the grid · 3 laps', 1600);
}
function go() { S.st = 'r'; S.t0 = S.now; S.lapT0 = S.now; S.lap = 0; S.next = 1; S.laps = []; G.sfx.ding && G.sfx.ding(); flash('VIA!', true, 900); }
function abandon(why) { S.st = 'idle'; S.g = null; publish(); if (why) G.toast(why, '', 1300); S.gate.visible = false; S.hud.hidden = true; S.msg.hidden = true; lamps(0); }
function finishIdle() { S.st = 'idle'; S.g = null; S.res.hidden = true; publish(); }
function finish() {
  S.st = 'f'; S.ft = S.now - S.t0; S.resT = 30; S.gate.visible = false;
  const b = store.get(); let rec = '';
  if (!b.best || S.ft < b.best) { b.best = S.ft; rec = 'New record!'; }
  const lapBest = Math.min(...S.laps); if (!b.lap || lapBest < b.lap) b.lap = lapBest;
  store.set(b); S.best = b.best; S.bestLap = b.lap;
  flash('ARRIVO!', true, 1400); G.sfx.ding && G.sfx.ding();
  if (rec) setTimeout(() => G.toast(rec, fmt(S.ft), 1800), 1500);
}
function flash(t, green, ms) { S.msg.textContent = t; S.msg.classList.toggle('go', !!green); S.msg.hidden = false; clearTimeout(S.msgT); S.msgT = setTimeout(() => { S.msg.hidden = true; }, ms); }
function lamps(n, green) { S.lamps.forEach((m, k) => { m.emissiveIntensity = k < n ? 2.4 : 0; m.emissive.set(green ? '#38e05a' : '#ff2a1a'); m.color.set(k < n ? (green ? '#1b6b2a' : '#7a1010') : '#3a0d0d'); }); }
// what the other players see of my race
function publish() {
  if (!NET || !NET.setRace) return;
  let o = null;
  if (S.g && (S.st === 'w' || S.st === 'r' || S.st === 'f')) {
    o = { g: S.g, s: S.st };
    if (S.st === 'w') o.w = Math.max(0, Math.round((S.cdEnd - S.now) * 10) / 10);
    if (S.st === 'r') { o.l = S.lap; o.c = S.next; }
    if (S.st === 'f') { o.ft = Math.round(S.ft * 100) / 100; o.l = LAPS; }
  }
  const k = JSON.stringify(o);
  if (k !== S.lastSent) { S.lastSent = k; NET.setRace(o); }
}
// how far round the race someone is: laps, checkpoints, and the way to the next one
function progress(l, next, x, y) {
  const cp = TR.cps, N = TR.pts.length, a = TR.pts[cp[(next - 1 + NCP) % NCP]], b = TR.pts[cp[next % NCP]];
  const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = Math.hypot(b[0] - x, b[1] - y);
  return l * NCP + ((next - 1 + NCP) % NCP) + G.clamp(1 - d / seg, 0, 1);
}

export function update(dt) {
  S.now += dt;
  const v = veh(), [x, y] = myPos();
  // flags and crowd
  if (S.flags) for (const f of S.flags) { f.rotation.y = Math.sin(S.now * 2.2 + f.userData.ph) * 0.35; }
  if (S.crowd && Math.hypot(x - TR.pts[TR.start][0], y - TR.pts[TR.start][1]) < 220) {
    const [cb, ch] = S.crowd, d = G.dummy || new G.THREE.Object3D(), cheer = S.st === 'r' || S.st === 'f' ? 1 : 0.25;
    for (let k = 0; k < S.crowdBase.length; k += 1) {
      const [bx, by, bz, ph] = S.crowdBase[k], j = Math.max(0, Math.sin(S.now * (6 + (k % 3)) + ph)) * 0.18 * cheer;
      d.position.set(bx, by + j, bz); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); cb.setMatrixAt(k, d.matrix);
      d.position.set(bx, by + 0.42 + j, bz); d.updateMatrix(); ch.setMatrixAt(k, d.matrix);
    }
    cb.instanceMatrix.needsUpdate = true; ch.instanceMatrix.needsUpdate = true;
  }
  // somebody else started a race on the circuit: join in if I'm here with a vehicle
  if (S.st === 'idle' && NET && NET.racers && canStart()) {
    for (const r of NET.racers()) {
      const q = r.rc; if (!q || q.s !== 'w' || S.seen.has(q.g) || q.w < 0.8) continue;
      if (Math.hypot(r.x - x, r.y - y) > 400) continue;
      start(q.g, q.w); break;
    }
  }
  // the prompt to start
  const showPrompt = S.st === 'idle' && canStart() && G.game.started;
  S.prompt.hidden = !showPrompt;
  const pk = G.PAD && G.PAD.active ? 'p' : G.isTouch ? 't' : 'k'; if (showPrompt && S.promptSet !== pk) { S.promptSet = pk; S.prompt.innerHTML = pk === 't' ? 'Tap to start a race' : pk === 'p' ? '<kbd>D-pad ↑</kbd>start a race' : '<kbd>R</kbd>start a race'; }
  if (S.st === 'f') { S.resT -= dt; if (S.resT <= 0 || !inZone()) finishIdle(); else results(); }
  if (S.st === 'w' || S.st === 'r') {
    if (!v || G.player.cuffed || G.player.ko || TR.near(x, y).d > TR.hw + 90) { abandon(v ? 'Race abandoned' : 'Out of the race'); publish(); return; }
  }
  if (S.st === 'w') {
    // line up: slots in the order of everyone's label, so every screen agrees
    const ids = [me(), ...rivals().filter((r) => r.rc.s === 'w').map((r) => r.peer)].sort();
    const k = Math.min(7, ids.indexOf(me()));
    const [gx, gy, ga] = gridSpot(k);
    v.x = gx; v.y = gy; v.heading = ga; v.speed = 0; v.drift = false;
    if (v.mesh) { v.mesh.position.set(gx, 0.09, -gy); v.mesh.rotation.set(0, ga, 0); }
    G.cam.yaw = ga;
    const left = S.cdEnd - S.now, n = left <= 5 ? Math.min(5, Math.floor(6 - left)) : 0;
    lamps(n);
    if (n !== S.beep && n > 0) { S.beep = n; G.sfx.ding && G.sfx.ding(); }
    if (left <= 3 && left > 0) { const t = String(Math.ceil(left)); if (S.msg.textContent !== t || S.msg.hidden) { S.msg.textContent = t; S.msg.classList.remove('go'); S.msg.hidden = false; } }
    if (left <= 0) { lamps(0); go(); }
  }
  if (S.st === 'r') {
    if (S.now - S.t0 < 1.2) lamps(5, true); else lamps(0);
    const p = TR.pts[TR.cps[S.next % NCP]];
    if (Math.hypot(p[0] - x, p[1] - y) < TR.hw + 5) {
      if (S.next % NCP === 0) {
        S.lap++; const lt = S.now - S.lapT0; S.laps.push(lt); S.lapT0 = S.now;
        if (!S.bestLap || lt < S.bestLap) { S.bestLap = lt; }
        if (S.lap >= LAPS) finish(); else { flash(S.lap === LAPS - 1 ? 'ULTIMO GIRO' : 'GIRO ' + (S.lap + 1), false, 1100); G.sfx.ding && G.sfx.ding(); }
        S.next = 1;
      } else S.next++;
    }
    if (S.st === 'r') {
      const gp = TR.pts[TR.cps[S.next % NCP]], gi = TR.cps[S.next % NCP];
      S.gate.visible = true; S.gate.position.set(gp[0], 0, -gp[1]); S.gate.rotation.y = Math.atan2(TR.tan[gi][1], TR.tan[gi][0]);
    }
  }
  // the HUD
  const racing = S.st === 'w' || S.st === 'r';
  S.hud.hidden = !racing || !G.game.started;
  if (racing) {
    const mine = S.st === 'r' ? progress(S.lap, S.next, x, y) : 0;
    const field = rivals().filter((r) => r.rc.s === 'r' || r.rc.s === 'f' || r.rc.s === 'w');
    let ahead = 0;
    for (const r of field) { const q = r.rc; const pr = q.s === 'f' ? 1e6 - q.ft : q.s === 'r' ? progress(q.l, q.c, r.x, r.y) : 0; if (pr > mine) ahead++; }
    const sp = S.hud.querySelectorAll('span');
    sp[0].textContent = (S.st === 'r' ? Math.min(LAPS, S.lap + 1) : 1) + '/' + LAPS;
    sp[1].textContent = (ahead + 1) + '/' + (field.length + 1);
    sp[2].textContent = S.st === 'r' ? fmt(S.now - S.t0) : '0:00.0';
    sp[3].textContent = fmt(S.bestLap);
  }
  publish();
}
function results() {
  const field = rivals();
  const rows = [{ me: true, name: 'You', ft: S.ft, l: LAPS }];
  for (const r of field) rows.push({ me: false, name: NET.nameOf ? NET.nameOf(r) : 'Rival', ft: r.rc.s === 'f' ? r.rc.ft : null, l: r.rc.l || 0 });
  rows.sort((a, b) => (a.ft != null && b.ft != null ? a.ft - b.ft : a.ft != null ? -1 : b.ft != null ? 1 : b.l - a.l));
  const html = `<h3>Kalsa Grand Prix</h3><ol>${rows.map((r, i) => `<li class="${r.me ? 'me' : ''}"><b>${i + 1}</b><span>${esc(r.name)}</span><b>${r.ft != null ? fmt(r.ft) : 'lap ' + Math.min(LAPS, r.l + 1) + '/' + LAPS}</b></li>`).join('')}</ol><p>Best lap ${fmt(S.bestLap)} · record ${fmt(S.best)} · ${G.isTouch ? 'tap the button' : G.PAD && G.PAD.active ? 'press <kbd>D-pad ↑</kbd>' : 'press <kbd>R</kbd>'} to race again</p>`;
  if (html !== S.resHtml) { S.resHtml = html; S.res.innerHTML = html; }
  S.res.hidden = !G.game.started;
  S.prompt.hidden = !G.isTouch; if (G.isTouch) { S.prompt.textContent = 'Race again'; S.promptSet = false; }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const state = () => ({ st: S.st, g: S.g, lap: S.lap, next: S.next, ft: S.ft, now: S.now });
