/** What the seed scripts share. Everything goes through the real API, so the write rules apply. */
import type { Mutation } from "@entwine/sync-engine/protocol";
import { readEnv } from "../src/env";
import { createServer, type ServerOptions } from "../src/server";

const ORIGIN = readEnv().baseURL;
const PASSWORD = "password123";

export const insert = (model: Mutation["model"], value: Record<string, unknown>): Mutation => ({
  model,
  type: "insert",
  key: String(value.id),
  value,
});
export const update = (model: Mutation["model"], key: string, value: Record<string, unknown>): Mutation => ({
  model,
  type: "update",
  key,
  value,
});

/** Exits the process when the slug is taken. */
export async function seedWorkspace(name: string, slug: string, options?: ServerOptions) {
  const server = await createServer(options);

  async function call(path: string, body: unknown, cookie?: string) {
    const response = await server.app.fetch(
      new Request(`${ORIGIN}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(body),
      }),
    );
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    const cookies = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return { body: (await response.json()) as Record<string, any>, cookie: cookies || cookie || "" };
  }

  async function account(name: string) {
    const email = `${name.toLowerCase()}@example.com`;
    const signed = await call("/api/auth/sign-up/email", { name, email, password: PASSWORD }).catch(() =>
      call("/api/auth/sign-in/email", { email, password: PASSWORD }),
    );
    return { id: signed.body.user.id as string, email, cookie: signed.cookie };
  }

  const [ada, bob, cy] = await Promise.all(["Ada", "Bob", "Cy"].map(account));
  // No mail reaches example.com: the demo addresses are taken as verified, as their holders would have made them.
  server.auth.database.query('UPDATE user SET "emailVerified" = 1 WHERE id IN (?, ?, ?)').run(ada.id, bob.id, cy.id);
  const existing = await server.auth.auth.api
    .getFullOrganization({ headers: new Headers({ Cookie: ada.cookie }), query: { organizationSlug: slug } })
    .catch(() => null);
  if (existing) {
    console.log(`[seed] workspace ${slug} already exists`);
    process.exit(0);
  }

  const workspace = (await call("/api/auth/organization/create", { name, slug }, ada.cookie)).body;
  for (const [member, role] of [
    [bob, "admin"],
    [cy, "member"],
  ] as const) {
    const invitation = (
      await call(
        "/api/auth/organization/invite-member",
        { email: member.email, role, organizationId: workspace.id },
        ada.cookie,
      )
    ).body;
    await call("/api/auth/organization/accept-invitation", { invitationId: invitation.id }, member.cookie);
  }

  const transact = (mutations: Mutation[], cookie = ada.cookie) =>
    call(`/api/w/${workspace.id}/transactions`, { id: crypto.randomUUID(), mutations }, cookie);
  return { server, ada, bob, cy, transact };
}
