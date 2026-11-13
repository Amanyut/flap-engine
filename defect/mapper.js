/* Amanyu's Flapendium - Defect Mapper (prototype).
   A true-scale 3D body (male / female, fitted to height and weight) on which the user paints one continuous
   defect. The app measures it (area, approximate length x width), works out which anatomical zones it lies in,
   and lists the flaps whose reach and usual size cover it.
   Bodies, fitting and painting follow the TBSA app (BodyMorphBuilder.cs / BurnPainter.cs). Loaded only when opened. */
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const BASE = 'defect/';
const BODY_FILES = { male: 'body_male.v1.bin', female: 'body_female.v1.bin' };
const LEVEL_DELTA = { Very_Lean: 0, Lean: 1, Obese: 2, Very_Obese: 3 };   // order of the deltas in the .bin
const LEVELS = ['Very_Lean', 'Lean', 'Normal', 'Obese', 'Very_Obese'];
// short codes for the zones (same order as body_meta.json "zones")
const ZONE_CODES = ['unmapped',
  'thigh.prox.ant', 'thigh.prox.med', 'thigh.prox.lat', 'thigh.prox.post',
  'thigh.mid.ant', 'thigh.mid.med', 'thigh.mid.lat', 'thigh.mid.post',
  'thigh.dist.ant', 'thigh.dist.med', 'thigh.dist.lat', 'thigh.dist.post',
  'knee.ant', 'knee.med', 'knee.lat', 'knee.post',
  'leg.prox.ant', 'leg.prox.med', 'leg.prox.lat', 'leg.prox.post',
  'leg.mid.ant', 'leg.mid.med', 'leg.mid.lat', 'leg.mid.post',
  'leg.dist.ant', 'leg.dist.med', 'leg.dist.lat', 'leg.dist.post',
  'ankle.ant', 'ankle.med', 'ankle.lat', 'heel.post',
  'foot.dorsum', 'sole.heel', 'sole.mid', 'sole.fore', 'toes'];

const SKIN = new THREE.Color('#e7b49c');
const DEFECT = new THREE.Color('#b3121f');
const EYE = new THREE.Color('#eeeeea');

let meta = null, reach = null, ui = null, state = null, openFlag = false;

// ================= BODY DATA =================
async function loadMeta() {
  if (!meta) meta = await fetch(BASE + 'body_meta.json').then(r => r.json());
  if (!reach) reach = await fetch(BASE + 'reach.json').then(r => r.json());
}
const bodyCache = {};
async function loadBody(sex) {
  if (bodyCache[sex]) return bodyCache[sex];
  const m = meta.bodies[sex];
  const buf = await fetch(BASE + BODY_FILES[sex]).then(r => { if (!r.ok) throw new Error('body file'); return r.arrayBuffer(); });
  const n = m.vertices; let off = 0;
  const take = (Type, count) => { const a = new Type(buf, off, count); off += count * Type.BYTES_PER_ELEMENT; return a; };
  const base = take(Int16Array, n * 3);
  const deltas = [0, 1, 2, 3].map(() => take(Int16Array, n * 3));
  const skin = take(Uint16Array, m.skinTris * 3);
  const eyes = take(Uint16Array, m.eyeTris * 3);
  const zone = new Uint8Array(buf, off, n);
  // neighbours of every vertex (for the one-continuous-defect rule)
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < skin.length; i += 3) {
    const a = skin[i], b = skin[i + 1], c = skin[i + 2];
    adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
  }
  const isSkin = new Uint8Array(n); for (let i = 0; i < skin.length; i++) isSkin[skin[i]] = 1;
  return (bodyCache[sex] = { m, n, base, deltas, skin, eyes, zone, adj, isSkin });
}

// ---- fitting: same maths as BodyMorphBuilder.Fit ----
function fitBody(sex, weightKg, heightM) {
  const m = meta.bodies[sex], T = meta.steps, vr = m.volumeRatio;
  const bmi = weightKg / (heightM * heightM);
  const male = sex === 'male' ? 1 : 0;
  const fat = Math.min(60, Math.max(5, 1.2 * bmi + 0.23 * 40 - 10.8 * male - 5.4)) / 100;
  const density = 1 / (fat / 0.9007 + (1 - fat) / 1.1);
  const target = (weightKg / density + 2.5) / 1000 / (heightM ** 3);
  let mass, clamped = '';
  if (target <= vr[0]) { mass = -1; clamped = 'low'; }
  else if (target >= vr[T]) { mass = 1; clamped = 'high'; }
  else { let i = 0; while (i < T - 1 && vr[i + 1] < target) i++; mass = -1 + i * 2 / T + (target - vr[i]) / (vr[i + 1] - vr[i]) * (2 / T); }
  const sample = tab => { const x = (Math.max(-1, Math.min(1, mass)) + 1) / (2 / T); const i = Math.min(Math.floor(x), T - 1); return tab[i] + (tab[i + 1] - tab[i]) * (x - i); };
  return { sex, weightKg, heightM, bmi, mass, clamped, scale: heightM / sample(m.meshHeight), bsa: sample(m.areaRatio) * heightM * heightM };
}
function describeShape(mass) {
  const x = (Math.max(-1, Math.min(1, mass)) + 1) / 0.5, k0 = Math.min(Math.floor(x), 3), f = x - k0;
  const nm = i => LEVELS[i].replace('_', ' ').toLowerCase();
  if (f < 0.1) return nm(k0); if (f > 0.9) return nm(k0 + 1);
  return 'between ' + nm(k0) + ' and ' + nm(k0 + 1);
}
function bodyPositions(B, fit, out) {
  const x = (Math.max(-1, Math.min(1, fit.mass)) + 1) / 0.5, k0 = Math.min(Math.floor(x), 3), f = x - k0;
  const d0 = LEVELS[k0] === 'Normal' ? null : B.deltas[LEVEL_DELTA[LEVELS[k0]]];
  const d1 = LEVELS[k0 + 1] === 'Normal' ? null : B.deltas[LEVEL_DELTA[LEVELS[k0 + 1]]];
  const ps = B.m.posScale, ds = B.m.deltaScale, s = fit.scale;
  for (let i = 0; i < B.n * 3; i++) {
    let v = B.base[i] * ps;
    if (d0) v += d0[i] * ds * (1 - f);
    if (d1) v += d1[i] * ds * f;
    out[i] = v * s;
  }
}

