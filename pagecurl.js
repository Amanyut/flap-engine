/* Amanyu's Flapendium – the page curl between flaps. */

/* ================= PAGE CURL =================
   Next / previous flap: the page curls like a soft book page, following the finger exactly
   (spine at the left edge; every page is a right-hand page). Swiping right brings the previous
   page back over the current one. Let go and it finishes or springs back, depending on how far
   and how fast it was moving. The paper rustle follows the finger's speed; the landing sound
   plays only when the page actually lands (or a softer one when it falls back).
   The back of each page is the underside of a skin flap – drawn once in the background and kept. */

// The back of the page: a ready-made picture of a skin flap's underside (drawn once on a computer from the
// design in "4 Design assets\Page curl underside"). To use another picture, replace this file or change the path.
const UNDERSIDE_IMAGE = 'icons/flap-underside.jpg';

(function () {
  const texURL = UNDERSIDE_IMAGE;
  let preloaded = false;
  // the picture is fetched quietly the first time a flap opens, so the first turn already shows it
  function prepareUnderside() { if (preloaded) return; preloaded = true; const im = new Image(); im.decoding = 'async'; im.src = texURL; }
  window.prepareUnderside = prepareUnderside;
  // phones with little memory get the plain, instant page change
  const lowMemory = !!(navigator.deviceMemory && navigator.deviceMemory <= 2);

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
    const bg = document.createElement('div'); bg.className = 'curl-bg'; bg.style.backgroundImage = 'url(' + texURL + ')';
    const vs = document.createElement('div'); vs.className = 'curl-vs';
    const edge = document.createElement('div'); edge.className = 'curl-edge';
    const logo = document.createElement('div'); logo.className = 'curl-logo'; logo.innerHTML = '<img src="icons/logo-96.png" alt="">Amanyu’s Flapendium';
    v.appendChild(bg); v.appendChild(vs); v.appendChild(edge); v.appendChild(logo); vw.appendChild(v);
    root.appendChild(leaf); root.appendChild(shd); root.appendChild(vw);
    body.after(root);
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
    try { return beginTurn(dir, y); }
    catch (err) { const g = G; G = null; try { if (g && g.el) g.el.root.remove(); if (g && g.dir > 0) renderFlapPage(g.cur); } catch (e2) {} try { SFX.curl.stop(); } catch (e3) {} return false; }
  }
  function beginTurn(dir, y) {
    const order = viewOrder(), idx = order.indexOf(flapPageName), target = order[idx + dir];
    if (idx < 0 || !target) return false;
    const body = document.getElementById('fp-body'), W = body.clientWidth, H = body.clientHeight;
    if (W < 50 || H < 50) return false;
    const cur = flapPageName, scroll = body.scrollTop, cy = y > H / 2 ? H : 0;
    G = { dir, cur, target, scroll, W, H, D: Math.hypot(W, H), C: [W, cy], v: 0, vx: 0, lastT: performance.now(), born: performance.now() };
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
    try { g.el.root.remove(); } catch (e) {}
    try { settleFlap(g, commit); } catch (e) {}
  }
  function settleFlap(g, commit) {
    const body = document.getElementById('fp-body');
    if (commit) {
      if (g.dir < 0) { renderFlapPage(g.target, -1); noSlide(); body.scrollTop = 0; }
      history.replaceState({ view: 'flap' }, '', flapHash(g.target));
      buzz(6); saveStateSoon();
    } else if (g.dir > 0) {
      renderFlapPage(g.cur); noSlide(); body.scrollTop = g.scroll;
    }
  }
  // a turn that somehow never finished (an interrupted touch) is put back after a few seconds
  function stale() { return G && !G.anim && !T && performance.now() - G.born > 3000; }
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
    if (lowMemory) return false;
    if (stale()) finish(false);
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
    // a new touch means any earlier one is over: a turn still hanging from it is put back at once
    if (G && !G.anim) abort();
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
      if (fancyOff() || lowMemory) { T.mode = 'flat'; T.dir = dir; return; }
      if (!begin(dir, T.ry)) { T.mode = 'edge'; T.dir = dir; return; }
      T.mode = 'curl'; T.bx = x; T.by = y;
    }
    if (T.mode === 'curl' && G && !G.anim) {
      if (e && e.cancelable) e.preventDefault();
      T.lx = x; T.ly = y;
      if (!T.raf) T.raf = requestAnimationFrame(() => {
        const t = T; if (!t) return; t.raf = 0;
        if (!G || G.anim) return;
        const base = G.dir > 0 ? [G.W, G.C[1]] : [-G.W, G.C[1]];
        track(constrain([base[0] + 2 * (t.lx - t.bx), base[1] + (t.ly - t.by)]), performance.now());
      });
    } else if (T.mode === 'flat' || T.mode === 'edge') { if (e && e.cancelable) e.preventDefault(); }
  }
  function endAt(x) {
    if (!T) return;
    const t = T; T = null;
    if (t.raf) cancelAnimationFrame(t.raf);
    if (t.mode === 'curl' && G && !G.anim) {
      const base = G.dir > 0 ? [G.W, G.C[1]] : [-G.W, G.C[1]];
      if (t.lx !== undefined) track(constrain([base[0] + 2 * (t.lx - t.bx), base[1] + (t.ly - t.by)]), performance.now());
      finish();
    }
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
