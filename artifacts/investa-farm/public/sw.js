const CACHE_NAME = 'investa-farm-v3';
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

// Type → visual config
const TYPE_CONFIG = {
  investment_received: { emoji: '📈', color: '#4f46e5', label: 'Investment',      requireInteract: true  },
  investment:          { emoji: '📈', color: '#4f46e5', label: 'Investment',      requireInteract: false },
  deposit:             { emoji: '💰', color: '#16a34a', label: 'Deposit',         requireInteract: false },
  wallet_funded:       { emoji: '💰', color: '#16a34a', label: 'Funds Added',     requireInteract: false },
  wallet_credit:       { emoji: '💰', color: '#16a34a', label: 'Wallet Credited', requireInteract: false },
  withdrawal:          { emoji: '🏧', color: '#ef4444', label: 'Withdrawal',      requireInteract: false },
  farm_update:         { emoji: '🌿', color: '#059669', label: 'Farm Update',     requireInteract: false },
  farm_fully_funded:   { emoji: '🎉', color: '#16a34a', label: 'Farm Funded!',   requireInteract: true  },
  price_alert:         { emoji: '📊', color: '#0ea5e9', label: 'Price Alert',     requireInteract: false },
  kyc_approved:        { emoji: '✅', color: '#16a34a', label: 'KYC Approved',   requireInteract: true  },
  kyc_rejected:        { emoji: '⚠️', color: '#ef4444', label: 'Action Needed',  requireInteract: true  },
  loan_approved:       { emoji: '🏦', color: '#4f46e5', label: 'Loan Approved',  requireInteract: true  },
  harvest_payout:      { emoji: '🌾', color: '#f59e0b', label: 'Harvest Payout', requireInteract: true  },
  harvest:             { emoji: '🌾', color: '#f59e0b', label: 'Harvest Payout', requireInteract: true  },
  new_listing:         { emoji: '🌱', color: '#16a34a', label: 'New Listing',     requireInteract: false },
  order_filled:        { emoji: '✅', color: '#16a34a', label: 'Order Filled',   requireInteract: false },
  exit_processed:      { emoji: '↩️', color: '#6b7280', label: 'Exit Processed', requireInteract: false },
};

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const {
    title = 'Investa Farm',
    body = 'You have a new notification',
    tag = 'investa-farm',
    url = '/',
    type = 'general',
    amount,
  } = data;

  const cfg = TYPE_CONFIG[type] ?? { emoji: '🔔', color: '#16a34a', label: 'Notification', requireInteract: false };
  const displayTitle = `${cfg.emoji} ${title}`;
  const displayBody = amount ? `${body}` : body;

  event.waitUntil(
    self.registration.showNotification(displayTitle, {
      body: displayBody,
      icon: '/logo.png',
      badge: '/favicon.png',
      tag,
      renotify: true,
      data: { url, type, amount },
      actions: cfg.requireInteract
        ? [{ action: 'open', title: '👁 View' }, { action: 'dismiss', title: 'Dismiss' }]
        : [{ action: 'open', title: 'Open App' }],
      requireInteraction: cfg.requireInteract,
      vibrate: cfg.requireInteract ? [200, 100, 200, 100, 400] : [150, 50, 150],
      silent: false,
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

// Background sync for offline resilience
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(Promise.resolve());
  }
});
