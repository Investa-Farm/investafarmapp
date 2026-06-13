const CACHE_NAME = 'investa-farm-v2';
const STATIC_ASSETS = ['/logo.png', '/favicon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const {
    title = 'Investa Farm',
    body = 'You have a new notification',
    icon = '/logo.png',
    badge = '/favicon.png',
    tag = 'investa-farm',
    url = '/',
    type = 'general',
    actions = [],
  } = data;

  const typeIcons = {
    investment_received: '💰',
    farm_update: '🌱',
    farm_fully_funded: '🎉',
    price_alert: '📈',
    kyc_approved: '✅',
    kyc_rejected: '⚠️',
    loan_approved: '🏦',
    harvest_payout: '💵',
    new_listing: '🌾',
    market_move: '📊',
    exit_processed: '↩️',
  };

  const emoji = typeIcons[type] || '🔔';

  event.waitUntil(
    self.registration.showNotification(`${emoji} ${title}`, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      data: { url },
      actions: actions.length ? actions : [
        { action: 'open', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      requireInteraction: ['investment_received', 'farm_fully_funded', 'kyc_approved', 'harvest_payout'].includes(type),
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