// ================= SCENE =================
function makeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 50);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a2a24, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1.5, 2.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.7); rim.position.set(-2, 1.5, -2.5); scene.add(rim);
  const back = new THREE.DirectionalLight(0xffffff, 0.45); back.position.set(0, -1, -3); scene.add(back);
  // skin colour, with the defect drawn where the painted value crosses 0.5 - a smooth edge between vertices
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72, metalness: 0.0 });
  skinMat.onBeforeCompile = sh => {
    sh.uniforms.uDefect = { value: DEFECT };
    sh.vertexShader = `attribute float paint;
varying float vPaint;
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vPaint = paint;`);
    sh.fragmentShader = `uniform vec3 uDefect;
varying float vPaint;
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float pm = smoothstep(0.46, 0.54, vPaint);
  float rim = smoothstep(0.32, 0.5, vPaint) * (1.0 - pm);
  diffuseColor.rgb = mix(diffuseColor.rgb, uDefect, pm);
  diffuseColor.rgb *= 1.0 - 0.28 * rim;`);
  };
  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.3 });
  return { renderer, scene, camera, skinMat, eyeMat, key };
}

// ================= UI =================
const CSS = `
.dm-root { position: fixed; top: var(--topbar-h); left: 0; right: 0; bottom: 0; z-index: 840; display: flex; flex-direction: column; background: radial-gradient(ellipse at 50% 35%, #12305e 0%, #071631 55%, #030a18 100%); color: #e8eef9; font-family: var(--ui-font, sans-serif); transform: translateY(100%); transition: transform .32s cubic-bezier(.2,.8,.2,1); }
.dm-root.open { transform: none; }
.dm-head { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: rgba(4, 18, 44, .85); border-bottom: 1px solid rgba(147,197,253,.18); }
.dm-head h2 { flex: 1; margin: 0; font-size: 1.12rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.dm-beta { font-size: .66rem; font-weight: 800; letter-spacing: .6px; padding: 3px 7px; border-radius: 999px; background: #f5c451; color: #042551; }
.dm-ibtn { width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.04); color: #e8eef9; font-size: 1.25rem; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
.dm-patient { display: flex; gap: 8px; align-items: center; padding: 8px 10px; flex-wrap: wrap; background: rgba(4, 18, 44, .6); border-bottom: 1px solid rgba(147,197,253,.12); }
.dm-seg { display: inline-flex; border: 1px solid rgba(255,255,255,.2); border-radius: 10px; overflow: hidden; }
.dm-seg button { border: none; background: transparent; color: #cbd5e1; padding: 9px 12px; font-weight: 700; font-size: .92rem; cursor: pointer; font-family: inherit; }
.dm-seg button.on { background: #3b82f6; color: #fff; }
.dm-field { display: inline-flex; align-items: center; gap: 4px; font-size: .85rem; color: #9fb0c8; }
.dm-field input { width: 62px; padding: 9px 6px; border-radius: 9px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); color: #fff; font-size: .98rem; font-family: inherit; text-align: center; }
.dm-fitnote { flex-basis: 100%; font-size: .78rem; color: #93a4bf; }
.dm-stage { position: relative; flex: 1; min-height: 0; touch-action: none; overflow: hidden; }
.dm-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.dm-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #cbd5e1; pointer-events: none; }
.dm-pad { position: absolute; right: 12px; bottom: 26px; width: 108px; height: 108px; border-radius: 50%; border: 1.5px solid rgba(147,197,253,.45); background: radial-gradient(circle, rgba(59,130,246,.18), rgba(4,18,44,.55)); display: none; touch-action: none; }
.dm-pad.show { display: block; }
.dm-pad::after { content: 'rotate'; position: absolute; left: 0; right: 0; bottom: -18px; text-align: center; font-size: .7rem; color: #93a4bf; }
.dm-knob { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; background: rgba(147,197,253,.55); box-shadow: 0 0 12px rgba(96,165,250,.6); }
.dm-hint { position: absolute; left: 12px; top: 10px; right: 130px; font-size: .8rem; color: #b8c6dc; text-shadow: 0 1px 2px #000; pointer-events: none; }
.dm-tools { display: flex; align-items: center; gap: 6px; padding: 8px 8px; background: rgba(4, 18, 44, .88); border-top: 1px solid rgba(147,197,253,.18); flex-wrap: wrap; }
.dm-tool { min-width: 44px; height: 44px; border-radius: 12px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.05); color: #e8eef9; font-weight: 700; font-size: .88rem; cursor: pointer; padding: 0 9px; font-family: inherit; white-space: nowrap; }
.dm-tool.on { background: #b3121f; border-color: #e2394a; }
.dm-tool.on.eraser { background: #475569; border-color: #94a3b8; }
.dm-size { flex: 1; min-width: 70px; display: flex; flex-direction: column; align-items: stretch; gap: 0; font-size: .72rem; color: #9fb0c8; text-align: center; }
.dm-size input { flex: 1; accent-color: #f5c451; }
.dm-result { padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #04122c; border-top: 1px solid rgba(245,196,81,.35); display: flex; align-items: center; gap: 10px; }
.dm-result .dm-rtext { flex: 1; min-width: 0; font-size: .9rem; line-height: 1.35; }
.dm-result .dm-rtext b { color: #f5c451; }
.dm-find { border: none; border-radius: 12px; padding: 12px 14px; background: linear-gradient(180deg, #fbd774, #f5c451); color: #042551; font-weight: 800; font-size: .95rem; cursor: pointer; font-family: inherit; white-space: nowrap; }
.dm-find:disabled { opacity: .45; }
.dm-sheet { position: absolute; left: 0; right: 0; bottom: 0; max-height: 78%; background: #061633; border-top: 1px solid rgba(245,196,81,.45); border-radius: 18px 18px 0 0; box-shadow: 0 -12px 40px rgba(0,0,0,.5); transform: translateY(105%); transition: transform .3s cubic-bezier(.2,.8,.2,1); display: flex; flex-direction: column; z-index: 5; }
.dm-sheet.open { transform: none; }
.dm-sheet-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
.dm-sheet-head h3 { flex: 1; margin: 0; font-size: 1.05rem; }
.dm-sheet-body { overflow-y: auto; padding: 6px 14px 22px; }
.dm-sec { margin: 14px 0 6px; font-size: .74rem; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; color: #f28b8b; }
.dm-item { display: flex; align-items: center; gap: 10px; padding: 12px; margin: 6px 0; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); cursor: pointer; }
.dm-item .dm-iname { flex: 1; font-weight: 600; }
.dm-item .dm-imeta { font-size: .78rem; color: #93a4bf; }
.dm-item.nolink { cursor: default; opacity: .75; }
.dm-note { font-size: .82rem; color: #b8c6dc; line-height: 1.45; padding: 10px 12px; border-radius: 10px; background: rgba(245,196,81,.08); border-left: 3px solid #f5c451; margin: 10px 0; }
.dm-zones { font-size: .84rem; color: #cbd5e1; line-height: 1.5; }
.dm-toast { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); background: rgba(127,29,29,.95); color: #fff; padding: 10px 14px; border-radius: 12px; font-size: .88rem; font-weight: 600; max-width: 88%; text-align: center; opacity: 0; transition: opacity .25s; pointer-events: none; z-index: 6; }
.dm-toast.show { opacity: 1; }
@media (max-width: 400px) { .dm-field input { width: 54px; } .dm-seg button { padding: 9px 10px; } }
`;

