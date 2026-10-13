/**
 * Web Push from this server. Its VAPID keys identify it to the browsers' push services; they are made on first start
 * and kept beside the auth database, since browsers' subscriptions are bound to the public one.
 */
import { chmod } from "node:fs/promises";
import webpush from "web-push";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What the app's service worker shows. `tag` folds a browser's notifications of one issue into one. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Resolves false when the push service no longer knows the browser, which is then forgotten; never throws. */
export type Pusher = (target: PushTarget, message: PushMessage) => Promise<boolean>;

/** A day: a browser away longer gets nothing, rather than a pile of old news. */
const TTL_SECONDS = 24 * 60 * 60;

/** `subject` is how a push service reaches the operator: an `https:` address or a `mailto:`. */
export async function webPusher(keyFile: string, subject: string): Promise<{ publicKey: string; push: Pusher }> {
  let keys: { publicKey: string; privateKey: string } | null = await Bun.file(keyFile)
    .json()
    .catch(() => null);
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    await Bun.write(keyFile, JSON.stringify(keys));
    await chmod(keyFile, 0o600);
  }
  const vapidDetails = { subject, ...keys };
  return {
    publicKey: keys.publicKey,
    async push(target, message) {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(message),
          { vapidDetails, TTL: TTL_SECONDS },
        );
        return true;
      } catch (error) {
        if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410))
          return false;
        console.error(`[push] could not push to ${new URL(target.endpoint).host}: ${(error as Error).message}`);
        return true;
      }
    },
  };
}
