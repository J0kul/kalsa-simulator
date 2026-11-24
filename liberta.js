// Via Libertà and Politeama: the boulevard's tree-lined islands, and the Famila at Via Libertà 30 (corner of Via Siracusa),
// open 24 hours, with a full shop inside. In the dairy aisle: Paolo, who gets angry about everything.
// Say hello to him and watch what happens when a little old lady asks him where the yoghurt is.
let G = null, T = null, F = null;
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const face = (a) => Math.atan2(Math.cos(a), -Math.sin(a)); // game heading -> model rotation (people face +z)

// the shop floor is built out at sea, where nothing else is, and you're moved there when you walk in
const R = [800, 1380], RW = 36, RD = 26;              // centre and size of the shop floor (game metres)
const IN_DOOR = [10.5, -12.2];                          // the inside of the doors (local)
const PAOLO_SPOT = [-6.2, 11.0], BUCKETS = [-3.4, 10.5], LADY_FROM = [-9.75, 6.4];
const S = {
  inside: false, back: null, door: null, doorN: null, front: null, room: null,
  paolo: null, lady: null, scene: 'idle', st: 0, greeted: 0, cool: 0, grumbleT: 6, now: 0, step: 0,
  shoppers: [], drops: null, puddle: null, bucket: null, buckets: [], pours: 0, seenToast: false,
};
const W2 = (lx, ly) => [R[0] + lx, R[1] + ly];

function M(c, o) { return new T.MeshStandardMaterial({ color: c, roughness: 0.75, ...(o || {}) }); }
const matCache = new Map();
function MC(c, o) { const k = c + JSON.stringify(o || {}); let m = matCache.get(k); if (!m) matCache.set(k, m = M(c, o)); return m; }
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
// plain coloured boxes added to a group marked for batching are merged into a few meshes at the end (one draw call per
// kind of surface instead of hundreds); anything else is a mesh of its own
const BATCHED = { rotation: {}, position: {}, scale: {} };
function addBox(g, w, h, d, col, x, y, z, ry = 0, o) {
  if (g.userData.batch && typeof col === 'string') {
    const geo = new T.BoxGeometry(w, h, d); if (ry) geo.rotateY(ry); geo.translate(x, y, z);
    g.userData.batch.push([geo, col, o ? JSON.stringify(o) : '']);
    return BATCHED;
  }
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? MC(col, o) : col);
  m.position.set(x, y, z); if (ry) m.rotation.y = ry; g.add(m); return m;
}
function flushBatch(g, shadows) {
  const byKind = new Map(), c = new T.Color();
  for (const [geo, col, ok] of g.userData.batch) {
    c.set(col); tint(geo, [c.r, c.g, c.b]);
    let l = byKind.get(ok); if (!l) byKind.set(ok, l = []); l.push(geo);
  }
  for (const [ok, list] of byKind) {
    const m = new T.Mesh(merge(list), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, ...(ok ? JSON.parse(ok) : {}) }));
    m.receiveShadow = true; m.castShadow = !!shadows; g.add(m);
    for (const x of list) x.dispose();
  }
  g.userData.batch = null;
}

export function init(game) {
  G = game; T = G.THREE0 || G.THREE; F = G.libFrame; // plain three.js: everything here picks its own detail
  if (F) { buildBoulevard(); buildFront(); }
  buildRoom(); buildCast();
  return true;
}

