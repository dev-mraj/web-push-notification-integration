
var url=null;

self.addEventListener('push', function(event) {
    var data=JSON.parse(event.data.text());
    if (data){
        if (data.url)
            data.notification.requireInteraction= true;
        if (data.url)
            url=data.url;
        event.waitUntil(self.registration.showNotification(data.title, data.notification));
    }
});
self.addEventListener('notificationclick', function(event) {
    if (url) {
        let page_open=url;
        url=null;
        //https://stackoverflow.com/a/39457287
        event.notification.close(); // Android needs explicit close.
        event.waitUntil(
            clients.matchAll({type: 'window'}).then(windowClients => {
                // Check if there is already a window/tab open with the target URL
                for (var i = 0; i < windowClients.length; i++) {
                    var client = windowClients[i];
                    // If so, just focus it.
                    if (client.url === page_open && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If not, then open the target URL in a new window/tab.
                if (clients.openWindow) {
                    return clients.openWindow(page_open);
                }
            })
        );;
    }
});
