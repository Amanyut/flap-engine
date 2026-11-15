/* Amanyu's Flapendium – page curl and the underside of the page (a skin flap's underside, drawn by code). */
// High-quality underside of a skin flap, drawn on a canvas (w × h device pixels).
// Spine (hinge) on the left, cut edge on the right. Deterministic for a given seed.
function makeFlapUnderside(w, h, seed) {
  // works in a worker (OffscreenCanvas) and on the page
  const mk = (a, b) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(a, b) : Object.assign(document.createElement('canvas'), { width: a, height: b }));
  const c = mk(w, h);
  let g = c.getContext('2d');
  let s0 = seed || 7331; const R = () => { s0 = (s0 * 16807) % 2147483647; return (s0 - 1) / 2147483646; };
  const S = w / 300;                                   // design units: 300 wide
  const TAU = Math.PI * 2;

  // ---- 1. base tissue: deep at the hinge, paler and fattier towards the cut edge ----
  let gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#6f222b'); gr.addColorStop(0.18, '#8f303a'); gr.addColorStop(0.5, '#b44c52');
  gr.addColorStop(0.82, '#cf6e6c'); gr.addColorStop(1, '#df8a7f');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(40,0,8,0.18)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,0,8,0.18)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);

  // ---- 2. soft mottling (blood-filled and paler patches) ----
  function blob(x, y, r, col, a) {
    const q = g.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, col.replace('A', a)); q.addColorStop(1, col.replace('A', 0));
    g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  for (let i = 0; i < 18; i++) blob(R() * w, R() * h, (60 + R() * 90) * S, R() < 0.5 ? 'rgba(255,185,175,A)' : 'rgba(80,5,20,A)', 0.06 + R() * 0.06);
  for (let i = 0; i < 260; i++) blob(R() * w, R() * h, (8 + R() * 38) * S, R() < 0.5 ? 'rgba(255,190,180,A)' : 'rgba(110,15,30,A)', 0.05 + R() * 0.09);

  // smooth wandering curve (angular velocity random walk: no kinks)
  function walk(x, y, ang, len, opt) {
    opt = opt || {};
    const step = (opt.step || 1.6) * S, n = Math.max(2, Math.round(len / step)), pts = [[x, y]];
    let om = 0; const wob = (opt.wob || 0.012), pull = opt.pull || 0, aim = opt.aim === undefined ? ang : opt.aim;
    for (let i = 0; i < n; i++) {
      om += (R() - 0.5) * wob; om *= 0.965;
      ang += om + (aim - ang) * pull;
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      pts.push([x, y]);
    }
    return pts;
  }
  function strokeCurve(pts, width, col) {
    g.strokeStyle = col; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const L = pts[pts.length - 1]; g.lineTo(L[0], L[1]); g.stroke();
  }

  // ---- 3. glistening fascial fibres ----
  for (let i = 0; i < 230; i++) {
    const p = walk(R() * w, R() * h, -0.35 + (R() - 0.5) * 0.5, (30 + R() * 90) * S, { wob: 0.03 });
    strokeCurve(p, (0.3 + R() * 0.5) * S, 'rgba(255,236,232,' + (0.02 + R() * 0.035) + ')');
  }

  // ---- 4. capillary network: fine branching twigs ----
  function twig(x, y, ang, len, wd, depth) {
    const p = walk(x, y, ang, len, { wob: 0.02, step: 1.4 });
    strokeCurve(p, wd, 'rgba(128,14,28,' + (0.16 + R() * 0.16) + ')');
    if (depth > 0) for (let b = 0; b < 2; b++) { const k = p[Math.floor(p.length * (0.35 + R() * 0.5))]; twig(k[0], k[1], ang + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), len * (0.45 + R() * 0.25), wd * 0.75, depth - 1); }
  }
  for (let i = 0; i < 70; i++) twig(R() * w * 0.95, R() * h, R() * TAU, (22 + R() * 40) * S, (0.45 + R() * 0.35) * S, 2);
  // ---- 4b. the subdermal / suprafascial plexus: a fine anastomosing network, a touch thicker and redder,
  //          patchy (denser in some areas), wavy, and softly blurred so it lies just beneath the surface ----
  (function () {
    let q0 = 99173; const Q = () => { q0 = (q0 * 16807) % 2147483647; return (q0 - 1) / 2147483646; };
    const gap = 33 * S, cols = Math.ceil(w / gap) + 2, rows = Math.ceil(h / gap) + 2, P = [];
    for (let j = 0; j < rows; j++) { P.push([]); for (let i = 0; i < cols; i++) P[j].push([(i - 0.5 + (Q() - 0.5) * 0.9) * gap, (j - 0.5 + (Q() - 0.5) * 0.9) * gap]); }
    const hubs = []; for (let k = 0; k < 6; k++) hubs.push([Q() * w * 0.85, Q() * h, (70 + Q() * 90) * S]);
    const density = (x, y) => { let d = 0.25; hubs.forEach(hb => { d += Math.max(0, 1 - Math.hypot(x - hb[0], y - hb[1]) / hb[2]); }); return Math.min(1, d); };
    g.save(); g.filter = 'blur(' + (0.35 * S) + 'px)'; g.lineCap = 'round';
    function seg(a, b) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
      const fade = 1 - Math.max(0, (mx / w - 0.8) / 0.16), dens = density(mx, my);
      if (fade <= 0.05 || Q() > dens) return;
      // a gently wavy S-curve between the two junctions
      const b1 = (Q() - 0.5) * 0.55, b2 = (Q() - 0.5) * 0.55;
      const c1 = [a[0] + dx * 0.33 - dy * b1, a[1] + dy * 0.33 + dx * b1], c2 = [a[0] + dx * 0.66 - dy * b2, a[1] + dy * 0.66 + dx * b2];
      const wd = (0.7 + Q() * 0.5) * S, al = (0.16 + Q() * 0.24) * fade * (0.6 + 0.4 * dens);
      [['rgba(80,4,16,', al * 0.5, 1.6], ['rgba(170,28,38,', al, 1], ['rgba(230,105,100,', al * 0.4, 0.35]].forEach(([col, a2, k]) => {
        g.strokeStyle = col + a2 + ')'; g.lineWidth = wd * k;
        g.beginPath(); g.moveTo(a[0], a[1]); g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); g.stroke();
      });
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (i + 1 < cols && Q() < 0.8) seg(P[j][i], P[j][i + 1]);
      if (j + 1 < rows && Q() < 0.7) seg(P[j][i], P[j + 1][i]);
      if (i + 1 < cols && j + 1 < rows && Q() < 0.15) seg(P[j][i], P[j + 1][i + 1]);
    }
    g.restore();
  })();

  // ---- 5. fat lobules: clusters at the cut edge and islands along the pedicle ----
  function lobule(x, y, r) {
    // an irregular, slightly translucent fat lobule with a fine septum around it
    const n = 12, ph = R() * TAU, pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * TAU, rr = r * (1 + 0.14 * Math.sin(a * 3 + ph) + 0.07 * (R() - 0.5)); pts.push([x + Math.cos(a) * rr * 1.08, y + Math.sin(a) * rr * 0.94]); }
    g.beginPath(); g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let k = 0; k < n; k++) { const p = pts[k], q = pts[(k + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    g.closePath();
    const q = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r * 1.1);
    q.addColorStop(0, 'rgba(252,228,150,0.96)'); q.addColorStop(0.6, 'rgba(238,196,104,0.92)'); q.addColorStop(1, 'rgba(206,146,70,0.88)');
    g.fillStyle = q; g.fill();
    g.strokeStyle = 'rgba(176,96,62,0.55)'; g.lineWidth = 0.7 * S; g.stroke();
    const hx = x - r * 0.3, hy = y - r * 0.35, hl = g.createRadialGradient(hx, hy, 0, hx, hy, r * 0.4);
    hl.addColorStop(0, 'rgba(255,252,235,' + (0.3 + R() * 0.25) + ')'); hl.addColorStop(1, 'rgba(255,252,235,0)');
    g.fillStyle = hl; g.beginPath(); g.ellipse(hx, hy, r * 0.4, r * 0.22, -0.5, 0, TAU); g.fill();
  }
  function cluster(cx, cy, spread, n, rmin, rmax) {
    const placed = [];
    for (let i = 0; i < n * 4 && placed.length < n; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * spread, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 1.3, r = (rmin + R() * (rmax - rmin)) * S;
      if (placed.some(p => Math.hypot(p[0] - x, p[1] - y) < (p[2] + r) * 0.82)) continue;
      placed.push([x, y, r]);
    }
    // a faint septal shadow under the cluster first
    blob(cx, cy, spread * 1.7, 'rgba(236,182,100,A)', 0.38);
    placed.forEach(p => blob(p[0] + 0.8 * S, p[1] + 1.2 * S, p[2] * 1.45, 'rgba(90,20,10,A)', 0.3));
    placed.forEach(p => lobule(p[0], p[1], p[2]));
  }
  // (the earlier droplet clusters still run, on a scratch canvas, only so the random sequence – and so every
  //  vessel – stays exactly as approved; nothing of them is drawn)
  { const real = g; g = mk(1, 1).getContext('2d');
    for (let i = 0; i < 22; i++) cluster(w * (0.89 + R() * 0.13), (i + R()) / 22 * h, (16 + R() * 16) * S, 22 + (R() * 16 | 0), 2.4, 5.6);
    for (let i = 0; i < 7; i++) cluster(w * (0.3 + R() * 0.55), R() * h, (10 + R() * 12) * S, 12 + (R() * 10 | 0), 1.8, 3.8);
    g = real; }

  // ---- 5b. subcutaneous fat as seen at the cut edge of a flap: one continuous mass of irregular lobules,
  //          grouped into larger lobes with deeper creases, thin translucent fibrous septa, varied
  //          butter-to-amber tones mottled within each lobule, uneven wet gloss and the odd blood tinge,
  //          veiled by fascia along its inner border; a few faint patches show through thin fascia further in.
  (function () {
    let f0 = 52711; const F = () => { f0 = (f0 * 16807) % 2147483647; return (f0 - 1) / 2147483646; };
    const sstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    function field(spacing, make) {              // jittered seed points on a grid, with a 3x3 nearest-two lookup
      const cols = Math.ceil(w / spacing) + 3, rows = Math.ceil(h / spacing) + 3, P = new Array(cols * rows);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) P[j * cols + i] = make((i - 1 + 0.5 + (F() - 0.5) * 0.9) * spacing, (j - 1 + 0.5 + (F() - 0.5) * 0.9) * spacing);
      return function (x, y, out) {
        const ci = Math.floor(x / spacing) + 1, cj = Math.floor(y / spacing) + 1;
        let d1 = 1e9, d2 = 1e9, best = null;
        for (let jj = cj - 1; jj <= cj + 1; jj++) { if (jj < 0 || jj >= rows) continue;
          for (let ii = ci - 1; ii <= ci + 1; ii++) { if (ii < 0 || ii >= cols) continue;
            const p = P[jj * cols + ii], dx = (x - p.x) / p.sz, dy = (y - p.y) / p.sz, dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < d1) { d2 = d1; d1 = dd; best = p; } else if (dd < d2) d2 = dd; } }
        out.d1 = d1; out.d2 = d2; out.p = best; return out;
      };
    }
    const sp = 6.4 * S;
    const lob = field(sp, (x, y) => ({ x, y, sz: 0.62 + F() * 0.9, tone: F(), blood: F(), gloss: F() }));
    const lobe = field(sp * 3.4, (x, y) => ({ x, y, sz: 0.8 + F() * 0.5, tone: F() }));
    // smooth value noise for mottling inside the fat
    const NG = 5 * S, nc = Math.ceil((w + 80 * S) / NG) + 2, nr = Math.ceil((h + 80 * S) / NG) + 2, NV = new Float32Array(nc * nr);
    for (let i = 0; i < NV.length; i++) NV[i] = F();
    const noise = (x, y) => { const fx = x / NG, fy = y / NG, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
      const a = NV[iy * nc + ix], b = NV[iy * nc + ix + 1], c2 = NV[(iy + 1) * nc + ix], d2 = NV[(iy + 1) * nc + ix + 1];
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return (a + (b - a) * su) * (1 - sv) + (c2 + (d2 - c2) * su) * sv; };
    const bx = y => w * (0.855 + 0.022 * Math.sin(y / h * 7.1 + 1.3) + 0.015 * Math.sin(y / h * 17.3 + 0.4) + 0.007 * Math.sin(y / h * 43 + 2.1));
    const T = 13 * S;
    const isl = []; for (let k = 0; k < 6; k++) isl.push([w * (0.28 + F() * 0.5), F() * h, (16 + F() * 26) * S, (10 + F() * 16) * S, F() * 3]);
    const img = g.getImageData(0, 0, w, h), d = img.data, A1 = {}, A2 = {};
    const Lx = -0.6, Ly = -0.8, sw = 0.8 * S;
    for (let y = 0; y < h; y++) {
      const b = bx(y);
      for (let x = 0; x < w; x++) {
        let m = sstep(b - T, b + T * 0.35, x), veil = 1 - sstep(b - T * 0.6, b + T * 1.8, x);
        if (m < 0.004) {
          for (let k = 0; k < isl.length; k++) {
            const I = isl[k], cs = Math.cos(I[4]), sn = Math.sin(I[4]), ux = ((x - I[0]) * cs + (y - I[1]) * sn) / I[2], uy = (-(x - I[0]) * sn + (y - I[1]) * cs) / I[3];
            const q = Math.sqrt(ux * ux + uy * uy); if (q < 1) { const mm = 0.3 * sstep(1, 0.35, q); if (mm > m) { m = mm; veil = 0.75; } }
          }
          if (m < 0.004) continue;
        }
        // gently warp the coordinates so lobule borders curve organically instead of running straight
        const wx = x + (noise(x * 0.55 + 37 * S, y * 0.55) - 0.5) * sp * 0.42, wy = y + (noise(x * 0.55, y * 0.55 + 53 * S) - 0.5) * sp * 0.42;
        lob(wx, wy, A1); lobe(wx, wy, A2);
        const p = A1.p, r = sp * 0.62 * p.sz, tt = Math.min(1, A1.d1 * p.sz / r), e = A1.d2 - A1.d1, E = A2.d2 - A2.d1;
        const nz = noise(x, y);
        // colour: the lobe sets the general tone, each lobule varies it, the mottling breaks it up
        const tone = Math.max(0, Math.min(1, A2.p.tone * 0.55 + p.tone * 0.35 + (nz - 0.5) * 0.4));
        let cr = 253 - tone * 14, cg = 224 - tone * 40, cb = 128 - tone * 58;
        if (p.blood < 0.1) { cr = cr * 0.72 + 214 * 0.28; cg = cg * 0.72 + 122 * 0.28; cb = cb * 0.72 + 92 * 0.28; }
        // each lobule gently domed, the whole lobe bulging a little
        const lx = (wx - p.x) / r, ly = (wy - p.y) / r, lit = Math.max(-1, Math.min(1, lx * Lx + ly * Ly));
        // pillowy lobules: bright, slightly translucent centres, rounded shoulders falling into soft creases
        const crease = sstep(sw * 5, sw * 0.8, e), deep = sstep(sw * 6, sw * 1.2, E);
        const light = 0.1 * lit + 0.1 * (1 - tt * tt) - 0.05 * sstep(0, 1, Math.min(1, A2.d1 / (sp * 2)));
        const dark = 0.28 * crease * crease + 0.32 * deep;
        if (light > 0) { cr += (255 - cr) * light; cg += (246 - cg) * light; cb += (214 - cb) * light; }
        else { cr += (168 - cr) * -light; cg += (104 - cg) * -light; cb += (44 - cb) * -light; }
        cr += (150 - cr) * dark; cg += (82 - cg) * dark; cb += (38 - cb) * dark;
        // thin, translucent fibrous septa (a faint pink where small vessels run in them)
        const sept = sstep(sw * 0.9, sw * 0.1, e) * (0.22 + 0.25 * nz), bl = p.blood < 0.3;
        cr += ((bl ? 214 : 244) - cr) * sept; cg += ((bl ? 150 : 222) - cg) * sept; cb += ((bl ? 132 : 196) - cb) * sept;
        const dsep = sstep(sw * 1.4, sw * 0.2, E) * 0.35;
        cr += (196 - cr) * dsep; cg += (128 - cg) * dsep; cb += (110 - cb) * dsep;
        // wet gloss, stronger on some lobules than others
        const gx = lx + 0.3, gy = ly + 0.36, glint = Math.exp(-(gx * gx * 7 + gy * gy * 18)) * (0.15 + 0.55 * p.gloss) * (1 - crease);
        cr += (255 - cr) * glint; cg += (252 - cg) * glint; cb += (242 - cb) * glint;
        // fascia veils the fat along its inner border
        const o = (y * w + x) * 4, vv = veil * 0.45;
        cr += (d[o] - cr) * vv; cg += (d[o + 1] - cg) * vv; cb += (d[o + 2] - cb) * vv;
        d[o] += (cr - d[o]) * m; d[o + 1] += (cg - d[o + 1]) * m; d[o + 2] += (cb - d[o + 2]) * m;
      }
    }
    g.putImageData(img, 0, 0);
  })();

  // ---- 6. the vessels: smooth tapering tubes with light, artery flanked by its venae comitantes ----
  function offsetCurve(pts, dist) {          // a parallel curve, dist(i) along the normal
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const d = dist(i);
      out.push([pts[i][0] - ty * d, pts[i][1] + tx * d]);
    }
    return out;
  }
  function tube(pts, w0, w1, pal) {
    const n = pts.length; if (n < 3) return;
    const wid = i => (w0 + (w1 - w0) * Math.pow(i / (n - 1), 0.9));
    const lx = -0.55, ly = -0.83;           // light from the upper left
    function shape(scale, shift) {          // filled outline of the tube at a fraction of its width, shifted toward the light
      const L = [], Rr = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        let nx = -ty, ny = tx; const sgn = (nx * lx + ny * ly) > 0 ? 1 : -1;
        const hw = wid(i) * scale / 2, sh = wid(i) * shift * sgn;
        const cx = pts[i][0] + nx * sh, cy = pts[i][1] + ny * sh;
        L.push([cx + nx * hw, cy + ny * hw]); Rr.push([cx - nx * hw, cy - ny * hw]);
      }
      g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
      const e = pts[n - 1], hwE = wid(n - 1) * scale / 2;
      g.arc(e[0], e[1], hwE, Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]), Math.atan2(Rr[n - 1][1] - e[1], Rr[n - 1][0] - e[0]));
      for (let i = n - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
      g.closePath(); g.fill();
    }
    g.save();
    g.shadowColor = pal.shadow; g.shadowBlur = 5 * S; g.shadowOffsetX = 1.2 * S; g.shadowOffsetY = 1.8 * S;
    g.fillStyle = pal.edge; shape(1.18, 0);
    g.restore();
    g.fillStyle = pal.base; shape(1, 0);
    // the side away from the light sinks into shadow
    g.globalAlpha = 0.35; g.fillStyle = pal.edge; shape(0.55, -0.24);
    // a smooth cylindrical gradient: many thin, faint layers stepping toward the light
    g.fillStyle = pal.mid;
    for (let k = 0; k < 6; k++) { g.globalAlpha = 0.28; shape(0.86 - k * 0.1, 0.03 + k * 0.035); }
    g.fillStyle = pal.light;
    for (let k = 0; k < 4; k++) { g.globalAlpha = 0.22; shape(0.5 - k * 0.08, 0.16 + k * 0.03); }
    g.globalAlpha = 1;
    // a soft wet highlight
    g.save(); g.filter = 'blur(' + (0.7 * S) + 'px)'; g.fillStyle = pal.spec; shape(0.16, 0.3); g.restore();
  }
  const ART = { shadow: 'rgba(50,0,8,0.5)', edge: '#4a0610', base: '#951320', mid: '#b3202a', light: '#d4433f', spec: 'rgba(255,206,200,0.7)' };
  const VEN = { shadow: 'rgba(20,5,30,0.5)', edge: '#1b1233', base: '#3a2d63', mid: '#463978', light: '#64569a', spec: 'rgba(214,205,255,0.45)' };
  const tree = [];
  function grow(pts, w0, w1, depth, kind) {
    tree.push({ pts, w0, w1, depth });
    if (depth <= 0) return;
    const nb = depth >= 3 ? 4 : depth === 2 ? 2 : (R() < 0.6 ? 1 : 0);
    for (let b = 0; b < nb; b++) {
      const f = 0.12 + 0.78 * (b + 0.3 + R() * 0.5) / nb, i = Math.min(pts.length - 3, Math.floor(f * (pts.length - 1)));
      const p = pts[i], q = pts[i + 2], dir = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const side = (b % 2 ? 1 : -1) * (R() < 0.2 ? -1 : 1);
      const wHere = w0 + (w1 - w0) * i / (pts.length - 1);
      const len = (0.28 + R() * 0.32) * (60 + depth * 70) * S;
      const child = walk(p[0], p[1], dir + side * (0.45 + R() * 0.55), len, { wob: 0.016, pull: 0.012, aim: dir + side * 0.15 });
      grow(child, wHere * 0.6, Math.max(0.5 * S, wHere * 0.18), depth - 1, kind);
    }
  }
  // main pedicle enters at the hinge, sweeps toward the cut edge; two smaller trunks above and below
  grow(walk(-6 * S, h * 0.56, -0.12, w * 1.12, { wob: 0.01, pull: 0.01, aim: -0.05 }), 6.4 * S, 3 * S, 3);
  grow(walk(-6 * S, h * 0.14, 0.18, w * 0.8, { wob: 0.012, pull: 0.01, aim: 0.05 }), 3.4 * S, 0.9 * S, 2);
  grow(walk(-6 * S, h * 0.9, -0.22, w * 0.78, { wob: 0.012, pull: 0.01, aim: -0.1 }), 3.4 * S, 0.9 * S, 2);

  // a pale areolar sheath under the main pedicle
  tree.filter(t => t.depth === 3).forEach(t => { g.save(); g.filter = 'blur(' + (4 * S) + 'px)'; strokeCurve(t.pts, t.w0 * 4.2, 'rgba(255,226,200,0.18)'); g.restore(); });

  // veins first (each artery with two venae comitantes on the larger branches, one on the smallest)
  tree.forEach((t, k) => {
    const n = t.pts.length, ph = R() * 6;
    const vw0 = t.w0 * 1.25, vw1 = t.w1 * 1.3;
    const gap = i => { const wa = t.w0 + (t.w1 - t.w0) * i / (n - 1), wv = vw0 + (vw1 - vw0) * i / (n - 1); return (wa * 0.5 + wv * 0.5) * (0.82 + 0.16 * Math.sin(i * 0.03 + ph) + 0.08 * Math.sin(i * 0.11 + ph * 2)); };
    if (t.depth === 0) { t.single = R() < 0.5 ? 'v' : 'a'; if (t.single === 'v') tube(t.pts, t.w0 * 1.15, t.w1 * 1.2, VEN); return; }
    tube(offsetCurve(t.pts, i => gap(i)), vw0, vw1, VEN);
    if (t.depth >= 2) tube(offsetCurve(t.pts, i => -gap(i)), vw0 * 0.9, vw1 * 0.9, VEN);
  });
  tree.forEach(t => { if (t.single !== 'v') tube(t.pts, t.w0, t.w1, ART); });

  // ---- 7. moist sheen: soft broad reflections and a few bright glints ----
  g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 26; i++) {
    const x = R() * w, y = R() * h, r = (18 + R() * 50) * S;
    g.save(); g.translate(x, y); g.rotate(-0.6 + (R() - 0.5) * 0.6); g.scale(1.8, 0.55);
    const q = g.createRadialGradient(0, 0, 0, 0, 0, r); q.addColorStop(0, 'rgba(255,235,235,' + (0.06 + R() * 0.07) + ')'); q.addColorStop(1, 'rgba(255,235,235,0)');
    g.fillStyle = q; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore();
  }
  for (let i = 0; i < 24; i++) {
    const x = R() * w, y = R() * h, r = (0.4 + R() * 0.9) * S;
    g.fillStyle = 'rgba(255,250,250,' + (0.15 + R() * 0.25) + ')'; g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.7, -0.6, 0, TAU); g.fill();
  }
  g.restore();

  g.save(); g.globalCompositeOperation = 'soft-light';
  const lg = g.createRadialGradient(w * 0.25, h * 0.15, 0, w * 0.25, h * 0.15, Math.hypot(w, h));
  lg.addColorStop(0, 'rgba(255,255,255,0.35)'); lg.addColorStop(0.6, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h); g.restore();

  // ---- 8. fine grain ----
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (R() - 0.5) * 9; d[i] += v; d[i + 1] += v * 0.8; d[i + 2] += v * 0.8; }
  g.putImageData(img, 0, 0);
  return c;
}