// ================================================================== the boulevard
const at = (al, off) => [F.O[0] + F.dx * al + F.nx * off, F.O[1] + F.dy * al + F.ny * off];
function crossings(off) {
  // where the side streets cross this line of the boulevard (no trees there)
  const out = [];
  for (const r of G.roads) {
    if (r.n === 'Via della Libertà') continue;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], oa = F.OF(a[0], a[1]) - off, ob = F.OF(b[0], b[1]) - off;
      if (oa * ob > 0 || oa === ob) continue;
      const t = oa / (oa - ob), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, al = F.AL(x, y);
      if (al > F.a0 - 10 && al < F.a1 + 10) out.push(al);
    }
  }
  return out;
}
function planeTreeGeos() {
  // trunk: pale, peeling plane-tree bark
  const tr = new T.CylinderGeometry(0.15, 0.24, 4.4, 8, 6); tr.translate(0, 2.2, 0);
  const bark = [[0.73, 0.70, 0.60], [0.55, 0.55, 0.45], [0.85, 0.82, 0.71], [0.62, 0.60, 0.48]];
  const p = tr.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) { const h = Math.abs(Math.sin(p.getX(i) * 31 + p.getY(i) * 7.3 + p.getZ(i) * 17)); const c = bark[Math.floor(h * 4) % 4]; cols.push(...c); }
  tr.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  // a few forks
  const parts = [tr];
  for (const [ax, az, len] of [[0.5, 0.2, 1.8], [-0.4, 0.45, 1.6], [0.1, -0.55, 1.7]]) {
    const b = new T.CylinderGeometry(0.07, 0.12, len, 6); b.translate(0, len / 2, 0); b.rotateX(az); b.rotateZ(ax); b.translate(0, 4.0, 0);
    const n = b.attributes.position.count, c = []; for (let i = 0; i < n; i++) c.push(0.6, 0.58, 0.48);
    b.setAttribute('color', new T.Float32BufferAttribute(c, 3)); parts.push(b);
  }
  const trunk = merge(parts);
  // canopy: clumps of leaves
  const greens = [[0.30, 0.47, 0.20], [0.36, 0.54, 0.24], [0.25, 0.41, 0.17], [0.41, 0.58, 0.27]];
  const cl = [];
  for (const [x, y, z, r] of [[0, 6.3, 0, 2.3], [1.5, 5.8, 0.5, 1.7], [-1.4, 6.0, -0.4, 1.8], [0.3, 5.6, 1.6, 1.6], [-0.4, 5.7, -1.6, 1.6], [0.2, 7.4, 0.2, 1.6]]) {
    const s = new T.IcosahedronGeometry(r, 1); s.translate(x, y, z);
    const q = s.attributes.position, c = [];
    for (let i = 0; i < q.count; i++) { const g = greens[Math.floor(Math.abs(Math.sin(q.getX(i) * 13 + q.getZ(i) * 5 + q.getY(i) * 3)) * 4) % 4]; const sh = 0.8 + 0.25 * (q.getY(i) - y + r) / (2 * r); c.push(g[0] * sh, g[1] * sh, g[2] * sh); }
    s.setAttribute('color', new T.Float32BufferAttribute(c, 3)); cl.push(s);
  }
  return { trunk, canopy: merge(cl) };
}
// merges non-indexed copies of geometries that all have position/normal/color
function merge(list) {
  const pos = [], nor = [], col = [];
  for (let g of list) {
    g = g.index ? g.toNonIndexed() : g;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    if (g.attributes.color) col.push(...g.attributes.color.array); else for (let i = 0; i < g.attributes.position.count; i++) col.push(1, 1, 1);
  }
  const m = new T.BufferGeometry();
  m.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); m.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return m;
}
function tint(g, c) { const n = g.attributes.position.count, a = []; for (let i = 0; i < n; i++) a.push(...c); g.setAttribute('color', new T.Float32BufferAttribute(a, 3)); return g; }
function lampGeo() {
  // a Liberty lamp post: fluted cast-iron pole, two curly arms, two lanterns
  const iron = [0.13, 0.20, 0.17], glass = [1.0, 0.93, 0.7], parts = [];
  const base = new T.CylinderGeometry(0.22, 0.3, 0.8, 10); base.translate(0, 0.4, 0); parts.push(tint(base, iron));
  const pole = new T.CylinderGeometry(0.07, 0.11, 4.6, 10); pole.translate(0, 3.0, 0); parts.push(tint(pole, iron));
  const ring = new T.TorusGeometry(0.13, 0.03, 6, 14); ring.rotateX(Math.PI / 2); ring.translate(0, 1.3, 0); parts.push(tint(ring, iron));
  for (const s of [-1, 1]) {
    const arm = new T.TorusGeometry(0.55, 0.035, 6, 14, Math.PI * 0.9); arm.rotateY(s > 0 ? 0 : Math.PI); arm.translate(s * 0.55, 5.0, 0); parts.push(tint(arm, iron));
    const lan = new T.CylinderGeometry(0.2, 0.13, 0.5, 6); lan.translate(s * 1.1, 4.75, 0); parts.push(tint(lan, glass));
    const cap = new T.ConeGeometry(0.26, 0.3, 6); cap.translate(s * 1.1, 5.15, 0); parts.push(tint(cap, iron));
  }
  const top = new T.SphereGeometry(0.1, 8, 6); top.translate(0, 5.45, 0); parts.push(tint(top, iron));
  return merge(parts);
}
function benchGeo() {
  const wood = [0.55, 0.36, 0.2], iron = [0.13, 0.2, 0.17], parts = [];
  for (let i = 0; i < 4; i++) { const sl = new T.BoxGeometry(1.8, 0.04, 0.09); sl.translate(0, 0.45, -0.18 + i * 0.12); parts.push(tint(sl, wood)); }
  for (let i = 0; i < 3; i++) { const sl = new T.BoxGeometry(1.8, 0.09, 0.04); sl.rotateX(-0.25); sl.translate(0, 0.62 + i * 0.13, -0.27 - i * 0.03); parts.push(tint(sl, wood)); }
  for (const x of [-0.75, 0.75]) { const l = new T.BoxGeometry(0.06, 0.45, 0.5); l.translate(x, 0.22, -0.05); parts.push(tint(l, iron)); const b = new T.BoxGeometry(0.06, 0.5, 0.05); b.rotateX(-0.25); b.translate(x, 0.7, -0.3); parts.push(tint(b, iron)); }
  return merge(parts);
}
function buildBoulevard() {
  const vc = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const isles = [];
  for (let i = 1; i < F.lines.length; i++) isles.push((F.lines[i - 1].off + F.lines[i].off) / 2);
  const trees = [], lamps = [], benches = [];
  for (const mid of isles) {
    const cross = crossings(mid), clear = (al, m) => cross.every((c) => Math.abs(c - al) > m);
    for (let al = F.a0 + 6; al < F.a1 - 4; al += 8.5) {
      if (!clear(al, 9)) continue;
      for (const s of [-2.9, 2.9]) trees.push(at(al + (s > 0 ? 4.2 : 0), mid + s));
    }
    for (let al = F.a0 + 10; al < F.a1 - 6; al += 25.5) { if (clear(al, 7)) lamps.push([...at(al, mid), Math.atan2(F.ny, F.nx)]); }
    for (let al = F.a0 + 16; al < F.a1 - 10; al += 34) {
      if (!clear(al, 10)) continue;
      for (const s of [-1, 1]) benches.push([...at(al + 2, mid + s * 1.25), Math.atan2(F.ny * s, F.nx * s)]);
    }
  }
  const { trunk, canopy } = planeTreeGeos();
  const tI = new T.InstancedMesh(trunk, vc, trees.length), cI = new T.InstancedMesh(canopy, vc, trees.length);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), sc = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
  trees.forEach(([x, y], i) => {
    const h = G.hash(x * 0.37 + y * 1.7), s = 0.85 + h * 0.4;
    q.setFromAxisAngle(Y, h * 6.28); p.set(x, 0.09, -y); sc.set(s, s * (0.9 + h * 0.25), s);
    m4.compose(p, q, sc); tI.setMatrixAt(i, m4); cI.setMatrixAt(i, m4);
    G.addSeg([x - 0.25, y - 0.25], [x + 0.25, y - 0.25], 4); G.addSeg([x + 0.25, y - 0.25], [x + 0.25, y + 0.25], 4);
    G.addSeg([x + 0.25, y + 0.25], [x - 0.25, y + 0.25], 4); G.addSeg([x - 0.25, y + 0.25], [x - 0.25, y - 0.25], 4);
  });
  tI.castShadow = true; cI.castShadow = true; cI.receiveShadow = true;
  G.scene.add(tI, cI);
  const lG = lampGeo(), lI = new T.InstancedMesh(lG, vc, lamps.length);
  lamps.forEach(([x, y, a], i) => { q.setFromAxisAngle(Y, a); p.set(x, 0.09, -y); sc.set(1, 1, 1); m4.compose(p, q, sc); lI.setMatrixAt(i, m4); G.addSeg([x - 0.3, y], [x + 0.3, y], 3); G.addSeg([x, y - 0.3], [x, y + 0.3], 3); });
  lI.castShadow = true; G.scene.add(lI);
  const bG = benchGeo(), bI = new T.InstancedMesh(bG, vc, benches.length);
  benches.forEach(([x, y, a], i) => { q.setFromAxisAngle(Y, face(a)); p.set(x, 0.09, -y); sc.set(1, 1, 1); m4.compose(p, q, sc); bI.setMatrixAt(i, m4); });
  G.scene.add(bI);
  // the newspaper kiosk near the Politeama end, and a bus shelter
  if (isles.length) {
    const mid = isles[isles.length - 1], [kx, ky] = at(F.a1 - 30, mid), ang = Math.atan2(F.dy, F.dx);
    kiosk(kx, ky, ang);
    const [bx, by] = at(F.a1 - 120, isles[0] - 3.6); shelter(bx, by, Math.atan2(-F.ny, -F.nx));
  }
  S.trees = trees.length;
}
function kiosk(x, y, ang) {
  const g = new T.Group(); g.position.set(x, 0.09, -y); g.rotation.y = ang;
  const green = '#1f4a3a';
  const body = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 2.5, 8), MC(green)); body.position.y = 1.25; g.add(body);
  const roof = new T.Mesh(new T.ConeGeometry(2.2, 0.8, 8), MC(green)); roof.position.y = 2.9; g.add(roof);
  const fin = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), MC('#c9a13c', { metalness: 0.6 })); fin.position.y = 3.4; g.add(fin);
  const mags = canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = '#efe9da'; c.fillRect(0, 0, w, h);
    const cols = ['#d7261e', '#1d4f9c', '#f2c94c', '#2b2b2e', '#e85d75', '#3d7f5a', '#ff8a3d', '#9b6fd1'];
    for (let i = 0; i < 16; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(6 + (i % 8) * 63, 8 + Math.floor(i / 8) * 76, 56, 70); c.fillStyle = '#fff'; c.fillRect(10 + (i % 8) * 63, 14 + Math.floor(i / 8) * 76, 46, 9); }
  });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    if (i === 0 || i === 4) continue;
    const pane = new T.Mesh(new T.PlaneGeometry(1.15, 0.9), new T.MeshStandardMaterial({ map: mags, roughness: 0.8 }));
    pane.position.set(Math.sin(a) * 1.62, 1.55, Math.cos(a) * 1.62); pane.rotation.y = a; g.add(pane);
  }
  const sign = new T.Mesh(new T.PlaneGeometry(2.4, 0.42), new T.MeshBasicMaterial({ map: canvasTex(512, 96, (c, w, h) => { c.fillStyle = '#1f4a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f6e7b6'; c.font = '700 54px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EDICOLA', w / 2, h / 2 + 3); }), toneMapped: false }));
  sign.position.set(0, 2.35, 1.66); g.add(sign);
  G.scene.add(g);
  for (let i = 0; i < 8; i++) { const a0 = ang + i * Math.PI / 4, a1 = ang + (i + 1) * Math.PI / 4; G.addSeg([x + Math.cos(a0) * 1.7, y + Math.sin(a0) * 1.7], [x + Math.cos(a1) * 1.7, y + Math.sin(a1) * 1.7], 2.5); }
}
function shelter(x, y, ang) {
  const g = new T.Group(); g.position.set(x, 0.09, -y); g.rotation.y = face(ang);
  addBox(g, 3.6, 0.08, 1.5, '#2d3a40', 0, 2.5, 0);
  for (const sx of [-1.7, 1.7]) addBox(g, 0.08, 2.5, 0.08, '#2d3a40', sx, 1.25, -0.6);
  const glass = new T.MeshStandardMaterial({ color: '#9fc6d4', transparent: true, opacity: 0.35, roughness: 0.1 });
  addBox(g, 3.4, 2.0, 0.04, glass, 0, 1.3, -0.62);
  addBox(g, 2.4, 0.06, 0.4, '#8a8f93', 0, 0.48, -0.4);
  const ad = new T.Mesh(new T.PlaneGeometry(1.2, 1.7), new T.MeshBasicMaterial({ map: canvasTex(240, 340, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f59ac4'); gr.addColorStop(1, '#d9558f'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 34px system-ui'; c.textAlign = 'center'; c.fillText('ARANCINA', w / 2, 120); c.fillText('O ARANCINO?', w / 2, 165); c.font = '600 20px system-ui'; c.fillText('vota a Palermo', w / 2, 280); }), toneMapped: false }));
  ad.position.set(1.75, 1.3, -0.1); ad.rotation.y = -Math.PI / 2; g.add(ad);
  const stop = new T.Mesh(new T.PlaneGeometry(0.8, 0.5), new T.MeshBasicMaterial({ map: canvasTex(160, 100, (c, w, h) => { c.fillStyle = '#f2c94c'; c.fillRect(0, 0, w, h); c.fillStyle = '#141116'; c.font = '800 30px system-ui'; c.textAlign = 'center'; c.fillText('FERMATA', w / 2, 44); c.font = '700 22px system-ui'; c.fillText('101 · 102 · 806', w / 2, 80); }), toneMapped: false, side: T.DoubleSide }));
  stop.position.set(-1.7, 2.9, -0.6); g.add(stop);
  G.scene.add(g);
}

// ================================================================== the Famila shop front, Via Libertà 30
function famSign(w, h, sub) {
  return canvasTex(w, h, (c, W, H) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e2401c'; c.fillRect(0, H - Math.round(H * 0.12), W, Math.round(H * 0.12));
    c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillStyle = '#e2401c'; c.font = `800 ${Math.round(H * 0.62)}px "Bricolage Grotesque", system-ui, sans-serif`;
    c.fillText('Famila', W / 2, H * 0.45);
    if (sub) {
      c.fillStyle = '#2a2a2a'; c.font = `700 ${Math.round(H * 0.24)}px system-ui, sans-serif`;
      c.textAlign = 'left'; c.fillText('Via Libertà 30', H * 0.4, H * 0.45);
      c.textAlign = 'right'; c.fillText(sub, W - H * 0.4, H * 0.45);
    }
  });
}
function windowTex() {
  // what you see through the windows: lit aisles, shelves full of colour, people shopping
  return canvasTex(1024, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fbf6e9'); gr.addColorStop(1, '#d9d4c6'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let x = 30; x < w; x += 130) { c.fillStyle = '#fffbe8'; c.fillRect(x, 8, 80, 8); }
    const cols = ['#d7261e', '#1d4f9c', '#f2c94c', '#3d7f5a', '#ff8a3d', '#e85d75', '#ffffff', '#6b4a2e', '#9b6fd1'];
    for (let s = 0; s < 6; s++) {
      const x0 = 20 + s * 170;
      c.fillStyle = '#cfd3d6'; c.fillRect(x0, 70, 120, 170);
      for (let r = 0; r < 5; r++) for (let i = 0; i < 12; i++) { c.fillStyle = cols[(s * 7 + r * 3 + i * 5) % cols.length]; c.fillRect(x0 + 4 + i * 9.5, 78 + r * 32, 8, 22); }
    }
    for (const [x, col] of [[160, '#2b4a7a'], [470, '#a33'], [760, '#3d6b3d']]) { c.fillStyle = col; c.fillRect(x, 150, 34, 70); c.fillStyle = '#e6b08a'; c.beginPath(); c.arc(x + 17, 138, 14, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.18)'; for (let x = -200; x < w; x += 260) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 90, 0); c.lineTo(x + 140, 0); c.lineTo(x + 50, h); c.fill(); }
  });
}
function posterTex(top, big, small, bg, fg) {
  return canvasTex(256, 360, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.textAlign = 'center';
    c.font = '800 30px system-ui'; c.fillText(top, w / 2, 60); c.font = '900 120px system-ui'; c.fillText(big, w / 2, 200); c.font = '700 26px system-ui'; c.fillText(small, w / 2, 300);
  });
}
function buildFront() {
  // the front of the building that faces the boulevard, just south of Via Siracusa
  const side = F.lines[F.lines.length - 1].off;  // the carriageway on the Famila side
  const ALc = 241, WID = 24;
  let face0 = Infinity;
  for (let al = ALc - WID / 2 + 1; al <= ALc + WID / 2 - 1; al += 2.5) {
    const [x0, y0] = at(al, side), [x1, y1] = at(al, side + 25);
    const t = G.rayWalls(x0, y0, 1.5, x1, y1, 1.5);
    if (t < 1) face0 = Math.min(face0, side + 25 * t);
  }
  if (!isFinite(face0)) face0 = side + 6;
  const off = face0 - 0.04;
  const [cx, cy] = at(ALc, off);
  // local frame: +x along the front (away from Politeama), +z out into the street
  const out = [-F.nx, -F.ny], g = new T.Group(); g.userData.batch = [];
  g.position.set(cx, 0.09, -cy); g.rotation.y = Math.atan2(F.dy, F.dx) + Math.PI; // local +z points out of the building
  // big white fascia with the name, and the band of cladding above
  const fascia = new T.Mesh(new T.BoxGeometry(WID, 1.1, 0.35), [MC('#f2f2f0'), MC('#f2f2f0'), MC('#f2f2f0'), MC('#f2f2f0'), new T.MeshBasicMaterial({ map: famSign(2048, 96, 'aperto 24 ore su 24'), toneMapped: false }), MC('#f2f2f0')]);
  fascia.position.set(0, 3.35, 0.22); g.add(fascia);
  addBox(g, WID + 0.4, 0.1, 0.5, '#e2401c', 0, 2.62, 0.25);
  // glass shop windows with the shop inside behind them, aluminium mullions, posters
  const glass = new T.Mesh(new T.PlaneGeometry(WID - 0.4, 2.4), new T.MeshBasicMaterial({ map: windowTex(), toneMapped: false }));
  glass.position.set(0, 1.35, 0.06); g.add(glass);
  for (let x = -WID / 2 + 0.2; x <= WID / 2 - 0.1; x += 2.0) addBox(g, 0.1, 2.5, 0.14, '#9aa1a6', x, 1.3, 0.1, 0, { metalness: 0.6, roughness: 0.35 });
  addBox(g, WID, 0.12, 0.16, '#9aa1a6', 0, 2.56, 0.1, 0, { metalness: 0.6, roughness: 0.35 });
  addBox(g, WID, 0.3, 0.18, '#6c7276', 0, 0.15, 0.1);
  const posters = [['OFFERTA', '3x2', 'su tutti i yogurt', '#ffe14d', '#d7261e'], ['SOLO OGGI', '-30%', 'pasta e sughi', '#d7261e', '#fff'], ['FRESCO', 'H24', 'sempre aperti', '#1d4f9c', '#fff'], ['NOVITÀ', '€0,99', 'cannoli mignon', '#ffe14d', '#1d4f9c']];
  posters.forEach((p, i) => { const m = new T.Mesh(new T.PlaneGeometry(0.85, 1.2), new T.MeshBasicMaterial({ map: posterTex(...p), toneMapped: false })); m.position.set(-10 + i * 2.6 + (i > 1 ? 9.8 : 0), 1.3, 0.08); g.add(m); });
  // the automatic sliding doors, with a canopy and ENTRATA / USCITA stickers
  const DX = 3.0;
  const door = (x, w) => { addBox(g, w, 2.4, 0.06, new T.MeshStandardMaterial({ color: '#9fc6d4', transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.2 }), x, 1.2, 0.16); };
  door(DX - 0.85, 1.6); door(DX + 0.85, 1.6);
  addBox(g, 3.8, 0.14, 0.2, '#9aa1a6', DX, 2.47, 0.16, 0, { metalness: 0.6 });
  addBox(g, 4.4, 0.12, 1.6, '#e2401c', DX, 2.75, 0.9);
  const stk = new T.Mesh(new T.PlaneGeometry(1.3, 0.3), new T.MeshBasicMaterial({ map: canvasTex(260, 60, (c, w, h) => { c.fillStyle = '#e2401c'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 34px system-ui'; c.textAlign = 'center'; c.fillText('ENTRATA ▸', w / 2, 44); }), toneMapped: false }));
  stk.position.set(DX, 1.75, 0.2); g.add(stk);
  // a projecting sign you see from down the boulevard
  const blade = new T.Mesh(new T.BoxGeometry(0.2, 1.6, 1.6), [new T.MeshBasicMaterial({ map: famSign(256, 256), toneMapped: false }), new T.MeshBasicMaterial({ map: famSign(256, 256), toneMapped: false }), MC('#ffffff'), MC('#ffffff'), MC('#ffffff'), MC('#ffffff')]);
  blade.position.set(WID / 2 - 0.6, 6.0, 0.9); g.add(blade);
  addBox(g, 0.08, 0.08, 1.0, '#6c7276', WID / 2 - 0.6, 6.85, 0.5);
  // trolleys lined up outside, a bike rack and a sandwich board
  for (let i = 0; i < 6; i++) trolley(g, -7.6 + i * 0.42, 0.95, Math.PI / 2, 0.92);
  addBox(g, 3.0, 0.9, 0.05, '#9aa1a6', -6.5, 0.5, 0.45, 0, { metalness: 0.6 }); addBox(g, 3.0, 0.9, 0.05, '#9aa1a6', -6.5, 0.5, 1.45, 0, { metalness: 0.6 });
  const board = new T.Mesh(new T.PlaneGeometry(0.7, 1.0), new T.MeshBasicMaterial({ map: posterTex('OFFERTE', '%', 'della settimana', '#141116', '#ffe14d'), toneMapped: false, side: T.DoubleSide }));
  board.position.set(6.5, 0.6, 1.4); board.rotation.x = -0.2; g.add(board);
  for (let i = 0; i < 4; i++) { const hoop = new T.Mesh(new T.TorusGeometry(0.4, 0.03, 6, 16, Math.PI), MC('#6c7276', { metalness: 0.6 })); hoop.position.set(8.4 + i * 0.7, 0.05, 1.2); g.add(hoop); }
  flushBatch(g, true);
  G.scene.add(g);
  S.front = g;
  const [dx, dy] = at(ALc - DX, off);
  S.door = [dx + out[0] * 0.9, dy + out[1] * 0.9]; S.doorN = out;
  S.frontInfo = { off, ALc, WID };
}

// ================================================================== the shop floor
function trolley(g, x, z, ry, s = 1) {
  const t = new T.Group(); t.position.set(x, 0, z); t.rotation.y = ry; t.scale.setScalar(s);
  const steel = MC('#b9c0c5', { metalness: 0.7, roughness: 0.3 });
  addBox(t, 0.5, 0.42, 0.85, new T.MeshStandardMaterial({ color: '#b9c0c5', metalness: 0.7, roughness: 0.3, wireframe: true }), 0, 0.68, 0);
  addBox(t, 0.5, 0.02, 0.85, steel, 0, 0.47, 0);
  addBox(t, 0.54, 0.05, 0.05, MC('#e2401c'), 0, 1.0, 0.47);
  for (const [a, b] of [[-0.22, -0.38], [0.22, -0.38], [-0.22, 0.38], [0.22, 0.38]]) { addBox(t, 0.03, 0.42, 0.03, steel, a, 0.24, b); const w = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.04, 10), MC('#222')); w.rotation.z = Math.PI / 2; w.position.set(a, 0.05, b); t.add(w); }
  g.add(t); return t;
}
const PRODUCT_COLS = {
  pasta: ['#1d4f9c', '#2a62b8', '#f2c94c', '#ffffff', '#d7261e'], conserve: ['#d7261e', '#b31b1b', '#3d7f5a', '#f2c94c', '#ffffff'],
  colazione: ['#f2c94c', '#8a5a2b', '#d7261e', '#ffffff', '#e85d75', '#6b4a2e'], dolci: ['#e85d75', '#9b6fd1', '#ff8a3d', '#6b4a2e', '#f2c94c', '#d7261e'],
  detersivi: ['#3d7fd9', '#6fd3ff', '#ffffff', '#f59ac4', '#6fbf73', '#ff8a3d'], cura: ['#ffffff', '#f59ac4', '#9b6fd1', '#6fd3ff', '#2b2b2e'],
  bevande: ['#d7261e', '#3d7fd9', '#6fbf73', '#ff8a3d', '#ffffff', '#2b2b2e'],
};
function buildRoom() {
  const g = new T.Group(); g.position.set(R[0], 0, -R[1]); g.userData.batch = [];
  const x0 = -RW / 2, x1 = RW / 2, y0 = -RD / 2, y1 = RD / 2;
  // a solid base under everything, then the tiled floor
  addBox(g, RW + 1, 1.2, RD + 1, '#6b6f72', 0, -0.6, 0);
  {
    const v = [], c = [], t = 0.6;
    for (let i = 0; i < RW / t; i++) for (let j = 0; j < RD / t; j++) {
      const a = x0 + i * t, b = y0 + j * t, h = G.hash(i * 7.1 + j * 3.3), k = 0.86 + h * 0.06 - ((i + j) % 2) * 0.03;
      const col = [k, k * 0.985, k * 0.955];
      v.push(a, 0.02, -b, a + t, 0.02, -b, a + t, 0.02, -(b + t), a, 0.02, -b, a + t, 0.02, -(b + t), a, 0.02, -(b + t));
      for (let q = 0; q < 6; q++) c.push(...col);
    }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(v, 3)); fg.setAttribute('color', new T.Float32BufferAttribute(c, 3)); fg.computeVertexNormals();
    const f = new T.Mesh(fg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.05, side: T.DoubleSide })); f.receiveShadow = true; g.add(f);
  }
  const solids = [];
  const solid = (ax, ay, bx, by, h = 2.2) => solids.push([Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), h]);
  // walls: white with a red band and big department boards
  const WH = 3.6;
  const wall = (ax, ay, bx, by, gaps = []) => {
    const len = hyp(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, ang = Math.atan2(by - ay, bx - ax);
    let s0 = 0; const pieces = [];
    for (const [g0, g1] of gaps.concat([[len, len]])) { if (g0 > s0) pieces.push([s0, g0]); s0 = g1; }
    for (const [p0, p1] of pieces) {
      const mid = (p0 + p1) / 2, px = ax + ux * mid, py = ay + uy * mid, w = p1 - p0;
      addBox(g, w, WH, 0.3, '#f4f2ee', px, WH / 2, -py, ang);
      addBox(g, w, 0.35, 0.32, '#e2401c', px, 2.55, -py, ang);
      addBox(g, w, 0.18, 0.33, '#7a7f83', px, 0.09, -py, ang);
      G.addSeg(W2(ax + ux * p0, ay + uy * p0), W2(ax + ux * p1, ay + uy * p1), WH);
    }
  };
  wall(x0, y0, x1, y0, [[x1 - x0 - 9.2, x1 - x0 - 5.8]]); // south, with the doors
  wall(x1, y0, x1, y1); wall(x1, y1, x0, y1); wall(x0, y1, x0, y0);
  // the glass doors from inside, with the street beyond
  const dg = new T.Mesh(new T.PlaneGeometry(3.4, 2.8), new T.MeshBasicMaterial({ map: canvasTex(256, 200, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fd2ec'); gr.addColorStop(0.6, '#e8e1d0'); gr.addColorStop(1, '#8a8a86'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#5a7a3a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(20 + i * 55, 80, 28, 0, 7); c.fill(); } c.fillStyle = '#d9c9a7'; c.fillRect(0, 100, w, 30); }), toneMapped: false }));
  dg.position.set(10.5, 1.4, -(y0 - 0.2)); dg.rotation.y = Math.PI; g.add(dg);
  const dm = new T.Mesh(new T.PlaneGeometry(3.2, 1.6), MC('#3a3d40', { roughness: 0.95 })); dm.rotation.x = -Math.PI / 2; dm.position.set(10.5, 0.03, -(y0 + 1.2)); g.add(dm);
  const boards = [[0, y1 - 0.17, 0, 'LATTICINI E YOGURT', '#1d4f9c'], [x0 + 0.17, 1, Math.PI / 2, 'PANETTERIA · GASTRONOMIA', '#8a5a2b'], [x1 - 0.17, -3, -Math.PI / 2, 'FRUTTA E VERDURA', '#3d7f5a'], [x1 - 0.17, 9, -Math.PI / 2, 'SURGELATI', '#3d7fd9']];
  for (const [x, y, ry, text, col] of boards) {
    const m = new T.Mesh(new T.PlaneGeometry(8, 0.8), new T.MeshBasicMaterial({ map: canvasTex(1024, 100, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 58px "Bricolage Grotesque", system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 3); }), toneMapped: false }));
    m.position.set(x, 3.15, -y); m.rotation.y = ry + (ry === 0 ? Math.PI : 0); g.add(m);
  }
  // ceiling light strips along the top of the walls (there's no ceiling: the camera looks in from above)
  for (let x = x0 + 2; x < x1 - 1; x += 4) { const l = new T.Mesh(new T.BoxGeometry(2.4, 0.08, 0.25), new T.MeshBasicMaterial({ color: '#fffbe8' })); l.position.set(x, 3.4, -(y1 - 0.35)); g.add(l); }

  // ---------- the aisles: double-sided shelving full of products
  const prodBox = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ roughness: 0.6 }), 6000);
  const prodCan = new T.InstancedMesh(new T.CylinderGeometry(0.5, 0.5, 1, 10), new T.MeshStandardMaterial({ roughness: 0.4, metalness: 0.25 }), 3000);
  let nb = 0, nc = 0;
  const m4 = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), sc = new T.Vector3(), col = new T.Color();
  const putBox = (x, y, z, sx, sy, sz, c) => { if (nb >= 6000) return; p.set(x, y, z); q.identity(); sc.set(sx, sy, sz); prodBox.setMatrixAt(nb, m4.compose(p, q, sc)); prodBox.setColorAt(nb++, col.set(c)); };
  const putCan = (x, y, z, r, h, c) => { if (nc >= 3000) return; p.set(x, y, z); q.identity(); sc.set(r * 2, h, r * 2); prodCan.setMatrixAt(nc, m4.compose(p, q, sc)); prodCan.setColorAt(nc++, col.set(c)); };
  const TIERS = [0.12, 0.5, 0.88, 1.26, 1.64];
  const fillRun = (x, ly0, ly1, faceDir, kind, depth = 0.42) => {
    // a run of shelf facing faceDir (+1 = towards +x), products from ly0 to ly1
    const cols = PRODUCT_COLS[kind];
    TIERS.forEach((ty, r) => {
      let y = ly0 + 0.05, k = 0;
      while (y < ly1 - 0.1) {
        const h = G.hash(x * 3.1 + y * 7.7 + r * 1.3), c = cols[Math.floor(h * cols.length)];
        const isCan = kind === 'conserve' ? h > 0.35 : kind === 'bevande' ? h > 0.2 : h > 0.85;
        const w = isCan ? 0.09 + h * 0.04 : 0.07 + h * 0.16, ht = isCan ? 0.12 + h * 0.18 : 0.16 + G.hash(y * 9 + r) * 0.16;
        const n = 2 + Math.floor(G.hash(y * 5 + r * 2) * 2);
        for (let d = 0; d < n; d++) {
          const xx = x + faceDir * (0.06 + d * (depth / n)) * -1 + faceDir * 0.02;
          if (isCan) putCan(xx, ty + ht / 2 + 0.03, -(y + w / 2), w / 2, ht, c); else putBox(xx, ty + ht / 2 + 0.03, -(y + w / 2), 0.16, ht, w, c);
        }
        y += w + 0.015; k++;
      }
    });
  };
  const gondola = (gx, ly0, ly1, kindA, kindB, num, label) => {
    const len = ly1 - ly0, mid = (ly0 + ly1) / 2;
    addBox(g, 0.1, 1.95, len, '#d7dadc', gx, 0.98, -mid);                       // back panel
    addBox(g, 1.0, 0.1, len, '#7a7f83', gx, 0.05, -mid);                        // plinth
    for (const ty of TIERS.slice(1)) addBox(g, 0.98, 0.03, len, '#c4c8cb', gx, ty, -mid);
    addBox(g, 1.0, 0.04, len, '#c4c8cb', gx, 1.97, -mid);
    for (const sx of [-1, 1]) for (const ty of TIERS) addBox(g, 0.01, 0.05, len, '#ffe14d', gx + sx * 0.5, ty + 0.06, -mid); // price strips
    fillRun(gx + 0.48, ly0, ly1, 1, kindA); fillRun(gx - 0.48, ly0, ly1, -1, kindB);
    // promo end caps
    for (const ey of [ly0 - 0.45, ly1 + 0.45]) {
      addBox(g, 1.0, 0.1, 0.8, '#7a7f83', gx, 0.05, -ey);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) putBox(gx - 0.33 + j * 0.33, 0.25 + i * 0.3, -ey, 0.3, 0.28, 0.6, PRODUCT_COLS[kindA][(i + j) % PRODUCT_COLS[kindA].length]);
      const cap = new T.Mesh(new T.PlaneGeometry(0.9, 0.35), new T.MeshBasicMaterial({ map: canvasTex(180, 70, (c, w, h) => { c.fillStyle = '#ffe14d'; c.fillRect(0, 0, w, h); c.fillStyle = '#d7261e'; c.font = '900 40px system-ui'; c.textAlign = 'center'; c.fillText(G.hash(gx + ey) > 0.5 ? '3x2' : '-20%', w / 2, 50); }), toneMapped: false, side: T.DoubleSide }));
      cap.position.set(gx, 1.85, -(ey + (ey < mid ? -0.42 : 0.42))); g.add(cap);
    }
    solid(gx - 0.5, ly0 - 0.85, gx + 0.5, ly1 + 0.85);
    // the hanging aisle sign
    const sgn = new T.Mesh(new T.PlaneGeometry(1.8, 0.6), new T.MeshBasicMaterial({ map: canvasTex(360, 120, (c, w, h) => { c.fillStyle = '#1d4f9c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe14d'; c.beginPath(); c.arc(56, 60, 38, 0, 7); c.fill(); c.fillStyle = '#1d4f9c'; c.font = '900 52px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(num, 56, 63); c.fillStyle = '#fff'; c.font = '800 30px system-ui'; c.textAlign = 'left'; c.fillText(label, 104, 63); }), toneMapped: false, side: T.DoubleSide }));
    sgn.position.set(gx, 2.9, -(ly0 - 1)); sgn.rotation.x = -0.35; g.add(sgn);
  };
  const AISLES = [[-15, 'pasta', 'conserve', '1', 'PASTA · RISO'], [-11.5, 'conserve', 'colazione', '2', 'CONSERVE'], [-8, 'colazione', 'dolci', '3', 'COLAZIONE'], [-4.5, 'dolci', 'bevande', '4', 'DOLCI · SNACK'], [-1, 'detersivi', 'cura', '5', 'DETERSIVI'], [2.5, 'cura', 'detersivi', '6', 'CURA PERSONA']];
  for (const [gx, a, b, n, l] of AISLES) gondola(gx, -3.2, 7.2, a, b, n, l);

  // ---------- the dairy: open fridges along the back wall, glowing, full of yoghurt, milk and cheese
  const fx0 = -17.5, fx1 = 5.5, fy = y1 - 0.75;
  addBox(g, fx1 - fx0, 2.2, 1.0, '#e8eaec', (fx0 + fx1) / 2, 1.1, -(fy + 0.15));
  addBox(g, fx1 - fx0, 1.9, 0.05, new T.MeshBasicMaterial({ color: '#f4fbff' }), (fx0 + fx1) / 2, 1.15, -(fy + 0.08)); // lit back
  addBox(g, fx1 - fx0, 0.25, 1.05, '#1d4f9c', (fx0 + fx1) / 2, 2.25, -(fy + 0.1));
  for (const ty of [0.35, 0.75, 1.15, 1.55]) addBox(g, fx1 - fx0, 0.03, 0.6, '#d0d6da', (fx0 + fx1) / 2, ty, -(fy - 0.1));
  addBox(g, fx1 - fx0, 0.35, 0.08, '#c4c8cb', (fx0 + fx1) / 2, 0.18, -(fy - 0.42));
  const pot = new T.InstancedMesh(new T.CylinderGeometry(0.045, 0.036, 0.085, 10), new T.MeshStandardMaterial({ roughness: 0.5 }), 2600);
  const lid = new T.InstancedMesh(new T.CylinderGeometry(0.047, 0.047, 0.008, 10), new T.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }), 2600);
  let np = 0;
  const lidCols = ['#d7261e', '#1d4f9c', '#f2c94c', '#e85d75', '#6fbf73', '#9b6fd1', '#ff8a3d', '#ffffff'];
  for (const [ti, ty] of [[0, 0.38], [1, 0.78]].concat([[2, 1.18]])) {
    for (let x = fx0 + 0.2; x < fx1 - 0.2; x += 0.1) for (let d = 0; d < 4; d++) {
      if (np >= 2600) break;
      const lc = lidCols[Math.floor(G.hash(Math.floor(x * 1.4) * 3.3 + ti) * lidCols.length)];
      p.set(x, ty + 0.045, -(fy - 0.3 + d * 0.11)); q.identity(); sc.set(1, 1, 1);
      pot.setMatrixAt(np, m4.compose(p, q, sc)); pot.setColorAt(np, col.set('#fbfaf6'));
      p.y = ty + 0.093; lid.setMatrixAt(np, m4.compose(p, q, sc)); lid.setColorAt(np, col.set(lc)); np++;
    }
  }
  pot.count = np; lid.count = np; g.add(pot, lid);
  for (let x = fx0 + 0.2; x < fx1 - 0.2; x += 0.13) for (let d = 0; d < 3; d++) {         // milk and cartons on the top shelf
    const h = G.hash(x * 5.3 + d), c = h > 0.6 ? '#3d7fd9' : h > 0.3 ? '#ffffff' : '#6fbf73';
    putBox(x, 1.58 + 0.13, -(fy - 0.25 + d * 0.15), 0.08, 0.24, 0.08, c);
  }
  for (let x = fx0 + 0.3; x < fx1 - 0.3; x += 0.32) { const h = G.hash(x * 2.9); putCan(x, 0.12 + 0.05, -(fy - 0.2), 0.13, 0.09, h > 0.5 ? '#f2d16b' : '#f6e7b6'); } // cheese wheels at the bottom
  for (const [x, t] of [[-14, 'YOGURT'], [-8, 'YOGURT'], [-2, 'LATTE FRESCO'], [3.5, 'FORMAGGI']]) {
    const m = new T.Mesh(new T.PlaneGeometry(1.6, 0.22), new T.MeshBasicMaterial({ map: canvasTex(320, 44, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d4f9c'; c.font = '800 30px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2 + 2); }), toneMapped: false }));
    m.position.set(x, 2.25, -(fy - 0.43)); m.rotation.y = Math.PI; g.add(m);
  }
  solid(fx0, fy - 0.45, fx1, y1);
  // the pallet of big 5 kg yoghurt buckets (one of them is about to be used)
  addBox(g, 1.3, 0.14, 1.0, '#b08a5a', BUCKETS[0], 0.07, -BUCKETS[1]);
  const bucketGeo = bucketMesh();
  for (let i = 0; i < 6; i++) {
    const b = bucketGeo.clone(); const bx = BUCKETS[0] - 0.42 + (i % 3) * 0.42, by = BUCKETS[1] - 0.22 + Math.floor(i / 3) * 0.44;
    b.position.set(bx, 0.14 + 0.18, -by); g.add(b); S.buckets.push(b);
  }
  const bs = new T.Mesh(new T.PlaneGeometry(0.9, 0.5), new T.MeshBasicMaterial({ map: posterTex('YOGURT BIANCO', '5 kg', 'formato famiglia', '#ffffff', '#1d4f9c'), toneMapped: false, side: T.DoubleSide }));
  bs.position.set(BUCKETS[0], 1.15, -(BUCKETS[1] - 0.55)); bs.scale.set(1, 0.7, 1); g.add(bs);
  addBox(g, 0.04, 0.9, 0.04, '#9aa1a6', BUCKETS[0], 0.6, -(BUCKETS[1] - 0.55));
  solid(BUCKETS[0] - 0.65, BUCKETS[1] - 0.5, BUCKETS[0] + 0.65, BUCKETS[1] + 0.5, 0.6);

  // ---------- bakery and deli along the west wall: glass counter, hams hanging, bread on the shelves behind
  const dx0 = x0 + 0.2;
  addBox(g, 1.0, 2.3, 13, '#8a5a2b', dx0 + 0.5, 1.15, -1.5);                                   // shelves behind
  for (let y = -7.5; y < 4.5; y += 0.45) for (const ty of [0.6, 1.1, 1.6]) { const h = G.hash(y * 3 + ty); putCan(dx0 + 0.75, ty + 0.1, -y, 0.16 + h * 0.06, 0.12, h > 0.5 ? '#d9a35c' : '#c88a3e'); }
  const cx0 = x0 + 2.4;
  addBox(g, 0.9, 0.95, 12, '#f4f2ee', cx0, 0.48, -1.5);
  addBox(g, 0.9, 0.06, 12, '#c4c8cb', cx0, 0.97, -1.5);
  addBox(g, 0.8, 0.45, 11.8, new T.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.3, roughness: 0.05 }), cx0 + 0.05, 1.22, -1.5);
  for (let y = -7.2; y < 4.2; y += 0.38) { const h = G.hash(y * 7.9); putBox(cx0, 1.06, -y, 0.5, 0.1, 0.3, h > 0.66 ? '#e88a8a' : h > 0.33 ? '#f2d16b' : '#c25a4a'); }
  for (let y = -6.5; y < 4; y += 1.1) { const ham = new T.Mesh(new T.SphereGeometry(0.18, 10, 8), MC('#9a4a3a')); ham.scale.set(1, 1.9, 1); ham.position.set(dx0 + 1.4, 2.2, -y); g.add(ham); addBox(g, 0.02, 0.4, 0.02, '#ddd', dx0 + 1.4, 2.75, -y); }
  addBox(g, 0.05, 0.05, 12, '#9aa1a6', dx0 + 1.4, 2.95, -1.5);
  solid(x0, -7.5, cx0 + 0.45, 4.5);

  // ---------- fruit and veg: angled crates by the entrance
  const fruitCols = [['#ff8a3d', 0.07], ['#d7261e', 0.07], ['#8fd14f', 0.065], ['#f2d22c', 0.06], ['#6b2a5a', 0.08], ['#e5452c', 0.06], ['#3d7f2a', 0.09], ['#f6e7b6', 0.08]];
  const fruit = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ roughness: 0.55 }), 2600);
  let nf = 0;
  for (const [tx, ty] of [[9.5, -2], [13.5, -2], [9.5, 2.2], [13.5, 2.2]]) {
    addBox(g, 3.0, 0.75, 1.6, '#8a5a2b', tx, 0.38, -ty);
    for (let i = 0; i < 4; i++) {
      const [c, r] = fruitCols[(Math.floor(tx + ty * 3) + i) % fruitCols.length];
      const cxr = tx - 1.1 + i * 0.73;
      addBox(g, 0.68, 0.14, 1.5, '#c9a46a', cxr, 0.82, -ty);
      for (let a = 0; a < 8; a++) for (let b = 0; b < 18; b++) {
        if (nf >= 2600) break;
        const xx = cxr - 0.28 + a * 0.08 + (b % 2) * 0.03, yy = ty - 0.68 + b * 0.08, zz = 0.92 + G.hash(nf) * 0.03;
        p.set(xx, zz, -yy); q.identity(); sc.setScalar(r * (0.85 + G.hash(nf * 3) * 0.3));
        fruit.setMatrixAt(nf, m4.compose(p, q, sc)); fruit.setColorAt(nf++, col.set(c));
      }
    }
    solid(tx - 1.55, ty - 0.85, tx + 1.55, ty + 0.85, 1.0);
  }
  fruit.count = nf; g.add(fruit);
  addBox(g, 0.4, 0.15, 0.35, '#f4f2ee', 15.6, 1.0, 0.1); addBox(g, 0.5, 0.95, 0.4, '#7a7f83', 15.6, 0.48, 0.1); solid(15.35, -0.15, 15.85, 0.35, 1);
  // drinks along the east wall
  addBox(g, 0.7, 2.0, 9, '#d7dadc', x1 - 0.45, 1.0, -(-4.8));
  fillRun(x1 - 0.8, -9.3, -0.3, -1, 'bevande', 0.5);
  solid(x1 - 0.85, -9.3, x1, -0.3);
  // freezers: an island of chest freezers and the upright ones on the east wall
  for (const fxp of [10.5, 14]) {
    addBox(g, 3.2, 0.85, 1.4, '#f4f2ee', fxp, 0.43, -9.5);
    addBox(g, 3.1, 0.04, 1.3, new T.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.45, roughness: 0.05 }), fxp, 0.88, -9.5);
    for (let i = 0; i < 26; i++) putBox(fxp - 1.4 + (i % 13) * 0.22, 0.7, -(9.5 - 0.3 + Math.floor(i / 13) * 0.6), 0.2, 0.14, 0.5, ['#3d7fd9', '#ffffff', '#d7261e', '#6fd3ff', '#f2c94c'][i % 5]);
  }
  solid(8.85, 8.75, 15.65, 10.25, 1.0);
  addBox(g, 0.9, 2.1, 6.5, '#e8eaec', x1 - 0.5, 1.05, -8.8);
  addBox(g, 0.05, 1.8, 6.3, new T.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.5, roughness: 0.05 }), x1 - 0.97, 1.1, -8.8);
  fillRun(x1 - 0.9, 5.7, 11.9, -1, 'detersivi', 0.5);
  solid(x1 - 0.95, 5.5, x1, 12.1);

  // ---------- the tills, with belts, scanners and the sweets nobody needs
  for (const tx of [-9, -4, 1]) {
    addBox(g, 0.85, 0.88, 3.4, '#e9e7e2', tx, 0.44, -(-8));
    addBox(g, 0.6, 0.02, 2.4, '#1c1c1e', tx, 0.89, -(-7.6));
    addBox(g, 0.5, 0.35, 0.4, '#2b2b2e', tx + 0.05, 1.05, -(-9.1));
    addBox(g, 0.3, 0.25, 0.04, new T.MeshBasicMaterial({ color: '#7fd1ff' }), tx + 0.05, 1.32, -(-9.32));
    addBox(g, 0.14, 0.04, 0.2, '#2b2b2e', tx - 0.25, 0.92, -(-8.8));
    addBox(g, 0.5, 1.2, 0.5, '#e2401c', tx + 0.05, 0.6, -(-10.0));
    for (let i = 0; i < 12; i++) putBox(tx - 0.2 + (i % 3) * 0.2, 0.75 + Math.floor(i / 3) * 0.25, -(-6.0), 0.16, 0.2, 0.08, ['#e85d75', '#f2c94c', '#9b6fd1', '#d7261e'][i % 4]);
    addBox(g, 0.5, 1.6, 0.25, '#c4c8cb', tx, 0.8, -(-6.0));
    addBox(g, 0.04, 2.6, 0.04, '#9aa1a6', tx + 0.42, 1.3, -(-9.6));
    const num = new T.Mesh(new T.BoxGeometry(0.3, 0.3, 0.06), new T.MeshBasicMaterial({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#e2401c'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 44px system-ui'; c.textAlign = 'center'; c.fillText(String((tx + 14) / 5), w / 2, 48); }), toneMapped: false }));
    num.position.set(tx + 0.42, 2.7, -(-9.6)); g.add(num);
    solid(tx - 0.45, -10.25, tx + 0.45, -5.85);
  }
  // trolleys and baskets by the doors
  for (let i = 0; i < 7; i++) trolley(g, 14.2 + i * 0.36, -(-11.4), 0, 0.95);
  solid(13.8, -12.2, 17.0, -10.6, 1.1);
  for (let i = 0; i < 6; i++) addBox(g, 0.5, 0.25, 0.36, '#e2401c', 6.6, 0.14 + i * 0.12, -(-11.8));
  solid(6.3, -12.0, 6.9, -11.6, 0.8);
  const gate = (gx) => { addBox(g, 0.12, 1.5, 0.5, '#c4c8cb', gx, 0.75, -(-11.9)); solid(gx - 0.08, -12.2, gx + 0.08, -11.6, 1.5); };
  gate(8.6); gate(12.4);

  flushBatch(g, false);
  g.add(prodBox, prodCan);
  prodBox.count = nb; prodCan.count = nc;
  prodBox.instanceMatrix.needsUpdate = true; prodCan.instanceMatrix.needsUpdate = true;
  G.scene.add(g); S.room = g;
  for (const [ax, ay, bx, by, h] of solids) {
    const A = W2(ax, ay), B = W2(bx, ay), C = W2(bx, by), D = W2(ax, by);
    G.addSeg(A, B, h); G.addSeg(B, C, h); G.addSeg(C, D, h); G.addSeg(D, A, h);
  }
  S.items = nb + nc + np * 2 + nf;
  // the yoghurt that's going to fly: drops, and a puddle that grows
  S.drops = new T.InstancedMesh(new T.SphereGeometry(0.05, 8, 6), new T.MeshStandardMaterial({ color: '#fbfaf3', roughness: 0.25 }), 140);
  S.drops.count = 0; S.drops.frustumCulled = false; G.scene.add(S.drops); S.dropList = [];
  S.puddle = new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshStandardMaterial({ color: '#fbfaf3', roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }));
  S.puddle.rotation.x = -Math.PI / 2; S.puddle.visible = false; G.scene.add(S.puddle);
}
function bucketMesh() {
  const g = new T.Group();
  const label = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d4f9c'; c.fillRect(0, 18, w, 60); c.fillStyle = '#fff'; c.font = '800 30px system-ui'; c.textAlign = 'center'; c.fillText('YOGURT BIANCO', w / 2, 52); c.font = '700 16px system-ui'; c.fillText('INTERO · 5 kg', w / 2, 72); });
  const body = new T.Mesh(new T.CylinderGeometry(0.2, 0.17, 0.36, 18, 1, true), new T.MeshStandardMaterial({ map: label, roughness: 0.4, side: T.DoubleSide }));
  g.add(body);
  const bottom = new T.Mesh(new T.CircleGeometry(0.17, 18), MC('#f4f4f2')); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.18; g.add(bottom);
  const lidM = new T.Mesh(new T.CylinderGeometry(0.21, 0.21, 0.03, 18), MC('#1d4f9c', { roughness: 0.3 })); lidM.position.y = 0.19; lidM.name = 'lid'; g.add(lidM);
  const fill = new T.Mesh(new T.CircleGeometry(0.19, 18), MC('#fbfaf3', { roughness: 0.2 })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.15; fill.name = 'fill'; g.add(fill);
  const handle = new T.Mesh(new T.TorusGeometry(0.2, 0.012, 6, 18, Math.PI), MC('#9aa1a6', { metalness: 0.6 })); handle.position.y = 0.16; handle.rotation.y = Math.PI / 2; g.add(handle);
  return g;
}

// ================================================================== the people inside
const LOOK_PAOLO = { v: 2, name: 'Paolo', kind: 'custom', behaviour: 'hang', skin: '#d99a78', height: 1.0, build: 'belly', face: 'square', eyes: '#3b2a1e', brows: 'angry', nose: 'big', mouth: 'frown', hair: 'receding', hairColor: '#5a4a3a', facial: 'mustache', facialColor: '#4a3a2a', glasses: 'none', hat: 'none', top: 'polo', c1: '#7a1f24', c2: '#7a1f24', pattern: 'solid', tie: 'none', bottom: 'trousers', bottomColor: '#4a4a52', shoes: 'shoes', shoeColor: '#2a2018' };
const LOOK_LADY = { v: 2, name: 'Signora', kind: 'custom', behaviour: 'hang', skin: '#e8c0a0', height: 0.9, build: 'normal', face: 'round', eyes: '#3b2a1e', brows: 'thin', nose: 'normal', mouth: 'smile', hair: 'bun', hairColor: '#d9d9d6', facial: 'none', facialColor: '#000', glasses: 'round', hat: 'none', top: 'dress', c1: '#5a6a8a', c2: '#e8d8c0', pattern: 'solid', necklace: 'pearls', earrings: 'studs', bag: 'handbag', tie: 'none', bottom: 'longskirt', bottomColor: '#5a6a8a', shoes: 'shoes', shoeColor: '#2a2018' };
const LOOK_CASHIER = { v: 2, kind: 'custom', behaviour: 'hang', skin: '#e6b08a', height: 0.97, build: 'slim', face: 'round', hair: 'ponytail', hairColor: '#3a2618', top: 'polo', c1: '#e2401c', c2: '#e2401c', bottom: 'trousers', bottomColor: '#22283a', shoes: 'sneakers', shoeColor: '#f2f0ea' };
const LOOK_DELI = { v: 2, kind: 'custom', behaviour: 'hang', skin: '#d9a07a', height: 1.02, build: 'broad', hair: 'buzz', hairColor: '#222', hat: 'chef', top: 'apron', c1: '#ffffff', c2: '#ffffff', bottom: 'trousers', bottomColor: '#ffffff', shoes: 'shoes', shoeColor: '#222' };
function person(look, lx, ly, a) {
  const m = G.makePerson(G.fullLook(look)); if (G.noLod) G.noLod(m);
  const [x, y] = W2(lx, ly); m.position.set(x, 0.02, -y); m.rotation.y = face(a);
  G.scene.add(m); return { m, x, y, a, look };
}
function buildCast() {
  S.paolo = person(LOOK_PAOLO, PAOLO_SPOT[0], PAOLO_SPOT[1], Math.PI / 2);
  S.paolo.home = W2(...PAOLO_SPOT);
  S.paolo.tag = nameTag('Paolo', '#e2401c'); S.paolo.m.add(S.paolo.tag); S.paolo.tag.position.set(0, 2.25, 0);
  S.cashier = person(LOOK_CASHIER, -8.05, -8.4, Math.PI);
  S.deli = person(LOOK_DELI, -17.15, 0.5, 0);
  // two shoppers doing laps of the shop
  const loops = [
    [[-13.25, -4.5], [-13.25, 8.6], [-6.25, 8.6], [-6.25, -4.5]],
    [[4.3, -4.6], [4.3, 8.3], [7.2, 8.3], [7.2, 0.2], [11.5, 0.2], [11.5, -4.6]],
  ];
  const looks = [{ v: 2, kind: 'custom', skin: '#c88a64', hair: 'short', hairColor: '#222', top: 'shirt', c1: '#3d7fd9', bottom: 'jeans', bottomColor: '#2a3a5a', shoes: 'sneakers', shoeColor: '#fff' }, { v: 2, kind: 'custom', skin: '#efc7a8', hair: 'ponytail', hairColor: '#8a5a2b', top: 'sweater', c1: '#f59ac4', bottom: 'skirt', bottomColor: '#22283a', shoes: 'heels', shoeColor: '#222' }];
  loops.forEach((pts, i) => { const s = person(looks[i], pts[0][0], pts[0][1], 0); s.path = pts.map(([a, b]) => W2(a, b)); s.pi = 1; s.wait = 0; S.shoppers.push(s); });
}
function nameTag(text, col) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(20,17,22,.8)'; c.beginPath(); c.roundRect(40, 10, 176, 44, 22); c.fill();
  c.fillStyle = col; c.font = '800 28px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 128, 33);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false })); sp.scale.set(1.3, 0.33, 1); sp.renderOrder = 5; return sp;
}
function walkTo(o, tx, ty, sp, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = hyp(dx, dy);
  if (d < 0.06) { G.posePerson(o.m, 'idle', S.now, 1); return true; }
  const k = Math.min(d, sp * dt); o.x += dx / d * k; o.y += dy / d * k;
  o.a += G.angDiff(o.a, Math.atan2(dy, dx)) * Math.min(1, dt * 9);
  o.m.position.set(o.x, 0.02, -o.y); o.m.rotation.y = face(o.a);
  o.ph = (o.ph || 0) + dt * sp * 4.2; G.animatePerson(o.m, o.ph, 0.6, 0);
  return false;
}
function turnTo(o, x, y, dt, k = 6) { o.a += G.angDiff(o.a, Math.atan2(y - o.y, x - o.x)) * Math.min(1, dt * k); o.m.rotation.y = face(o.a); }
function arms(o, lx, rx, lz = 0, rz = 0) { const u = o.m.userData; if (!u.armL) return; u.armL.rotation.x = lx; u.armR.rotation.x = rx; u.armL.rotation.z = lz; u.armR.rotation.z = rz; }
const say = (o, text, ms) => G.say(o.m, text, ms);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const GRUMBLES = ['Stu latti è scadutu dumani... chi vergogna!', 'Quattru euro u furmaggiu?! Latri!', 'Ma pirchì i cancianu sempre di postu?!', 'U yogurt magru... chi schifiu.', 'Unni sunnu i ricotti?! Unni?!', 'Ogni vota a stissa storia!'];
const ANNOYED = ['Chi talìi?!', 'Un m\'aviti a stari accussì vicinu!', 'Mi stai sciatannu ncoddu!', 'Spustiti, ca staiu scegliennu!'];

// ================================================================== the yoghurt incident
function startScene() {
  S.scene = 'greet'; S.st = 0; S.step = 0; S.pours = 0;
  S.puddle.visible = false; S.puddle.scale.setScalar(0.01);
  if (S.lady) freeLady();
  for (const b of S.buckets) b.visible = true;
  say({ m: G.player.mesh }, 'Ciao Paolo!', 1400);
}
function spawnLady() {
  S.lady = person(LOOK_LADY, LADY_FROM[0], LADY_FROM[1], Math.PI / 2);
  // her own copy of the materials, so she can get covered in yoghurt without everyone else
  S.lady.mats = [];
  S.lady.m.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); S.lady.mats.push(o.material); } });
  S.lady.path = [W2(-9.75, 9.3), W2(-7.5, 10.2)]; S.lady.pi = 0; S.lady.cover = 0;
  S.lady.drips = [];
}
// the lady is built fresh for every incident, so everything of hers is freed when she's gone
function freeLady() {
  const L = S.lady; if (!L) return;
  G.scene.remove(L.m);
  for (const d of L.drips) { L.m.remove(d); d.geometry.dispose(); }
  for (const m of L.mats) m.dispose();
  if (G.disposeChar) G.disposeChar(L.m);
  S.lady = null;
}
// one bucket to pour, made once and reused
function carryBucket() {
  if (!S.carry) { S.carry = bucketMesh(); S.carry.visible = false; G.scene.add(S.carry); }
  const b = S.carry, lid = b.getObjectByName('lid'), fill = b.getObjectByName('fill');
  if (lid) lid.visible = false; if (fill) fill.visible = true;
  b.rotation.set(0, 0, 0); b.userData.fall = null;
  return b;
}
function coverLady(k) {
  const L = S.lady; if (!L) return;
  L.cover = Math.max(L.cover, k);
  for (const m of L.mats) { if (m.emissive) { m.emissive.setRGB(0.9 * L.cover, 0.9 * L.cover, 0.85 * L.cover); } }
  while (L.drips.length < Math.floor(L.cover * 14)) {
    const d = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), MC('#fbfaf3', { roughness: 0.2 }));
    const a = Math.random() * 6.28, r = 0.12 + Math.random() * 0.1, h = 1.1 + Math.random() * 0.65;
    d.position.set(Math.cos(a) * r, h, Math.sin(a) * r); d.scale.set(1, 1.8 + Math.random() * 1.5, 1);
    L.m.add(d); L.drips.push(d);
  }
}
const DROP_T = {};
function updateDrops(dt) {
  if (!DROP_T.m4) { DROP_T.m4 = new T.Matrix4(); DROP_T.q = new T.Quaternion(); DROP_T.p = new T.Vector3(); DROP_T.sc = new T.Vector3(); }
  const list = S.dropList, { m4, q, p, sc } = DROP_T;
  if (!list.length && !S.drops.count) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i]; d.vz -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.z <= 0.04 || (S.lady && hyp(d.x - S.lady.x, d.y - S.lady.y) < 0.28 && d.z < 1.85 && d.z > 0.4 && Math.random() < 0.3)) list.splice(i, 1);
  }
  S.drops.count = Math.min(140, list.length);
  for (let i = 0; i < S.drops.count; i++) { const d = list[i]; p.set(d.x, d.z, -d.y); sc.set(1, 1.6, 1); S.drops.setMatrixAt(i, m4.compose(p, q, sc)); }
  S.drops.instanceMatrix.needsUpdate = true;
}
function updateScene(dt) {
  const P = S.paolo, L = S.lady, pl = G.player;
  S.st += dt;
  switch (S.scene) {
    case 'idle': {
      // browsing the dairy, picking up pots and putting them back, muttering
      P.a += G.angDiff(P.a, Math.PI / 2) * Math.min(1, dt * 3); P.m.rotation.y = face(P.a);
      G.posePerson(P.m, 'idle', S.now, 2);
      const reach = Math.max(0, Math.sin(S.now * 0.9)); arms(P, -0.9 * reach, -0.3 - 0.9 * Math.max(0, Math.sin(S.now * 0.9 + 1.8)));
      const d = hyp(pl.x - P.x, pl.y - P.y);
      if (S.inside && d < 7 && (S.grumbleT -= dt) <= 0) { S.grumbleT = 7 + Math.random() * 5; say(P, pick(d < 1.4 ? ANNOYED : GRUMBLES), 2200); }
      break;
    }
    case 'greet':
      turnTo(P, pl.x, pl.y, dt);
      G.posePerson(P.m, 'argue', S.now, 2);
      if (S.step === 0 && S.st > 0.6) { S.step = 1; say(P, 'Chi c\'è?! Un viri ca staiu taliannu i latticini?!', 2600); }
      if (S.st > 3.2) { S.scene = 'lady'; S.st = 0; S.step = 0; spawnLady(); }
      break;
    case 'lady': {
      turnTo(P, P.x + 0, P.y + 1, dt, 3); G.posePerson(P.m, 'idle', S.now, 2); arms(P, -0.6, -0.6);
      if (S.step === 0 && S.st > 0.3) { S.step = 1; say(P, '...ogni jornu a stissa storia.', 1800); }
      const tgt = L.path[L.pi];
      if (walkTo(L, tgt[0], tgt[1], 1.1, dt)) { if (++L.pi >= L.path.length) { S.scene = 'ask'; S.st = 0; S.step = 0; } }
      break;
    }
    case 'ask':
      turnTo(L, P.x, P.y, dt); G.posePerson(L.m, 'talk', S.now, 4);
      if (S.step === 0) { S.step = 1; say(L, 'Mi scusi, giovanotto... unn\'è u yogurt?', 2600); }
      if (S.st > 1.2) turnTo(P, L.x, L.y, dt);
      if (S.st > 2.8) { S.scene = 'yell'; S.st = 0; S.step = 0; }
      break;
    case 'yell':
      turnTo(P, L.x, L.y, dt); G.posePerson(P.m, 'argue', S.now * 1.6, 2);
      P.m.position.x = P.x + Math.sin(S.now * 40) * 0.015;
      G.posePerson(L.m, 'shock', S.now, 4);
      if (S.step === 0) { S.step = 1; say(P, 'U YOGURT?! È CCÀ, DAVANTI Ê SO OCCHI! MA CHI SI ORBA?!', 2600); }
      if (S.step === 1 && S.st > 2.7) { S.step = 2; say(P, 'TENISSI! SI PIGGHIASSI TUTTU!', 1900); }
      if (S.st > 3.6) { S.scene = 'fetch'; S.st = 0; S.step = 0; }
      break;
    case 'fetch': {
      G.posePerson(L.m, 'shock', S.now, 4);
      const b = W2(BUCKETS[0] - 0.5, BUCKETS[1] - 0.15);
      if (walkTo(P, b[0], b[1], 2.4, dt)) { S.scene = 'lift'; S.st = 0; S.step = 0; }
      break;
    }
    case 'lift': {
      // a whole bucket, up over his head
      turnTo(P, ...W2(...BUCKETS), dt);
      G.posePerson(P.m, 'idle', S.now, 2);
      const k = clamp(S.st / 0.8, 0, 1);
      if (S.step === 0) {
        S.step = 1; const src = S.buckets.find((x) => x.visible) || S.buckets[0];
        src.visible = false; S.bucket = carryBucket(); S.bucket.visible = true;
        const lidM = S.bucket.getObjectByName('lid'); if (lidM) lidM.visible = false;
        G.sfx && G.sfx.pick && G.sfx.pick();
      }
      arms(P, -0.6 - 2.3 * k, -0.6 - 2.3 * k, -0.15, 0.15);
      placeBucket(P, 0.35 + 1.75 * k, 0.4 * (1 - k), 0);
      if (S.st > 0.9) { S.scene = 'carry'; S.st = 0; }
      break;
    }
    case 'carry': {
      arms(P, -2.9, -2.9, -0.15, 0.15);
      const tx = L.x + Math.cos(L.a) * 0.75, ty = L.y + Math.sin(L.a) * 0.75;
      const there = walkTo(P, tx, ty, 1.6, dt);
      arms(P, -2.9, -2.9, -0.15, 0.15); placeBucket(P, 2.15, 0.1, 0);
      G.posePerson(L.m, 'shock', S.now, 4);
      if (there) { S.scene = 'pour'; S.st = 0; S.step = 0; }
      break;
    }
    case 'pour': {
      turnTo(P, L.x, L.y, dt);
      G.posePerson(P.m, 'idle', S.now, 2); arms(P, -2.6, -2.6, -0.15, 0.15);
      const tip = clamp(S.st / 0.6, 0, 1) * 2.3;
      placeBucket(P, 2.2, 0.45, tip);
      if (S.step === 0) { S.step = 1; say(L, 'AAAAH! MATRI MIA!', 2200); G.sfx && G.sfx.splat && G.sfx.splat(); }
      // the yoghurt comes out in a thick white stream
      if (S.st > 0.4 && S.st < 3.0) {
        const b = S.bucket.position;
        for (let i = 0; i < 4; i++) S.dropList.push({ x: L.x + (Math.random() - 0.5) * 0.12, y: L.y + (Math.random() - 0.5) * 0.12, z: b.y - 0.1, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, vz: -0.5 - Math.random() });
        coverLady(clamp((S.st - 0.5) / 2.2, 0, 1));
        S.puddle.visible = true; S.puddle.position.set(L.x, 0.035, -L.y); S.puddle.scale.setScalar(0.1 + clamp((S.st - 0.6) / 2.4, 0, 1) * 0.75);
      }
      G.posePerson(L.m, 'shock', S.now * 2, 4);
      L.m.position.x = L.x + Math.sin(S.now * 30) * 0.02;
      if (S.step === 1 && S.st > 2.4) { S.step = 2; say(L, 'Gesù, Giuseppe e Maria...', 2000); }
      if (S.st > 3.3) { S.scene = 'drop'; S.st = 0; S.step = 0; }
      break;
    }
    case 'drop': {
      // he lets go of the empty bucket and dusts off his hands
      if (S.step === 0) { S.step = 1; S.bucket.userData.fall = { x: S.bucket.position.x, y: S.bucket.position.y, z: S.bucket.position.z, vy: 0, roll: 0, dx: (Math.random() - 0.5) * 2, dz: (Math.random() - 0.5) * 2 }; }
      const f = S.bucket.userData.fall;
      if (f.y > 0.2) { f.vy -= 9.8 * dt; f.y = Math.max(0.2, f.y + f.vy * dt); } else { f.roll += dt; f.x += f.dx * dt * Math.max(0, 1 - f.roll); f.z += f.dz * dt * Math.max(0, 1 - f.roll); }
      S.bucket.position.set(f.x, f.y, f.z); S.bucket.rotation.set(Math.PI / 2, 0, f.roll * 3);
      G.posePerson(P.m, 'clap', S.now, 2);
      G.posePerson(L.m, 'shock', S.now, 4);
      if (S.st > 0.9 && S.step === 1) { S.step = 2; say(P, '...e mancu grazie mi rissi.', 2200); }
      if (S.st > 2.6) { S.scene = 'after'; S.st = 0; S.step = 0; L.path = [W2(-7.5, 8.6), W2(-6.25, -4.6), W2(6.6, -10.2), W2(10.5, -12.0)]; L.pi = 0; }
      break;
    }
    case 'after': {
      // Paolo goes back to his yoghurts; she drips her way out
      const h = P.home;
      if (walkTo(P, h[0], h[1], 1.2, dt)) { turnTo(P, P.x, P.y + 1, dt, 3); G.posePerson(P.m, 'idle', S.now, 2); }
      if (L && L.pi < L.path.length) {
        const tgt = L.path[L.pi];
        if (walkTo(L, tgt[0], tgt[1], 0.7, dt)) L.pi++;
        if (S.step === 0 && S.st > 2) { S.step = 1; say(L, 'Vergogna! Chiamo me figghiu!', 2000); }
        if (Math.random() < dt * 6) S.dropList.push({ x: L.x + (Math.random() - 0.5) * 0.3, y: L.y + (Math.random() - 0.5) * 0.3, z: 1.0 + Math.random() * 0.6, vx: 0, vy: 0, vz: 0 });
      } else if (L) freeLady();
      if (S.st > 1.5 && S.step < 2) {
        S.step = 2;
        const st = store.get(); st.yog = (st.yog || 0) + 1; store.set(st);
        G.toast('Paolo lost it', st.yog === 1 ? 'all she asked was where the yoghurt was' : `yoghurt incidents in the dairy aisle: ${st.yog}`, 2600);
      }
      if (!S.lady && S.st > 6) { S.scene = 'idle'; S.st = 0; S.cool = 12; if (S.bucket) { S.bucket.visible = false; S.bucket = null; } for (const b of S.buckets) b.visible = true; }
      break;
    }
  }
}
function placeBucket(P, h, fwd, tip) {
  const b = S.bucket; if (!b) return;
  const ca = Math.cos(P.a), sa = Math.sin(P.a);
  b.position.set(P.x + ca * (0.15 + fwd), h, -(P.y + sa * (0.15 + fwd)));
  b.rotation.set(0, 0, 0); b.rotateY(face(P.a)); b.rotateX(tip);
  const fill = b.getObjectByName('fill'); if (fill) fill.visible = S.scene !== 'drop' && !(S.scene === 'pour' && S.st > 2.8);
}
const store = { get() { try { return JSON.parse(localStorage.getItem('kalsa.famila') || '{}') || {}; } catch (e) { return {}; } }, set(o) { try { localStorage.setItem('kalsa.famila', JSON.stringify(o)); } catch (e) {} } };

