/* Amanyu's Flapendium - opening animation.
   The launch screen (navy background with the app icon) is incised down the middle with a scalpel and raised
   as two skin flaps that peel back to the sides, revealing the app underneath. Everything is drawn live:
   the flaps with WebGL (so they can bend, show their thickness and the vessels on their underside), the
   scalpel and blood droplets on a 2D canvas on top.
   The page shows a plain copy of the launch screen (#intro) until this script takes over. */
(function () {
  'use strict';

  // ===== Tuning =====
  const SPEED = 0.9;        // 1 = original pace; higher is faster (1.2 = 20% faster), lower is slower
  const ICON_HOLD = 0.5;    // seconds the icon stays still before the scalpel cuts
  const NAVY = '#042551';   // same as the manifest background colour

  // Timeline in seconds (before SPEED is applied)
  const T_CUT = ICON_HOLD;          // scalpel starts cutting at the top
  const CUT_DUR = 0.72;             // top to bottom
  const T_CUT_END = T_CUT + CUT_DUR;
  const T_OPEN = T_CUT_END + 0.12;  // flaps start lifting
  const T_END = T_OPEN + 1.68;      // flaps have cleared the screen
  const T_FADE = 0.22;              // final fade of anything left (droplets, shadow)
  const T_DRIP_END = T_END + 0.45;  // blood trickling down the app has faded by now

  // The two flaps are deliberately different so the opening looks organic, not mirrored.
  // side +1 = right flap (hinged on the right edge), -1 = left flap.
  // spurtV = height (0 top .. 1 bottom) where this flap's main artery reaches the cut and spurts.
  const FLAPS = [
    { side: 1,  seed: 1.7, start: 0.00, dur: 1.45, curl: 3.0, spurtV: 0.38, pulses: 3, drips: [0.22, 0.71] },
    { side: -1, seed: 4.2, start: 0.13, dur: 1.38, curl: 2.7, spurtV: 0.64, pulses: 2, drips: [0.47, 0.86] }
  ];

  const NX = 28, NY = 44; // mesh resolution of each flap (across, down)

  // ---------- small helpers ----------
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const q = clamp((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
  function rng(seed) { let s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // Incision progress (0 top .. 1 bottom) for a normalised cutting time x; keeps growing afterwards so
  // the blood along the margins keeps oozing
  function cutEase(x) {
    if (x <= 0) return x * 0.4;
    if (x >= 1) return 1 + (x - 1) * 0.4;
    return 0.4 * x + 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * x));
  }
  function tCutOf(v) { // time at which the blade passes height v
    let lo = 0, hi = 1;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (cutEase(m) < v) lo = m; else hi = m; }
    return T_CUT + CUT_DUR * (lo + hi) / 2;
  }
  function roundRectPath(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  // ---------- underside of a flap: glistening tissue, fat lobules, paired arteries and veins ----------
  function makeUnderside(F, tw, th) {
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    const g = c.getContext('2d'); const R = rng(Math.floor(F.seed * 1000));
    const base = g.createLinearGradient(0, 0, tw, 0); // u = 0 at the hinge, 1 at the cut edge
    base.addColorStop(0, '#a6434a'); base.addColorStop(0.55, '#cd6967'); base.addColorStop(1, '#e38a80');
    g.fillStyle = base; g.fillRect(0, 0, tw, th);
    for (let n = 0; n < 520; n++) {
      const r = 4 + R() * 26;
      g.fillStyle = R() < 0.5 ? 'rgba(255,200,190,' + (0.03 + R() * 0.05) + ')' : 'rgba(120,25,35,' + (0.03 + R() * 0.06) + ')';
      g.beginPath(); g.ellipse(R() * tw, R() * th, r * 1.4, r, R() * 3, 0, 7); g.fill();
    }
    g.lineCap = 'round';
    for (let n = 0; n < 150; n++) { // fascial fibres
      const x = R() * tw, y = R() * th, l = 20 + R() * 60, a = (R() - 0.5) * 0.6;
      g.strokeStyle = 'rgba(255,240,235,' + (0.05 + R() * 0.08) + ')'; g.lineWidth = 0.6 + R() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + (R() - 0.5) * 10, x + l * Math.cos(a), y + l * Math.sin(a)); g.stroke();
    }
    for (let n = 0; n < 120; n++) { // fat lobules, mostly at the cut edge
      const x = tw * (R() < 0.75 ? 0.9 + R() * 0.1 : R()), y = R() * th, r = 1.8 + R() * 3.2;
      g.fillStyle = 'rgba(' + (235 + R() * 20 | 0) + ',' + (185 + R() * 40 | 0) + ',70,' + (0.22 + R() * 0.25) + ')';
      g.strokeStyle = 'rgba(170,110,30,0.35)'; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(x, y, r * 1.15, r, R() * 3, 0, 7); g.fill(); g.stroke();
    }

    // vessel trees as polylines with tapering width
    const vessels = [];
    function bez(p0, p1, p2, p3, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return out; }
    function wander(x, y, ang, len, steps) { const pts = [[x, y]]; const st = len / steps; for (let i = 0; i < steps; i++) { ang += (R() - 0.5) * 0.45; x += Math.cos(ang) * st; y += Math.sin(ang) * st; pts.push([x, y]); } return pts; }
    function branchOut(pts, w0, w1, depth, count) {
      vessels.push({ pts: pts, w0: w0, w1: w1 });
      if (depth <= 0) return;
      for (let b = 0; b < count; b++) {
        const i = Math.floor((0.15 + 0.75 * (b + R() * 0.8) / count) * (pts.length - 2)) + 1;
        const p = pts[i], q = pts[i + 1];
        const dir = Math.atan2(q[1] - p[1], q[0] - p[0]);
        const sgn = (b % 2 === 0 ? 1 : -1) * (R() < 0.15 ? -1 : 1);
        const wHere = w0 + (w1 - w0) * i / (pts.length - 1);
        const len = (0.35 + R() * 0.5) * (40 + depth * 55) * (th / 1024);
        branchOut(wander(p[0], p[1], dir + sgn * (0.5 + R() * 0.7), len, 10), wHere * 0.62, Math.max(0.8, wHere * 0.25), depth - 1, depth > 1 ? 3 : 2);
      }
    }
    const k = th / 1024;
    const yIn = (F.spurtV + (F.side > 0 ? 0.12 : -0.14)) * th, yOut = F.spurtV * th;
    branchOut(bez([-6, yIn], [tw * 0.3, yIn - 60 * k], [tw * 0.65, yOut + 70 * k], [tw + 6, yOut], 44), 13 * k, 8 * k, 3, 6);
    branchOut(wander(-4, 0.1 * th, 0.25, tw * 0.85, 22), 8 * k, 1.5 * k, 2, 4);
    branchOut(wander(-4, 0.9 * th, -0.3, tw * 0.8, 22), 8 * k, 1.5 * k, 2, 4);

    function strokeVessels(offsetSign, outline, body, hi, widen) {
      vessels.forEach(vs => {
        const P = vs.pts, n = P.length;
        const off = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; const w = vs.w0 + (vs.w1 - vs.w0) * i / (n - 1); return [p[0] - ty / l * w * 1.15 * offsetSign, p[1] + tx / l * w * 1.15 * offsetSign, w * widen, -ty / l, tx / l]; });
        [[outline, 1.35, 0], [body, 1, 0], [hi, 0.32, -0.22]].forEach(([col, wf, shift]) => {
          g.strokeStyle = col;
          for (let i = 1; i < n; i++) {
            const a = off[i - 1], b = off[i];
            g.lineWidth = Math.max(0.6, b[2] * wf);
            g.beginPath(); g.moveTo(a[0] + a[3] * a[2] * shift, a[1] + a[4] * a[2] * shift); g.lineTo(b[0] + b[3] * b[2] * shift, b[1] + b[4] * b[2] * shift); g.stroke();
          }
        });
      });
    }
    strokeVessels(1, '#162a63', '#3463c2', 'rgba(170,200,255,0.55)', 1.2);   // veins alongside
    strokeVessels(0, '#5c0b12', '#c81d25', 'rgba(255,160,160,0.75)', 1.0);   // arteries
    return c;
  }

  // ---------- shaders ----------
  const VS = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aUV;',
    'uniform vec3 uScreen;',
    'varying vec3 vPos; varying vec3 vNor; varying vec4 vUV;',
    'void main(){',
    '  vPos = aPos; vNor = aNor; vUV = aUV;',
    '  float W = uScreen.x, H = uScreen.y, D = uScreen.z; float w = D - aPos.z;',
    '  gl_Position = vec4((aPos.x - W*0.5)*2.0/W*D, -(aPos.y - H*0.5)*2.0/H*D, -aPos.z/D*w, w);',
    '}'].join('\n');

  const FS = [
    'precision highp float;',
    'uniform int uMode;', // 0 flap surface, 1 flap cut edge, 2 wound bed, 3 shadow
    'uniform sampler2D uFront; uniform sampler2D uBack;',
    'uniform vec3 uScreen; uniform float uSide; uniform float uCutV; uniform float uSpurtV;',
    'uniform float uWf; uniform vec4 uDrips; uniform float uAlpha;',
    'varying vec3 vPos; varying vec3 vNor; varying vec4 vUV;',
    'float hash(float n){ return fract(sin(n)*43758.5453); }',
    'float noise(float x){ float i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(hash(i), hash(i+1.0), f); }',
    'float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float noise2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash2(i), hash2(i+vec2(1.0,0.0)), f.x), mix(hash2(i+vec2(0.0,1.0)), hash2(i+vec2(1.0,1.0)), f.x), f.y); }',
    'const vec3 L = vec3(-0.2932, -0.4607, 0.8376);', // light from the upper left, in front
    'vec3 shade(vec3 base, vec3 n, float spec, float shin){',
    '  vec3 V = normalize(vec3(uScreen.x*0.5, uScreen.y*0.5, uScreen.z) - vPos);',
    '  float diff = max(dot(n, L), 0.0);',
    '  float sp = pow(max(dot(n, normalize(L + V)), 0.0), shin)*spec;',
    '  return base*(0.32 + 0.78*diff) + vec3(sp);',
    '}',
    'vec3 bloodCol(float d){ return mix(vec3(0.36,0.01,0.03), vec3(0.62,0.04,0.06), clamp(d/6.0, 0.0, 1.0)); }',
    // blood along the cut margin of the skin surface, d = pixels from the cut edge
    'float marginBlood(float d, float v){',
    '  float Hs = uScreen.y;',
    '  float behind = clamp((uCutV - v)*6.0, 0.0, 1.0);',
    '  float grow = clamp((uCutV - v)*1.5, 0.0, 1.0);',
    '  float spurt = exp(-pow((v - uSpurtV)*Hs/26.0, 2.0));',
    '  float w = behind*1.8 + grow*(2.3 + 4.2*noise(v*Hs/16.0 + uSide*9.0)) + 6.0*spurt*grow;',
    '  w += grow*3.2*pow(0.5 + 0.5*sin(v*Hs/7.0 + 4.0*noise(v*Hs/40.0 + 3.0)), 3.0);',
    '  float m = smoothstep(w + 0.7, w - 0.7, d);',
    '  for (int k = 0; k < 2; k++) {', // drips running down from the margin
    '    float v0 = k == 0 ? uDrips.x : uDrips.z; float len = k == 0 ? uDrips.y : uDrips.w;',
    '    if (len > 0.0) {',
    '      float c = length(vec2(d - 3.0, (v - clamp(v, v0, v0 + len))*Hs));',
    '      m = max(m, smoothstep(2.0, 0.9, c));',
    '      float e = length(vec2(d - 3.0, (v - v0 - len)*Hs));',
    '      m = max(m, smoothstep(2.9, 1.8, e));',
    '    }',
    '  }',
    '  return m;',
    '}',
    'void main(){',
    '  vec3 col; float a = 1.0;',
    '  if (uMode == 3) { a = vNor.x*uAlpha; gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }',
    '  if (uMode == 2) {',
    '    float v = vUV.y; float behind = clamp((uCutV - v)*8.0, 0.0, 1.0);',
    '    float n = noise2(vec2(vPos.x*0.5, v*uScreen.y*0.14));',
    '    col = mix(vec3(0.50,0.07,0.08), vec3(0.93,0.72,0.28), smoothstep(0.35, 0.75, n)*0.7);',
    '    a = behind*uAlpha; gl_FragColor = vec4(col*a, a); return;',
    '  }',
    '  vec3 V = normalize(vec3(uScreen.x*0.5, uScreen.y*0.5, uScreen.z) - vPos);',
    '  vec3 n = normalize(vNor);',
    '  if (uMode == 1) {', // the cut face: skin surface, dermis, fat lobules, fascia
    '    float t = vUV.x; float al = vUV.y*uScreen.y;',
    '    if (t < 0.07) col = vec3(0.02,0.14,0.32);',
    '    else if (t < 0.27) col = mix(vec3(0.96,0.80,0.76), vec3(0.88,0.62,0.60), noise2(vec2(al*0.3, t*20.0)));',
    '    else if (t < 0.86) {',
    '      float c1 = noise2(vec2(al*0.22, t*9.0)); float c2 = noise2(vec2(al*0.5 + 7.0, t*16.0));',
    '      col = mix(vec3(0.99,0.85,0.32), vec3(0.93,0.66,0.12), smoothstep(0.3, 0.7, c1));',
    '      col *= 0.8 + 0.2*smoothstep(0.15, 0.45, c2);',
    '    } else col = vec3(0.78,0.32,0.33);',
    '    float bl = noise2(vec2(al*0.12, t*4.0));',
    '    col = mix(col, vec3(0.55,0.03,0.05), smoothstep(0.5, 0.85, bl)*0.75);',
    '    if (dot(n, V) < 0.0) n = -n;',
    '    gl_FragColor = vec4(shade(col, n, 0.35, 30.0), 1.0); return;',
    '  }',
    '  float d = (1.0 - vUV.x)*uWf;',
    '  if (dot(n, V) > 0.0) {', // skin side: the launch screen
    '    vec3 tex = texture2D(uFront, vUV.zw).rgb;',
    '    col = tex*(0.3 + 0.7*max(dot(n, L), 0.0))/(0.3 + 0.7*L.z);',
    '    col = mix(col, shade(bloodCol(d), n, 0.7, 50.0), marginBlood(d, vUV.y));',
    '  } else {', // raw underside of the flap
    '    n = -n;',
    '    col = shade(texture2D(uBack, vUV.xy).rgb, n, 0.3, 22.0);',
    '    float behind = clamp((uCutV - vUV.y)*6.0, 0.0, 1.0);',
    '    float w = (2.0 + 4.0*noise(vUV.y*uScreen.y/12.0 + 5.0))*behind;',
    '    col = mix(col, shade(bloodCol(d), n, 0.7, 50.0), smoothstep(w + 0.7, w - 0.7, d));',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'].join('\n');

  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function texture(gl, src, unit) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p[0], p[1]));
    return t;
  }

  // ---------- the scene ----------
  function createScene(overlay, logo) {
    const W = overlay.clientWidth || window.innerWidth, H = overlay.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const glc = document.createElement('canvas'), c2 = document.createElement('canvas');
    [glc, c2].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); overlay.appendChild(c); });
    const gl = glc.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) { glc.remove(); c2.remove(); return null; }
    const ctx = c2.getContext('2d');

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const A = { pos: gl.getAttribLocation(prog, 'aPos'), nor: gl.getAttribLocation(prog, 'aNor'), uv: gl.getAttribLocation(prog, 'aUV') };
    const U = {};
    ['uMode', 'uFront', 'uBack', 'uScreen', 'uSide', 'uCutV', 'uSpurtV', 'uWf', 'uDrips', 'uAlpha'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
    [A.pos, A.nor, A.uv].forEach(l => gl.enableVertexAttribArray(l));

    // front: an exact copy of the launch screen
    const fc = document.createElement('canvas'); fc.width = glc.width; fc.height = glc.height;
    const f = fc.getContext('2d'); f.fillStyle = NAVY; f.fillRect(0, 0, fc.width, fc.height);
    if (logo && logo.naturalWidth) {
      const r = logo.getBoundingClientRect();
      f.save(); f.scale(dpr, dpr); roundRectPath(f, r.left, r.top, r.width, r.height, r.width * 0.22); f.clip();
      f.drawImage(logo, r.left, r.top, r.width, r.height); f.restore();
    }
    texture(gl, fc, 0);
    gl.uniform1i(U.uFront, 0); gl.uniform1i(U.uBack, 1);

    const Wf = W / 2 + 0.75;                  // each flap overlaps the middle slightly so no seam shows
    const gMax = Math.min(W, H) * 0.012;      // how far the wound gapes before the flaps lift
    const TH = Math.max(12, Math.min(W, H) * 0.056); // flap thickness
    const D = Math.max(W, H) * 1.05;          // camera distance (perspective)
    gl.uniform3f(U.uScreen, W, H, D);
    gl.uniform1f(U.uWf, Wf);

    const nv = (NX + 1) * (NY + 1);
    const surfIdx = []; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; surfIdx.push(a, b, c, b, d, c); }
    function stripIdx(n, base, out) { for (let i = 0; i < n; i++) { const a = base + i * 2; out.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const edgeIdx = []; stripIdx(NY, 0, edgeIdx); stripIdx(NX, (NY + 1) * 2, edgeIdx); stripIdx(NX, (NY + 1) * 2 + (NX + 1) * 2, edgeIdx);
    const nEdge = (NY + 1) * 2 + (NX + 1) * 4;
    const shadIdx = []; for (let j = 0; j < NY; j++) { const a = j * 3, b = a + 3; shadIdx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2); }

    function buf(data, target, usage) { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; }
    const IB = { surf: buf(new Uint16Array(surfIdx), gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW), edge: buf(new Uint16Array(edgeIdx), gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW), shad: buf(new Uint16Array(shadIdx), gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW) };

    const texH = 1024, texW = Math.min(2048, Math.round(1024 * Wf / H));
    FLAPS.forEach((F, fi) => {
      F.tex = texture(gl, makeUnderside(F, texW, texH), 1 + fi);
      F.pos = new Float32Array(nv * 3); F.phi = new Float32Array(nv); F.p = new Float32Array(NY + 1);
      F.surf = new Float32Array(nv * 6); F.edge = new Float32Array(nEdge * 6); F.shad = new Float32Array((NY + 1) * 3 * 6);
      const uv = new Float32Array(nv * 4);
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const k = (j * (NX + 1) + i) * 4, s = i / NX * Wf, x0 = F.side > 0 ? W - s : s;
        uv[k] = i / NX; uv[k + 1] = j / NY; uv[k + 2] = x0 / W; uv[k + 3] = j / NY;
      }
      const euv = new Float32Array(nEdge * 4); let e = 0;
      for (let j = 0; j <= NY; j++) for (let t = 0; t < 2; t++) { euv[e++] = t; euv[e++] = j / NY; e += 2; }
      for (let r = 0; r < 2; r++) for (let i = 0; i <= NX; i++) for (let t = 0; t < 2; t++) { euv[e++] = t; euv[e++] = i / NX; e += 2; }
      const suv = new Float32Array((NY + 1) * 3 * 4); for (let j = 0; j <= NY; j++) for (let q = 0; q < 3; q++) suv[(j * 3 + q) * 4 + 1] = j / NY;
      F.uvB = buf(uv, gl.ARRAY_BUFFER, gl.STATIC_DRAW); F.euvB = buf(euv, gl.ARRAY_BUFFER, gl.STATIC_DRAW); F.suvB = buf(suv, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
      F.surfB = buf(F.surf, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW); F.edgeB = buf(F.edge, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW); F.shadB = buf(F.shad, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
      F.tSpurt = tCutOf(F.spurtV);
    });

    // wound bed under the gaping incision
    const bedPos = new Float32Array((NY + 1) * 2 * 6), bedUV = new Float32Array((NY + 1) * 2 * 4);
    const bw = gMax * 1.1 + 3;
    for (let j = 0; j <= NY; j++) for (let q = 0; q < 2; q++) { const k = j * 2 + q; bedPos[k * 6] = W / 2 + (q ? bw : -bw); bedPos[k * 6 + 1] = j / NY * H; bedPos[k * 6 + 2] = -TH; bedPos[k * 6 + 5] = 1; bedUV[k * 4 + 1] = j / NY; }
    const bedIdx = []; stripIdx(NY, 0, bedIdx);
    const bedB = buf(bedPos, gl.ARRAY_BUFFER, gl.STATIC_DRAW), bedUVB = buf(bedUV, gl.ARRAY_BUFFER, gl.STATIC_DRAW), bedIB = buf(new Uint16Array(bedIdx), gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);

    // ----- flap shape: each row bends like a sheet of tissue being lifted at its cut edge -----
    function deform(F, t, cutV) {
      const P = F.pos, ds = Wf / NX, hingeX = F.side > 0 ? W : 0;
      for (let j = 0; j <= NY; j++) {
        const v = j / NY;
        const delay = 0.085 * (1 - Math.sin(Math.PI * v)) + 0.07 * (0.5 + 0.5 * Math.sin(4.3 * v + F.seed));
        const p = clamp((t - T_OPEN - F.start - delay) / F.dur, 0, 1); F.p[j] = p;
        const e = p * p * (3 - 2 * p);
        const Ang = 1.12 * Math.PI * e + 0.07 * Math.sin(12 * p + F.seed) * Math.sin(Math.PI * p);
        const C = F.curl * (0.5 + 0.5 * Math.sin(Math.PI * v)) * Math.sin(Math.PI * Math.min(1, p * 1.2));
        const hz = Wf * (0.62 - 0.45 * e);
        const slide = smooth(0.5, 1, p) * 0.1 * W;
        const age = smooth(0, 0.3, cutV - v);
        const gap = gMax * Math.pow(Math.sin(Math.PI * v), 0.7) * age * (1 - e);
        let x = hingeX + F.side * slide, z = 0, prev = 0;
        for (let i = 0; i <= NX; i++) {
          const s = i * ds, q = Math.min(1, s / hz);
          const phi = Ang * q * q * (3 - 2 * q) + C * Math.pow(s / Wf, 1.6);
          if (i > 0) { const pm = 0.5 * (phi + prev); x -= F.side * Math.cos(pm) * ds; z += Math.sin(pm) * ds; }
          prev = phi;
          const k = j * (NX + 1) + i;
          P[k * 3] = x + F.side * gap * Math.pow(s / Wf, 1.5); P[k * 3 + 1] = v * H; P[k * 3 + 2] = z; F.phi[k] = phi;
        }
      }
      // normals, and the interleaved surface buffer
      const S = F.surf;
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const k = j * (NX + 1) + i, ja = Math.max(0, j - 1), jb = Math.min(NY, j + 1);
        const a = (ja * (NX + 1) + i) * 3, b = (jb * (NX + 1) + i) * 3;
        const yx = P[b] - P[a], yy = P[b + 1] - P[a + 1], yz = P[b + 2] - P[a + 2];
        const tx = -F.side * Math.cos(F.phi[k]), tz = Math.sin(F.phi[k]);
        let nx = -tz * yy, ny = tz * yx - tx * yz, nz = tx * yy;
        const l = Math.hypot(nx, ny, nz) || 1, sg = -F.side / l;
        nx *= sg; ny *= sg; nz *= sg;
        S.set([P[k * 3], P[k * 3 + 1], P[k * 3 + 2], nx, ny, nz], k * 6);
      }
      // cut edge (free edge) and the top/bottom edges, given thickness
      const E = F.edge; let w = 0;
      const put = (k, nx, ny, nz) => {
        for (let t = 0; t < 2; t++) {
          E[w++] = S[k * 6] - S[k * 6 + 3] * TH * t; E[w++] = S[k * 6 + 1] - S[k * 6 + 4] * TH * t; E[w++] = S[k * 6 + 2] - S[k * 6 + 5] * TH * t;
          E[w++] = nx; E[w++] = ny; E[w++] = nz;
        }
      };
      for (let j = 0; j <= NY; j++) { const k = j * (NX + 1) + NX; put(k, -F.side * Math.cos(F.phi[k]), 0, Math.sin(F.phi[k])); }
      for (let i = 0; i <= NX; i++) put(i, 0, -1, 0);
      for (let i = 0; i <= NX; i++) put(NY * (NX + 1) + i, 0, 1, 0);
      // soft shadow on the app under the lifted flap
      const Sh = F.shad;
      for (let j = 0; j <= NY; j++) {
        const k = (j * (NX + 1) + NX) * 3, xE = P[k], zE = Math.max(0, P[k + 2]);
        const al = 0.42 * clamp(zE / (0.22 * W), 0, 1) * (1 - smooth(0.75, 1, F.p[j]));
        const xs = [xE - F.side * (zE * 0.45 + 4), xE, hingeX + F.side * 20], als = [0, al, al];
        for (let q = 0; q < 3; q++) Sh.set([xs[q], j / NY * H, -0.5, als[q], 0, 0], (j * 3 + q) * 6);
      }
    }

    function draw(posB, uvB, ib, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, posB);
      gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(A.nor, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvB); gl.vertexAttribPointer(A.uv, 4, gl.FLOAT, false, 16, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }
    function upload(b, data) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data); }

    // ----- blood droplets (2D overlay), all precomputed so any moment can be drawn exactly -----
    const parts = [], R = rng(7);
    for (let n = 0; n < 26; n++) { // ooze along the incision
      const v = 0.03 + R() * 0.94;
      parts.push({ t0: tCutOf(v) + 0.05 + R() * 0.25, life: 0.35 + R() * 0.3, x: W / 2 + (R() - 0.5) * 3, y: v * H, vx: (R() - 0.5) * 40, vy: -20 + R() * 30, r: 0.8 + R() * 1.2, g: 900 });
    }
    FLAPS.forEach(F => { // pulsatile spurts where the big vessels are cut
      for (let p = 0; p < F.pulses; p++) {
        const strength = [1, 0.7, 0.45][p], tp = F.tSpurt + 0.03 + p * 0.31;
        for (let n = 0; n < Math.round(26 * strength); n++) {
          const dt = R() * 0.09, ang = (F.side > 0 ? -1.15 : -1.99) + (R() - 0.5) * 0.35;
          const sp = H * (0.75 + R() * 0.6) * (0.55 + 0.45 * strength) * (1 - dt * 3);
          parts.push({ t0: tp + dt, life: 0.55 + R() * 0.35, x: W / 2 + F.side * (1 + R() * 2), y: F.spurtV * H + (R() - 0.5) * 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: (1.3 + R() * 2.2) * (0.6 + 0.4 * strength), g: H * 2.8 });
        }
      }
    });
    function drawParticles(t) {
      for (const p of parts) {
        const a = t - p.t0; if (a < 0 || a > p.life) continue;
        const x = p.x + p.vx * a, y = p.y + p.vy * a + 0.5 * p.g * a * a, vy = p.vy + p.g * a, sp = Math.hypot(p.vx, vy);
        ctx.globalAlpha = 0.95 * (1 - smooth(p.life * 0.6, p.life, a));
        ctx.fillStyle = '#7d0a10';
        ctx.beginPath(); ctx.ellipse(x, y, p.r + sp * 0.012, p.r, Math.atan2(vy, p.vx), 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,140,140,0.55)';
        ctx.beginPath(); ctx.arc(x - p.r * 0.3, y - p.r * 0.3, p.r * 0.35, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ----- blood drops that fall from the lifted flap edges onto the app and trickle down it -----
    const c3 = document.createElement('canvas'); c3.id = 'intro-drips';
    c3.width = glc.width; c3.height = glc.height;
    c3.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99998;pointer-events:none;';
    document.body.appendChild(c3);
    const dctx = c3.getContext('2d');
    const DR = rng(31);
    const drips = [
      { t0: T_OPEN + 0.38, x: 0.57 * W, y: 0.31 * H, len: 0.24 * H, r: 5.2 },
      { t0: T_OPEN + 0.62, x: 0.40 * W, y: 0.55 * H, len: 0.17 * H, r: 4.6 }
    ].map(d => {
      d.fall = 0.26; d.wob = DR() * 10;
      d.sats = [0, 1, 2, 3].map(() => { const a = DR() * 6.28, r = 5 + DR() * 7; return [Math.cos(a) * r, Math.sin(a) * r * 0.8, 0.6 + DR() * 0.9]; });
      return d;
    });
    const trickleY = (d, a) => d.y + d.len * (1 - Math.exp(-a / 0.75));
    const trickleX = (d, y) => { const q = (y - d.y) / d.len; return d.x + 2.2 * Math.sin(q * 7 + d.wob) + 1.2 * Math.sin(q * 17 + d.wob * 2); };
    function renderDrips(t) {
      dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, c3.width, c3.height);
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drips.forEach(d => {
        dctx.globalAlpha = 1;
        const a = t - d.t0; if (a < 0) return;
        if (a < d.fall) { // falling towards the screen: shrinks as it moves away from the viewer
          const q = a / d.fall, r = d.r * (2.3 - 1.3 * q * q), y = d.y - (1 - q) * 18;
          dctx.fillStyle = 'rgba(125,10,16,0.95)'; dctx.beginPath(); dctx.ellipse(d.x, y, r, r * 1.15, 0, 0, 6.2832); dctx.fill();
          dctx.fillStyle = 'rgba(255,150,150,0.55)'; dctx.beginPath(); dctx.arc(d.x - r * 0.3, y - r * 0.35, r * 0.3, 0, 6.2832); dctx.fill();
          return;
        }
        const b = a - d.fall;
        dctx.globalAlpha = 1 - smooth(0.2, 1.0, b); // fades out smoothly as it runs
        if (dctx.globalAlpha <= 0) return;
        if (b < 0.18) { // splash ring
          const rr = d.r + b * 60;
          dctx.strokeStyle = 'rgba(140,12,18,' + (0.6 * (1 - b / 0.18)) + ')'; dctx.lineWidth = 1.5;
          dctx.beginPath(); dctx.ellipse(d.x, d.y, rr, rr * 0.8, 0, 0, 6.2832); dctx.stroke();
        }
        dctx.fillStyle = '#7d0a10'; // small pool where it landed, and satellite spots around it
        dctx.beginPath(); dctx.ellipse(d.x, d.y, d.r * 0.95 * smooth(0, 0.06, b), d.r * 0.8 * smooth(0, 0.06, b), 0, 0, 6.2832); dctx.fill();
        d.sats.forEach(s => { dctx.beginPath(); dctx.arc(d.x + s[0], d.y + s[1], s[2] * smooth(0, 0.08, b), 0, 6.2832); dctx.fill(); });
        // the trail left behind as it runs down
        const yh = trickleY(d, b), n = Math.max(2, Math.ceil((yh - d.y) / 3));
        dctx.lineCap = 'round'; dctx.lineJoin = 'round';
        [['#5c0710', 3.0, 0], ['#9a0e17', 2.2, 0], ['rgba(255,140,140,0.4)', 0.6, -0.8]].forEach(L => {
          dctx.strokeStyle = L[0]; dctx.lineWidth = L[1] * d.r / 3; dctx.beginPath();
          for (let i = 0; i <= n; i++) { const y = d.y + (yh - d.y) * i / n, x = trickleX(d, y) + L[2]; if (i) dctx.lineTo(x, y); else dctx.moveTo(x, y); }
          dctx.stroke();
        });
        // the bead at its front, slowly shrinking as blood is left behind
        const hr = d.r * (1 - 0.35 * smooth(0, 1.5, b)), hx = trickleX(d, yh);
        dctx.fillStyle = '#8a0b13'; dctx.beginPath(); dctx.ellipse(hx, yh, hr, hr * 1.25, 0, 0, 6.2832); dctx.fill();
        dctx.fillStyle = 'rgba(255,160,160,0.6)'; dctx.beginPath(); dctx.arc(hx - hr * 0.35, yh - hr * 0.3, hr * 0.32, 0, 6.2832); dctx.fill();
      });
      dctx.globalAlpha = 1;
    }

    // ----- scalpel -----
    const SCALPEL_ROT = Math.PI - 0.30; // handle points down, about 17 degrees off the incision line
    function scalpelPose(t) {
      const enter = 0.28;
      if (t < T_CUT - enter) return null;
      if (t < T_CUT) { const q = 1 - Math.pow(1 - (t - T_CUT + enter) / enter, 3); return { x: W / 2 + (1 - q) * W * 0.35, y: -(1 - q) * H * 0.2, rot: SCALPEL_ROT + (1 - q) * 0.25, alpha: 1, depth: 0 }; }
      if (t < T_CUT_END) { const e = cutEase((t - T_CUT) / CUT_DUR); return { x: W / 2 + Math.sin(e * 19) * 0.8, y: e * H, rot: SCALPEL_ROT - 0.04 * Math.sin(e * 3.1), alpha: 1, depth: smooth(0, 0.06, e) * (1 - smooth(0.94, 1, e)) }; }
      const q = (t - T_CUT_END) / 0.32; if (q >= 1) return null;
      const eq = q * q;
      return { x: W / 2 + eq * W * 0.45, y: H + eq * H * 0.04, rot: SCALPEL_ROT + eq * 0.3, alpha: 1 - smooth(0.4, 1, q), depth: 0 };
    }
    function drawScalpel(p) {
      const k = Math.min(W, H * 0.55) / 420;
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.depth > 0) { // blood welling where the blade enters the skin
        ctx.fillStyle = 'rgba(110,6,12,0.9)'; ctx.beginPath(); ctx.ellipse(0, -1, 2.5 + 2 * p.depth, 4 + 2.5 * p.depth, 0, 0, 6.2832); ctx.fill();
      }
      ctx.rotate(p.rot); ctx.scale(-k, k); ctx.globalAlpha = p.alpha;
      ctx.translate(12.5, 21); // the curved belly of the blade, not the tip, sits on the cut
      ctx.shadowColor = 'rgba(0,8,30,0.45)'; ctx.shadowBlur = 10 * dpr; ctx.shadowOffsetX = 9 * dpr; ctx.shadowOffsetY = 12 * dpr;
      // handle
      ctx.beginPath(); ctx.moveTo(-5, -60); ctx.lineTo(-6, -90); ctx.quadraticCurveTo(-9, -100, -9, -112); ctx.lineTo(-9, -262);
      ctx.quadraticCurveTo(-9, -272, 0, -272); ctx.quadraticCurveTo(9, -272, 9, -262); ctx.lineTo(9, -112); ctx.quadraticCurveTo(9, -100, 6, -90); ctx.lineTo(5, -60); ctx.closePath();
      let gr = ctx.createLinearGradient(-9, 0, 9, 0);
      gr.addColorStop(0, '#5d6873'); gr.addColorStop(0.3, '#e6ebf0'); gr.addColorStop(0.45, '#ffffff'); gr.addColorStop(0.75, '#aab4be'); gr.addColorStop(1, '#5d6873');
      ctx.fillStyle = gr; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(55,65,78,0.55)'; ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) { const y = -150 - i * 6; ctx.beginPath(); ctx.moveTo(-7, y); ctx.lineTo(7, y); ctx.stroke(); }
      roundRectPath(ctx, -2.5, -235, 5, 66, 2.5); ctx.fillStyle = 'rgba(70,80,92,0.35)'; ctx.fill();
      // blade (#15)
      ctx.shadowColor = 'rgba(0,8,30,0.4)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-13, -3, -17, -24, -11, -46); ctx.lineTo(-7, -66); ctx.lineTo(7, -66); ctx.bezierCurveTo(6, -40, 5, -16, 0, 0); ctx.closePath();
      gr = ctx.createLinearGradient(-13, 0, 7, 0);
      gr.addColorStop(0, '#9aa6b2'); gr.addColorStop(0.35, '#f4f7fa'); gr.addColorStop(0.7, '#c3ccd6'); gr.addColorStop(1, '#7f8b97');
      ctx.fillStyle = gr; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-1.5, -2.5); ctx.bezierCurveTo(-11, -6, -14, -24, -9.5, -44); ctx.stroke();
      roundRectPath(ctx, -1.2, -60, 3, 13, 1.5); ctx.fillStyle = 'rgba(40,50,62,0.6)'; ctx.fill();
      ctx.restore();
    }

    // ----- one frame at time t (seconds on the intro timeline) -----
    function render(t) {
      const cutV = cutEase((t - T_CUT) / CUT_DUR);
      gl.viewport(0, 0, glc.width, glc.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(U.uCutV, cutV);
      FLAPS.forEach(F => { deform(F, t, cutV); upload(F.surfB, F.surf); upload(F.edgeB, F.edge); upload(F.shadB, F.shad); });

      gl.depthMask(false);
      gl.uniform1i(U.uMode, 3); gl.uniform1f(U.uAlpha, 1);
      FLAPS.forEach(F => draw(F.shadB, F.suvB, IB.shad, shadIdx.length));
      gl.uniform1i(U.uMode, 2); gl.uniform1f(U.uAlpha, 1 - smooth(T_OPEN, T_OPEN + 0.5, t));
      draw(bedB, bedUVB, bedIB, bedIdx.length);
      gl.depthMask(true);

      FLAPS.forEach((F, fi) => {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, F.tex);
        gl.uniform1f(U.uSide, F.side); gl.uniform1f(U.uSpurtV, F.spurtV);
        const dl = F.drips.map(v0 => clamp((cutV - v0 - 0.12) * 0.11, 0, 0.07));
        gl.uniform4f(U.uDrips, F.drips[0], dl[0], F.drips[1], dl[1]);
        gl.uniform1i(U.uMode, 0); draw(F.surfB, F.uvB, IB.surf, surfIdx.length);
        gl.uniform1i(U.uMode, 1); draw(F.edgeB, F.euvB, IB.edge, edgeIdx.length);
      });

      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c2.width, c2.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawParticles(t);
      const sp = scalpelPose(t); if (sp) drawScalpel(sp);
      renderDrips(t);
    }

    function destroy() {
      const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
      glc.remove(); c2.remove();
    }
    return { render: render, renderDrips: renderDrips, destroy: destroy, removeDrips: () => c3.remove() };
  }

  // ---------- running it ----------
  let current = null;

  function getOverlay() {
    let el = document.getElementById('intro');
    if (!el) {
      el = document.createElement('div'); el.id = 'intro';
      const img = document.createElement('img'); img.id = 'intro-logo'; img.src = 'icons/splash.webp'; img.alt = '';
      el.appendChild(img); document.body.appendChild(el);
    }
    return el;
  }
  function imageReady(img) {
    return new Promise(res => {
      if (!img) return res();
      if (img.complete) return res();
      img.addEventListener('load', () => res(), { once: true });
      img.addEventListener('error', () => res(), { once: true });
      setTimeout(res, 1500);
    });
  }

  function play() {
    if (current) { current.finish(true); current.stopDrips(); }
    const overlay = getOverlay(), logo = document.getElementById('intro-logo');
    overlay.style.opacity = '1'; overlay.style.background = NAVY; if (logo) logo.style.visibility = 'visible';
    window.__introRunning = true;
    let scene = null, raf = 0, dripRaf = 0, done = false, t0 = null;
    const me = {
      finish(fast) {
        if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(failsafe);
        const ms = fast ? 180 : T_FADE / SPEED * 1000;
        overlay.style.transition = 'opacity ' + ms + 'ms ease-out'; overlay.style.opacity = '0';
        setTimeout(() => { if (scene) scene.destroy(); overlay.remove(); if (current === me) { current = null; window.__introRunning = false; } }, ms + 60);
        if (scene) {
          if (fast || t0 === null) scene.removeDrips();
          else {
            const dripTick = now => {
              const t = (now - t0) / 1000 * SPEED;
              scene.renderDrips(t);
              if (t < T_DRIP_END) dripRaf = requestAnimationFrame(dripTick); else scene.removeDrips();
            };
            dripRaf = requestAnimationFrame(dripTick);
          }
        }
      },
      seek(t) { // for testing: stop the clock and draw the moment t
        cancelAnimationFrame(raf); clearTimeout(failsafe);
        cancelAnimationFrame(dripRaf);
        if (scene) { scene.render(t); overlay.style.background = 'transparent'; if (logo) logo.style.visibility = 'hidden'; }
      }
    };
    current = me;
    const failsafe = setTimeout(() => me.finish(true), 9000);
    overlay.addEventListener('pointerdown', () => me.finish(true), { once: true });
    me.stopDrips = () => { cancelAnimationFrame(dripRaf); if (scene) scene.removeDrips(); };

    imageReady(logo).then(() => {
      if (done) return;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) { try { scene = createScene(overlay, logo); } catch (err) { console.warn('Intro animation unavailable:', err); scene = null; } }
      if (!scene) { setTimeout(() => me.finish(false), (ICON_HOLD + 0.3) * 1000); return; }
      let first = true;
      const tick = now => {
        if (done) return;
        if (t0 === null) t0 = now;
        const t = (now - t0) / 1000 * SPEED;
        scene.render(t);
        if (first) { first = false; overlay.style.background = 'transparent'; if (logo) logo.style.visibility = 'hidden'; }
        if (t >= T_END) { me.finish(false); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return me;
  }

  window.flapIntro = { play: play, get current() { return current; }, duration: (T_END + T_FADE) / SPEED };
  play();
})();
