// Service worker: the app works offline after the first visit.
// - OCR models, WASM, build assets, fonts: cache first (they never change at the same URL).
// - Pages: network first, cached copy when offline.
// - Server functions (/_serverFn): never cached; the app queues writes itself.
// Bump to drop old caches after a deploy.
const VERSION = 'v3'
const STATIC = `static-${VERSION}`
const PAGES = `pages-${VERSION}`
// Precached responses carry Vary headers that a module-script request would not match.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(PAGES).then((c) => c.add('/')),
      // Every JS and CSS file of the build, so screens not opened yet still work offline.
      fetch('/precache.json')
        .then((r) => r.json())
        .then((files) =>
          caches.open(STATIC).then((c) => c.addAll([...files, '/manifest.webmanifest', '/icon.svg', '/icon-192.png'])),
        ),
    ]).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isStatic(url) {
  return (
    url.pathname.startsWith('/models/') ||
    url.pathname.startsWith('/ort/') ||
    url.pathname.startsWith('/assets/') ||
    /\.(png|svg|webmanifest|css|js)$/.test(url.pathname) ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  )
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.pathname.startsWith('/_serverFn')) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, copy))
          return res
        })
        // The signed-in pages render on the client, so any cached page works as the app shell.
        .catch(async () => (await caches.match(req, MATCH)) || (await caches.match('/', MATCH)) || Response.error()),
    )
    return
  }

  if (isStatic(url)) {
    e.respondWith(
      caches.match(req, MATCH).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone()
              caches.open(STATIC).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