function buildUI() {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'dm-root'; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="dm-head">
      <button class="dm-ibtn" data-a="close" aria-label="Back">‹</button>
      <h2>Defect Mapper <span class="dm-beta">BETA</span></h2>
      <button class="dm-ibtn" data-a="view" aria-label="Reset view" title="Reset view">⟲</button>
    </div>
    <div class="dm-patient">
      <div class="dm-seg"><button data-sex="male" class="on">Male</button><button data-sex="female">Female</button></div>
      <label class="dm-field"><input type="number" inputmode="decimal" data-f="h" value="170" min="120" max="210"> cm</label>
      <label class="dm-field"><input type="number" inputmode="decimal" data-f="w" value="70" min="30" max="200"> kg</label>
      <div class="dm-fitnote" data-r="fit"></div>
    </div>
    <div class="dm-stage">
      <canvas></canvas>
      <div class="dm-loading" data-r="loading">Loading the body…</div>
      <div class="dm-hint" data-r="hint"></div>
      <div class="dm-pad" data-r="pad"><div class="dm-knob"></div></div>
      <div class="dm-toast" data-r="toast"></div>
      <div class="dm-sheet" data-r="sheet">
        <div class="dm-sheet-head"><h3>Flap options</h3><button class="dm-ibtn" data-a="sheet-close" aria-label="Close">✕</button></div>
        <div class="dm-sheet-body" data-r="sheetbody"></div>
      </div>
    </div>
    <div class="dm-tools">
      <button class="dm-tool" data-tool="brush">🖌 Paint</button>
      <button class="dm-tool eraser" data-tool="eraser">⌫ Erase</button>
      <div class="dm-size"><input type="range" min="0.5" max="5" step="0.25" value="1.5" data-r="size"><span>brush <span data-r="sizev">1.5 cm</span></span></div>
      <button class="dm-tool" data-a="undo" title="Undo" aria-label="Undo">↶</button>
      <button class="dm-tool" data-a="clear" title="Clear the defect" aria-label="Clear the defect">🗑</button>
    </div>
    <div class="dm-result">
      <div class="dm-rtext" data-r="result">Choose <b>Paint</b> and draw the defect on the body.</div>
      <button class="dm-find" data-a="find" disabled>Find flaps</button>
    </div>`;
  document.body.appendChild(root);
  const q = s => root.querySelector(s);
  return { root, q, canvas: q('canvas'), stage: q('.dm-stage') };
}

function toast(text) {
  const el = ui.q('[data-r="toast"]'); el.textContent = text; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ================= STATE =================
function newState() {
  return {
    sex: 'male', heightCm: 170, weightKg: 70, fit: null, B: null, mesh: null, eyes: null, geo: null,
    painted: null, colors: null, grid: null, cell: 0.02,
    tool: null, brushCm: 1.5, undo: [],
    cam: { theta: 0, phi: Math.PI / 2 - 0.05, radius: 2.2, target: new THREE.Vector3(0, 0.9, 0) },
    pointers: new Map(), pinch: null, lastHit: null, strokeOk: true, stroking: false, padVec: null,
    dirty: true, measure: null, three: null, raf: 0
  };
}

// ================= BUILD THE BODY =================
async function rebuildBody() {
  const s = state;
  ui.q('[data-r="loading"]').style.display = 'flex';
  const B = await loadBody(s.sex);
  const fit = fitBody(s.sex, s.weightKg, s.heightCm / 100);
  const sexChanged = s.B !== B;
  s.B = B; s.fit = fit;
  const T = s.three;
  if (sexChanged || !s.geo) {
    if (s.mesh) { T.scene.remove(s.mesh); s.geo.disposeBoundsTree(); s.geo.dispose(); }
    if (s.eyes) { T.scene.remove(s.eyes); s.eyes.geometry.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(B.n * 3), 3));
    s.paint = new Float32Array(B.n);
    geo.setAttribute('paint', new THREE.BufferAttribute(s.paint, 1));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(B.skin), 1));
    s.geo = geo;
    s.mesh = new THREE.Mesh(geo, T.skinMat); T.scene.add(s.mesh);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', geo.getAttribute('position'));
    eg.setIndex(new THREE.BufferAttribute(new Uint32Array(B.eyes), 1));
    s.eyes = new THREE.Mesh(eg, T.eyeMat); T.scene.add(s.eyes);
    s.painted = new Uint8Array(B.n); s.undo = [];
  }
  const pos = s.geo.getAttribute('position');
  bodyPositions(B, fit, pos.array);
  pos.needsUpdate = true;
  s.geo.computeVertexNormals(); s.eyes.geometry.computeVertexNormals();
  s.geo.computeBoundingBox(); s.geo.computeBoundingSphere();
  if (s.geo.boundsTree) s.geo.disposeBoundsTree();
  s.geo.computeBoundsTree();
  buildGrid();
  paintColors();
  measure();
  if (sexChanged) frame(true);
  const note = ui.q('[data-r="fit"]');
  note.textContent = `BMI ${fit.bmi.toFixed(1)} · body shape ${describeShape(fit.mass)}` +
    (fit.clamped === 'low' ? ' (leaner than the thinnest model)' : fit.clamped === 'high' ? ' (heavier than the largest model)' : '');
  ui.q('[data-r="loading"]').style.display = 'none';
  s.dirty = true;
}

function buildGrid() {
  const s = state, p = s.geo.getAttribute('position').array, n = s.B.n;
  const cell = s.cell = 0.03 * (s.fit.heightM / 1.8);
  const g = new Map();
  for (let i = 0; i < n; i++) {
    if (!s.B.isSkin[i]) continue;
    const k = Math.floor(p[i * 3] / cell) + ',' + Math.floor(p[i * 3 + 1] / cell) + ',' + Math.floor(p[i * 3 + 2] / cell);
    let a = g.get(k); if (!a) g.set(k, a = []); a.push(i);
  }
  s.grid = g;
}

function paintColors() {
  const s = state, n = s.B.n;
  for (let i = 0; i < n; i++) s.painted[i] = s.paint[i] >= 0.5 ? 1 : 0;
  s.geo.getAttribute('paint').needsUpdate = true; s.dirty = true;
}

// ================= CAMERA =================
function frame(resetAngles) {
  const s = state, h = s.fit.heightM;
  if (resetAngles) { s.cam.theta = 0; s.cam.phi = Math.PI / 2 - 0.05; }
  s.cam.target.set(0, h * 0.52, 0);
  // fit the whole star pose: its height, and the arm span (about the same as the height) across the screen
  const T = s.three, vHalf = THREE.MathUtils.degToRad(T.camera.fov / 2), hHalf = Math.atan(Math.tan(vHalf) * T.camera.aspect);
  s.cam.radius = Math.max((h * 0.56) / Math.tan(vHalf), (h * 0.56) / Math.tan(hHalf));
  s.dirty = true;
}
function applyCamera() {
  const s = state, c = s.cam, cam = s.three.camera;
  c.phi = Math.max(0.12, Math.min(Math.PI - 0.12, c.phi));
  c.radius = Math.max(0.18, Math.min(6, c.radius));
  cam.position.set(c.target.x + c.radius * Math.sin(c.phi) * Math.sin(c.theta), c.target.y + c.radius * Math.cos(c.phi), c.target.z + c.radius * Math.sin(c.phi) * Math.cos(c.theta));
  cam.lookAt(c.target);
  s.three.key.position.copy(cam.position).add(new THREE.Vector3(1, 1.5, 0.5));
}
function orbit(dx, dy) { state.cam.theta -= dx * 0.008; state.cam.phi -= dy * 0.008; state.dirty = true; }
function pan(dx, dy) {
  const s = state, cam = s.three.camera, k = s.cam.radius * 0.0016;
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
  s.cam.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
  const h = s.fit.heightM;
  s.cam.target.x = Math.max(-h * 0.6, Math.min(h * 0.6, s.cam.target.x));
  s.cam.target.y = Math.max(0, Math.min(h, s.cam.target.y));
  s.cam.target.z = Math.max(-h * 0.4, Math.min(h * 0.4, s.cam.target.z));
  s.dirty = true;
}

// ================= PAINTING =================
const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
const ndc = new THREE.Vector2();
function hitAt(clientX, clientY) {
  const r = ui.canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, state.three.camera);
  const h = ray.intersectObject(state.mesh, false)[0];
  return h ? { point: h.point.clone(), dir: ray.ray.direction.clone() } : null;
}
function verticesNear(point, dir, radius) {
  const s = state, p = s.geo.getAttribute('position').array, nrm = s.geo.getAttribute('normal').array;
  const out = [], r2 = radius * radius, cell = s.cell;
  const x0 = Math.floor((point.x - radius) / cell), x1 = Math.floor((point.x + radius) / cell);
  const y0 = Math.floor((point.y - radius) / cell), y1 = Math.floor((point.y + radius) / cell);
  const z0 = Math.floor((point.z - radius) / cell), z1 = Math.floor((point.z + radius) / cell);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const a = s.grid.get(x + ',' + y + ',' + z); if (!a) continue;
    for (const i of a) {
      const dx = p[i * 3] - point.x, dy = p[i * 3 + 1] - point.y, dz = p[i * 3 + 2] - point.z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      if (nrm[i * 3] * dir.x + nrm[i * 3 + 1] * dir.y + nrm[i * 3 + 2] * dir.z >= 0.2) continue;   // skip the far side
      out.push(i); out.d = out.d || []; out.d.push(Math.sqrt(dx * dx + dy * dy + dz * dz) / radius);
    }
  }
  return out;
}
function touchesDefect(idx) {
  const s = state; let any = false;
  for (let i = 0; i < s.B.n && !any; i++) if (s.painted[i]) any = true;
  if (!any) return true;
  for (const i of idx) { if (s.painted[i]) return true; for (const j of s.B.adj[i]) if (s.painted[j]) return true; }
  return false;
}
function dab(point, dir) {
  const s = state, idx = verticesNear(point, dir, s.brushCm / 100);
  if (!idx.length) return;
  if (s.tool === 'brush' && !s.strokeOk) return;
  // soft-edged brush: full strength in the middle, fading over the outer part
  idx.forEach((i, k) => {
    const w = Math.min(1, Math.max(0, (1 - idx.d[k]) * 2.2));
    s.paint[i] = s.tool === 'brush' ? Math.max(s.paint[i], w) : Math.min(s.paint[i], 1 - w);
    s.painted[i] = s.paint[i] >= 0.5 ? 1 : 0;
  });
  s.geo.getAttribute('paint').needsUpdate = true; s.dirty = true; s.measureDue = true;
}
function strokeTo(clientX, clientY) {
  const s = state, h = hitAt(clientX, clientY);
  if (!h) { s.lastHit = null; return; }
  if (!s.lastHit && s.tool === 'brush') {
    // a new piece of stroke must start on, or touching, the existing defect
    s.strokeOk = touchesDefect(verticesNear(h.point, h.dir, s.brushCm / 100));
    if (!s.strokeOk) toast('A defect must be one continuous area. Start painting from the existing defect, or Clear it first.');
  }
  const r = s.brushCm / 100;
  if (s.lastHit) {
    const d = s.lastHit.distanceTo(h.point);
    if (d > r * 3) { s.lastHit = null; return strokeTo(clientX, clientY); }   // jumped across a gap
    const steps = Math.ceil(d / (r * 0.35));
    for (let k = 1; k < steps; k++) dab(s.lastHit.clone().lerp(h.point, k / steps), h.dir);
  }
  dab(h.point, h.dir);
  s.lastHit = h.point;
}
function pushUndo() { const s = state; s.undo.push(s.paint.slice()); if (s.undo.length > 20) s.undo.shift(); }
function endStroke() {
  const s = state;
  if (!s.stroking) return;
  s.stroking = false; s.lastHit = null;
  if (s.tool === 'eraser') keepLargestPiece();
  measure();
}
// erasing through the middle can split the defect: keep the largest piece
function keepLargestPiece() {
  const s = state, n = s.B.n, seen = new Int32Array(n).fill(-1), sizes = [];
  for (let i = 0; i < n; i++) {
    if (!s.painted[i] || seen[i] >= 0) continue;
    const id = sizes.length; let count = 0; const stack = [i]; seen[i] = id;
    while (stack.length) { const v = stack.pop(); count++; for (const w of s.B.adj[v]) if (s.painted[w] && seen[w] < 0) { seen[w] = id; stack.push(w); } }
    sizes.push(count);
  }
  if (sizes.length <= 1) return;
  const best = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < n; i++) if (s.painted[i] && seen[i] !== best) { s.painted[i] = 0; s.paint[i] = 0; }
  paintColors();
  toast('Only one continuous defect is allowed – the smaller part was removed.');
}

// ================= MEASURE =================
const TRI_SAMPLES = [];   // evenly spread points inside a triangle (barycentric u, v)
for (let i = 0; i < 6; i++) for (let j = 0; j < 6 - i; j++) TRI_SAMPLES.push([(i + 1 / 3) / 6, (j + 1 / 3) / 6]);
function measure() {
  const s = state, B = s.B, p = s.geo.getAttribute('position').array, t = B.skin;
  let area = 0, count = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i], b = t[i + 1], c = t[i + 2];
    const pa = s.paint[a], pb = s.paint[b], pc = s.paint[c];
    if (pa < 0.5 && pb < 0.5 && pc < 0.5 && pa + pb + pc < 1.0) continue;
    let inside = 0;
    for (const [u, v] of TRI_SAMPLES) if (pa * (1 - u - v) + pb * u + pc * v >= 0.5) inside++;
    const k = inside / TRI_SAMPLES.length;
    if (!k) continue;
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    area += Math.sqrt(cx * cx + cy * cy + cz * cz) * 0.5 * k;
  }
  // principal directions of the painted points give an approximate length and width
  const pts = [], zc = {};
  for (let i = 0; i < B.n; i++) if (s.painted[i]) { pts.push(i); zc[B.zone[i]] = (zc[B.zone[i]] || 0) + 1; count++; }
  let L = 0, W = 0;
  if (count >= 3) {
    let mx = 0, my = 0, mz = 0;
    for (const i of pts) { mx += p[i * 3]; my += p[i * 3 + 1]; mz += p[i * 3 + 2]; }
    mx /= count; my /= count; mz /= count;
    const C = [0, 0, 0, 0, 0, 0];
    for (const i of pts) { const x = p[i * 3] - mx, y = p[i * 3 + 1] - my, z = p[i * 3 + 2] - mz; C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z; }
    const mul = v => [C[0] * v[0] + C[1] * v[1] + C[2] * v[2], C[1] * v[0] + C[3] * v[1] + C[4] * v[2], C[2] * v[0] + C[4] * v[1] + C[5] * v[2]];
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    let e1 = [0.3, 1, 0.2]; for (let k = 0; k < 30; k++) e1 = norm(mul(e1));
    let e2 = [1, 0.1, 0.3];
    for (let k = 0; k < 30; k++) { e2 = mul(e2); const d = e2[0] * e1[0] + e2[1] * e1[1] + e2[2] * e1[2]; e2 = norm([e2[0] - d * e1[0], e2[1] - d * e1[1], e2[2] - d * e1[2]]); }
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const i of pts) {
      const x = p[i * 3] - mx, y = p[i * 3 + 1] - my, z = p[i * 3 + 2] - mz;
      const u = x * e1[0] + y * e1[1] + z * e1[2], v = x * e2[0] + y * e2[1] + z * e2[2];
      a0 = Math.min(a0, u); a1 = Math.max(a1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v);
    }
    const pad = s.brushCm / 100 * 0.4;   // painted vertices sit inside the coloured edge
    L = (a1 - a0) + pad; W = (b1 - b0) + pad;
  }
  const zones = Object.entries(zc).map(([z, c]) => ({ z: +z, c, f: c / Math.max(1, count) })).sort((a, b) => b.c - a.c);
  s.measure = { areaCm2: area * 1e4, L: L * 100, W: W * 100, count, zones };
  showResult();
}
function zoneName(z) { return meta.zones[z]; }
function showResult() {
  const m = state.measure, el = ui.q('[data-r="result"]'), btn = ui.q('[data-a="find"]');
  if (!m || m.count < 3) { el.innerHTML = state.tool ? 'Draw the defect on the body. Two fingers move and zoom.' : 'Choose <b>Paint</b> and draw the defect on the body.'; btn.disabled = true; return; }
  const main = m.zones[0];
  const where = main.z === 0 ? 'outside the mapped lower limb' : zoneName(main.z);
  el.innerHTML = `<b>${m.areaCm2.toFixed(m.areaCm2 < 10 ? 1 : 0)} cm²</b> · about ${m.L.toFixed(1)} × ${m.W.toFixed(1)} cm<br>${where}${m.zones.length > 1 ? ` <span style="color:#93a4bf">+ ${m.zones.length - 1} more</span>` : ''}`;
  btn.disabled = false;
}

// ================= FLAP MATCHING =================
function zoneMatches(code, pattern) {
  const a = code.split('.'), b = pattern.split('.');
  return b.every((seg, i) => seg === '*' || seg === a[i]);
}
function findFlapByMatch(match) {
  const list = (window.datasetMaster || (typeof datasetMaster !== 'undefined' ? datasetMaster : [])).filter(f => f.category !== 'System');
  const hits = list.filter(f => String(f.name).toLowerCase().replace(/<[^>]*>/g, '').includes(match));
  hits.sort((a, b) => a.name.length - b.name.length);
  return hits[0] ? hits[0].name : null;
}
function findFlaps() {
  const m = state.measure, area = m.areaCm2;
  const significant = m.zones.filter(z => z.f >= 0.12 || z.c >= 6);
  const codes = significant.map(z => ZONE_CODES[z.z]);
  const unmapped = significant.some(z => z.z === 0);
  const local = [], free = [];
  for (const e of reach.flaps) {
    const name = findFlapByMatch(e.match);
    const label = name || e.match.replace(/\b\w/g, c => c.toUpperCase());
    if (!unmapped && e.zones.length && codes.every(c => e.zones.some(p => zoneMatches(c, p)))) {
      local.push({ name, label, tier: e.tier, max: e.maxArea, fits: area <= e.maxArea });
    }
    if (e.free && area <= e.free) free.push({ name, label, max: e.free });
  }
  local.sort((a, b) => (b.fits - a.fits) || (a.tier - b.tier) || (a.max - b.max));
  free.sort((a, b) => a.max - b.max);
  return { local, free, unmapped, codes, significant };
}
function showSheet() {
  const r = findFlaps(), m = state.measure, body = ui.q('[data-r="sheetbody"]');
  const tierName = t => t === 1 ? 'fasciocutaneous / perforator' : t === 2 ? 'muscle / musculocutaneous' : 'distant';
  const item = (f, meta) => `<div class="dm-item${f.name ? '' : ' nolink'}" ${f.name ? `data-flap="${encodeURIComponent(f.name)}"` : ''}><div style="flex:1"><div class="dm-iname">${f.label}</div><div class="dm-imeta">${meta}</div></div>${f.name ? '<span>›</span>' : ''}</div>`;
  let html = `<div class="dm-zones"><b>${m.areaCm2.toFixed(0)} cm²</b>, about ${m.L.toFixed(1)} × ${m.W.toFixed(1)} cm<br>` +
    r.significant.map(z => `${zoneName(z.z)} <span style="color:#93a4bf">(${Math.round(z.f * 100)}%)</span>`).join('<br>') + '</div>';
  if (r.unmapped) html += `<div class="dm-note">Part of this defect lies outside the lower limb. This prototype maps only the lower limb so far – other regions will follow.</div>`;
  const fits = r.local.filter(f => f.fits), tooSmall = r.local.filter(f => !f.fits);
  html += `<div class="dm-sec">Local and regional flaps that reach this site</div>`;
  html += fits.length ? fits.map(f => item(f, `${tierName(f.tier)} · usually up to ~${f.max} cm²`)).join('') : `<div class="dm-note">No pedicled flap in the current data covers a defect this size at this site.</div>`;
  if (tooSmall.length) html += `<div class="dm-sec">Reach the site, but usually for smaller defects</div>` + tooSmall.map(f => item(f, `${tierName(f.tier)} · usually up to ~${f.max} cm²`)).join('');
  // free flaps: the few whose usual size best suits this defect first; the rest behind "Show all"
  const freeTop = r.free.slice(0, 5), freeRest = r.free.slice(5);
  html += `<div class="dm-sec">Free flaps large enough${fits.length ? ' (if local options are unsuitable)' : ''}</div>` +
    (r.free.length ? freeTop.map(f => item(f, `usually up to ~${f.max} cm²`)).join('') : '<div class="dm-note">None in the current data.</div>');
  if (freeRest.length) html += `<div class="dm-more" data-more><button type="button" class="dm-tool" style="width:100%;margin-top:6px">Show all ${r.free.length} free flaps</button></div><div data-rest style="display:none">` +
    freeRest.map(f => item(f, `usually up to ~${f.max} cm²`)).join('') + '</div>';
  html += `<div class="dm-note">Prototype: the reach and size limits are a first draft and still need expert review. Always judge the actual defect, pedicle and patient.</div>`;
  body.innerHTML = html;
  const more = body.querySelector('[data-more]');
  if (more) more.onclick = () => { more.remove(); body.querySelector('[data-rest]').style.display = ''; };
  body.querySelectorAll('[data-flap]').forEach(el => el.onclick = () => { if (window.openFlapPage) window.openFlapPage(decodeURIComponent(el.dataset.flap)); });
  ui.q('[data-r="sheet"]').classList.add('open');
}

// ================= INPUT =================
function setTool(t) {
  const s = state; s.tool = s.tool === t ? null : t;
  ui.root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === s.tool));
  ui.q('[data-r="pad"]').classList.toggle('show', !!s.tool);
  ui.q('[data-r="hint"]').textContent = s.tool ? 'One finger paints · the circle rotates · two fingers move and zoom' : 'One finger rotates · two fingers move and zoom';
  showResult();
}
function bindInput() {
  const s = state, stage = ui.canvas;
  stage.addEventListener('pointerdown', e => {
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 2) { if (s.stroking) endStroke(); s.pinch = null; return; }
    if (s.pointers.size === 1 && s.tool) { pushUndo(); s.stroking = true; s.lastHit = null; strokeTo(e.clientX, e.clientY); }
  });
  stage.addEventListener('pointermove', e => {
    const prev = s.pointers.get(e.pointerId); if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (s.pointers.size === 1) {
      if (s.stroking) strokeTo(cur.x, cur.y);
      else if (!s.tool) orbit(cur.x - prev.x, cur.y - prev.y);
    } else if (s.pointers.size === 2) {
      s.pointers.set(e.pointerId, cur);
      const [a, b] = [...s.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (s.pinch) { s.cam.radius *= s.pinch.dist / Math.max(dist, 1); pan(mid.x - s.pinch.mid.x, mid.y - s.pinch.mid.y); s.dirty = true; }
      s.pinch = { mid, dist };
      return;
    }
    s.pointers.set(e.pointerId, cur);
  });
  const up = e => { s.pointers.delete(e.pointerId); if (s.pointers.size < 2) s.pinch = null; if (s.pointers.size === 0) endStroke(); };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => { e.preventDefault(); s.cam.radius *= Math.exp(e.deltaY * 0.0012); s.dirty = true; }, { passive: false });
  // rotation pad (used while painting), like the trackpad of the TBSA app
  const pad = ui.q('[data-r="pad"]'), knob = pad.querySelector('.dm-knob');
  const padMove = e => {
    const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const max = r.width / 2 - 14, l = Math.hypot(dx, dy);
    if (l > max) { dx *= max / l; dy *= max / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`; s.padVec = { x: dx / max, y: dy / max };
  };
  pad.addEventListener('pointerdown', e => { e.stopPropagation(); try { pad.setPointerCapture(e.pointerId); } catch (err) {} padMove(e); });
  pad.addEventListener('pointermove', e => { if (s.padVec) padMove(e); });
  const padUp = () => { s.padVec = null; knob.style.transform = ''; };
  pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);

  ui.root.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  ui.q('[data-r="size"]').oninput = e => { s.brushCm = parseFloat(e.target.value); ui.q('[data-r="sizev"]').textContent = s.brushCm + ' cm'; };
  ui.root.querySelector('[data-a="undo"]').onclick = () => { if (!s.undo.length) return; s.paint.set(s.undo.pop()); paintColors(); measure(); };
  ui.root.querySelector('[data-a="clear"]').onclick = () => { pushUndo(); s.paint.fill(0); paintColors(); measure(); };
  ui.root.querySelector('[data-a="view"]').onclick = () => frame(true);
  ui.root.querySelector('[data-a="close"]').onclick = () => close();
  ui.root.querySelector('[data-a="find"]').onclick = () => showSheet();
  ui.root.querySelector('[data-a="sheet-close"]').onclick = () => ui.q('[data-r="sheet"]').classList.remove('open');
  ui.root.querySelectorAll('[data-sex]').forEach(b => b.onclick = () => {
    if (s.sex === b.dataset.sex) return;
    s.sex = b.dataset.sex;
    ui.root.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x === b));
    ui.q('[data-f="h"]').value = s.heightCm = s.sex === 'male' ? 170 : 158;
    ui.q('[data-f="w"]').value = s.weightKg = s.sex === 'male' ? 70 : 58;
    rebuildBody();
  });
  let t = 0;
  ui.root.querySelectorAll('[data-f]').forEach(inp => inp.oninput = () => {
    clearTimeout(t); t = setTimeout(() => {
      const h = parseFloat(ui.q('[data-f="h"]').value), w = parseFloat(ui.q('[data-f="w"]').value);
      if (!(h >= 120 && h <= 215 && w >= 30 && w <= 220)) return;
      s.heightCm = h; s.weightKg = w; rebuildBody();
    }, 450);
  });
  window.addEventListener('resize', () => { if (openFlag) { sizeRenderer(); s.dirty = true; } });
}

