import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ServerOptions } from "@entwine/backend/server";
import { MODELS, type Rows } from "@entwine/shared";
import type { LoadResponse } from "@entwine/sync-engine/protocol";
import { type Client, type ClientOptions, ORIGIN, openClient } from "./client";

export interface Session {
  userId: string;
  email: string;
  cookie: string;
}

/** A backend on a temporary data directory: its accounts and workspaces, and the clients opened on it. */
export async function harness(options: Pick<ServerOptions, "heartbeatMs" | "retentionMs" | "now"> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "entwine-integration-"));
  const server = await createServer({
    authPath: join(dir, "auth.db"),
    tenantDir: join(dir, "tenants"),
    secret: "integration-secret-with-at-least-32-characters",
    baseURL: ORIGIN,
    mailer: () => {},
    ...options,
  });
  const clients: Client[] = [];
  const requests = new Set<Promise<Response>>();
  const streams = new Set<() => Promise<void>>();

  const request = async (path: string, init: RequestInit = {}, cookie?: string) => {
    const headers = new Headers(init.headers);
    headers.set("Origin", ORIGIN);
    if (cookie) headers.set("Cookie", cookie);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = Promise.resolve(server.app.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers })));
    requests.add(response);
    try {
      return await response;
    } finally {
      requests.delete(response);
    }
  };
  const post = async (path: string, body: unknown, cookie?: string) => {
    const response = await request(path, { method: "POST", body: JSON.stringify(body) }, cookie);
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    return response;
  };

  async function signUp(name: string): Promise<Session> {
    const email = `${name}@example.com`;
    const response = await post("/api/auth/sign-up/email", { name, email, password: "password123" });
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return { userId: ((await response.json()) as { user: { id: string } }).user.id, email, cookie };
  }

  async function workspace(owner: Session, slug: string, members: Session[] = []): Promise<string> {
    const { id } = (await (await post("/api/auth/organization/create", { name: slug, slug }, owner.cookie)).json()) as {
      id: string;
    };
    for (const member of members) {
      const invitation = (await (
        await post(
          "/api/auth/organization/invite-member",
          { email: member.email, role: "member", organizationId: id },
          owner.cookie,
        )
      ).json()) as { id: string };
      await post("/api/auth/organization/accept-invitation", { invitationId: invitation.id }, member.cookie);
    }
    return id;
  }

  /** `cleanup` closes the client. */
  async function connect(session: Session, workspaceId: string, options: ClientOptions = {}): Promise<Client> {
    const client = await openClient({ request, streams }, session.cookie, workspaceId, options);
    clients.push(client);
    return client;
  }

  /** Every row the server holds, as `session` loads them. */
  async function snapshot(session: Session, workspaceId: string) {
    const response = await request(
      `/api/w/${workspaceId}/load`,
      { method: "POST", body: JSON.stringify({ queries: MODELS.map((model) => ({ model })) }) },
      session.cookie,
    );
    const { cursor, rows } = (await response.json()) as LoadResponse;
    return {
      cursor,
      rows: Object.fromEntries(MODELS.map((model) => [model, rows[model] ?? []])) as {
        [M in keyof Rows]: Rows[M][];
      },
    };
  }

  return {
    dir,
    server,
    signUp,
    workspace,
    connect,
    snapshot,
    request,
    post,
    async cleanup() {
      await Promise.all(clients.map((client) => client.close()));
      // Aborting a client does not stop a Hono handler already using the auth database.
      while (requests.size) await Promise.allSettled([...requests]);
      await Promise.all([...streams].map((cancel) => cancel()));
      await server.close();
      // Windows keeps a closed SQLite file locked until its statements are garbage-collected; one the test still
      // references survives, and the directory stays.
      Bun.gc(true);
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
    },
  };
}
