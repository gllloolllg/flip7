const CACHE_NAME = 'flip7-score-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './logo.png',
    './manifest.json'
    // Icons are optional for cached offline capability but good to have
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