function sizeRenderer() {
  const r = ui.stage.getBoundingClientRect(), T = state.three;
  T.renderer.setSize(r.width, r.height, false);
  T.camera.aspect = r.width / Math.max(1, r.height); T.camera.updateProjectionMatrix();
}

function loop() {
  const s = state;
  if (!openFlag) return;
  if (s.padVec) { orbit(s.padVec.x * 9, s.padVec.y * 9); }
  if (s.measureDue && !s.stroking) { s.measureDue = false; measure(); }
  if (s.dirty && s.mesh) { applyCamera(); s.three.renderer.render(s.three.scene, s.three.camera); s.dirty = false; }
  s.raf = requestAnimationFrame(loop);
}

// ================= OPEN / CLOSE =================
export async function open() {
  if (!ui) { ui = buildUI(); state = newState(); state.three = makeScene(ui.canvas); bindInput(); }
  openFlag = true;
  ui.root.classList.add('open'); ui.root.setAttribute('aria-hidden', 'false');
  history.pushState({ view: 'defect' }, '', '#defect-mapper');
  requestAnimationFrame(() => { sizeRenderer(); state.dirty = true; });
  cancelAnimationFrame(state.raf); state.raf = requestAnimationFrame(loop);
  if (!state.mesh) {
    try { await loadMeta(); await rebuildBody(); frame(true); }
    catch (err) { ui.q('[data-r="loading"]').textContent = 'Could not load the 3D body. Check the connection and try again.'; console.error(err); }
  }
}
export function close(fromBackButton) {
  if (!openFlag) return;
  openFlag = false;
  ui.root.classList.remove('open'); ui.root.setAttribute('aria-hidden', 'true');
  ui.q('[data-r="sheet"]').classList.remove('open');
  cancelAnimationFrame(state.raf);
  if (fromBackButton !== true) history.back();
}
export function isOpen() { return openFlag; }
export function sheetOpen() { return !!(ui && ui.q('[data-r="sheet"]').classList.contains('open')); }
export function closeSheet() { if (ui) ui.q('[data-r="sheet"]').classList.remove('open'); }
// for testing: the internal state and a helper that projects a body vertex to the screen
export function _debug() {
  return { state, meta, project(i) { const p = state.geo.getAttribute('position').array; const v = new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).project(state.three.camera); const r = ui.canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; } };
}
