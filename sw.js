/* Service worker — PAT WORKSPACE
 * Chỉ cache TÀI NGUYÊN TĨNH (app shell + thư viện/phông CDN).
 * Không đụng vào: API thời tiết (open-meteo), Google Calendar / Google Sign-In,
 * và mọi request khác — những request đó để trình duyệt tự xử lý như bình thường.
 * Dữ liệu nghiệp vụ nằm trong IndexedDB (pat_workspace_db) → không đi qua fetch, SW không chạm tới.
 * Đổi v1 → v2 ... khi cần ép mọi máy bỏ cache cũ. */
const CACHE_PREFIX = 'pat-workspace-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v1';

const INDEX_URL = new URL('./index.html', self.location).href;
const SCOPE_PATH = new URL('./', self.location).pathname;

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];
const SHELL_PATHS = new Set(APP_SHELL.map((p) => new URL(p, self.location).pathname));

// Script CDN mà file HTML gọi trực tiếp
const CDN_SCRIPTS = [
  'https://unpkg.com/@phosphor-icons/web'
];
// CSS mà script Phosphor tự chèn (jsdelivr, bản 2.1.2) + CSS Google Fonts của file HTML.
// Các file này kéo theo phông woff2 → cache luôn để dùng được khi offline.
const CDN_CSS_WITH_FONTS = [
  'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/bold/style.css',
  'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/fill/style.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];
const CDN_CSS_ONLY = [
  'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/regular/style.css',
  'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/thin/style.css',
  'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/light/style.css',
  'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/duotone/style.css'
];
// Chỉ các host tĩnh này mới được cache khi chạy (runtime). Host khác → bỏ qua hoàn toàn.
const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

async function putIfOk(cache, url) {
  try {
    const res = await fetch(url);
    if (res && res.ok) { await cache.put(url, res.clone()); return res; }
  } catch (e) { /* offline / bị chặn: bỏ qua, không làm hỏng bước install */ }
  return null;
}

async function precacheCss(cache, cssUrl, withFonts) {
  const res = await putIfOk(cache, cssUrl);
  if (!res || !withFonts) return;
  try {
    const css = await res.text();
    const fonts = new Set();
    css.replace(/url\(\s*["']?([^"')]+?)["']?\s*\)/g, (m, u) => {
      const abs = new URL(u, cssUrl).href;
      if (/\.woff2(\?|#|$)/i.test(abs) || abs.indexOf('fonts.gstatic.com') !== -1) fonts.add(abs);
      return m;
    });
    await Promise.all([...fonts].map((f) => putIfOk(cache, f)));
  } catch (e) { /* bỏ qua */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);                         // bắt buộc phải có
    await Promise.all([                                    // CDN: cố gắng hết sức, lỗi cũng không sao
      ...CDN_SCRIPTS.map((u) => putIfOk(cache, u)),
      ...CDN_CSS_WITH_FONTS.map((u) => precacheCss(cache, u, true)),
      ...CDN_CSS_ONLY.map((u) => precacheCss(cache, u, false))
    ]);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // Chỉ dọn cache CŨ CỦA CHÍNH APP NÀY (cùng tiền tố), không xoá cache của app khác trên cùng domain.
    await Promise.all(
      names.filter((n) => n.indexOf(CACHE_PREFIX) === 0 && n !== CACHE_NAME).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) Tài nguyên cùng origin: chỉ app shell + điều hướng trong phạm vi app. Cache-first (làm mới ngầm).
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf(SCOPE_PATH) !== 0) return;
    const isNav = req.mode === 'navigate';
    if (!isNav && !SHELL_PATHS.has(url.pathname)) return;
    const target = isNav ? INDEX_URL : url.origin + url.pathname;

    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(target);
      const refresh = fetch(new Request(target, { cache: 'no-cache' }))
        .then(async (res) => { if (res && res.ok) await cache.put(target, res.clone()); return res; })
        .catch(() => null);
      event.waitUntil(refresh);                       // cập nhật ngầm cho lần mở sau
      if (cached) return cached;
      const fresh = await refresh;
      if (fresh) return fresh;
      if (isNav) { const fb = await cache.match(INDEX_URL); if (fb) return fb; }   // offline → luôn mở được index.html
      return Response.error();
    })());
    return;
  }

  // 2) CDN tĩnh đã khai báo: cache-first, chỉ lưu phản hồi hợp lệ (không lưu opaque).
  if (CDN_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        cache.put(req, res.clone());
      }
      return res;
    })());
    return;
  }

  // 3) Mọi thứ còn lại (open-meteo, Google Calendar API, accounts.google.com...): KHÔNG can thiệp.
});
