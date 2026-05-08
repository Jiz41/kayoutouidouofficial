const CACHE = 'kayou-1.1.4';
const PRECACHE = [
  '/kayoutouidouofficial/',
  '/kayoutouidouofficial/index.html',
  '/kayoutouidouofficial/style.css',
  '/kayoutouidouofficial/board.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', e => {
  const data  = e.data ? e.data.json() : {};
  const title = data.title || '👁 真自在律A.L.L';
  const body  = data.body  || '大衛星より入電';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/kayoutouidouofficial/assets/logo.png',
      data: { url: '/kayoutouidouofficial/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/kayoutouidouofficial/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/kayoutouidouofficial/'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isAsset = /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?)$/.test(url.pathname);

  if (isAsset) {
    // 画像・フォント: cache-first（変更頻度低）
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  } else {
    // HTML/JS/CSS: network-first（常に最新を取得、失敗時にキャッシュへフォールバック）
    e.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(e.request)
          .then(res => { cache.put(e.request, res.clone()); return res; })
          .catch(() => caches.match(e.request))
      )
    );
  }
});
