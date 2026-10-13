/**
 * The browsers that receive a person's push notifications. A subscription belongs to the session that made it, and
 * goes with it: a browser signed out, or whose sessions a password change ended, is pushed nothing more.
 */
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";

/**
 * The push services of the browsers. The server posts to a subscription's address, so any other host is refused:
 * it would make the server a client of whatever address someone gave.
 */
const PUSH_SERVICES = ["fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];

export const isPushService = (endpoint: string): boolean => {
  const url = URL.parse(endpoint);
  return (
    url?.protocol === "https:" &&
    PUSH_SERVICES.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  );
};

/** What `PushSubscription.toJSON()` gives in the browser. */
const subscription = z.object({
  endpoint: z.string().refine(isPushService, "Not a browser's push service"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const pushSubscriptions = () =>
  ({
    id: "push-subscriptions",
    schema: {
      pushSubscription: {
        fields: {
          userId: { type: "string", required: true, references: { model: "user", field: "id", onDelete: "cascade" } },
          sessionId: {
            type: "string",
            required: true,
            references: { model: "session", field: "id", onDelete: "cascade" },
          },
          endpoint: { type: "string", required: true, unique: true },
          p256dh: { type: "string", required: true },
          auth: { type: "string", required: true },
          createdAt: { type: "date", required: true },
        },
      },
    },
    endpoints: {
      subscribePush: createAuthEndpoint(
        "/push/subscribe",
        { method: "POST", body: subscription, use: [sessionMiddleware] },
        async (ctx) => {
          const { session } = ctx.context.session;
          const { endpoint, keys } = ctx.body;
          // A browser has one endpoint, whoever signed in last.
          await ctx.context.adapter.deleteMany({
            model: "pushSubscription",
            where: [{ field: "endpoint", value: endpoint }],
          });
          await ctx.context.adapter.create({
            model: "pushSubscription",
            data: {
              userId: session.userId,
              sessionId: session.id,
              endpoint,
              p256dh: keys.p256dh,
              auth: keys.auth,
              createdAt: new Date(),
            },
          });
          return ctx.json({ ok: true });
        },
      ),
      unsubscribePush: createAuthEndpoint(
        "/push/unsubscribe",
        { method: "POST", body: z.object({ endpoint: z.string().min(1) }), use: [sessionMiddleware] },
        async (ctx) => {
          await ctx.context.adapter.deleteMany({
            model: "pushSubscription",
            where: [
              { field: "endpoint", value: ctx.body.endpoint },
              { field: "userId", value: ctx.context.session.user.id },
            ],
          });
          return ctx.json({ ok: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
