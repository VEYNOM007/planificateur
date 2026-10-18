self.addEventListener('push', (event) => {
  let data = { title: 'Planificateur', body: 'Notification reçue.' };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    // charge utile non JSON : on garde le message par défaut
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'planificateur-test',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('./'));
});
