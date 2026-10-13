import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";

/** The request header that carries the client's address to Better Auth; the app sets it, never the client. */
export const CLIENT_IP_HEADER = "x-entwine-client-ip";

/**
 * Sign-in attempts are limited per client address, which is therefore never taken from a header a client set.
 * `proxyHeader` is the header in which a reverse proxy in front of the server gives the client's address; the
 * last address in it is the one that proxy added. Without it the address is the connection's.
 */
export const clientIp =
  (proxyHeader?: string): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const forwarded = proxyHeader && c.req.header(proxyHeader)?.split(",").at(-1)?.trim();
    const ip = proxyHeader ? forwarded : c.env?.ip;
    const headers = new Headers(c.req.raw.headers);
    headers.delete(CLIENT_IP_HEADER);
    if (ip) headers.set(CLIENT_IP_HEADER, ip);
    c.req.raw = new Request(c.req.raw, { headers });
    await next();
  };