// ================================================================== going in and out
function enter() {
  const P = G.player;
  S.back = [S.door[0] + S.doorN[0] * 0.9, S.door[1] + S.doorN[1] * 0.9];
  S.inside = true;
  const [x, y] = W2(IN_DOOR[0], IN_DOOR[1] + 1.0);
  P.x = x; P.y = y; P.a = Math.PI / 2; G.cam.yaw = Math.PI / 2;
  if (G.guard) { G.guard.x = P.x; G.guard.y = P.y; }
  G.perfWarm && G.perfWarm(3);
  if (!S.seenToast) { S.seenToast = true; G.toast('Famila · Via Libertà', 'open 24 hours · Paolo is in the dairy aisle', 2400); }
  else G.toast('Famila', 'aperto 24 ore su 24', 1200);
}
function leave() {
  const P = G.player;
  S.inside = false;
  P.x = S.back[0]; P.y = S.back[1]; P.a = Math.atan2(S.doorN[1], S.doorN[0]); G.cam.yaw = P.a;
  if (G.guard) { G.guard.x = P.x; G.guard.y = P.y; }
  G.perfWarm && G.perfWarm(3);
  G.toast('Back on Via Libertà', '', 1100);
}
const nearDoorOut = () => S.door && !S.inside && !G.player.vespa && hyp(G.player.x - S.door[0], G.player.y - S.door[1]) < 2.6;
const nearDoorIn = () => { if (!S.inside) return false; const [x, y] = W2(...IN_DOOR); return hyp(G.player.x - x, G.player.y - y) < 2.0; };
const nearPaolo = () => S.inside && S.scene === 'idle' && S.cool <= 0 && hyp(G.player.x - S.paolo.x, G.player.y - S.paolo.y) < 2.6;

