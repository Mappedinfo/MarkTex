/**
 * Service Worker - 资源缓存策略
 * 用于缓存 SwiftLaTeX 引擎和字体文件,提升加载性能
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `latextable-${CACHE_VERSION}`;

// 需要缓存的资源列表
const CACHE_URLS = [
  '/',
  '/index.html',
  // SwiftLaTeX 引擎会动态加载,这里主要缓存应用本身
];

// CDN 资源的缓存策略(Stale-While-Revalidate)
const CDN_PATTERNS = [
  /^https:\/\/cdn\.jsdelivr\.net/,
  /^https:\/\/fonts\.googleapis\.com/,
  /^https:\/\/fonts\.gstatic\.com/,
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安装中...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 缓存核心资源');
      return cache.addAll(CACHE_URLS);
    })
  );
  
  // 立即激活新的 Service Worker
  self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活中...', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // 立即接管所有客户端
  return self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 检查是否是 CDN 资源
  const isCDNResource = CDN_PATTERNS.some(pattern => pattern.test(request.url));
  
  if (isCDNResource) {
    // CDN 资源使用 Stale-While-Revalidate 策略
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            // 只缓存成功的响应
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // 网络请求失败,返回缓存
            return cachedResponse;
          });
          
          // 优先返回缓存,同时更新缓存
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else if (url.origin === location.origin) {
    // 本地资源使用 Cache-First 策略
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request).then((networkResponse) => {
          // 只缓存成功的 GET 请求
          if (request.method === 'GET' && networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
      })
    );
  }
  // 其他请求直接穿透,不缓存
});
