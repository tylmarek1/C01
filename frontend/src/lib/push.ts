import { api } from "@/lib/api"

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
}

// The browser Push API wants the VAPID public key as a raw Uint8Array, but
// hands it out (and we store/transmit it) as base64url text.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration("/sw.js")
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush(token: string): Promise<void> {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported in this browser")

  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Notification permission was not granted")

  const registration = await navigator.serviceWorker.register("/sw.js")
  const { public_key: publicKey } = await api.getPushPublicKey()
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  })

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription")
  }
  await api.subscribeToPush(token, {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  })
}

export async function unsubscribeFromPush(token: string): Promise<void> {
  const subscription = await getExistingPushSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await api.unsubscribeFromPush(token, endpoint)
}
