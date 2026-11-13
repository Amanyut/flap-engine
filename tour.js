/* Amanyu's Flapendium - interactive guide.
   Walks a new user through the app; on "Try it" steps the user does the action themselves and the guide moves on
   when it sees it done. Shown automatically once after the first login, and any time from Menu > Guide. */
(function () {
  'use strict';

  const DONE_KEY = 'flap_tour_done';
  const $ = sel => document.querySelector(sel);
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const sidebarOpen = () => $('.sidebar') && $('.sidebar').classList.contains('open');
  const pageOpen = () => $('#flap-page') && $('#flap-page').classList.contains('open');
  const matrixOpen = () => $('#matrix-dock') && $('#matrix-dock').classList.contains('open');
  const openSidebar = () => { if (!sidebarOpen()) toggleSidebarDrawer(); };
  const closeSidebar = () => { if (sidebarOpen()) closeSidebarDrawer(); };
  const mainScreen = () => {
    closeSidebar();
    if (pageOpen()) closeFlapPage();
    if (matrixOpen()) minimizeMatrix();
  };
  const flapCount = () => (typeof datasetMaster !== 'undefined' ? datasetMaster.filter(f => f.category !== 'System').length : 0);
  function firstUnticked() {
    return Array.from(document.querySelectorAll('#flap-grid-canvas [data-name]')).find(el => !selectedFlaps.has(el.dataset.name));
  }

  // ---------- the steps ----------
  // target: element to highlight (null = centred card). action: () => true once the user has done it.
  // free: the whole screen stays usable during the step (not only the highlighted element).
  let mem = {};
  const STEPS = [
    { center: true, icon: '📖', title: 'Welcome to Amanyu’s Flapendium',
      text: () => `Your ready reckoner of flaps in plastic and reconstructive surgery – always at hand.<br><br>This short guide shows you everything the app can do. On steps marked <b>Try it</b>, you do it yourself.`,
      prepare: mainScreen, startLabel: 'Start the guide' },

    { target: () => $('.hamburger-btn'), title: 'Open the Flap Chapters', tryIt: true,
      text: 'Tap <b>☰</b> to open the side panel, where the flaps are arranged by region.',
      prepare: () => { mainScreen(); }, action: sidebarOpen },

    { target: () => $('#chapter-menu'), title: 'Choose a region', tryIt: true,
      text: 'Each tile is a chapter. <b>All References</b> shows every flap and <b>Favourites</b> holds your starred ones.<br>Tap a region now – for example <b>Head &amp; Neck</b>.',
      prepare: openSidebar,
      onStart: () => {
        mem.tapped = false;
        $('#chapter-menu').addEventListener('click', e => { const t = e.target.closest('[data-cat]'); if (t && t.dataset.cat !== 'ALL' && t.dataset.cat !== 'FAVOURITES') mem.tapped = true; });
      },
      action: () => mem.tapped && !sidebarOpen() },

    { target: () => $('#subregion-dropdown'), title: 'Narrow it down',
      text: 'Pick a sub-region such as <b>Nose</b> or <b>Cheek</b> to see only those flaps – or leave it at <b>All Sub-Regions</b>.',
      prepare: closeSidebar },

    { target: () => $('#sort-dropdown'), title: 'Sort order',
      text: 'Keep the textbook order, or sort the flaps <b>A–Z</b> or <b>Z–A</b>.' },

    { target: () => $('#search-wrap'), title: 'Search anything',
      text: 'Type a flap’s name, an artery, a nerve, an author – even fragments such as <b>“rev sur”</b>.<br>Spelling slips are forgiven: <b>“latisimus”</b> still finds the latissimus flaps.' },

    { target: () => $('#view-toggle-btn'), title: 'Cards or List', tryIt: true,
      text: 'Switch between <b>Cards</b> and a numbered <b>List</b>, like a book’s contents page. Tap it to try.',
      onStart: () => { mem.view = viewMode; }, action: () => viewMode !== mem.view },

    { target: firstUnticked, title: 'Open a flap', tryIt: true,
      text: 'Tap any flap to open its own page.',
      prepare: () => { mainScreen(); const el = firstUnticked(); if (el) el.scrollIntoView({ block: 'center' }); },
      action: pageOpen },

    { target: () => $('#fp-tabs'), title: 'Jump to a section',
      text: 'These chips take you straight to a section – Introduction, Arterial Anatomy, Flap Markings and more. The one you are reading lights up as you scroll.' },

    { target: () => $('.fp-nav'), title: 'Next and previous flap',
      text: '<b>Swipe left or right</b> on the page – or use these buttons – to move through the flaps of the list you came from.' },

    { target: () => $('#fp-star .fav-btn'), title: 'Add to Favourites', tryIt: true,
      text: 'Tap <b>☆</b> to star this flap. Starred flaps are saved to your account on every device. Tap again any time to remove it.',
      onStart: () => { mem.favs = favouriteFlaps.size; }, action: () => favouriteFlaps.size !== mem.favs },

    { target: () => $('.fp-header button[aria-label="Share this flap"]'), title: 'Share a flap',
      text: 'Sends a link that opens straight to this flap – handy for WhatsApp groups and colleagues.' },

    { target: () => $('.fp-header .fp-icon-btn'), title: 'Back to the list', tryIt: true,
      text: 'Tap <b>‹</b> – or your phone’s Back button – to return to the list.',
      action: () => !pageOpen() },

    { target: () => $('#flap-grid-canvas .compare-toggle, #flap-grid-canvas .list-check'), title: 'Compare flaps', tryIt: true, free: true,
      text: 'Tick <b>Compare</b> on <b>two or more</b> flaps that you want to see side by side.',
      prepare: () => { mainScreen(); },
      action: () => selectedFlaps.size >= 2 },

    { target: () => $('#launch-matrix-btn'), title: 'Open the comparison', tryIt: true,
      text: 'Now tap <b>Compare Flaps</b>.<br><span class="tg-tip">Tip: tapping any <b>ticked</b> flap also opens the comparison, while an <b>unticked</b> flap opens its own page.</span>',
      action: matrixOpen },

    { target: () => $('#matrix-container'), title: 'Comparative Overview',
      text: 'Every section is lined up side by side. Scroll down to read on, and sideways when you compare more flaps than fit on the screen.' },

    { target: () => $('.dock-header button[onclick="minimizeMatrix()"]'), title: 'Keep it for later', tryIt: true,
      text: '<b>Minimise</b> keeps this comparison ready for later; <b>Close &amp; Clear</b> ends it and unticks the flaps. Tap <b>Minimise</b>.',
      action: () => !matrixOpen() },

    { target: () => $('#matrix-fab'), title: 'Back to your comparison',
      text: '<b>Show Comparison</b> brings it back at any time, from any screen.' },

    { target: () => $('.fav-tile'), title: 'Your Favourites',
      text: 'Everything you star is gathered here.',
      prepare: openSidebar },

    { target: () => $('.dm-tile'), title: 'Defect Mapper (beta)',
      text: 'Paint a defect on a 3D body, sized to your patient, and see which reconstructive options may reach it. A preview of what is to come.',
      prepare: openSidebar },

    { target: () => $('.text-size-ctl'), title: 'Text size',
      text: '<b>A−</b> and <b>A+</b> make the reading text smaller or larger – in cards, lists, flap pages and comparisons.',
      prepare: openSidebar },

    { target: () => $('.btn-sidebar[onclick="toggleTheme()"]'), title: 'Light or dark',
      text: 'Switch between the light and dark themes.',
      prepare: openSidebar },

    { target: () => $('.guide-item'), title: 'Need a reminder?',
      text: 'Replay this guide any time from <b>Guide</b>, here in the menu.',
      prepare: openSidebar },

    { center: true, icon: '🎉', title: 'You’re all set',
      text: () => 'Enjoy exploring the flaps.' + (selectedFlaps.size ? '<br><br><span class="tg-tip">Your practice comparison is still waiting under <b>Show Comparison</b> – open it and tap <b>Close &amp; Clear</b> when you no longer need it.</span>' : ''),
      prepare: closeSidebar, startLabel: 'Finish' }
  ];

  // ---------- drawing ----------
  let root, spot, card, blockers, idx = -1, raf = 0, active = false, advanceTimer = 0, ready = false;

  function build() {
    if (root) return;
    root = document.createElement('div'); root.className = 'tg-root';
    spot = document.createElement('div'); spot.className = 'tg-spot';
    blockers = [0, 1, 2, 3].map(() => { const b = document.createElement('div'); b.className = 'tg-block'; root.appendChild(b); return b; });
    card = document.createElement('div'); card.className = 'tg-card'; card.setAttribute('role', 'dialog');
    root.appendChild(spot); root.appendChild(card);
    document.body.appendChild(root);
  }

  function place() {
    if (!active) return;
    const s = STEPS[idx];
    const el = s.target ? s.target() : null;
    const W = window.innerWidth, H = window.innerHeight;
    let r = null;
    if (el && visible(el)) {
      const b = el.getBoundingClientRect(), pad = 6;
      r = { left: Math.max(4, b.left - pad), top: Math.max(4, b.top - pad), right: Math.min(W - 4, b.right + pad), bottom: Math.min(H - 4, b.bottom + pad) };
    }
    root.classList.toggle('tg-centered', !r);
    if (r) {
      Object.assign(spot.style, { left: r.left + 'px', top: r.top + 'px', width: (r.right - r.left) + 'px', height: (r.bottom - r.top) + 'px' });
      // Try-it steps: everything but the highlighted element is blocked (or nothing, on "free" steps).
      // Reading steps: the whole screen is blocked, only the message card responds.
      let rects;
      if (!s.tryIt) rects = [[0, 0, W, H]];
      else if (s.free) rects = [];
      else rects = [[0, 0, W, r.top], [0, r.bottom, W, H - r.bottom], [0, r.top, r.left, r.bottom - r.top], [r.right, r.top, W - r.right, r.bottom - r.top]];
      blockers.forEach((b, i) => {
        const q = rects[i];
        if (!q) { b.style.display = 'none'; return; }
        b.style.display = 'block';
        Object.assign(b.style, { left: q[0] + 'px', top: q[1] + 'px', width: Math.max(0, q[2]) + 'px', height: Math.max(0, q[3]) + 'px' });
      });
      // the message card: below the element if there is room, otherwise above
      const cw = Math.min(360, W - 24), ch = card.offsetHeight || 200;
      let top = r.bottom + 14, below = true;
      if (top + ch > H - 10) { top = r.top - ch - 14; below = false; }
      if (top < 10) { top = Math.max(10, H - ch - 12); below = null; }
      let left = (r.left + r.right) / 2 - cw / 2;
      left = Math.max(12, Math.min(W - cw - 12, left));
      Object.assign(card.style, { width: cw + 'px', left: left + 'px', top: top + 'px' });
      const ax = Math.max(18, Math.min(cw - 18, (r.left + r.right) / 2 - left));
      card.style.setProperty('--ax', ax + 'px');
      card.dataset.arrow = below === true ? 'up' : below === false ? 'down' : 'none';
    } else {
      blockers.forEach((b, i) => { b.style.display = i ? 'none' : 'block'; Object.assign(b.style, { left: '0px', top: '0px', width: W + 'px', height: H + 'px' }); });
      const cw = Math.min(380, W - 24);
      Object.assign(card.style, { width: cw + 'px', left: (W - cw) / 2 + 'px', top: Math.max(12, (H - (card.offsetHeight || 260)) / 2) + 'px' });
      card.dataset.arrow = 'none';
    }
    // done yet?
    if (ready && s.action && !advanceTimer && s.action()) {
      card.classList.add('tg-done');
      advanceTimer = setTimeout(() => { advanceTimer = 0; go(idx + 1); }, 650);
    }
    raf = requestAnimationFrame(place);
  }

  function render() {
    const s = STEPS[idx];
    const text = typeof s.text === 'function' ? s.text() : s.text;
    const isFirst = idx === 0, isLast = idx === STEPS.length - 1;
    const n = STEPS.length - 2; // numbered steps (welcome and finish are not counted)
    const pct = Math.round(Math.max(0, Math.min(1, (idx) / (STEPS.length - 1))) * 100);
    card.className = 'tg-card' + (s.center ? ' tg-card-center' : '') + (s.tryIt ? ' tg-try' : '');
    card.innerHTML = `
      ${s.center ? `<div class="tg-icon">${s.icon || ''}</div>` : `<div class="tg-step"><span>Step ${idx} of ${n}</span>${s.tryIt ? '<span class="tg-badge">Try it</span>' : ''}</div>`}
      <div class="tg-title">${s.title}</div>
      <div class="tg-text">${text}</div>
      ${s.center ? '' : `<div class="tg-bar"><i style="width:${pct}%"></i></div>`}
      <div class="tg-actions">
        ${isFirst ? '<button class="tg-btn tg-ghost" data-act="end">Skip for now</button>' : (isLast ? '' : '<button class="tg-btn tg-ghost" data-act="back">Back</button>')}
        <span class="tg-spacer"></span>
        ${s.tryIt ? '<button class="tg-btn tg-ghost" data-act="next">Skip step</button>' : `<button class="tg-btn tg-gold" data-act="next">${s.startLabel || 'Next'}</button>`}
      </div>
      ${isFirst || isLast ? '' : '<button class="tg-x" data-act="end" aria-label="End the guide">✕</button>'}
      ${isFirst ? '<div class="tg-foot">You can replay it any time from Menu › Guide.</div>' : ''}`;
    card.querySelectorAll('[data-act]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const a = b.dataset.act;
      if (a === 'next') go(idx + 1); else if (a === 'back') go(idx - 1, -1); else end();
    });
    card.classList.remove('tg-in'); void card.offsetWidth; card.classList.add('tg-in');
  }

  function go(i, dir) {
    clearTimeout(advanceTimer); advanceTimer = 0; ready = false;
    if (i >= STEPS.length) { end(true); return; }
    if (i < 0) i = 0;
    idx = i;
    const s = STEPS[idx];
    if (s.prepare) { try { s.prepare(); } catch (e) {} }
    mem = Object.assign({}, mem);
    // give drawers and pages a moment to slide into place, then show the step (or skip it if its element is missing)
    setTimeout(() => {
      if (!active || idx !== i) return;
      const el = s.target ? s.target() : null;
      if (s.target && !visible(el)) { go(idx + (dir || 1), dir); return; }
      if (s.onStart) { try { s.onStart(); } catch (e) {} }
      if (el && el.scrollIntoView) {
        const b = el.getBoundingClientRect();
        if (b.top < 60 || b.bottom > window.innerHeight - 60) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      render();
      ready = true;
    }, s.prepare ? 380 : 60);
  }

  function start() {
    build();
    if (active) return;
    active = true; mem = {};
    root.classList.add('tg-on');
    go(0);
    raf = requestAnimationFrame(place);
  }

  function end(finished) {
    active = false;
    cancelAnimationFrame(raf); clearTimeout(advanceTimer); advanceTimer = 0;
    if (root) root.classList.remove('tg-on');
    try { localStorage.setItem(DONE_KEY, '1'); } catch (e) {}
    if (finished) closeSidebar();
  }

  // First login on this device: start once the opening animation has finished
  let firstTried = false;
  function maybeStartFirstTime() {
    if (firstTried) return; firstTried = true;
    let done = false; try { done = localStorage.getItem(DONE_KEY) === '1'; } catch (e) {}
    if (done) return;
    const wait = () => { if (window.__introRunning) setTimeout(wait, 300); else setTimeout(start, 700); };
    wait();
  }

  window.addEventListener('resize', () => { if (active) cancelAnimationFrame(raf), raf = requestAnimationFrame(place); });
  window.flapTour = { start: start, end: end, maybeStartFirstTime: maybeStartFirstTime };

  // ---------- look ----------
  const css = `
  .tg-root { position: fixed; inset: 0; z-index: 2800; pointer-events: none; display: none; }
  .tg-root.tg-on { display: block; }
  .tg-block { position: fixed; pointer-events: auto; background: transparent; }
  .tg-spot { position: fixed; border-radius: 14px; pointer-events: none; box-shadow: 0 0 0 9999px rgba(2, 6, 16, 0.72); outline: 2px solid rgba(245, 196, 81, 0.95); outline-offset: 0; transition: left .35s cubic-bezier(.2,.8,.2,1), top .35s cubic-bezier(.2,.8,.2,1), width .35s cubic-bezier(.2,.8,.2,1), height .35s cubic-bezier(.2,.8,.2,1); }
  .tg-spot::after { content: ''; position: absolute; inset: -6px; border-radius: 18px; border: 2px solid rgba(245, 196, 81, 0.6); animation: tgPulse 1.6s ease-out infinite; }
  .tg-root.tg-centered .tg-spot { left: 50% !important; top: 50% !important; width: 0 !important; height: 0 !important; outline: none; }
  .tg-root.tg-centered .tg-spot::after { display: none; }
  @keyframes tgPulse { 0% { opacity: .9; transform: scale(1); } 100% { opacity: 0; transform: scale(1.12); } }
  .tg-card { position: fixed; pointer-events: auto; box-sizing: border-box; padding: 16px 18px 14px; border-radius: 18px; color: #e8eef9;
    background: linear-gradient(160deg, rgba(10, 38, 86, 0.97), rgba(4, 21, 52, 0.98)); border: 1px solid rgba(245, 196, 81, 0.45);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06); font-family: var(--ui-font, sans-serif);
    transition: left .35s cubic-bezier(.2,.8,.2,1), top .35s cubic-bezier(.2,.8,.2,1); }
  .tg-card.tg-in { animation: tgIn .32s cubic-bezier(.2,.8,.2,1); }
  @keyframes tgIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
  .tg-card::before { content: ''; position: absolute; left: calc(var(--ax, 50%) - 9px); width: 16px; height: 16px; transform: rotate(45deg); background: rgba(10, 38, 86, 0.97); border: 1px solid rgba(245, 196, 81, 0.45); display: none; }
  .tg-card[data-arrow="up"]::before { display: block; top: -9px; border-right: none; border-bottom: none; }
  .tg-card[data-arrow="down"]::before { display: block; bottom: -9px; border-left: none; border-top: none; background: rgba(4, 21, 52, 0.98); }
  .tg-step { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 26px 6px 0; font-size: .74rem; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: #f5c451; }
  .tg-badge { padding: 3px 9px; border-radius: 999px; background: #f5c451; color: #042551; letter-spacing: .5px; animation: tgGlow 1.6s ease-in-out infinite; }
  @keyframes tgGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 196, 81, .55); } 50% { box-shadow: 0 0 0 6px rgba(245, 196, 81, 0); } }
  .tg-title { font-family: var(--brand-font, serif); font-weight: 700; font-size: 1.18rem; line-height: 1.25; color: #ffffff; margin-bottom: 6px; }
  .tg-card-center .tg-title { font-size: 1.4rem; text-align: center; }
  .tg-text { font-size: .98rem; line-height: 1.55; color: #d6e0f0; }
  .tg-card-center .tg-text { text-align: center; }
  .tg-text b { color: #ffffff; }
  .tg-tip { display: block; margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: rgba(245, 196, 81, 0.1); border-left: 3px solid #f5c451; font-size: .9rem; color: #e9eef7; }
  .tg-icon { font-size: 2.4rem; text-align: center; margin: 2px 0 6px; }
  .tg-bar { height: 3px; border-radius: 3px; background: rgba(255, 255, 255, 0.12); margin: 12px 0 2px; overflow: hidden; }
  .tg-bar i { display: block; height: 100%; background: linear-gradient(90deg, #f5c451, #fde68a); border-radius: 3px; transition: width .35s; }
  .tg-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .tg-spacer { flex: 1; }
  .tg-btn { border-radius: 10px; padding: 10px 16px; font-weight: 700; font-size: .95rem; cursor: pointer; font-family: inherit; }
  .tg-gold { border: none; background: linear-gradient(180deg, #fbd774, #f5c451); color: #042551; box-shadow: 0 4px 14px rgba(245, 196, 81, .3); }
  .tg-ghost { border: 1px solid rgba(255, 255, 255, 0.22); background: transparent; color: #d6e0f0; }
  .tg-x { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; cursor: pointer; font-size: .9rem; }
  .tg-foot { margin-top: 10px; text-align: center; font-size: .8rem; color: #93a4bf; }
  .tg-card.tg-done { border-color: #4ade80; box-shadow: 0 0 0 3px rgba(74, 222, 128, .35), 0 18px 50px rgba(0, 0, 0, .55); }
  .tg-card.tg-done .tg-badge { background: #4ade80; }
  .tg-card.tg-done .tg-badge::after { content: ' ✓'; }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
})();
