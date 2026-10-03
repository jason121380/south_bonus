// Retirement worker: clear only legacy salon caches, then unregister.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('salon-performance-')).map(k=>caches.delete(k)))).then(()=>self.registration.unregister())));
