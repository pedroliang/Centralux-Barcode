// ============================================
// Centralux Barcode — Service Worker
// Gerencia cache para funcionamento offline
// ============================================

const CACHE_NAME = 'centralux-barcode-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './app.html',
    './style.css',
    './supabase.js',
    './scanner.js',
    './app.js',
    './manifest.json'
];

// CDN resources para cache
const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Instalar Service Worker e cachear assets estáticos
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando assets estáticos');
                // Cachear assets locais
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                        // Cachear CDN assets individualmente (podem falhar sem impedir a instalação)
                        return Promise.allSettled(
                            CDN_ASSETS.map(url =>
                                fetch(url).then(response => {
                                    if (response.ok) {
                                        return cache.put(url, response);
                                    }
                                }).catch(err => {
                                    console.warn(`[SW] Não foi possível cachear: ${url}`, err);
                                })
                            )
                        );
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// Ativar e limpar caches antigos
self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Removendo cache antigo:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia de cache: Network First com fallback para cache
// Ideal para app que precisa de dados atualizados mas funciona offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Não interceptar requisições POST (ex: Supabase mutations)
    if (request.method !== 'GET') {
        return;
    }

    // Para requisições à API do Supabase: Network Only (dados precisam ser frescos)
    if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/')) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'Sem conexão com o servidor' }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }

    // Para assets estáticos e CDN: Cache First, depois Network
    if (STATIC_ASSETS.some(asset => request.url.endsWith(asset.replace('./', ''))) ||
        CDN_ASSETS.some(cdn => request.url.startsWith(cdn)) ||
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com') {

        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) {
                    // Atualizar cache em background
                    fetch(request).then((response) => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, response);
                            });
                        }
                    }).catch(() => { /* Ignorar erros de rede */ });

                    return cached;
                }

                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Para outras requisições: Network First
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(request);
            })
    );
});
