'use strict';

const CACHE_VERSION = 'v1';
const CACHE_NAME = `news-board-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './scale.js',
  './theme-init.js',
  './sources.js',
  './topic-keywords.js',
  './sentiment-keywords.js',
  './genre-keywords.js',
  './market-sessions.js',
  './utils.js',
  './theme.js',
  './feed.js',
  './translate.js',
  './topic-filter.js',
  './genre-filter.js',
  './sentiment.js',
  './render.js',
  './ticker.js',
  './sessions.js',
  './calendar.js',
  './watchlist.js',
  './health.js',
  './main.js',
  './news.json',
  './status.json',
  './privacy.html',
  './privacy.css',
  './robots.txt',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

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
          }).catch(() => {})
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
