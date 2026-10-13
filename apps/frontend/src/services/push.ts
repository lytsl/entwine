import { authClient } from "./auth-client";

const WORKER = "/push-worker.js";

/** Push needs a service worker and a push manager, which browsers offer only over HTTPS or on localhost. */
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** This browser's subscription, if it has one. */
export async function browserSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(WORKER);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** A VAPID key is URL-safe base64; the push manager takes its bytes. */
const keyBytes = (key: string) =>
  Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

/** Asks the person, then has the server push to this browser for as long as this session lasts. */
export async function subscribePush(serverKey: string): Promise<void> {
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error("The browser does not allow notifications from this site");
  const registration = await navigator.serviceWorker.register(WORKER);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(serverKey) }));
  await authClient.$fetch("/push/subscribe", { method: "POST", body: subscription.toJSON() });
}

/** Stops pushes to this browser; the server forgets it too while the session lasts, and with the session otherwise. */
export async function unsubscribePush(): Promise<void> {
  const subscription = await browserSubscription();
  if (!subscription) return;
  await authClient
    .$fetch("/push/unsubscribe", { method: "POST", body: { endpoint: subscription.endpoint } })
    .catch(() => {});
  await subscription.unsubscribe();
}

/**
 * The server ties a subscription to the session that sent it, and forgets it with that session; the browser keeps it.
 * A new session of this browser sends it again, so pushes keep coming after signing in anew.
 */
export async function renewPush(): Promise<void> {
  const subscription = await browserSubscription();
  if (subscription && Notification.permission === "granted")
    await authClient.$fetch("/push/subscribe", { method: "POST", body: subscription.toJSON() });
}
