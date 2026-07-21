'use strict';
// PWA用Service Worker。方針:
//   ・同一オリジンのGETのみ扱う(TradingView・翻訳API等の外部リクエストには関与しない)
//   ・常にネットワーク優先。成功したらキャッシュへ保存し、オフライン時だけキャッシュで応答する
//     (オンライン時の表示は非PWAと完全に同じ = 古いデプロイを掴む事故が起きない)
//   ・キャッシュのキーはクエリを取り除いたURLにする。news.json?t=タイムスタンプ や ?v=バージョン の
//     クエリをキーに含めると同じファイルが別エントリとして無限に溜まってしまうため

const CACHE_VERSION = 'v1';
const CACHE_NAME = `news-board-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './theme-init.js',
  './sources.js',
  './topic-keywords.js',
  './sentiment-keywords.js',
  './market-sessions.js',
  './utils.js',
  './theme.js',
  './feed.js',
  './translate.js',
  './topic-filter.js',
  './sentiment.js',
  './render.js',
  './ticker.js',
  './sessions.js',
  './calendar.js',
  './watchlist.js',
  './main.js',
  './news.json',
  './privacy.html',
  './privacy.css',
  './robots.txt',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

// クエリを除いたURLをキャッシュキーにする
function cacheKeyFor(requestUrl){
  const url = new URL(requestUrl, self.location.href);
  return url.origin + url.pathname;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        CORE_ASSETS.map(asset =>
          fetch(asset).then(response => {
            if(response.ok) return cache.put(cacheKeyFor(asset), response);
          }).catch(() => {})   // 1件の失敗で全体を止めない
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const cacheKey = cacheKeyFor(event.request.url);
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(cacheKey).then(cached => {
        if(cached) return cached;
        throw new Error('offline and not cached: ' + cacheKey);
      }))
  );
});
