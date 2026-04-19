// قم بتغيير اسم الكاش لضمان تحديث الـ Service Worker عند المستخدمين
const CACHE_NAME = 'commerce-zagazig-v3';

// استخدام المسارات النسبية (إضافة نقطة)
const APP_SHELL =[
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] تم حفظ ملفات التطبيق الأساسية بنجاح');
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] تم مسح الذاكرة القديمة:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const url = new URL(event.request.url);
        // التخزين في الكاش إذا كان الملف ضمن الـ APP_SHELL
        if (APP_SHELL.some(path => url.pathname.endsWith(path.replace('./', '/')))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        console.log('[Service Worker] أنت الآن في وضع عدم الاتصال (Offline).');

        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // استخدام المسار النسبي هنا أيضاً
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});