/* ================= PAGE CURL =================
   Next / previous flap: the page curls like a soft book page, following the finger exactly
   (spine at the left edge; every page is a right-hand page). Swiping right brings the previous
   page back over the current one. Let go and it finishes or springs back, depending on how far
   and how fast it was moving. The paper rustle follows the finger's speed; the landing sound
   plays only when the page actually lands (or a softer one when it falls back).
   The back of each page is the underside of a skin flap – drawn once in the background and kept. */

// To use a designed picture for the back of the page instead, put its path here (e.g. 'icons/underside.jpg')
const UNDERSIDE_IMAGE = '';

(function () {
  const TEX_W = 720, TEX_H = 1300, TEX_KEY = 'flap-underside-v1.jpg', ART_CACHE = 'flapendium-art';
  let texURL = null, texBusy = false, verso = null;

  function setTex(url) { texURL = url; if (verso) verso.bg.style.backgroundImage = 'url(' + url + ')'; }
  function prepareUnderside() {
    if (texURL || texBusy) return;
    texBusy = true;
    if (UNDERSIDE_IMAGE) { setTex(UNDERSIDE_IMAGE); return; }
    const make = () => {
      // in a worker, so drawing it never makes the app stutter
      try {
        if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
          const src = makeFlapUnderside.toString() + '\nself.onmessage = async e => { const c = makeFlapUnderside(e.data.w, e.data.h, 7331); self.postMessage(await c.convertToBlob({ type: "image/jpeg", quality: 0.9 })); };';
          const wk = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
          wk.onmessage = e => { wk.terminate(); store(e.data); };
          wk.onerror = () => { wk.terminate(); onMain(); };
          wk.postMessage({ w: TEX_W, h: TEX_H });
          return;
        }
      } catch (err) {}
      onMain();
    };
    const onMain = () => (window.requestIdleCallback || (f => setTimeout(f, 300)))(() => {
      try { makeFlapUnderside(TEX_W, TEX_H, 7331).toBlob(b => b && store(b), 'image/jpeg', 0.9); } catch (e) { texBusy = false; }
    });
    const store = blob => {
      setTex(URL.createObjectURL(blob));
      try { caches.open(ART_CACHE).then(c => c.put(TEX_KEY, new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } }))); } catch (e) {}
    };
    try {
      caches.open(ART_CACHE).then(c => c.match(TEX_KEY)).then(r => r ? r.blob() : null)
        .then(b => { if (b) setTex(URL.createObjectURL(b)); else make(); }).catch(make);
    } catch (e) { make(); }
  }
  window.prepareUnderside = prepareUnderside;

  // ---------- geometry ----------
  function clip(poly, nx, ny, c0, keep) {
    const o = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], fa = a[0] * nx + a[1] * ny - c0, fb = b[0] * nx + b[1] * ny - c0;
      const ia = keep ? fa >= 0 : fa <= 0, ib = keep ? fb >= 0 : fb <= 0;
      if (ia) o.push(a);
      if (ia !== ib) { const t = fa / (fa - fb); o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return o;
  }
  const poly = p => p.length ? 'polygon(' + p.map(q => q[0].toFixed(1) + 'px ' + q[1].toFixed(1) + 'px').join(',') + ')' : 'polygon(0 0,0 0,0 0)';

  let G = null;          // the turn in progress
  function build(W, H) {
    const page = document.getElementById('flap-page'), body = document.getElementById('fp-body');
    const root = document.createElement('div'); root.className = 'curl-root';
    root.style.cssText = 'left:' + body.offsetLeft + 'px;top:' + body.offsetTop + 'px;width:' + W + 'px;height:' + H + 'px;';
    const leaf = document.createElement('div'); leaf.className = 'curl-leaf'; leaf.style.background = getComputedStyle(page).backgroundColor || 'var(--matrix-bg)';
    const shd = document.createElement('div'); shd.className = 'curl-shd';
    const vw = document.createElement('div'); vw.className = 'curl-vwrap';
    const v = document.createElement('div'); v.className = 'curl-verso'; v.style.width = W + 'px'; v.style.height = H + 'px';
    const bg = document.createElement('div'); bg.className = 'curl-bg'; if (texURL) bg.style.backgroundImage = 'url(' + texURL + ')';
    const vs = document.createElement('div'); vs.className = 'curl-vs';
    const edge = document.createElement('div'); edge.className = 'curl-edge';
    const logo = document.createElement('div'); logo.className = 'curl-logo'; logo.innerHTML = '<img src="icons/logo-96.png" alt="">Amanyu’s Flapendium';
    v.appendChild(bg); v.appendChild(vs); v.appendChild(edge); v.appendChild(logo); vw.appendChild(v);
    root.appendChild(leaf); root.appendChild(shd); root.appendChild(vw);
    body.after(root);
    verso = { bg: bg };
    return { root, leaf, shd, v, vs, logo };
  }
  function snapshot(into, scroll) {
    const body = document.getElementById('fp-body'), copy = body.cloneNode(true);
    copy.removeAttribute('id'); copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copy.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;';
    into.innerHTML = ''; into.appendChild(copy); copy.scrollTop = scroll;
  }
  function render(P) {
    const W = G.W, H = G.H, C = G.C, dx = C[0] - P[0], dy = C[1] - P[1], len = Math.hypot(dx, dy), D = G.D;
    G.P = P; G.q = Math.max(0, Math.min(1, (W - P[0]) / (2 * W)));
    const el = G.el;
    if (len < 1) { el.leaf.style.clipPath = ''; el.v.style.display = 'none'; el.shd.style.display = 'none'; return; }
    const nx = dx / len, ny = dy / len, A = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2], c0 = A[0] * nx + A[1] * ny, rect = [[0, 0], [W, 0], [W, H], [0, H]];
    el.leaf.style.clipPath = poly(clip(rect, nx, ny, c0, false));
    el.v.style.display = 'block'; el.v.style.clipPath = poly(clip(rect, nx, ny, c0, true));
    el.v.style.transform = 'matrix(' + (1 - 2 * nx * nx) + ',' + (-2 * nx * ny) + ',' + (-2 * nx * ny) + ',' + (1 - 2 * ny * ny) + ',' + (2 * c0 * nx) + ',' + (2 * c0 * ny) + ')';
    const ph = Math.atan2(ny, nx) * 180 / Math.PI, tf = 'translate(' + A[0] + 'px,' + A[1] + 'px) rotate(' + ph + 'deg) translate(0,' + (-D) + 'px)';
    el.shd.style.display = 'block'; el.shd.style.width = Math.min(80, len * 0.5) + 'px'; el.shd.style.height = 2 * D + 'px'; el.shd.style.transform = tf;
    el.shd.style.background = 'linear-gradient(to right,rgba(0,0,0,' + (0.36 * Math.sin(Math.PI * Math.min(1, G.q * 1.6 + 0.05))).toFixed(3) + '),rgba(0,0,0,0))';
    el.vs.style.width = (len / 2 + 2) + 'px'; el.vs.style.height = 2 * D + 'px'; el.vs.style.transform = tf;
  }
  function constrain(P) {
    const W = G.W, H = G.H, cy = G.C[1], D = G.D, S1 = [0, cy], S2 = [0, H - cy];
    let dx = P[0] - S1[0], dy = P[1] - S1[1], d = Math.hypot(dx, dy);
    if (d > W) P = [S1[0] + dx * W / d, S1[1] + dy * W / d];
    dx = P[0] - S2[0]; dy = P[1] - S2[1]; d = Math.hypot(dx, dy);
    if (d > D) P = [S2[0] + dx * D / d, S2[1] + dy * D / d];
    return P;
  }
  function track(P, now) {
    const dt = Math.max(1, now - G.lastT), dist = Math.hypot(P[0] - G.lastP[0], P[1] - G.lastP[1]) / 2, vx = (P[0] - G.lastP[0]) / 2 / dt;
    G.v = G.v * 0.6 + (dist / dt) * 0.4; G.vx = G.vx * 0.5 + vx * 0.5; G.lastT = now; G.lastP = P.slice();
    render(P);
    SFX.curl.drive(G.v, G.q, P[0] / G.W);
  }
  const noSlide = () => document.getElementById('fp-inner').classList.remove('from-left', 'from-right');

  // start turning: dir 1 = next, -1 = previous; y = where the finger is (picks the lower or upper corner)
  function begin(dir, y) {
    const order = viewOrder(), idx = order.indexOf(flapPageName), target = order[idx + dir];
    if (idx < 0 || !target) return false;
    const body = document.getElementById('fp-body'), W = body.clientWidth, H = body.clientHeight;
    if (W < 50 || H < 50) return false;
    const cur = flapPageName, scroll = body.scrollTop, cy = y > H / 2 ? H : 0;
    G = { dir, cur, target, scroll, W, H, D: Math.hypot(W, H), C: [W, cy], v: 0, vx: 0, lastT: performance.now() };
    G.el = build(W, H);
    G.el.logo.classList.toggle('top', cy === 0);
    if (dir > 0) {
      snapshot(G.el.leaf, scroll);
      renderFlapPage(target, 1); noSlide(); body.scrollTop = 0;
      G.P = [W, cy];
    } else {
      renderFlapPage(target, -1); noSlide(); body.scrollTop = 0;
      snapshot(G.el.leaf, 0);
      renderFlapPage(cur); noSlide(); body.scrollTop = scroll;
      G.P = [-W, cy];
    }
    G.lastP = G.P.slice();
    SFX.curl.start();
    render(G.P);
    return true;
  }
  function settle(commit) {
    const g = G; G = null;
    g.el.root.remove();
    const body = document.getElementById('fp-body');
    if (commit) {
      if (g.dir < 0) { renderFlapPage(g.target, -1); noSlide(); body.scrollTop = 0; }
      history.replaceState({ view: 'flap' }, '', flapHash(g.target));
      buzz(6); saveStateSoon();
    } else if (g.dir > 0) {
      renderFlapPage(g.cur); noSlide(); body.scrollTop = g.scroll;
    }
  }
  function finish(force) {
    const g = G;
    const commit = force !== undefined ? force : (g.dir > 0 ? (g.q > 0.5 || (g.vx < -0.35 && g.q > 0.04)) : (g.q < 0.5 || (g.vx > 0.35 && g.q < 0.96)));
    const target = (g.dir > 0) === commit ? [-g.W, g.C[1]] : [g.C[0], g.C[1]];
    const from = g.P.slice(), dist = Math.hypot(target[0] - from[0], target[1] - from[1]);
    const dur = Math.max(170, Math.min(520, dist / Math.max(1.8, Math.abs(g.vx) * 2.4)));
    const t0 = performance.now(); g.lastT = t0; g.anim = true;
    (function step() {
      if (G !== g) return;
      const now = performance.now(), k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      track([from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e], now);
      if (k < 1) { requestAnimationFrame(step); return; }
      SFX.curl.stop(); sfx(commit ? 'land' : 'flop');
      settle(commit);
    })();
  }
  // the ‹ › buttons: the same curl, played on its own
  function auto(dir) {
    if (G) return true;
    const body = document.getElementById('fp-body');
    if (!begin(dir, body.clientHeight * 0.8)) return false;
    const g = G, from = g.P.slice(), to = dir > 0 ? [-g.W, g.C[1]] : [g.W, g.C[1]], t0 = performance.now(), dur = 660;
    g.anim = true;
    (function step() {
      if (G !== g) return;
      const now = performance.now(), k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      track(constrain([from[0] + (to[0] - from[0]) * e, from[1] - 70 * Math.sin(Math.PI * e)]), now);
      if (k < 1) { requestAnimationFrame(step); return; }
      SFX.curl.stop(); sfx('land'); settle(true);
    })();
    return true;
  }
  function abort() { if (!G) return; SFX.curl.stop(); const g = G; G = null; g.el.root.remove(); if (g.dir > 0) { renderFlapPage(g.cur); noSlide(); } }
  window.flapCurl = { auto: auto, abort: abort, busy: () => !!G };

  // ---------- the finger ----------
  const zoomed = () => !!(window.visualViewport && window.visualViewport.scale > 1.02);
  let T = null;    // touch being followed
  function startAt(x, y, target) {
    if (!target.closest || !target.closest('#fp-body') || target.closest('#fp-tabs, .fp-gallery, [data-no-swipe]') || zoomed() || G) { T = null; return; }
    const r = document.getElementById('fp-body').getBoundingClientRect();
    T = { sx: x, sy: y, ry: y - r.top, mode: '', t: Date.now() };
  }
  function moveTo(x, y, e) {
    if (!T) return;
    const dx = x - T.sx, dy = y - T.sy;
    if (!T.mode) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { T.mode = 'scroll'; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < 1.4 * Math.abs(dy)) return;
      const dir = dx < 0 ? 1 : -1;
      if (fancyOff()) { T.mode = 'flat'; T.dir = dir; return; }
      if (!begin(dir, T.ry)) { T.mode = 'edge'; T.dir = dir; return; }
      T.mode = 'curl'; T.bx = x; T.by = y;
    }
    if (T.mode === 'curl' && G && !G.anim) {
      if (e && e.cancelable) e.preventDefault();
      const base = G.dir > 0 ? [G.W, G.C[1]] : [-G.W, G.C[1]];
      track(constrain([base[0] + 2 * (x - T.bx), base[1] + (y - T.by)]), performance.now());
    } else if (T.mode === 'flat' || T.mode === 'edge') { if (e && e.cancelable) e.preventDefault(); }
  }
  function endAt(x) {
    if (!T) return;
    const t = T; T = null;
    if (t.mode === 'curl' && G && !G.anim) finish();
    else if (t.mode === 'flat' && Math.abs(x - t.sx) > 60) stepFlap(t.dir);
    else if (t.mode === 'edge' && Math.abs(x - t.sx) > 60) edgeBounce(t.dir);
  }
  document.addEventListener('touchstart', e => { if (e.touches.length > 1) { T = null; return; } startAt(e.touches[0].clientX, e.touches[0].clientY, e.target); }, { passive: true });
  document.addEventListener('touchmove', e => { if (!T) return; if (e.touches.length > 1) { if (T.mode === 'curl' && G && !G.anim) finish(false); T = null; return; } moveTo(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
  document.addEventListener('touchend', e => endAt(e.changedTouches[0].clientX), { passive: true });
  document.addEventListener('touchcancel', () => { if (T && T.mode === 'curl' && G && !G.anim) finish(false); T = null; }, { passive: true });
  // a mouse can turn pages too (desktop)
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) startAt(e.clientX, e.clientY, e.target); });
  document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && T) moveTo(e.clientX, e.clientY, e); });
  document.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') endAt(e.clientX); });
})();
