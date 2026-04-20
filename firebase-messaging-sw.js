// ==========================================
// 1. إعدادات فايربيز لاستقبال الإشعارات
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyANg4wLchZaikXneXr1c3qhRgcOnvPbfoA",
  authDomain: "faculty-of-commerce-2026.firebaseapp.com",
  projectId: "faculty-of-commerce-2026",
  storageBucket: "faculty-of-commerce-2026.firebasestorage.app",
  messagingSenderId: "350727231766",
  appId: "1:350727231766:web:b08a0f335e38bfc2e79837"
});

const messaging = firebase.messaging();

// معالجة الرسائل والموقع مغلق أو في الخلفية
messaging.onBackgroundMessage(function(payload) {
  console.log('[ServiceWorker] استلام إشعار في الخلفية: ', payload);

  const notificationTitle = payload.notification?.title || 'تحديث جديد من التجارة';
  const notificationOptions = {
    body: payload.notification?.body || '',
    
    // 👇 الأيقونة الصغيرة للإشعار (يأخذها من الإشعار أو يضع أيقونة الموقع الافتراضية)
    icon: payload.notification?.icon || './icon-192x192.png',
    
    // 👇 السطر الجديد المسؤول عن جلب وعرض "الصورة الكبيرة" داخل الإشعار
    image: payload.notification?.image || payload.fcmOptions?.image || payload.data?.image,
    
    badge: './icon-192x192.png',
    vibrate: [200, 100, 200],
    data: { 
      // دعم الروابط سواء جاءت في custom data أو الـ link الافتراضي
      url: payload.data?.url || payload.data?.link || payload.fcmOptions?.link || './' 
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// التعامل مع الضغط على الإشعار من قِبل المستخدم (سواء الموبايل مغلق أو مفتوح)
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // إغلاق الإشعار بعد الضغط عليه

  const urlToOpen = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // إذا كان الموقع مفتوحاً بالفعل، قم بتبديل التبويب وعمل التركيز عليه (focus)
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen); // توجيه للرابط
          return client.focus();
        }
      }
      // إذا كان الموقع مغلقاً بالكامل، افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ==========================================
// 2. كاش الموقع (تسريع الموقع وحل مشكلة الباقة)
// ==========================================
const CACHE_NAME = 'commerce-zagazig-v10-image-support'; // 👈 تم رفع الإصدار لتحديث أجهزة كل الطلاب تلقائياً

const APP_SHELL =[
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png'
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

  // 🚨🚨 التعديل الأهم: منع الكاش من تدمير اتصالات Firebase (هذا كان سبب فشل حفظ التوكن)
  if (
    event.request.method !== 'GET' || 
    !url.protocol.startsWith('http') || 
    url.host.includes('firestore.googleapis.com') || 
    url.host.includes('firebase') || 
    url.host.includes('fcm.googleapis.com') || // استثناء خوادم الإشعارات من الكاش
    url.host.includes('cloudinary.com') || 
    url.host.includes('esm.sh')
  ) {
    return; // دع الطلب يمر للإنترنت مباشرة
  }

  // استراتيجية Cache First للملفات الباقية (لجعل الموقع صاروخي)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // إذا وجد الملف في الكاش، يعرضه فورا دون تحميل من الإنترنت (يحل البطء)
      if (cachedResponse) {
        return cachedResponse;
      }

      // إذا لم يكن موجودا، يحمله ويضعه في الكاش للمرة القادمة
      return fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      }).catch(() => {
         if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
