/* titanali — سرویس‌ورکر (آفلاین‌شدن + به‌روزرسانی بی‌دردسر) */
const V = 'titanali-v1';
const ASSETS = ['./', './index.html', './site.webmanifest', './favicon.svg',
                './apple-touch-icon.png', './icon-192.png', './icon-512.png', './404.html'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    for (const u of ASSETS) { try { await c.add(new Request(u, { cache: 'reload' })); } catch (_) {} }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;            // اینستاگرام و CDN ها دست‌نخورده
  if (url.pathname.includes('/api/') || url.search) return;

  // صفحه: شبکه اول، کش به‌عنوان پشتیبان (تا آپدیت‌ها سریع دیده شوند)
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(r);
        const c = await caches.open(V);
        c.put('./index.html', net.clone());
        return net;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./')) ||
               (await caches.match('./404.html')) || Response.error();
      }
    })());
    return;
  }

  // فایل‌های ثابت: کش اول
  e.respondWith((async () => {
    const hit = await caches.match(r);
    if (hit) return hit;
    try {
      const net = await fetch(r);
      if (net && net.status === 200 && net.type === 'basic') (await caches.open(V)).put(r, net.clone());
      return net;
    } catch (_) {
      return caches.match('./404.html') || Response.error();
    }
  })());
});
