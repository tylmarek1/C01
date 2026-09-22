// Minimal Web Push service worker — no offline caching, no app-shell
// strategy. Its only job is turning a push event into an OS notification
// and focusing/opening the app on click. Registered from lib/push.ts.

self.addEventListener("push", (event) => {
  let data = { title: "Courtly", body: "" }
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { title: "Courtly", body: event.data.text() }
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Courtly", {
      body: data.body || "",
      icon: "/favicon.svg",
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow("/app")
      return undefined
    }),
  )
})