export function inside() { return S.inside; }
export function hint() {
  if (nearDoorOut()) return 'Press <kbd>E</kbd> to go into Famila · open 24 hours';
  if (nearPaolo()) return 'Press <kbd>E</kbd> to greet Paolo';
  if (nearDoorIn()) return 'Press <kbd>E</kbd> to go back out onto Via Libertà';
  return null;
}
export function interact() {
  if (nearDoorOut()) { enter(); return true; }
  if (nearPaolo()) { startScene(); return true; }
  if (nearDoorIn()) { leave(); return true; }
  return false;
}
export function mapInfo() { return S.door ? { x: S.door[0], y: S.door[1] } : null; }
export function update(dt) {
  S.now += dt;
  if (S.cool > 0) S.cool -= dt;
  const P = G.player;
  if (S.room && S.room.visible !== S.inside) {
    S.room.visible = S.inside; S.drops.visible = S.inside;
    for (const o of [S.paolo, S.cashier, S.deli, ...S.shoppers, S.lady]) if (o) o.m.visible = S.inside;
    if (S.carry) S.carry.visible = S.inside && !!S.bucket;
  }
  if (S.inside) {
    // keep inside the walls of the shop
    P.x = clamp(P.x, R[0] - RW / 2 + 0.5, R[0] + RW / 2 - 0.5); P.y = clamp(P.y, R[1] - RD / 2 + 0.5, R[1] + RD / 2 - 0.5);
    if (P.vespa) G.dismount && G.dismount();
  } else if (hyp(P.x - R[0], P.y - R[1]) < 40) { S.inside = true; } // got here some other way (a respawn): you're in the shop
  // the people inside only move while you can see them
  if (!S.inside && S.scene === 'idle') return;
  updateScene(dt);
  updateDrops(dt);
  for (const s of S.shoppers) {
    if (s.wait > 0) { s.wait -= dt; G.posePerson(s.m, 'idle', S.now, 3); continue; }
    const tgt = s.path[s.pi];
    if (walkTo(s, tgt[0], tgt[1], 1.0, dt)) { s.pi = (s.pi + 1) % s.path.length; s.wait = 1 + Math.random() * 3; }
  }
  G.posePerson(S.cashier.m, Math.sin(S.now * 0.4) > 0.6 ? 'talk' : 'idle', S.now, 5);
  G.posePerson(S.deli.m, 'idle', S.now, 6);
}
export function status() {
  return { inside: S.inside, scene: S.scene, door: S.door, trees: S.trees, items: S.items, gone: F && F.gone, lady: S.lady ? { x: S.lady.x, y: S.lady.y, cover: S.lady.cover } : null, paolo: { x: S.paolo.x, y: S.paolo.y } };
}
export const debug = { S, R, W2 };
