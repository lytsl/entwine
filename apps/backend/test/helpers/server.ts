import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ServerOptions } from "../../src/server";
import type { Mail } from "../../src/services/mail/mailer";
import type { PushMessage, PushTarget } from "../../src/services/push";
import { removeTemp } from "./temp";

/** A signed-in account: requests through `fetch` carry its session cookie. */
export interface Account {
  id: string;
  email: string;
  cookie: string;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  json<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T>;
}

const ORIGIN = "http://localhost:3000";

/** What the server sent, and a promise of the first that matches, whether it came already or comes later. */
function recorder<T>() {
  const items: T[] = [];
  const waiting = new Set<{ match(item: T): boolean; resolve(item: T): void }>();
  return {
    items,
    add(item: T) {
      items.push(item);
      for (const wait of waiting)
        if (wait.match(item)) {
          waiting.delete(wait);
          wait.resolve(item);
        }
    },
    next(match: (item: T) => boolean): Promise<T> {
      const found = items.find(match);
      return found ? Promise.resolve(found) : new Promise((resolve) => waiting.add({ match, resolve }));
    },
  };
}

export async function testServer(options: ServerOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), "entwine-backend-"));
  const mail = recorder<Mail>();
  const pushes = recorder<PushTarget & { message: PushMessage }>();
  const start = () =>
    createServer({
      authPath: join(dir, "auth.db"),
      tenantDir: join(dir, "tenants"),
      secret: "test-secret-with-at-least-thirty-two-characters",
      baseURL: ORIGIN,
      mailer: (m) => mail.add(m),
      // A push service that no longer knows an endpoint ending in `/gone`.
      push: {
        publicKey: "test-push-key",
        push: async (target, message) => {
          pushes.add({ ...target, message });
          return !target.endpoint.endsWith("/gone");
        },
      },
      ...options,
    });
  let server = await start();

  const request = (path: string, init: RequestInit = {}, cookie?: string) => {
    const headers = new Headers(init.headers);
    headers.set("Origin", ORIGIN);
    if (cookie) headers.set("Cookie", cookie);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return Promise.resolve(server.app.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers })));
  };

  async function signUp(name: string): Promise<Account> {
    const email = `${name}@example.com`;
    const response = await request("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password: "password123" }),
    });
    if (!response.ok) throw new Error(`sign-up failed: ${await response.text()}`);
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const { user } = (await response.json()) as { user: { id: string } };
    const fetch = (path: string, init?: RequestInit) => request(path, init, cookie);
    return {
      id: user.id,
      email,
      cookie,
      fetch,
      async json(path, body) {
        const r = await fetch(path, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`${path} failed with ${r.status}: ${await r.text()}`);
        return r.json();
      },
    };
  }

  async function workspace(owner: Account, slug: string, members: [Account, string][] = []): Promise<string> {
    const { id } = await owner.json<{ id: string }>("/api/auth/organization/create", { name: slug, slug });
    for (const [account, role] of members) {
      const invitation = await owner.json<{ id: string }>("/api/auth/organization/invite-member", {
        email: account.email,
        role,
        organizationId: id,
      });
      await account.json("/api/auth/organization/accept-invitation", { invitationId: invitation.id });
    }
    return id;
  }

  return {
    get server() {
      return server;
    },
    mail: mail.items,
    /** The first mail that matches, now or once it is sent. */
    mailed: mail.next,
    pushes: pushes.items,
    pushed: pushes.next,
    /** Stops the server and starts another on the same data, as a restart does. */
    async restart() {
      await server.close();
      server = await start();
    },
    request,
    signUp,
    workspace,
    async cleanup() {
      await server.close();
      removeTemp(dir);
    },
  };
}
