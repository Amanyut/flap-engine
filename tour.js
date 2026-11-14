/* Amanyu's Flapendium - interactive guide.
   Walks a new user through the app; on "Try it" steps the user does the action themselves and the guide moves on
   when it sees it done. Shown automatically once after the first login, and any time from Menu > Guide. */
(function () {
  'use strict';

  const DONE_KEY = 'flap_tour_done';
  const $ = sel => document.querySelector(sel);
  const visible = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) || getComputedStyle(el).visibility === 'hidden') return false;
    return r.right > 0 && r.left < window.innerWidth;   // a panel slid out sideways is not visible (below the fold is fine: it is scrolled into view)
  };
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
  // when: the step is shown only if this is true (otherwise it is passed over).
  // wait: how long (ms) to wait for the step's element to appear before passing it over.
  // group 'dm': the optional Defect Mapper tour. choice: offers that tour.
  let mem = {};
  const dmOpen = () => !!(window.defectMapper && window.defectMapper.isOpen && window.defectMapper.isOpen());
  const dmSheetOpen = () => !!(window.defectMapper && window.defectMapper.sheetOpen && window.defectMapper.sheetOpen());
  const dm = sel => dmOpen() ? document.querySelector('.dm-root ' + sel) : null;
  const peekShown = () => !!document.querySelector('.peek-backdrop');
  function firstToggle() {
    const el = firstUnticked();
    return el ? el.querySelector('.compare-toggle, .list-check') : null;
  }
  const showFirst = () => { const el = firstUnticked(); if (el) el.scrollIntoView({ block: 'center' }); };

  const STEPS = [
    { center: true, icon: '📖', title: 'Welcome to Amanyu’s Flapendium',
      text: () => `Your ready reckoner of flaps in plastic and reconstructive surgery – always at hand.<br><br>This short guide shows you everything the app can do. On steps marked <b>Try it</b>, you do it yourself.`,
      prepare: mainScreen, startLabel: 'Start the guide' },

    { target: () => $('.hamburger-btn'), title: 'Open the Flap Chapters', tryIt: true,
      text: 'Tap <b>☰</b> to open the side panel, where the flaps are arranged by region.',
      prepare: () => { mainScreen(); }, action: sidebarOpen },

    { target: () => $('#chapter-menu'), title: 'Choose a region', tryIt: true,
      text: 'Each tile is a chapter. <b>All References</b> shows every flap, with the ones you viewed recently at the top.<br>Tap a region now – for example <b>Head &amp; Neck</b>.',
      prepare: openSidebar,
      onStart: () => {
        mem.tapped = false;
        $('#chapter-menu').addEventListener('click', e => { const t = e.target.closest('[data-cat]'); if (t && t.dataset.cat !== 'ALL' && t.dataset.cat !== 'FAVOURITES') mem.tapped = true; });
      },
      action: () => mem.tapped && !sidebarOpen() },

    { target: () => $('#sub-chips'), title: 'Narrow it down',
      text: 'Swipe along these chips and tap a sub-region such as <b>Nose</b> or <b>Cheek</b> to see only those flaps – or keep <b>All</b>.',
      prepare: closeSidebar },

    { target: () => $('#sort-btn'), title: 'Sort order',
      text: 'Tap <b>⇅</b> to keep the textbook order, or sort the flaps <b>A–Z</b> or <b>Z–A</b>. In alphabetical order, a letter strip appears at the right side – slide along it to jump to any letter.' },

    { target: () => $('#search-wrap'), title: 'Search anything',
      text: 'Type a flap’s name, an artery, a nerve, an author – even fragments such as <b>“rev sur”</b>. The words you type are highlighted in the results, and your <b>recent searches</b> appear when you tap the empty box.<br>Spelling slips are forgiven, and a <b>Did you mean…?</b> button offers the right spelling.' },

    { target: () => $('#view-toggle-btn'), title: 'Cards or List', tryIt: true,
      text: 'This button switches between <b>Cards</b> and a numbered <b>List</b>, like a book’s contents page. Tap it to try.',
      onStart: () => { mem.view = viewMode; }, action: () => viewMode !== mem.view },

    { target: firstUnticked, title: 'Press and hold to peek', tryIt: true,
      text: 'Press and <b>hold</b> this flap for a quick preview of its key points.<br>Then <b>slide your finger up</b> to open the flap, or simply <b>let go</b> to close the preview.',
      prepare: () => { mainScreen(); showFirst(); },
      onStart: () => { mem.peeked = false; },
      action: () => { if (peekShown()) mem.peeked = true; return mem.peeked && !peekShown(); } },

    { target: firstUnticked, title: 'Double-tap to favourite', tryIt: true,
      text: '<b>Double-tap</b> this flap to add it to your <b>Favourites</b> – a gold star bursts over it.<br><span class="tg-tip">A single tap still opens the flap.</span>',
      prepare: () => { if (!pageOpen()) { mainScreen(); showFirst(); } },
      onStart: () => { mem.favDt = favouriteFlaps.size; },
      action: () => favouriteFlaps.size > mem.favDt },

    { target: firstUnticked, title: 'Open a flap', tryIt: true,
      text: 'A normal <b>tap</b> on any flap opens its own page.',
      prepare: () => { if (!pageOpen()) { mainScreen(); showFirst(); } },
      action: pageOpen },

    { target: () => $('#fp-tabs'), title: 'Jump to a section',
      text: 'These chips take you straight to a section – Introduction, Arterial Anatomy, Flap Markings and more. The one you are reading lights up as you scroll, and the thin gold line beneath shows how far you have read.<br><span class="tg-tip">When a flap mentions another flap, its name is a <b>link</b> – tap it to jump there, and Back returns you.</span>' },

    { target: () => $('.fp-nav'), title: 'Next and previous flap',
      text: '<b>Swipe left or right</b> on the page – or use these buttons – to move through the flaps of the list you came from.<br><span class="tg-tip">When you have zoomed in with two fingers, a sideways swipe simply scrolls the text.</span>' },

    { target: () => $('#fp-star .fav-btn'), title: 'Add to Favourites', tryIt: true,
      text: 'The star on a flap’s page does the same: tap <b>☆</b> to add it to <b>Favourites</b>, or <b>★</b> to remove it (an <b>Undo</b> button appears for a moment). Favourites are saved to your account on every device.',
      onStart: () => { mem.favs = favouriteFlaps.size; }, action: () => favouriteFlaps.size !== mem.favs },

    { target: () => $('.fp-header button[aria-label="Share this flap"]'), title: 'Share a flap',
      text: 'Sends a link that opens straight to this flap – handy for WhatsApp groups and colleagues.' },

    { target: () => $('#fp-ask'), title: 'Ask Amanyu',
      text: 'You have personal access to <b>Ask Amanyu</b>. Type your question about this flap and send it straight to Amanyu on WhatsApp.' },

    { target: () => $('.fp-header .fp-icon-btn'), title: 'Back to the list', tryIt: true,
      text: 'Tap <b>‹</b> – or your phone’s Back button – to return to the list.',
      action: () => !pageOpen() },

    { target: firstToggle, title: 'Compare flaps', tryIt: true,
      text: 'To see flaps side by side, tick <b>Compare</b> on this flap.',
      prepare: () => { mainScreen(); showFirst(); },
      action: () => selectedFlaps.size >= 1 },

    { target: firstToggle, title: 'And one more', tryIt: true,
      text: 'Now tick <b>Compare</b> on a second flap – here, or any other.',
      action: () => selectedFlaps.size >= 2 },

    { target: () => $('#ct-stack'), title: 'Your deck of selected flaps', tryIt: true,
      text: 'Every flap you tick joins this little <b>deck of cards</b> at the bottom-left, so you always see how many you have picked. <b>Tap the deck</b> to fan the cards out.',
      when: () => selectedFlaps.size >= 1,
      action: () => !!document.querySelector('#ct-fan.open') },

    { target: () => $('#ct-fan.open') || $('#cmp-tray'), title: 'Check before you compare',
      text: 'Here you can see exactly which flaps are lined up. Tap <b>✕</b> to drop one you picked by mistake, or tap a card to read that flap <b>full screen</b> – your selection stays as it is.<br><span class="tg-tip"><b>Clear</b> in the tray unticks them all at once.</span>',
      when: () => selectedFlaps.size >= 1 },

    { target: () => $('#launch-matrix-btn'), title: 'Open the comparison', tryIt: true,
      text: 'Now tap <b>Compare</b>.<br><span class="tg-tip">Tip: tapping any <b>ticked</b> flap also opens the comparison, while an <b>unticked</b> flap opens its own page.</span>',
      when: () => selectedFlaps.size >= 2, action: matrixOpen },

    { target: () => $('#matrix-container'), title: 'Comparative Overview',
      text: 'Every section is lined up side by side. Scroll down to read on, and sideways when you compare more flaps than fit on the screen.',
      when: matrixOpen },

    { target: () => $('.matrix-table th .th-tools'), title: 'Arrange and expand',
      text: '<b>‹</b> and <b>›</b> move this column left or right. <b>📌</b> pins it at the left while the others scroll.<br><b>⤢</b> – or tapping the flap’s name – opens it <b>full screen</b>; swipe there to move between the compared flaps, and <b>Back</b> returns you to this comparison.',
      when: matrixOpen },

    { target: () => $('.dock-header button[onclick="minimizeMatrix()"]'), title: 'Keep it for later', tryIt: true,
      text: '<b>Minimise</b> keeps this comparison ready for later; <b>Close &amp; Clear</b> ends it and unticks the flaps. Tap <b>Minimise</b>.',
      when: matrixOpen, action: () => !matrixOpen() },

    { target: () => $('#launch-matrix-btn'), title: 'Back to your comparison',
      text: 'Your selection waits in the tray – tap <b>Compare</b> to bring the comparison back at any time.',
      when: () => !matrixOpen() && selectedFlaps.size > 0 },

    { target: () => $('#select-all-btn'), title: 'Select everything at once', tryIt: true,
      text: 'Tap <b>☑</b> to tick <b>every flap on this screen</b> for comparison – the button lights up. Then tap it <b>again</b> to untick just those, keeping any flaps you had picked yourself.',
      onStart: () => { mem.selOn = false; },
      action: () => { const b = $('#select-all-btn'); if (b && b.classList.contains('on')) mem.selOn = true; return !!(mem.selOn && b && !b.classList.contains('on')); } },

    { target: () => $('.workspace'), title: 'Pull down to refresh',
      text: 'At the top of any list, <b>pull down</b> to fetch the newest flaps – watch the scalpel spin.<br>After a long scroll, the round <b>↑</b> button takes you back to the top.',
      prepare: mainScreen },

    { target: () => $('.fav-tile'), title: 'Your Favourites',
      text: 'Everything you star is gathered here.',
      prepare: openSidebar },

    { target: () => $('.text-size-ctl'), title: 'Text size',
      text: '<b>A−</b> and <b>A+</b> make the reading text smaller or larger – in cards, lists, flap pages and comparisons.',
      prepare: openSidebar },

    { target: () => $('.btn-sidebar[onclick^="toggleTheme"]'), title: 'Three themes',
      text: 'Each tap of <b>Theme</b> moves to the next look: <b>light</b>, <b>dark</b> and a bold <b>yellow</b>.',
      prepare: openSidebar },

    { target: () => $('#sound-btn'), title: 'Sounds',
      text: 'The app plays a few soft sounds – when a flap opens, cards are dealt, or the connection drops. Tap the speaker <b>🔊</b> to mute them – it changes to <b>🔇</b> – and tap it again to turn them back on.',
      prepare: openSidebar },

    { target: () => $('#display-user-name'), title: 'Your details',
      text: 'Tap your name to change it, or to add or change your <b>birthday</b>.',
      prepare: openSidebar },

    { target: () => $('.guide-item'), title: 'Need a reminder?',
      text: 'Replay this guide any time from <b>Guide</b>, here in the menu.',
      prepare: openSidebar },

    { target: () => $('.dm-tile'), title: 'Defect Mapper (beta)', choice: true,
      text: 'Paint a defect on a 3D body, sized to your patient, and see which reconstructive options may reach it.<br><br>Would you like a short tour of the <b>Defect Mapper</b>?',
      prepare: () => { if (dmOpen()) window.defectMapper.close(); openSidebar(); } },

    // ----- optional Defect Mapper tour -----
    { group: 'dm', target: () => dm('.dm-modal.show .dm-mcard'), title: 'A note before you begin', tryIt: true, makeRoom: true,
      text: 'Scroll through the note below and read it, then tap <b>I understand</b> at its end.',
      when: dmOpen, wait: 4000, action: () => !dm('.dm-modal.show') },

    { group: 'dm', target: () => dm('.dm-patient'), title: 'Your patient',
      text: 'Choose <b>Male</b> or <b>Female</b> and enter the <b>height</b> and <b>weight</b>. The body is reshaped to match, so the size of the defect in cm² is true to life.',
      when: dmOpen, wait: 8000 },

    { group: 'dm', target: () => dm('.dm-stage'), title: 'Turn the body',
      text: '<b>One finger</b> rotates the body. <b>Two fingers</b> move it and zoom in or out.',
      when: dmOpen, wait: 8000 },

    { group: 'dm', target: () => dm('[data-a="view"]'), title: 'Reset the view',
      text: 'Lost your way? <b>⟲</b> brings the body back to the starting view.',
      when: dmOpen },

    { group: 'dm', target: () => dm('[data-tool="brush"]'), title: 'Pick the brush', tryIt: true,
      text: 'Tap <b>Paint</b>.',
      when: dmOpen, action: () => { const b = dm('[data-tool="brush"]'); return !!(b && b.classList.contains('on')); } },

    { group: 'dm', target: () => dm('.dm-stage'), title: 'Paint the defect', tryIt: true,
      text: 'Draw the defect on the body with <b>one finger</b>. While painting, the <b>circle</b> at the side rotates the body and two fingers still move and zoom.<br><span class="tg-tip">A defect must be one continuous area.</span>',
      when: dmOpen, action: () => { const b = dm('[data-a="find"]'); return !!(b && !b.disabled); } },

    { group: 'dm', target: () => dm('.dm-tools'), title: 'Fine-tune it',
      text: 'The slider sets the <b>brush size</b>. <b>Erase</b> trims the edge, <b>↶</b> undoes the last stroke and <b>🗑</b> clears the defect.',
      when: dmOpen },

    { group: 'dm', target: () => dm('.dm-result'), title: 'Find the options', tryIt: true,
      text: 'The defect’s <b>area</b> and <b>size</b> appear here. Tap <b>Find flaps</b>.',
      when: dmOpen, action: dmSheetOpen },

    { group: 'dm', target: () => dm('.dm-sheet'), title: 'The reconstructive ladder',
      text: 'The options follow the ladder: <b>direct closure</b>, <b>skin graft</b>, <b>local flaps</b>, named <b>regional flaps</b> and <b>free flaps</b> – with the size each one usually covers. Tap a flap’s name to open its page.<br><span class="tg-tip">This is a beta and a rough guide – always judge the defect and the patient yourself.</span>',
      when: dmSheetOpen },

    { group: 'dm', target: () => dm('.dm-head [data-a="close"]'), title: 'Leave the Defect Mapper', tryIt: true,
      text: 'Tap <b>‹</b> – or your phone’s Back button – to return to the flaps.',
      prepare: () => { if (dmSheetOpen()) window.defectMapper.closeSheet(); },
      when: dmOpen, action: () => !dmOpen() },

    { center: true, icon: '🎉', title: 'You’re all set',
      text: () => 'Enjoy exploring the flaps.<br><br><span class="tg-tip">Notes from Amanyu appear at the top of <b>All References</b> from time to time.</span>' + (selectedFlaps.size ? '<span class="tg-tip">Your practice comparison is still waiting under <b>Show Comparison</b> – open it and tap <b>Close &amp; Clear</b> when you no longer need it.</span>' : ''),
      prepare: closeSidebar, startLabel: 'Finish' }
  ];
  // The screen each step needs. If the user ends up somewhere else (a stray tap, the phone's Back button,
  // going Back or skipping in the guide), the guide quietly returns to that screen.
  // A new step only needs an entry here (or its own `screen`) to be protected the same way.
  const SCREEN_OF = {
    'Welcome to Amanyu’s Flapendium': 'list', 'Open the Flap Chapters': 'list', 'Choose a region': 'menu', 'Narrow it down': 'list',
    'Sort order': 'list', 'Search anything': 'list', 'Cards or List': 'list', 'Press and hold to peek': 'list', 'Double-tap to favourite': 'list',
    'Open a flap': 'list', 'Jump to a section': 'flap', 'Next and previous flap': 'flap', 'Add to Favourites': 'flap', 'Share a flap': 'flap',
    'Ask Amanyu': 'flap', 'Back to the list': 'flap', 'Compare flaps': 'list', 'And one more': 'list', 'Your deck of selected flaps': 'list',
    'Check before you compare': 'list', 'Open the comparison': 'list', 'Comparative Overview': 'matrix', 'Arrange and expand': 'matrix',
    'Keep it for later': 'matrix', 'Back to your comparison': 'list', 'Select everything at once': 'list', 'Pull down to refresh': 'list',
    'Your Favourites': 'menu', 'Text size': 'menu', 'Three themes': 'menu', 'Sounds': 'menu', 'Your details': 'menu', 'Need a reminder?': 'menu',
    'Defect Mapper (beta)': 'menu', 'You’re all set': 'any'
  };
  const HINT_OF = {
    'Double-tap to favourite': 'That single tap opened the flap. Try <b>two quick taps</b> on the same flap instead.',
    'Press and hold to peek': 'That tap opened the flap. This time keep your finger <b>pressed down</b> for a moment.',
    'Compare flaps': 'That opened the flap. Tick the small <b>Compare</b> box on the card instead.',
    'And one more': 'That opened the flap. Tick the small <b>Compare</b> box on another card instead.'
  };
  const FINAL = STEPS.length - 1;
  const MAIN = STEPS.filter(s => !s.center && s.group !== 'dm');
  const DMSTEPS = STEPS.filter(s => s.group === 'dm');

  // ---------- keeping the guide on track ----------
  const OVERLAYS = '#flap-page, #matrix-dock, .sidebar, .sidebar-overlay, .dm-root';
  function currentScreen() { return dmOpen() ? 'dm' : pageOpen() ? 'flap' : matrixOpen() ? 'matrix' : sidebarOpen() ? 'menu' : 'list'; }
  function stepScreen(s) { return s.screen || (s.group === 'dm' ? 'dm' : SCREEN_OF[s.title]) || 'any'; }
  function ensureScreen(sc) {
    if (!sc || sc === 'any' || currentScreen() === sc) return;
    if (sc !== 'dm' && dmOpen()) window.defectMapper.close();
    if (sc !== 'flap' && pageOpen()) closeFlapPage();
    if (sc !== 'matrix' && matrixOpen()) minimizeMatrix();
    if (sc === 'menu') { openSidebar(); return; }
    closeSidebar();
    if (sc === 'flap' && !pageOpen()) { const el = firstUnticked(); if (el) openFlapPage(el.dataset.name); }
    else if (sc === 'matrix' && !matrixOpen() && selectedFlaps.size) openMatrix();
    else if (sc === 'dm' && !dmOpen() && typeof openDefectMapper === 'function') openDefectMapper();
  }
  // is the step's element hidden behind another screen (a flap page, the comparison, the menu)?
  function occluded(el) {
    if (!el || !document.elementsFromPoint) return false;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1), y = Math.min(Math.max(r.top + Math.min(r.height / 2, 40), 1), window.innerHeight - 1);
    const top = document.elementsFromPoint(x, y).find(n => !n.closest('.tg-root, .toast, .net-island, .net-traveller, .greet-pill, .tile-fly, .peek-backdrop, .tile-ripple'));
    if (!top) return false;
    const ov = top.closest(OVERLAYS);
    return !!ov && !ov.contains(el) && !el.contains(ov);
  }
  function recover(s) {
    mem.recoverAt = Date.now(); mem.offSince = 0;
    if (window.sfx) window.sfx('oops');
    ensureScreen(stepScreen(s));
    if (s.prepare && stepScreen(s) === 'list') { try { s.prepare(); } catch (e) {} }
    const box = card && card.querySelector('.tg-text');
    if (box) {
      let n = card.querySelector('.tg-oops');
      if (!n) { n = document.createElement('div'); n.className = 'tg-oops'; box.parentNode.insertBefore(n, box); }
      n.innerHTML = '↺ ' + (HINT_OF[s.title] || 'Back on track – the guide brought you back to this step.');
      n.classList.remove('tg-oops-in'); void n.offsetWidth; n.classList.add('tg-oops-in');
    }
    if (typeof buzz === 'function') buzz([8, 40, 8]);
  }

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
    const room = !!s.makeRoom;
    document.documentElement.classList.toggle('tg-room', room);
    if (root) root.classList.toggle('tg-calm', room);   // no ripple over text that is being read
    if (room) document.documentElement.style.setProperty('--tg-room', ((card && card.offsetHeight) || 180) + 26 + 'px');
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
      spot.style.setProperty('--rmin', Math.min(r.right - r.left, r.bottom - r.top) + 'px');
      spot.style.setProperty('--rw', (r.right - r.left) + 'px');
      spot.style.setProperty('--rh', (r.bottom - r.top) + 'px');
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
    // gone somewhere else? (only while the step is waiting, and not straight after a correction)
    if (ready && !advanceTimer && !(s.action && s.action()) && Date.now() - (mem.recoverAt || 0) > 900) {
      const want = stepScreen(s);
      const off = (want !== 'any' && currentScreen() !== want && !(s.center && want === 'list')) || (el && occluded(el));
      if (off) { if (!mem.offSince) mem.offSince = Date.now(); else if (Date.now() - mem.offSince > 450) recover(s); }
      else mem.offSince = 0;
    }
    // done yet?
    if (ready && s.action && !advanceTimer && s.action()) {
      card.classList.add('tg-done'); if (window.sfx) window.sfx('done');
      advanceTimer = setTimeout(() => { advanceTimer = 0; go(idx + 1); }, 650);
    }
    raf = requestAnimationFrame(place);
  }

  function render() {
    const s = STEPS[idx];
    const text = typeof s.text === 'function' ? s.text() : s.text;
    const isFirst = idx === 0, isLast = idx === STEPS.length - 1;
    const list = s.group === 'dm' ? DMSTEPS : MAIN;
    const k = list.indexOf(s) + 1, n = list.length;
    const label = s.group === 'dm' ? `Defect Mapper · ${k} of ${n}` : `Step ${k} of ${n}`;
    const pct = Math.round(Math.max(0, Math.min(1, k / n)) * 100);
    card.className = 'tg-card' + (s.center ? ' tg-card-center' : '') + (s.tryIt ? ' tg-try' : (s.center ? '' : ' tg-read')) + (s.choice ? ' tg-choice' : '');
    root.classList.toggle('tg-tryon', !!s.tryIt);
    card.innerHTML = `
      ${s.center ? `<div class="tg-icon">${s.icon || ''}</div>` : `<div class="tg-step"><span>${label}</span>${s.tryIt ? '<span class="tg-badge tg-badge-try"><i>👆</i>TRY IT</span>' : ''}</div>`}
      <div class="tg-title">${s.title}</div>
      <div class="tg-text">${text}</div>
      ${s.center ? '' : `<div class="tg-bar"><i style="width:${pct}%"></i></div>`}
      <div class="tg-actions">
        ${isFirst ? '<button class="tg-btn tg-ghost" data-act="end">Skip for now</button>' : (isLast ? '' : '<button class="tg-btn tg-ghost" data-act="back">Back</button>')}
        <span class="tg-spacer"></span>
        ${s.choice ? '<button class="tg-btn tg-ghost" data-act="finish">No, finish</button><button class="tg-btn tg-gold" data-act="dmtour">Yes, show me</button>'
          : s.tryIt ? '<button class="tg-btn tg-ghost" data-act="next">Skip step</button>' : `<button class="tg-btn tg-gold" data-act="next">${s.startLabel || 'Next'}</button>`}
      </div>
      ${isFirst || isLast ? '' : '<button class="tg-x" data-act="end" aria-label="End the guide">✕</button>'}
      ${isFirst ? '<div class="tg-foot">You can replay it any time from Menu › Guide.</div>' : ''}`;
    card.querySelectorAll('[data-act]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const a = b.dataset.act;
      if (a === 'next') go(idx + 1);
      else if (a === 'back') go(idx - 1, -1);
      else if (a === 'finish') go(FINAL);
      else if (a === 'dmtour') { closeSidebar(); if (typeof openDefectMapper === 'function') openDefectMapper(); go(idx + 1); }
      else end();
    });
    card.classList.remove('tg-in'); void card.offsetWidth; card.classList.add('tg-in');
  }

  function go(i, dir) {
    clearTimeout(advanceTimer); advanceTimer = 0; ready = false;
    if (i >= STEPS.length) { end(true); return; }
    if (i < 0) i = 0;
    idx = i;
    if (i === FINAL && window.sfx) window.sfx('finish');
    const s = STEPS[idx];
    mem = Object.assign({}, mem, { offSince: 0, recoverAt: 0 });
    try { ensureScreen(stepScreen(s)); } catch (e) {}
    if (s.prepare) { try { s.prepare(); } catch (e) {} }
    // give drawers and pages a moment to slide into place, then show the step – or pass it over when it does not apply
    const t0 = Date.now();
    const attempt = () => {
      if (!active || idx !== i) return;
      const el = s.target ? s.target() : null;
      const ok = (!s.when || s.when()) && (!s.target || visible(el));
      if (!ok) {
        if (Date.now() - t0 < (s.wait || 0)) { setTimeout(attempt, 200); return; }
        // the Defect Mapper part is only for those who asked for it: moving back out of it returns to the offer
        go(idx + (dir || 1), dir); return;
      }
      if (s.onStart) { try { s.onStart(); } catch (e) {} }
      if (el && el.scrollIntoView) {
        const b = el.getBoundingClientRect();
        if (b.top < 60 || b.bottom > window.innerHeight - 60) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      render();
      ready = true;
    };
    setTimeout(attempt, s.prepare ? 380 : 60);
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
    document.documentElement.classList.remove('tg-room');
    if (root) root.classList.remove('tg-on');
    try { localStorage.setItem(DONE_KEY, '1'); } catch (e) {}
    if (finished) { closeSidebar(); if (window.sfx) window.sfx('done'); }
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
  .tg-card .tg-actions .tg-btn { white-space: nowrap; }
  .tg-badge-try { display: inline-flex; align-items: center; gap: 7px; font-size: .86rem; padding: 4px 14px 4px 4px; letter-spacing: 1.2px; text-transform: uppercase; font-weight: 800; background: linear-gradient(180deg, #ffe07a, #f5c451); animation: tgBadge 1.2s ease-in-out infinite; }
  .tg-badge-try i { font-style: normal; width: 24px; height: 24px; border-radius: 50%; background: #0b2a5c; display: inline-flex; align-items: center; justify-content: center; font-size: .9rem; letter-spacing: 0; }
  @keyframes tgBadge { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 210, 80, .85), 0 0 10px rgba(255, 210, 80, .6); } 50% { box-shadow: 0 0 0 7px rgba(255, 210, 80, 0), 0 0 22px rgba(255, 210, 80, .95); } }

  /* reading steps: a cool steel-blue card, a calm steady outline */
  .tg-card.tg-read { background: linear-gradient(160deg, rgba(44, 93, 146, 0.97), rgba(26, 60, 102, 0.98)); border-color: rgba(170, 205, 245, .5); }
  .tg-card.tg-read .tg-step { color: #b9d4f4; }
  .tg-card.tg-read .tg-text { color: #e3ecf8; }
  .tg-card.tg-read::before { background: rgba(44, 93, 146, 0.97); border-color: rgba(170, 205, 245, .5); }
  .tg-card.tg-read[data-arrow="down"]::before { background: rgba(26, 60, 102, 0.98); }
  .tg-root:not(.tg-tryon) .tg-spot::after { display: none; }
  .tg-root:not(.tg-tryon) .tg-spot { outline: 2px solid rgba(190, 218, 248, .85); box-shadow: 0 0 16px 2px rgba(170, 205, 245, .4), 0 0 0 9999px rgba(2, 6, 16, 0.72); }

  /* try-it steps: a warm navy card with a strong pulsing gold glow */
  .tg-card.tg-try { background: radial-gradient(130% 75% at 50% 0%, rgba(245, 180, 60, .26), rgba(245, 180, 60, 0) 70%), linear-gradient(160deg, rgba(29, 28, 70, 0.98), rgba(16, 15, 46, 0.98));
    border: 2px solid #ffd34d; animation: tgIn .32s cubic-bezier(.2,.8,.2,1), tgTryGlow 1.4s ease-in-out .35s infinite; }
  .tg-card.tg-try::before { background: rgba(58, 50, 76, 0.98); border-color: #ffd34d; border-width: 2px; }
  .tg-card.tg-try[data-arrow="down"]::before { background: rgba(16, 15, 46, 0.98); }
  @keyframes tgTryGlow {
    0%, 100% { box-shadow: 0 18px 50px rgba(0, 0, 0, .55), 0 0 0 0 rgba(255, 211, 77, .0), 0 0 10px 0 rgba(255, 200, 60, .35); }
    50% { box-shadow: 0 18px 50px rgba(0, 0, 0, .55), 0 0 0 4px rgba(255, 211, 77, .45), 0 0 42px 10px rgba(255, 200, 60, .75); } }
  .tg-root.tg-tryon .tg-spot { outline: 3px solid #ffd34d; }
  /* the ring around the highlighted area: a bright glow that swells and fades */
  .tg-root.tg-tryon .tg-spot::after { inset: 0; border: none; border-radius: 14px; animation: tgRing 1.2s ease-out infinite; }
  @keyframes tgRing {
    0% { box-shadow: 0 0 0 0 rgba(255, 211, 77, .95), 0 0 18px 4px rgba(255, 200, 60, .85); }
    100% { box-shadow: 0 0 0 16px rgba(255, 211, 77, 0), 0 0 40px 12px rgba(255, 200, 60, 0); } }
  /* the ripple: grows as a circle for a moment, then smoothly stretches (circle → ellipse → rounded box)
     so it meets every side and corner of the highlighted area at the same instant.
     Two separate smooth curves – growing (--g) and reshaping (--m) – so there is no jolt in between. */
  @property --tg-g { syntax: '<number>'; inherits: false; initial-value: 0; }
  @property --tg-m { syntax: '<number>'; inherits: false; initial-value: 0; }
  .tg-root.tg-tryon .tg-spot::before { content: ''; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;
    --tg-d: calc(10px + var(--tg-g) * (var(--rmin, 40px) - 10px));
    width: calc(var(--tg-d) + var(--tg-m) * (var(--rw, 40px) - var(--tg-d)));
    height: calc(var(--tg-d) + var(--tg-m) * (var(--rh, 40px) - var(--tg-d)));
    border-radius: calc(50% * (1 - var(--tg-m)) + 14px * var(--tg-m));
    background: radial-gradient(closest-side, rgba(255, 220, 100, .7), rgba(255, 196, 50, .5));
    box-shadow: 0 0 22px 4px rgba(255, 200, 60, .55);
    animation: tgGrow 1.2s infinite, tgMorph 1.2s infinite, tgFade 1.2s linear infinite; }
  @keyframes tgGrow { 0% { --tg-g: 0; animation-timing-function: cubic-bezier(.25, .6, .35, 1); } 70% { --tg-g: 1; } 100% { --tg-g: 1; } }
  @keyframes tgMorph { 0% { --tg-m: 0; } 24% { --tg-m: 0; animation-timing-function: cubic-bezier(.45, 0, .3, 1); } 76% { --tg-m: 1; } 100% { --tg-m: 1; } }
  @keyframes tgFade { 0% { opacity: 0; } 6% { opacity: .95; } 78% { opacity: .6; } 100% { opacity: 0; } }
  .tg-root.tg-calm .tg-spot::before { display: none; }
  html.tg-room .dm-root .dm-modal { padding-top: var(--tg-room, 200px); align-items: flex-start; }
  html.tg-room .dm-root .dm-mcard { max-height: 100%; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .tg-oops { margin: 0 0 8px; padding: 8px 10px; border-radius: 10px; background: rgba(96, 165, 250, .14); border-left: 3px solid #60a5fa; font-size: .9rem; color: #e2ecfb; }
  .tg-oops-in { animation: tgIn .35s cubic-bezier(.2,.8,.2,1); }
  .tg-foot { margin-top: 10px; text-align: center; font-size: .8rem; color: #93a4bf; }
  .tg-card.tg-done { border-color: #4ade80; box-shadow: 0 0 0 3px rgba(74, 222, 128, .35), 0 18px 50px rgba(0, 0, 0, .55); }
  .tg-card.tg-done .tg-badge { background: #4ade80; }
  .tg-card.tg-done .tg-badge::after { content: ' ✓'; }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
})();
