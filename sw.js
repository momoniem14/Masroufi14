// ========================================================
// تطبيق مصروفي - Service Worker المحدث للعمل أوفلاين على GitHub Pages
// اسم الملف المطلوب رفعه على GitHub: sw.js
// ========================================================

const CACHE_NAME = 'masroufi-offline-v3';

// الأصول الأساسية المراد تخزينها مبدئياً عند التثبيت
const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 1. مرحلة التثبيت (Install)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] جاري تخزين الأصول الأساسية...');
      return cache.addAll(PRE_CACHE_ASSETS).catch((err) => {
        console.warn('[Service Worker] تنبيه أثناء التخزين المبدئي (سيتم الاعتماد على الكاش الديناميكي):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. مرحلة التفعيل (Activate) وتنظيف النسخ القديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] حذف الكاش القديم:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. معالجة طلبات التصفح والملفات (Fetch)
// إستراتيجية Network-First مع حفظ ديناميكي في الكاش + fallback تلقائي للأوفلاين
self.addEventListener('fetch', (event) => {
  // تخطي الطلبات غير المدعومة (مثل POST أو chrome-extension)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  event.respondWith(
    // محاولة جلب الملف من الشبكة وتخزينه في الكاش للاستخدام بدون نت
    fetch(event.request)
      .then((networkResponse) => {
        // إذا كانت الاستجابة صالحة نقوم بحفظ نسخة منها
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // عند انقطاع الإنترنت، نبحث عن الملف في الكاش
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // إذا كان الطلب لصفحة HTML رئيسية ولم يجد الملف بالمسار الحرفي
        if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
          const fallbackIndex = await caches.match('./index.html') || await caches.match('./');
          if (fallbackIndex) {
            return fallbackIndex;
          }
        }

        return new Response('غير متصل بالإنترنت، يرجى فتح التطبيق مرة واحدة أثناء الاتصال بالإنترنت لتخزينه كلياً.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      })
  );
});
