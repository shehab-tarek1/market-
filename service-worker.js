const CACHE_NAME = 'commerce-zagazig-v7-fast';

const APP_SHELL =[
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './assets/fonts/cairo-bold.woff2'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تخطي الطلبات الخارجية (Firebase, Cloudinary, Tailwind) لعدم إبطاء الموقع
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http') || url.host.includes('firestore') || url.host.includes('cloudinary.com') || url.host.includes('esm.sh')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // إرجاع الملف من الكاش فوراً إن وجد (سرعة صاروخية)
      if (cachedResponse) {
        // تحديث الملفات المحلية فقط في الخلفية بصمت
        if (url.origin === self.location.origin) {
          fetch(event.request).then((response) => {
            if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
          }).catch(() => {});
        }
        return cachedResponse;
      }

      // إذا لم يكن في الكاش، اجلبه من الإنترنت
      return fetch(event.request).then((response) => {
        // تخزين الملفات المحلية الجديدة فقط
        if (response.ok && url.origin === self.location.origin) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      }).catch(() => {
         // في حالة انقطاع الإنترنت
         if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

// إشعارات Push كما هي بدون تغيير
self.addEventListener('push', (event) => {
  let payload = { title: 'تطبيق تجارة الزقازيق', body: 'تحديث جديد', icon: './icon-192x192.png', url: './' };
  if (event.data) try { payload = event.data.json(); } catch (e) { payload.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: payload.icon, data: { url: payload.url }}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});