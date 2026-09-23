/*
 * Portfolio: one particle cloud, many identities.
 * sphere → padlock (security) → AI chip → agents → starfield (skills) → helix (experience)
 *        → dust (work) → football → sphere (contact)
 *
 * All text lives in index.html. This file only drives the visuals.
 * Classic script (not a module) so double-clicking index.html works; Three.js comes from a CDN.
 */

// ✏️ Which 3D design the AI section uses: 'orb' | 'sparkle' | 'knot' | 'eye' | 'chip' | 'network' | 'brain'
const AI_SHAPE = 'chip';

(async () => {
  // resolves to a bare-specifier importer once es-module-shims has loaded
  async function waitForShim() {
    for (let i = 0; i < 100 && !window.importShim; i++) await new Promise((r) => setTimeout(r, 50));
    if (!window.importShim) throw new Error('import maps unsupported and the shim never loaded');
    return (spec) => window.importShim(spec);
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const debug = location.search.includes('debug');

  const loader = initLoader();
  initClock();
  initCursor();
  initReveal();
  initNav();
  initMenu();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  document.fonts?.ready.then(() => loader.set(30));

  /* ───────────────────────── Three.js ───────────────────────── */
  let THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass;
  try {
    // older phone browsers (iOS < 16.4) have no import maps; es-module-shims fills in
    const imp = window.__esmShim ? await waitForShim() : (spec) => import(spec);
    const mods = await Promise.all([
      imp('three'),
      imp('three/addons/postprocessing/EffectComposer.js'),
      imp('three/addons/postprocessing/RenderPass.js'),
      imp('three/addons/postprocessing/UnrealBloomPass.js'),
      imp('three/addons/postprocessing/OutputPass.js'),
    ]);
    THREE = mods[0];
    ({ EffectComposer } = mods[1]);
    ({ RenderPass } = mods[2]);
    ({ UnrealBloomPass } = mods[3]);
    ({ OutputPass } = mods[4]);
  } catch (err) {
    console.warn('Could not load Three.js.', err);
    document.body.classList.add('no-3d');
    loader.set(100);
    return;
  }
  loader.set(55);

  const canvas = document.getElementById('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('No WebGL on this device.', err);
    document.body.classList.add('no-3d');
    loader.set(100);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor('#050505', 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050505'); // colour-managed, so it stays true black through the glow pass
  const CAM_Z = 6;
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);
  camera.position.z = CAM_Z;

  // soft glow on everything bright
  let composer = null, bloom = null;
  try {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    const small = innerWidth <= 900;
    bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      small ? 0.3 : 0.55,   // strength
      small ? 0.18 : 0.35,  // radius
      small ? 0.62 : 0.42,  // threshold
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (err) {
    console.warn('Glow pass unavailable; drawing without it.', err);
    composer = null;
  }

  // one draw call: with the glow pass while it works, plain otherwise
  const draw = () => {
    if (composer) {
      try { composer.render(); return; }
      catch (err) { console.warn('Glow pass failed; drawing without it.', err); composer = null; }
    }
    renderer.render(scene, camera);
  };

  /* ───────────────────────── Shapes ─────────────────────────
   * Every shape is N points stored as (x, y, z, w).
   * w = brightness (0..1); a negative w marks an accent-coloured point.
   */
  const N = innerWidth <= 560 ? 9000 : innerWidth <= 900 ? 12000 : 28000;
  const TAU = Math.PI * 2;
  const rnd = Math.random;
  const randDir = () => {
    const u = rnd() * 2 - 1, t = rnd() * TAU, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(t), u, s * Math.sin(t)];
  };
  const buffer = () => new Float32Array(N * 4);
  const put = (b, i, x, y, z, w) => { b[i * 4] = x; b[i * 4 + 1] = y; b[i * 4 + 2] = z; b[i * 4 + 3] = w; };
  const nextFrame = () => new Promise((r) => setTimeout(r, 0));

  function shapeSphere() {
    const b = buffer();
    for (let i = 0; i < N; i++) {
      const [x, y, z] = randDir();
      if (i < N * 0.14) {
        const r = 1.1 * Math.cbrt(rnd());
        put(b, i, x * r, y * r, z * r, 0.12);
        continue;
      }
      const band = Math.pow(0.5 + 0.5 * Math.sin(y * 16 + Math.sin(x * 3 + z * 2) * 2.2), 3);
      put(b, i, x * 1.15, y * 1.15, z * 1.15, rnd() < 0.025 ? -1 : 0.22 + 0.78 * band);
    }
    return b;
  }

  function shapePadlock() {
    const b = buffer();
    const W = 1.5, H = 1.15, D = 0.55, cy = -0.42;
    const top = cy + H / 2, R = 0.48, r = 0.1, arcY = 0.42, keyY = cy + 0.12;
    const inKeyhole = (x, y) => {
      const dy = y - keyY;
      return Math.hypot(x, dy) < 0.13 || (dy < 0 && dy > -0.36 && Math.abs(x) < 0.05 + -dy * 0.12);
    };
    const faces = [
      { a: W, b: H, n: 'front' }, { a: W, b: H, n: 'back' },
      { a: W, b: D, n: 'top' }, { a: W, b: D, n: 'bottom' },
      { a: D, b: H, n: 'right' }, { a: D, b: H, n: 'left' },
    ];
    const total = faces.reduce((s, f) => s + f.a * f.b, 0);
    const nBody = Math.floor(N * 0.6), nShackle = Math.floor(N * 0.32);
    let i = 0;
    while (i < nBody) {
      let pick = rnd() * total, f = faces[0];
      for (const face of faces) { pick -= face.a * face.b; if (pick <= 0) { f = face; break; } }
      const u = rnd() * f.a, v = rnd() * f.b;
      const edge = Math.min(u, f.a - u, v, f.b - v) < 0.03;
      let x, y, z;
      if (f.n === 'front' || f.n === 'back') { x = u - W / 2; y = cy - H / 2 + v; z = f.n === 'front' ? D / 2 : -D / 2; }
      else if (f.n === 'top' || f.n === 'bottom') { x = u - W / 2; z = v - D / 2; y = f.n === 'top' ? top : cy - H / 2; }
      else { z = u - D / 2; y = cy - H / 2 + v; x = f.n === 'right' ? W / 2 : -W / 2; }
      if (f.n === 'front' && inKeyhole(x, y)) continue;
      put(b, i++, x, y, z, edge ? 1 : 0.38);
    }
    while (i < nBody + nShackle) {
      const phi = rnd() * TAU;
      let x, y;
      if (rnd() < 0.72) {
        const th = rnd() * Math.PI;
        x = (R + r * Math.cos(phi)) * Math.cos(th);
        y = arcY + (R + r * Math.cos(phi)) * Math.sin(th);
      } else {
        x = (rnd() < 0.5 ? -R : R) + r * Math.cos(phi);
        y = top + rnd() * (arcY - top);
      }
      put(b, i++, x, y, r * Math.sin(phi), 0.45 + 0.4 * Math.abs(Math.cos(phi)));
    }
    while (i < N) {
      // glowing keyhole outline
      let x, y;
      if (rnd() < 0.6) {
        const a = -Math.PI / 2 + 0.45 + rnd() * (TAU - 0.9);
        x = 0.13 * Math.cos(a);
        y = keyY + 0.13 * Math.sin(a);
      } else {
        const dy = -0.1 - rnd() * 0.26;
        x = (rnd() < 0.5 ? -1 : 1) * (0.05 + -dy * 0.12);
        y = keyY + dy;
      }
      put(b, i++, x, y, D / 2 + 0.01, -1);
    }
    return b;
  }

  function shapeBrain() {
    const b = buffer();
    let i = 0;
    const nCortex = Math.floor(N * 0.8), nCereb = Math.floor(N * 0.1), nStem = Math.floor(N * 0.03);
    while (i < nCortex) {
      const [dx, dy, dz] = randDir();
      if (Math.abs(dx) < 0.07) continue; // gap between the two hemispheres
      const fold = Math.sin(dx * 9 + dy * 4) * Math.sin(dy * 11 - dz * 5) * Math.sin(dz * 8 + dx * 3);
      const r = 1 + 0.07 * fold;
      let x = dx * 0.95 * r + Math.sign(dx) * 0.04;
      let y = dy * 0.8 * r + 0.12;
      const z = dz * 1.2 * r;
      if (y < -0.3) y = -0.3 + (y + 0.3) * 0.45;
      put(b, i++, x, y, z, 0.28 + 0.72 * Math.max(0, fold) ** 0.6);
    }
    while (i < nCortex + nCereb) {
      const [dx, dy, dz] = randDir();
      const x = dx * 0.5, y = -0.42 + dy * 0.26, z = -0.72 + dz * 0.34;
      put(b, i++, x, y, z, 0.3 + 0.5 * Math.abs(Math.sin(y * 45)));
    }
    while (i < nCortex + nCereb + nStem) {
      const a = rnd() * TAU, t = rnd();
      put(b, i++, Math.cos(a) * 0.11, -0.45 - t * 0.55, -0.35 + Math.sin(a) * 0.11 - t * 0.1, 0.4);
    }
    while (i < N) {
      // neurons firing inside
      const [dx, dy, dz] = randDir(), s = Math.cbrt(rnd()) * 0.8;
      put(b, i++, dx * 0.9 * s, dy * 0.7 * s + 0.12, dz * 1.1 * s, -0.9);
    }
    return b;
  }

  function shapeAgents() {
    const b = buffer();
    const tilt = (p) => {
      const [x, y, z] = p, a = 0.45, c = Math.cos(a), s = Math.sin(a);
      const y1 = y * c - z * s, z1 = y * s + z * c;
      const cz = Math.cos(0.18), sz = Math.sin(0.18);
      return [x * cz - y1 * sz, x * sz + y1 * cz, z1];
    };
    const K = 5, RING = 1.3;
    const agents = Array.from({ length: K }, (_, k) => tilt([Math.cos((k / K) * TAU) * RING, 0, Math.sin((k / K) * TAU) * RING]));
    let i = 0;
    const until = (frac) => Math.min(N, i + Math.floor(N * frac));
    for (let end = until(0.22); i < end; ) {
      const [x, y, z] = randDir(), inner = rnd() < 0.2, r = inner ? 0.36 * Math.cbrt(rnd()) : 0.36;
      put(b, i++, x * r, y * r, z * r, inner ? 0.3 : 0.9);
    }
    for (let end = until(0.36); i < end; ) {
      const c = agents[Math.floor(rnd() * K)], [x, y, z] = randDir();
      put(b, i++, c[0] + x * 0.14, c[1] + y * 0.14, c[2] + z * 0.14, -0.95);
    }
    for (let end = until(0.12); i < end; ) {
      const a = rnd() * TAU, j = (rnd() - 0.5) * 0.02;
      const [x, y, z] = tilt([Math.cos(a) * (RING + j), j, Math.sin(a) * (RING + j)]);
      put(b, i++, x, y, z, 0.3);
    }
    for (let end = until(0.2); i < end; ) {
      const c = agents[Math.floor(rnd() * K)], t = 0.28 + rnd() * 0.6;
      put(b, i++, c[0] * t, c[1] * t, c[2] * t, 0.6);
    }
    while (i < N) {
      const k = Math.floor(rnd() * K), a = agents[k], c = agents[(k + 2) % K], t = rnd();
      put(b, i++, a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t, 0.22);
    }
    return b;
  }

  function shapeHelix() {
    // a double helix: two strands climbing over time, rungs between them, glowing milestones
    const b = buffer();
    const H = 2.7, R = 0.5, TURNS = 2.3;
    let i = 0;
    const until = (frac) => Math.min(N, i + Math.floor(N * frac));
    const strandAt = (t, side) => {
      const a = t * TURNS * TAU + side * Math.PI;
      return [Math.cos(a) * R, -H / 2 + t * H, Math.sin(a) * R];
    };
    for (let end = until(0.6); i < end; ) {
      const t = rnd(), [x, y, z] = strandAt(t, rnd() < 0.5 ? 0 : 1), [jx, jy, jz] = randDir(), j = 0.045 * rnd();
      put(b, i++, x + jx * j, y + jy * j, z + jz * j, 0.45 + 0.5 * rnd());
    }
    const RUNGS = 16;
    for (let end = until(0.2); i < end; ) {
      const k = Math.floor(rnd() * RUNGS), t = (k + 0.5) / RUNGS, u = rnd();
      const A = strandAt(t, 0), B = strandAt(t, 1);
      put(b, i++, A[0] + (B[0] - A[0]) * u, A[1], A[2] + (B[2] - A[2]) * u, 0.3);
    }
    const milestones = [0.2, 0.5, 0.8]; // one per role on the timeline
    for (let end = until(0.07); i < end; ) {
      const t = milestones[Math.floor(rnd() * milestones.length)], P = strandAt(t, rnd() < 0.5 ? 0 : 1), [x, y, z] = randDir(), r = 0.09 * Math.cbrt(rnd());
      put(b, i++, P[0] + x * r, P[1] + y * r, P[2] + z * r, -1);
    }
    while (i < N) {
      const a = rnd() * TAU, r = 0.95 * Math.sqrt(rnd());
      put(b, i++, Math.cos(a) * r, (rnd() - 0.5) * H * 1.1, Math.sin(a) * r, 0.07);
    }
    return b;
  }

  /* ---------- AI section options ---------- */

  // A. 3D neural network: rings of neurons in layers, fibres between them, sparks travelling along
  function shapeNeural() {
    const b = buffer();
    const layers = [6, 10, 10, 6, 3];
    const radii = [0.55, 0.85, 0.85, 0.55, 0.3];
    const nodes = layers.map((n, li) => Array.from({ length: n }, (_, k) => {
      const a = (k / n) * TAU + li * 0.4;
      return [(li - (layers.length - 1) / 2) * 0.72, Math.cos(a) * radii[li], Math.sin(a) * radii[li]];
    }));
    const edges = [];
    for (let li = 0; li < layers.length - 1; li++) nodes[li].forEach((p) => nodes[li + 1].forEach((q) => edges.push([p, q])));
    let i = 0;
    const until = (frac) => Math.min(N, i + Math.floor(N * frac));
    for (let end = until(0.34); i < end; ) {
      const li = Math.floor(rnd() * layers.length), p = nodes[li][Math.floor(rnd() * layers[li])];
      const [x, y, z] = randDir(), r = (li === layers.length - 1 ? 0.1 : 0.075) * (rnd() < 0.7 ? 1 : Math.cbrt(rnd()));
      put(b, i++, p[0] + x * r, p[1] + y * r, p[2] + z * r, li === layers.length - 1 ? -1 : 0.95);
    }
    for (let end = until(0.46); i < end; ) {
      const [p, q] = edges[Math.floor(rnd() * edges.length)], t = rnd();
      put(b, i++, p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, 0.32);
    }
    for (let end = until(0.08); i < end; ) {
      // sparks: tight bright clusters part-way along a connection
      const [p, q] = edges[Math.floor(rnd() * edges.length)], t = 0.2 + rnd() * 0.6, [x, y, z] = randDir(), r = 0.025 * rnd();
      put(b, i++, p[0] + (q[0] - p[0]) * t + x * r, p[1] + (q[1] - p[1]) * t + y * r, p[2] + (q[2] - p[2]) * t + z * r, -0.9);
    }
    while (i < N) {
      const [x, y, z] = randDir(), r = 1.6 * Math.cbrt(rnd());
      put(b, i++, x * r * 1.2, y * r * 0.7, z * r * 0.7, 0.06);
    }
    return b;
  }

  // B. AI chip: die, pins, circuit traces to glowing pads, "AI" written on the core
  function shapeChip() {
    const b = buffer();
    const D = 0.62, T = 0.06, C = 0.36; // half-size of the die, half-thickness, half-size of the core
    const text = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.font = '800 96px Geist, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AI', 64, 68);
      const px = ctx.getImageData(0, 0, 128, 128).data, pts = [];
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (px[(y * 128 + x) * 4 + 3] > 128) pts.push([(x / 128 - 0.5) * 2 * C * 0.9, -(y / 128 - 0.5) * 2 * C * 0.9]);
      return pts;
    })();
    const pins = [];
    const PINS = 11;
    for (let side = 0; side < 4; side++) for (let k = 0; k < PINS; k++) {
      const u = ((k + 0.5) / PINS - 0.5) * 2 * D * 0.86;
      const dir = [[1, 0], [0, 1], [-1, 0], [0, -1]][side];
      const along = [-dir[1], dir[0]];
      pins.push({ x: dir[0] * D + along[0] * u, y: dir[1] * D + along[1] * u, dir, along, len: 0.5 + rnd() * 0.75, bend: (rnd() - 0.5) * 0.5 });
    }
    let i = 0;
    const until = (frac) => Math.min(N, i + Math.floor(N * frac));
    for (let end = until(0.28); i < end; ) {
      const x = (rnd() * 2 - 1) * D, y = (rnd() * 2 - 1) * D;
      const edge = Math.max(Math.abs(x), Math.abs(y)) > D - 0.025;
      const inCore = Math.abs(x) < C && Math.abs(y) < C;
      const coreEdge = inCore && Math.max(Math.abs(x), Math.abs(y)) > C - 0.02;
      put(b, i++, x, y, inCore ? T + 0.03 : T, edge || coreEdge ? 1 : inCore ? 0.1 : 0.3);
    }
    for (let end = until(0.1); i < end; ) {
      const [x, y] = text[Math.floor(rnd() * text.length)];
      put(b, i++, x + (rnd() - 0.5) * 0.004, y + (rnd() - 0.5) * 0.004, T + 0.035, -1);
    }
    for (let end = until(0.08); i < end; ) {
      // sides + underside of the die
      const x = (rnd() * 2 - 1) * D, y = (rnd() * 2 - 1) * D;
      if (rnd() < 0.5) put(b, i++, x, y, -T, 0.12);
      else {
        const side = Math.floor(rnd() * 4), u = (rnd() * 2 - 1) * D, z = (rnd() * 2 - 1) * T;
        put(b, i++, side < 2 ? (side ? D : -D) : u, side < 2 ? u : (side === 2 ? D : -D), z, 0.5);
      }
    }
    for (let end = until(0.1); i < end; ) {
      const p = pins[Math.floor(rnd() * pins.length)], t = rnd() * 0.16;
      put(b, i++, p.x + p.dir[0] * t, p.y + p.dir[1] * t, 0, 0.85);
    }
    for (let end = until(0.36); i < end; ) {
      // traces: out from the pin, then a diagonal jog, then out again
      const p = pins[Math.floor(rnd() * pins.length)], t = rnd();
      const seg1 = 0.16 + p.len * 0.35, jog = p.bend;
      const d = 0.16 + t * p.len;
      let x, y;
      if (d < seg1) { x = p.x + p.dir[0] * d; y = p.y + p.dir[1] * d; }
      else { const k = Math.min(1, (d - seg1) / 0.25); x = p.x + p.dir[0] * d + p.along[0] * jog * k; y = p.y + p.dir[1] * d + p.along[1] * jog * k; }
      put(b, i++, x, y, 0, 0.4);
    }
    while (i < N) {
      // glowing pads at the end of each trace
      const p = pins[Math.floor(rnd() * pins.length)], d = 0.16 + p.len, [x, y] = randDir(), r = 0.03 * Math.sqrt(rnd());
      put(b, i++, p.x + p.dir[0] * d + p.along[0] * p.bend + x * r, p.y + p.dir[1] * d + p.along[1] * p.bend + y * r, 0, -0.9);
    }
    return b;
  }

  // C. The eye: iris fibres, dark pupil, glowing limbus, targeting rings (it follows the cursor)
  function shapeEye() {
    const b = buffer();
    const R = 1, IRIS = 0.62, PUPIL = 0.24;
    let i = 0;
    const until = (frac) => Math.min(N, i + Math.floor(N * frac));
    const onSphere = (theta, phi, r = R) => [r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)];
    for (let end = until(0.46); i < end; ) {
      const theta = PUPIL + (IRIS - PUPIL) * Math.sqrt(rnd()), phi = rnd() * TAU;
      const fibre = Math.pow(Math.abs(Math.sin(phi * 36 + Math.sin(theta * 30) * 0.8)), 3);
      const ringy = 0.5 + 0.5 * Math.sin(theta * 55);
      const [x, y, z] = onSphere(theta, phi, R * 0.985);
      put(b, i++, x, y, z, 0.18 + 0.6 * fibre * (0.6 + 0.4 * ringy));
    }
    for (let end = until(0.06); i < end; ) {
      const [x, y, z] = onSphere(IRIS + (rnd() - 0.5) * 0.04, rnd() * TAU);
      put(b, i++, x, y, z, -1);
    }
    for (let end = until(0.05); i < end; ) {
      const [x, y, z] = onSphere(PUPIL + rnd() * 0.02, rnd() * TAU, R * 0.98);
      put(b, i++, x, y, z, 0.95);
    }
    for (let end = until(0.2); i < end; ) {
      const theta = IRIS + 0.05 + rnd() * (Math.PI * 0.62 - IRIS), phi = rnd() * TAU;
      const [x, y, z] = onSphere(theta, phi);
      put(b, i++, x, y, z, 0.1 + 0.12 * rnd());
    }
    while (i < N) {
      // targeting rings around the eye, with tick marks and two lime arcs
      const which = rnd(), a = rnd() * TAU;
      if (which < 0.4) put(b, i++, Math.cos(a) * 1.28, Math.sin(a) * 1.28, 0.2, 0.35);
      else if (which < 0.7) {
        const t = (Math.floor(rnd() * 48) / 48) * TAU, r = 1.4 + rnd() * 0.07;
        put(b, i++, Math.cos(t) * r, Math.sin(t) * r, 0.2, 0.55);
      } else {
        const arc = (rnd() < 0.5 ? 0.3 : Math.PI + 0.3) + rnd() * 0.9;
        put(b, i++, Math.cos(arc) * 1.55, Math.sin(arc) * 1.55, 0.2, -0.8);
      }
    }
    return b;
  }

  // E. Voice orb: an assistant-style orb that ripples as if it's speaking (see uSpeak in the shader)
  function shapeOrb() {
    const b = buffer();
    let i = 0;
    const until = (frac) => Math.min(N, i + Math.floor(N * frac));
    for (let end = until(0.5); i < end; ) {
      const [x, y, z] = randDir();
      const band = 0.5 + 0.5 * Math.sin(y * 9 + Math.atan2(z, x) * 2);
      put(b, i++, x, y, z, 0.25 + 0.55 * band);
    }
    for (let end = until(0.24); i < end; ) {
      // three tilted inner orbits
      const k = Math.floor(rnd() * 3), a = rnd() * TAU, r = 0.62 + k * 0.08;
      let x = Math.cos(a) * r, y = 0, z = Math.sin(a) * r;
      const tilt = [0.5, -0.7, 1.3][k], c = Math.cos(tilt), sn = Math.sin(tilt);
      [y, z] = [y * c - z * sn, y * sn + z * c];
      const c2 = Math.cos(k * 1.1), s2 = Math.sin(k * 1.1);
      [x, y] = [x * c2 - y * s2, x * s2 + y * c2];
      put(b, i++, x, y, z, k === 1 ? -0.9 : 0.6);
    }
    for (let end = until(0.14); i < end; ) {
      const [x, y, z] = randDir(), r = 0.26 * Math.cbrt(rnd());
      put(b, i++, x * r, y * r, z * r, -1);
    }
    while (i < N) {
      const [x, y, z] = randDir(), r = 1.18 + rnd() * 0.25;
      put(b, i++, x * r, y * r, z * r, 0.07);
    }
    return b;
  }

  // F. AI sparkle: a puffy four-point star with two small companions
  function shapeSparkle() {
    const b = buffer();
    const stars = [
      { cx: 0, cy: 0, cz: 0, R: 1.05, w: 0.62, acc: false },
      { cx: 0.98, cy: 0.9, cz: 0.15, R: 0.36, w: 0.2, acc: true },
      { cx: -0.95, cy: -0.85, cz: -0.1, R: 0.22, w: 0.12, acc: true },
    ];
    const inside = (x, y, R) => Math.pow(Math.abs(x) / R, 2 / 3) + Math.pow(Math.abs(y) / R, 2 / 3); // astroid: <= 1 is inside
    let i = 0;
    while (i < N) {
      const pick = rnd();
      const st = pick < 0.72 ? stars[0] : pick < 0.9 ? stars[1] : stars[2];
      const x = (rnd() * 2 - 1) * st.R, y = (rnd() * 2 - 1) * st.R;
      const f = inside(x, y, st.R);
      if (f > 1) continue;
      const edge = f > 0.9;
      if (!edge && rnd() < 0.55) continue; // lighter fill, crisp outline
      const puff = st.w * Math.pow(1 - f, 0.7) * 0.5; // thicker in the middle
      const z = (rnd() < 0.5 ? -1 : 1) * puff;
      const w = st.acc ? -0.95 : edge ? -0.85 : 0.3 + 0.6 * (1 - f);
      put(b, i++, st.cx + x, st.cy + y, st.cz + z, w);
    }
    return b;
  }

  // G. Infinity knot: a (2,3) torus knot tube with bright highlights
  function shapeKnot() {
    const b = buffer();
    const P = 2, Q = 3, S = 0.36, TUBE = 0.13;
    const curve = (t) => {
      const r = Math.cos(Q * t) + 2;
      return [r * Math.cos(P * t) * S, r * Math.sin(P * t) * S, -Math.sin(Q * t) * S * 1.2];
    };
    for (let i = 0; i < N; i++) {
      const t = rnd() * TAU;
      const c = curve(t), c2 = curve(t + 0.001);
      const T = [c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]];
      const tl = Math.hypot(...T);
      T[0] /= tl; T[1] /= tl; T[2] /= tl;
      // a frame around the tangent
      let Nn = [-T[1], T[0], 0];
      const nl = Math.hypot(...Nn) || 1;
      Nn = Nn.map((v) => v / nl);
      const B = [T[1] * Nn[2] - T[2] * Nn[1], T[2] * Nn[0] - T[0] * Nn[2], T[0] * Nn[1] - T[1] * Nn[0]];
      const phi = rnd() * TAU, r = TUBE * (rnd() < 0.85 ? 1 : Math.sqrt(rnd()));
      const x = c[0] + (Nn[0] * Math.cos(phi) + B[0] * Math.sin(phi)) * r;
      const y = c[1] + (Nn[1] * Math.cos(phi) + B[1] * Math.sin(phi)) * r;
      const z = c[2] + (Nn[2] * Math.cos(phi) + B[2] * Math.sin(phi)) * r;
      const glint = Math.pow(0.5 + 0.5 * Math.sin(t * 3), 12); // three bright highlight streaks
      put(b, i, x, y, z, glint > 0.55 ? -0.95 : 0.3 + 0.5 * Math.abs(Math.cos(phi)));
    }
    return b;
  }

  function shapeDust() {
    const b = buffer();
    for (let i = 0; i < N; i++) {
      put(b, i, (rnd() - 0.5) * 7.4, (rnd() - 0.5) * 4.6, -2.5 + rnd() * 4, rnd() < 0.01 ? -0.7 : 0.08 + 0.4 * rnd() ** 3);
    }
    return b;
  }

  function shapeFootball() {
    // Classic ball: 12 pentagons + 20 hexagons (Voronoi cells of an icosahedron's vertices + face centres)
    const phi = (1 + Math.sqrt(5)) / 2;
    const verts = []; // the 12 vertices: cyclic permutations of (0, ±1, ±φ)
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      verts.push([0, s1, s2 * phi], [s1, s2 * phi, 0], [s2 * phi, 0, s1]);
    }
    const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const pent = verts.map(norm);
    const hex = [];
    for (let a = 0; a < 12; a++) for (let c = a + 1; c < 12; c++) for (let d = c + 1; d < 12; d++) {
      const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (Math.abs(dist(verts[a], verts[c]) - 2) < 0.01 && Math.abs(dist(verts[a], verts[d]) - 2) < 0.01 && Math.abs(dist(verts[c], verts[d]) - 2) < 0.01) {
        hex.push(norm([verts[a][0] + verts[c][0] + verts[d][0], verts[a][1] + verts[c][1] + verts[d][1], verts[a][2] + verts[c][2] + verts[d][2]]));
      }
    }
    const centres = [...pent.map((p) => ({ p, pent: true })), ...hex.map((p) => ({ p, pent: false }))];
    const b = buffer();
    let i = 0;
    while (i < N) {
      const d = randDir();
      let best = -2, second = -2, bestC = null;
      for (const c of centres) {
        const dot = d[0] * c.p[0] + d[1] * c.p[1] + d[2] * c.p[2];
        if (dot > best) { second = best; best = dot; bestC = c; } else if (dot > second) second = dot;
      }
      const seam = Math.acos(Math.min(second, 1)) - Math.acos(Math.min(best, 1)) < 0.045;
      let w;
      if (seam) w = 0.95;
      else if (bestC.pent) { if (rnd() > 0.55) continue; w = -0.85; }
      else { if (rnd() > 0.1) continue; w = 0.3; }
      put(b, i++, d[0] * 1.1, d[1] * 1.1, d[2] * 1.1, w);
    }
    return b;
  }

  const shapes = [];
  const aiChoice = new URLSearchParams(location.search).get('ai') || AI_SHAPE;
  const aiShape = { orb: shapeOrb, sparkle: shapeSparkle, knot: shapeKnot, network: shapeNeural, chip: shapeChip, eye: shapeEye, brain: shapeBrain }[aiChoice] || shapeBrain;
  for (const make of [shapeSphere, shapePadlock, aiShape, shapeAgents, shapeDust, shapeHelix, shapeDust, shapeFootball]) {
    shapes.push(make());
    loader.set(55 + shapes.length * 5);
    await nextFrame();
  }
  loader.set(100);

  /* ───────────────────────── Points ───────────────────────── */
  const geo = new THREE.BufferGeometry();
  const dirs = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [x, y, z] = randDir();
    dirs.set([x, y, z], i * 3);
    seeds[i] = rnd();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(dirs, 3)); // random scatter direction
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const shapeAttrs = shapes.map((s) => new THREE.BufferAttribute(s, 4));
  shapeAttrs.forEach((a, k) => geo.setAttribute(`aP${k}`, a));
  geo.setAttribute('aP8', shapeAttrs[0]); // contact reuses the sphere

  const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c6ff3d';
  const uniforms = {
    uStage: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: innerWidth <= 900 ? 10.5 : 10 },
    uPR: { value: renderer.getPixelRatio() },
    uAlpha: { value: 1 },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uMouseOn: { value: 0 },
    uAspect: { value: innerWidth / innerHeight },
    uCamZ: { value: CAM_Z },
    uSpeak: { value: 0 },
    uColor: { value: new THREE.Color('#f2f2f2') },
    uAccent: { value: new THREE.Color(accentHex) },
  };
  const STAGES = 9;
  const weights = Array.from({ length: STAGES }, (_, k) => k).map((k) => `float w${k} = clamp(1.0 - abs(uStage - ${k}.0), 0.0, 1.0);`).join('\n');
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      ${Array.from({ length: STAGES }, (_, k) => `attribute vec4 aP${k};`).join(' ')}
      uniform float uStage;
      uniform float uTime;
      uniform float uSize;
      uniform float uPR;
      uniform vec2 uMouse;
      uniform float uMouseOn;
      uniform float uAspect;
      uniform float uCamZ;
      uniform float uSpeak;
      varying float vBright;
      varying float vAccent;
      varying float vDepth;
      void main() {
        ${weights}
        vec4 P = ${Array.from({ length: STAGES }, (_, k) => `aP${k} * w${k}`).join(' + ')};
        float maxW = ${Array.from({ length: STAGES - 1 }, () => 'max(').join('')}w0${Array.from({ length: STAGES - 1 }, (_, k) => `, w${k + 1})`).join('')};
        float scatter = (1.0 - maxW) * 2.0;           // 0 when settled, 1 halfway between shapes
        vec3 p = P.xyz;
        if (uSpeak > 0.0) {
          // voice orb: ripples travel over the surface like a voice waveform
          vec3 nd = normalize(P.xyz + vec3(1e-4));
          float wave = sin(nd.y * 10.0 - uTime * 6.0) * 0.5 + 0.5;
          wave *= 0.6 + 0.4 * sin(atan(nd.z, nd.x) * 3.0 + uTime * 2.0);
          p += nd * w2 * uSpeak * wave * 0.12;
        }
        p += position * scatter * (0.7 + aSeed * 1.1);  // burst apart while morphing
        p += position * sin(uTime * 0.9 + aSeed * 6.2831) * 0.012; // gentle breathing
        // slow shimmer that flows across the surface
        p += vec3(
          sin(uTime * 0.7 + p.y * 3.1 + aSeed * 6.0),
          cos(uTime * 0.6 + p.z * 2.7 + aSeed * 4.0),
          sin(uTime * 0.8 + p.x * 2.9 + aSeed * 5.0)
        ) * 0.016;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // push particles away from the cursor
        vec4 clip = projectionMatrix * mv;
        vec2 ndc = clip.xy / clip.w;
        vec2 d = (ndc - uMouse) * vec2(uAspect, 1.0);
        float push = smoothstep(0.28, 0.0, length(d)) * uMouseOn;
        mv.xy += normalize(d + 1e-5) * push * 0.28 * (-mv.z / 6.0);
        gl_Position = projectionMatrix * mv;

        // fake lighting: depth (front bright, back dim) + rim light on the silhouette
        vec3 vn = normalize(normalMatrix * normalize(P.xyz + vec3(1e-4)));
        float facing = abs(dot(vn, normalize(-mv.xyz)));
        float rim = pow(1.0 - facing, 2.2);
        float depth = smoothstep(-uCamZ - 1.8, -uCamZ + 1.4, mv.z);
        vDepth = depth;

        vAccent = step(P.w, -0.001);
        float twinkle = 0.78 + 0.22 * sin(uTime * (2.0 + vAccent * 3.0) + aSeed * 40.0);
        vBright = abs(P.w) * twinkle * (0.28 + 0.72 * depth) * (0.75 + 1.1 * rim) + push * 0.6;
        gl_PointSize = uSize * (0.55 + aSeed * 0.9) * (1.0 + vAccent * 0.35) * (0.65 + 0.7 * depth) * uPR / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uAccent;
      uniform float uAlpha;
      varying float vBright;
      varying float vAccent;
      varying float vDepth;
      void main() {
        // near particles are crisp, far ones soft (like depth of field)
        float a = smoothstep(0.5, mix(0.32, 0.04, vDepth), length(gl_PointCoord - 0.5));
        vec3 base = mix(vec3(0.42, 0.45, 0.55), uColor, vDepth); // far = cool grey, near = white
        gl_FragColor = vec4(mix(base, uAccent, vAccent), a * vBright * uAlpha * 0.62);
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  const mover = new THREE.Group(); // position + squash (the inner group only rotates)
  mover.add(group);
  scene.add(mover);

  /* ---------- Orbiting dust ring (like a tiny planet's ring) ---------- */
  const RING_N = innerWidth <= 900 ? 1400 : 3200;
  const ringPos = new Float32Array(RING_N * 3);
  const ringSeed = new Float32Array(RING_N);
  for (let i = 0; i < RING_N; i++) {
    const a = rnd() * TAU;
    const gauss = (rnd() + rnd() + rnd() - 1.5) / 1.5;
    const r = 1.85 + gauss * 0.16 + (rnd() < 0.08 ? 0.35 : 0); // a faint outer band too
    ringPos.set([Math.cos(a) * r, gauss * 0.025, Math.sin(a) * r], i * 3);
    ringSeed[i] = rnd();
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  ringGeo.setAttribute('aSeed', new THREE.BufferAttribute(ringSeed, 1));
  const ringU = { uTime: uniforms.uTime, uPR: uniforms.uPR, uAlpha: { value: 1 }, uColor: uniforms.uColor, uAccent: uniforms.uAccent };
  const ring = new THREE.Points(ringGeo, new THREE.ShaderMaterial({
    uniforms: ringU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPR;
      varying float vA;
      varying float vAccent;
      void main() {
        // inner dust orbits faster than outer dust
        float r = length(position.xz);
        float ang = atan(position.z, position.x) + uTime * (0.22 / r) * (0.8 + aSeed * 0.4);
        vec3 p = vec3(cos(ang) * r, position.y, sin(ang) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = smoothstep(-8.5, -4.0, mv.z);
        vAccent = step(0.965, aSeed);
        vA = (0.18 + 0.5 * depth) * (0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 50.0));
        gl_PointSize = (5.0 + aSeed * 7.0) * (0.6 + 0.8 * depth) * uPR / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uAccent;
      uniform float uAlpha;
      varying float vA;
      varying float vAccent;
      void main() {
        float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(mix(uColor, uAccent, vAccent), a * vA * uAlpha);
        #include <colorspace_fragment>
      }
    `,
  }));
  ring.frustumCulled = false;
  const ringHolder = new THREE.Group(); // tilted plane the ring lives in
  ringHolder.rotation.set(0.32, 0, 0.22);
  ringHolder.add(ring);
  scene.add(ringHolder);

  /* ───────────────────────── Scroll choreography ─────────────────────────
   * One entry per section, in page order. xf / yf: position as a fraction of the half-screen,
   * s: scale, a: opacity, spin: rotation speed, tilt: forward tilt.
   */
  // ring: how visible the orbiting dust ring is (0 = hidden)
  const LAYOUT = [
    { xf: 0.38, yf: 0.18, s: 1.02, a: 1, ring: 1, spin: 0.12, tilt: 0.15, m: { xf: 0, yf: 0.34, s: 0.62 } },      // intro · sphere, top-right
    { xf: -0.4, yf: 0, s: 1.2, a: 1, ring: 0.9, spin: 0.22, tilt: 0.1, m: { xf: 0, yf: 0.46, s: 0.58 } },        // security · padlock, left
    { xf: 0.4, yf: 0, s: 1.7, a: 1, ring: 0.5, spin: 0.16, tilt: 0.3, m: { xf: 0, yf: 0.44, s: 0.5 } },          // ai · chip, right of the text
    { xf: -0.4, yf: 0, s: 1.0, a: 1, ring: 0, spin: 0.25, tilt: 0.2, m: { xf: 0, yf: 0.46, s: 0.56 } },         // agents · left of the text
    { xf: 0, yf: 0, s: 1.7, a: 0.2, ring: 0, spin: 0.02, tilt: 0, m: { s: 1.3, a: 0.16 } },                                  // skills · faint dust behind the tree
    { xf: -0.52, yf: 0, s: 1.15, a: 1, ring: 0, spin: 0.35, tilt: 0.05, m: { xf: 0, yf: 0.05, s: 0.7, a: 0.3 } }, // experience · helix, left
    { xf: 0, yf: 0, s: 1, a: 0.45, ring: 0, spin: 0.02, tilt: 0, m: {} },                                          // work · dust
    { xf: 0, yf: 0, s: 0.58, a: 1, ring: 0, spin: 0.2, tilt: 0.2, m: { xf: 0, yf: 0, s: 0.42 } },                 // football · bouncing ball (see physics below)
    { xf: 0, yf: 0.04, s: 0.95, a: 0.4, ring: 0.6, spin: 0.1, tilt: 0.15, m: { yf: 0.1, s: 0.6 } },               // contact · sphere
  ];
  const AI = 2;
  // each AI design gets its own spot; chip and eye face the viewer instead of spinning
  const AI_LAYOUT = {
    brain: {},
    network: { xf: 0.34, yf: -0.06, s: 1.08, spin: 0, ring: 0 },
    chip: { xf: 0.36, yf: 0, s: 0.95, spin: 0, ring: 0 },
    eye: { xf: 0.36, yf: -0.05, s: 1.05, spin: 0, ring: 0 },
    orb: { xf: 0.36, yf: -0.04, s: 1.12, spin: 0.15, tilt: 0.2, ring: 0.8 },
    sparkle: { xf: 0.36, yf: -0.02, s: 1.0, spin: 0, ring: 0 },
    knot: { xf: 0.36, yf: -0.04, s: 1.05, spin: 0.3, tilt: 0.45, ring: 0 },
  };
  Object.assign(LAYOUT[AI], AI_LAYOUT[aiChoice] || {});
  const AI_FACE = { network: [0.18, -0.62], chip: [-0.55, 0.28], eye: [0, 0], sparkle: [0.05, -0.2] }[aiChoice]; // [tilt, turn] when facing the viewer
  const FOOTBALL = 7;
  const sections = ['intro', 'security', 'ai', 'agents', 'skills', 'experience', 'work', 'football', 'contact']
    .map((id) => document.getElementById(id));
  const hudNum = document.querySelector('.hud-num');
  const hudLabel = document.querySelector('.hud-label');

  const smoothstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  function scrollStage() {
    const mid = innerHeight / 2;
    // a section can hand the 3D a smaller box to centre on (data-anchor), e.g. just the starfield stage
    const centers = sections.map((s) => {
      const r = (s.dataset.anchor ? s.querySelector(s.dataset.anchor) || s : s).getBoundingClientRect();
      return r.top + r.height / 2;
    });
    let i = 0;
    while (i < centers.length - 1 && centers[i + 1] <= mid) i++;
    if (i === centers.length - 1 || mid <= centers[0]) return i;
    const t = (mid - centers[i]) / (centers[i + 1] - centers[i]);
    return i + smoothstep(0.2, 0.8, t); // hold each shape, morph in between
  }
  function layoutAt(stage) {
    const small = innerWidth <= 900;
    const i = Math.min(Math.floor(stage), LAYOUT.length - 1);
    const j = Math.min(i + 1, LAYOUT.length - 1);
    const f = stage - i;
    const A = { ...LAYOUT[i], ...(small ? LAYOUT[i].m : null) };
    const B = { ...LAYOUT[j], ...(small ? LAYOUT[j].m : null) };
    const out = {};
    for (const k of ['xf', 'yf', 's', 'a', 'ring', 'spin', 'tilt']) out[k] = A[k] + (B[k] - A[k]) * f;
    return out;
  }

  /* ───────────────────────── Input ───────────────────────── */
  const mouse = { x: 9, y: 9, on: 0, sx: 0, sy: 0, px: -9999, py: -9999 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    mouse.px = e.clientX;
    mouse.py = e.clientY;
    mouse.on = 1;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.on = 0; });
  const tap = { x: 0, y: 0, t: -10 };
  window.addEventListener('pointerdown', (e) => {
    tap.x = (e.clientX / innerWidth) * 2 - 1;
    tap.y = -(e.clientY / innerHeight) * 2 + 1;
    tap.t = time;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setSize(innerWidth, innerHeight);
    uniforms.uAspect.value = camera.aspect;
    uniforms.uPR.value = renderer.getPixelRatio();
  });

  /* ───────────────────────── Loop ───────────────────────── */
  const clock = new THREE.Clock();
  let stage = scrollStage();
  let rotY = 0;
  let time = 0;
  let hudIndex = -1;
  const ball = { x: 0, y: 0, vx: 0, vy: 0, roll: 0, spin: 0, squash: 0, lastKick: -10 };
  let prevMouseX = 0;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;

  renderer.setAnimationLoop(() => tick(Math.min(clock.getDelta(), 0.05)));
  if (debug) {
    window.__step = (frames = 60) => { for (let i = 0; i < frames; i++) tick(1 / 60); };
    window.__bloom = bloom;
    window.__ball = ball;
    window.__info = () => ({ stage, target: scrollStage(), scrollY });
    window.__mover = mover;
  }

  // Football: keeps bouncing on its own; touch it with the cursor (or tap it) to kick it across the screen
  function updateBall(dt, fw, halfW, r) {
    const mx = mouse.x * halfW;
    const mouseVX = dt > 0 ? (mx - prevMouseX) / dt : 0;
    prevMouseX = mx;
    if (fw < 0.05) {
      // off-screen: get ready to drop in from the top when the section arrives
      Object.assign(ball, { x: 0, y: halfH * 0.6, vx: (rnd() - 0.5) * 2, vy: 0, spin: 0 });
      return;
    }
    if (reduceMotion) { ball.x = 0; ball.y = 0; return; }
    ball.vy -= 9 * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const floor = -halfH * 0.74 + r, wall = halfW - r, ceil = halfH - r;
    if (ball.y < floor) {
      ball.y = floor;
      ball.squash = Math.min(0.2, Math.abs(ball.vy) * 0.025);
      ball.vy = Math.max(Math.abs(ball.vy) * 0.78, 4.4); // never stops bouncing
    }
    if (ball.x > wall) { ball.x = wall; ball.vx = -Math.abs(ball.vx) * 0.82; ball.spin *= -0.6; }
    if (ball.x < -wall) { ball.x = -wall; ball.vx = Math.abs(ball.vx) * 0.82; ball.spin *= -0.6; }
    if (ball.y > ceil) { ball.y = ceil; ball.vy = -Math.abs(ball.vy) * 0.5; }
    ball.vx *= Math.exp(-dt * 0.3);
    ball.spin *= Math.exp(-dt * 1.2);
    ball.squash *= Math.exp(-dt * 12);
    ball.roll -= (ball.vx * dt) / r;

    // kick: cursor touching the ball, or a recent tap on it
    const tapping = time - tap.t < 0.15;
    const px = tapping ? tap.x * halfW : mx;
    const py = (tapping ? tap.y : mouse.y) * halfH;
    const dx = ball.x - px, dy = ball.y - py, dist = Math.hypot(dx, dy) || 1;
    if ((mouse.on || tapping) && dist < r * 1.05 && time - ball.lastKick > 0.3) {
      const nx = dx / dist;
      ball.vx = nx * 7.5 + THREE.MathUtils.clamp(mouseVX * 0.25, -4, 4);
      ball.vy = Math.max(ball.vy, 0) + 5.5 + Math.max(dy / dist, 0) * 2.5;
      ball.spin += -nx * 10;
      ball.lastKick = time;
      if (tapping) tap.t = -10;
    }
  }

  function tick(dt) {
    time += dt * (reduceMotion ? 0.3 : 1);
    const k = 1 - Math.exp(-dt * (reduceMotion ? 10 : 3.2));
    stage += (scrollStage() - stage) * k;
    const L = layoutAt(stage);

    const halfW = halfH * camera.aspect;
    const fw = Math.max(0, 1 - Math.abs(stage - FOOTBALL)); // 1 = fully in the football section
    updateBall(dt, fw, halfW, 1.1 * L.s);
    const sq = ball.squash * fw;
    mover.position.set(
      L.xf * halfW + (ball.x - L.xf * halfW) * fw,
      L.yf * halfH + (ball.y - L.yf * halfH) * fw,
      0,
    );
    mover.scale.set(L.s * (1 + sq * 0.6), L.s * (1 - sq), L.s * (1 + sq * 0.6));
    rotY += dt * (L.spin * (reduceMotion ? 0.3 : 1) + ball.spin * fw);
    mouse.sx += (Math.min(Math.max(mouse.x, -1), 1) * mouse.on - mouse.sx) * k;
    mouse.sy += (Math.min(Math.max(mouse.y, -1), 1) * mouse.on - mouse.sy) * k;
    let rx = L.tilt - mouse.sy * 0.25 * (1 - fw);
    let ry = rotY + mouse.sx * 0.35 * (1 - fw);
    // some sections face the viewer instead of spinning: [stage, tilt, turn, how much the cursor steers]
    for (const [idx, fx, fy, steer] of [AI_FACE && [AI, AI_FACE[0], AI_FACE[1], 1]].filter(Boolean)) {
      if (idx === undefined) continue;
      const w = Math.max(0, 1 - Math.abs(stage - idx));
      const lookX = fx - mouse.sy * 0.45 * steer + Math.sin(time * 0.5) * 0.05 * steer;
      const lookY = fy + mouse.sx * 0.6 * steer + Math.sin(time * 0.35) * 0.08 * steer;
      rx += (lookX - rx) * w;
      ry += (lookY - ry) * w;
    }
    group.rotation.set(rx, ry, ball.roll * fw);
    ringHolder.position.copy(mover.position);
    ringHolder.scale.setScalar(L.s);
    ringHolder.rotation.x = 0.32 - mouse.sy * 0.15;
    ringHolder.rotation.y = mouse.sx * 0.2;
    // the ring fades while shapes are morphing
    const settle = 1 - Math.min(1, Math.abs(stage - Math.round(stage)) * 2.2);
    ringU.uAlpha.value = L.ring * (0.3 + 0.7 * settle);

    uniforms.uStage.value = stage;
    if (aiChoice === 'orb') {
      // "speaking" rhythm, stronger when the cursor is close to the orb
      const talk = 0.35 + 0.35 * Math.abs(Math.sin(time * 2.3) * Math.sin(time * 1.3 + 1));
      const near = mouse.on ? Math.max(0, 1 - Math.hypot(mouse.x * halfW - mover.position.x, mouse.y * halfH - mover.position.y) / 2.2) : 0;
      uniforms.uSpeak.value += (talk + near * 0.9 - uniforms.uSpeak.value) * 0.15;
    }
    uniforms.uTime.value = time;
    uniforms.uAlpha.value = L.a;
    uniforms.uMouse.value.set(mouse.x, mouse.y);
    uniforms.uMouseOn.value += (mouse.on - uniforms.uMouseOn.value) * k;

    const nearest = Math.round(stage);
    if (nearest !== hudIndex && hudNum) {
      hudIndex = nearest;
      hudNum.textContent = String(nearest).padStart(2, '0');
      hudLabel.textContent = sections[nearest]?.dataset.label || '';
    }
    draw();
  }

  /* ───────────────────────── UI helpers ───────────────────────── */
  function initLoader() {
    const el = document.getElementById('loader');
    const pct = el?.querySelector('.loader-pct span');
    const bar = el?.querySelector('.loader-bar span');
    const finish = () => document.body.classList.add('loaded');
    if (!el || reduceMotion) {
      el?.remove();
      finish();
      return { set() {} };
    }
    let target = 8, shown = 0, closed = false;
    const step = () => {
      shown = Math.min(target, shown + Math.max(0.6, (target - shown) * 0.09));
      pct.textContent = Math.floor(shown);
      bar.style.transform = `scaleX(${shown / 100})`;
      if (shown >= 100 && !closed) {
        closed = true;
        setTimeout(() => { el.classList.add('done'); finish(); setTimeout(() => el.remove(), 1100); }, 300);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { target = 100; }, 9000); // never get stuck
    return { set(v) { target = Math.max(target, v); } };
  }

  function initClock() {
    const el = document.querySelector('.clock');
    const out = el?.querySelector('.clock-time');
    if (!out) return;
    const tz = el.dataset.tz;
    const update = () => {
      try {
        out.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined }).format(new Date());
      } catch (e) {
        out.textContent = new Date().toTimeString().slice(0, 5);
      }
    };
    update();
    setInterval(update, 15000);
  }

  function initCursor() {
    const c = document.querySelector('.cursor');
    if (!c || !finePointer || reduceMotion) { c?.remove(); return; }
    const dot = c.querySelector('.cursor-dot'), ring = c.querySelector('.cursor-ring');
    let x = -100, y = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', (e) => {
      x = e.clientX;
      y = e.clientY;
      c.classList.add('on');
      c.classList.toggle('hover', !!e.target.closest('a, button'));
    }, { passive: true });
    document.addEventListener('pointerleave', () => c.classList.remove('on'));
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      dot.style.transform = `translate(${x}px, ${y}px)`;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  // full-screen menu on phones
  function initMenu() {
    const btn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');
    if (!btn || !menu) return;
    let open = false;
    const set = (v) => {
      open = v;
      btn.setAttribute('aria-expanded', String(v));
      btn.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
      if (v) {
        menu.hidden = false;
        void menu.offsetWidth; // force a layout pass so the fade actually runs
        document.body.classList.add('menu-open');
      } else {
        document.body.classList.remove('menu-open');
        setTimeout(() => { if (!open) menu.hidden = true; }, 400);
      }
    };
    btn.addEventListener('click', () => set(!open));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) set(false); });
    // a phone rotated to landscape gets the desktop bar back
    matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches && open) set(false); });
  }

  function initNav() {
    const links = [...document.querySelectorAll('.nav-links a')];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => io.observe(s));
  }
})();
