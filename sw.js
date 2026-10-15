/* Service worker: שומר את האפליקציה והתמונות לשימוש בלי אינטרנט */
const V = 'mitkonenim-v1';
const CORE = ['./', 'index.html'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const isAsset = /\/assets\//.test(r.url);
  if (isAsset) { // תמונות: קודם מהמטמון
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; })));
  } else { // דף: קודם רשת (כך עדכונים מגיעים), ואם אין אינטרנט - מהמטמון
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r)));
  }
});
