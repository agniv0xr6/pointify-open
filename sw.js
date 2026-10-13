const CACHE_NAME = 'pointify-v1780000021'; // Phase 6b: network-first for first-party JS + HTML so edits are never served stale
const CORE_ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './vendor/tailwind.js',
  './pointify-dashboard-preview.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './js/db.js',
  './js/auth.js',
  './js/pos.js',
  './js/inventory.js',
  './js/reports.js',
  './js/settings.js'
];

// Only this path is allowed to fail without failing the whole install. Some
// hosts do not serve a directory index, and CORE_ASSETS is otherwise
// precached strictly (a single 404 would disable offline support entirely).
const OPTIONAL_ASSETS = ['./'];

// External assets are fetched with DIFFERENT modes, and getting this wrong is
// what made offline support unreliable.
//
// Tailwind used to be here (cdn.tailwindcss.com sends no Access-Control-Allow-
// Origin, so it could only be cached as an unusable-in-CORS-mode OPAQUE
// response). It is now vendored at ./vendor/tailwind.js: same-origin, status
// visible, never a cached failure.
//
// fonts.googleapis.com sends `Access-Control-Allow-Origin: *`, so we fetch it
// with the default cors mode and get a real 200 we can inspect, instead of an
// opaque response that might be a cached error.
const EXTERNAL_ASSETS = [
  { url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap', mode: 'cors' },
];

// Hosts this service worker may cache at RUNTIME.
//
// fonts.gstatic.com MUST be here: @font-face requests are made in CORS mode, so
// a cached OPAQUE font response is rejected by the browser and the font
// silently disappears. Only response.ok (real 200s) is ever cached.
const RUNTIME_CACHE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// A redirected response cannot satisfy a navigation request (those have redirect
// mode "manual"), so if the server 302s './' the offline first load would fail
// with "a redirected response was used for a request whose redirect mode is not
// follow". Rebuilding the Response drops it off the redirect chain.
async function cleanRedirect(response) {
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function precacheCore(cache) {
  await Promise.all(CORE_ASSETS.map(async (url) => {
    const optional = OPTIONAL_ASSETS.includes(url);
    let response;
    try {
      // cache:'no-cache' forces revalidation. Without it fetch() would happily
      // return a stale copy from the HTTP cache, and a version bump would pin
      // OLD files into the NEW offline cache.
      response = await fetch(url, { cache: 'no-cache' });
    } catch (e) {
      if (optional) return;
      throw new Error(`Precache failed (network): ${url}`);
    }

    if (!response.ok) {
      if (optional) return;
      throw new Error(`Precache failed (HTTP ${response.status}): ${url}`);
    }

    if (response.redirected) response = await cleanRedirect(response);
    await cache.put(url, response);
  }));
}

async function precacheExternal(cache) {
  await Promise.all(EXTERNAL_ASSETS.map(async ({ url, mode }) => {
    try {
      const response = await fetch(url, { mode });
      // Never cache a non-ok response: with a cache-first strategy a single
      // error would be served forever.
      if (!response.ok && response.type !== 'opaque') {
        console.warn('External asset not ok, skipped:', url, response.status);
        return;
      }
      await cache.put(url, response);
    } catch (e) {
      // Best effort: an offline install must not fail because a CDN is down.
      console.warn('Failed to cache external asset:', url, e && e.message);
    }
  }));
}

self.addEventListener('install', (event) => {
  // Deliberately NOT calling self.skipWaiting().
  //
  // skipWaiting() makes a freshly installed worker seize control of pages that
  // are still running the previous version - on a POS that means the code under
  // a cashier can change mid-shift. Omitting it parks the new worker in
  // "waiting"; it activates on the next launch, once every tab is closed.
  // clients.claim() below still lets the FIRST worker take control immediately,
  // so offline support works without a reload on first visit.
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await precacheCore(cache);
      await precacheExternal(cache);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(), // Take control of all clients immediately
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        );
      })
    ])
  );
});

async function respondTo(event) {
  const request = event.request;
  const url = new URL(request.url);

  // 0. FIRST-PARTY CODE IS NETWORK-FIRST.
  //
  //    Everything below is cache-first on purpose - an offline till must never
  //    stall waiting for a network that may not exist. Code is the exception.
  //    The operator edits these files, and a cache-first copy hides every edit
  //    until every tab has been closed (and this worker deliberately does NOT
  //    call skipWaiting, so activation waits for exactly that). That is why a
  //    corrected receipt footer still printed the old Kenyan phone number: the
  //    source was right, the cached copy was not.
  //
  //    Offline the fetch throws and we fall straight through to the precache,
  //    so cold/field behaviour is unchanged - we just stop serving stale code
  //    while the network is there to serve it.
  //    HTML is in the same boat: app.html was cache-first, so a rebuilt page
  //    (new markup, new ?v= cache-buster) could not reach the device until every
  //    tab closed. Navigations are now network-first too, with the precache as
  //    the offline fallback.
  const wantsFresh = url.origin === self.location.origin &&
    (/\.(?:js|mjs)$/.test(url.pathname) || request.mode === 'navigate');

  if (wantsFresh) {
    try {
      const fresh = await withTimeout(fetch(request, { cache: 'no-cache' }), FRESH_TIMEOUT_MS);
      if (fresh.ok) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, fresh.clone());
        } catch (e) {
          // Cache write is best effort; the live response still wins.
        }
        return fresh;
      }
    } catch (e) {
      // Offline: fall through to the precache below.
    }
    let offlineCopy = await caches.match(request, { ignoreSearch: true });
    if (!offlineCopy && request.mode === 'navigate') {
      offlineCopy = await caches.match('./index.html');
    }
    if (offlineCopy) return offlineCopy;
  }

  // 1. Exact match first.
  let cached = await caches.match(request);

  // 2. Same-origin only: retry ignoring the query string.
  //
  //    app.html requests ./js/db.js?v=6 but the precache stores ./js/db.js, and
  //    Cache.match does not strip query strings on its own. Without this the
  //    FIRST offline load misses on every single module, the ES module graph
  //    fails to resolve and the app never boots - even though the files are
  //    sitting in the cache. Restricted to same-origin so that two different
  //    cross-origin font stylesheets (which differ only by ?family=) can never
  //    be confused for one another.
  if (!cached && url.origin === self.location.origin) {
    cached = await caches.match(request, { ignoreSearch: true });
  }
  if (cached) return cached;

  // 3. Network.
  let response;
  try {
    response = await withTimeout(fetch(request), FRESH_TIMEOUT_MS);
  } catch (e) {
    // 4. Offline fallback.
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return new Response('You are offline and this page is not cached.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // 5. Runtime-cache CORS-enabled cross-origin assets (Google Fonts CSS and the
  //    woff2 files it points at). Only real 200s - never an opaque response,
  //    which could be a cached failure.
  if (response.ok && RUNTIME_CACHE_HOSTS.includes(url.hostname)) {
    const copy = response.clone();
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
    );
  }

  return response;
}

// A stalled local server used to hang event.respondWith() forever, which on a
// phone is indistinguishable from "the app is frozen on its splash screen":
// the navigation promise never settles, so the OS never repaints. Cap every
// network wait and drop through to the precache instead. Four seconds is well
// past a warm localhost round trip and still fast enough to beat a user's
// patience on a cold start.
const FRESH_TIMEOUT_MS = 4000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', (event) => {
  // Non-GET requests (none today) must go straight to the network.
  if (event.request.method !== 'GET') return;
  event.respondWith(respondTo(event));
});
