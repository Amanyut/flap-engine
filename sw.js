/* Amanyu's Flapendium - offline support.
   The app's own files are stored on the device when a version is installed, so the app opens instantly and
   works without a connection. A new version is downloaded in the background; the page then offers an
   "Update" button, and the new version takes over only when the user taps it.
   VERSION is a fingerprint of the app files (set by bump_sw.py) - any change to them makes a new version. */
const VERSION = '4bf297b56d1f';
const SHELL = 'flapendium-shell-' + VERSION;
const RUNTIME = 'flapendium-runtime';
const IMAGES = 'flapendium-images';
const MAX_IMAGES = 160;

const SHELL_FILES = [
  './', 'index.html', 'intro.js', 'tour.js', 'manifest.json', 'icon.png',
  'defect/mapper.js', 'defect/reach.json', 'defect/body_meta.json',
  'icons/splash.webp', 'icons/logo-96.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png',
  'icons/icon-192.png', 'icons/icon-maskable-512.png',
  'icons/regions/all-references.png', 'icons/regions/favourites.png', 'icons/regions/groin-perineum.png',
  'icons/regions/head-neck.png', 'icons/regions/local-flaps.png', 'icons/regions/lower-extremity.png',
  'icons/regions/trunk.png', 'icons/regions/upper-extremity.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('flapendium-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The login / flap-data server is always asked directly (the page keeps its own copy of the data)
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') return;

  // The app itself: from the stored version (instant, works offline), else from the network
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(caches.match('index.html', { cacheName: SHELL }).then(r => r || fetch(req)));
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Fonts: use the stored copy, refresh it in the background
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(RUNTIME).then(cache => cache.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }

  // Flap pictures (Google Drive): keep a copy once seen, so they show offline too
  if (req.destination === 'image' && (url.hostname === 'drive.google.com' || url.hostname.endsWith('googleusercontent.com'))) {
    event.respondWith(caches.open(IMAGES).then(cache => cache.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { cache.put(req, res.clone()); trimCache(IMAGES, MAX_IMAGES); }
      return res;
    }))));
  }
});
