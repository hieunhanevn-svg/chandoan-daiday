// ================================================================
// Service Worker — Offline support
// Cách cập nhật: khi deploy mới, Vercel tự thêm ?v=xxx vào URL
// Browser tự detect sw.js thay đổi → cập nhật tự động
// ================================================================

const VERSION = 'chandoan-v2';
const CACHE = VERSION;

// Các file cần cache để chạy offline
// Next.js tự tạo URL có hash → dùng runtime caching thay vì hardcode
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Cài đặt SW mới → cache các file cốt lõi
self.addEventListener('install', e => {
  console.log('[SW] Installing version:', VERSION);
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())  // Kích hoạt SW mới ngay lập tức
  );
});

// Kích hoạt SW mới → xóa cache phiên bản cũ
self.addEventListener('activate', e => {
  console.log('[SW] Activating version:', VERSION);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE)  // Giữ cache mới, xóa cache cũ
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())  // Áp dụng ngay cho tất cả tab
  );
});

// Xử lý fetch — chiến lược: Network first, Cache fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // API diagnose: luôn ưu tiên mạng (tính toán JS thuần, nhanh)
  // Nếu mất mạng → dùng cache lần trước
  if (url.pathname === '/api/diagnose') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request)
          .then(cached => cached || new Response(
            JSON.stringify({ error: 'Không có kết nối mạng. Vui lòng thử lại.' }),
            { headers: { 'Content-Type': 'application/json' } }
          ))
        )
    );
    return;
  }

  // Trang và file JS/CSS: Network first → Cache fallback
  // Có mạng → lấy file mới nhất + cập nhật cache
  // Mất mạng → dùng cache cũ
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Nhận lệnh từ app → xóa cache thủ công (dùng khi cần)
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
