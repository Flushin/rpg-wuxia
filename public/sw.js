// Service worker mínimo: rede primeiro, cache só como reserva (offline).
// Assim um deploy novo é pego na hora e nunca serve JS velho com internet.
// Arquivos sem hash no nome (index.html, maps/, sprites/, sw.js...) sempre revalidam no servidor
// (cache: 'no-cache' → 304 barato se não mudou), senão o cache HTTP do GitHub Pages (10 min) servia versão velha.
// Arquivos em assets/ têm hash no nome: podem vir do cache HTTP sem risco.
const CACHE = 'mistpeak-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // nunca intercepta outras origens (ex.: api.web3forms.com do report de bug)
  if (url.origin !== self.location.origin) return;
  const hashed = url.pathname.includes('/assets/');
  e.respondWith(
    fetch(req, hashed ? undefined : { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : undefined) || Response.error())),
  );
});
