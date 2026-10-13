import type { Mutation } from "@entwine/sync-engine/protocol";
import type { APIRequestContext } from "@playwright/test";
import { auditTitle, issue, planning, today } from "../helpers/seed";
import { expect } from "../helpers/test";

const ISSUE_COUNT = 10_000;
export const titleOf = (n: number) => auditTitle(n, 5);

export async function seed(request: APIRequestContext) {
  const post = async (path: string, data: unknown) => {
    const result = await request.post(path, { data, headers: { Origin: "http://localhost:3000" } });
    expect(result.ok(), `${path}: ${result.status()} ${await result.text()}`).toBe(true);
    return result.json();
  };
  const session = await post("/api/auth/sign-in/email", { email: "ada@example.com", password: "password123" });
  const workspace = await post("/api/auth/organization/create", {
    name: "Scale audit",
    slug: `scale-audit-${crypto.randomUUID()}`,
  });
  const members = [session.user.id];
  const sessions: Record<string, Awaited<ReturnType<APIRequestContext["storageState"]>>> = {};
  for (const name of ["bob", "cy"]) {
    const invitation = await post("/api/auth/organization/invite-member", {
      email: `${name}@example.com`,
      role: "member",
      organizationId: workspace.id,
    });
    const { request: contexts } = await import("@playwright/test");
    const member = await contexts.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { Origin: "http://localhost:3000" },
    });
    try {
      const signed = await member.post("/api/auth/sign-in/email", {
        data: { email: `${name}@example.com`, password: "password123" },
      });
      expect(signed.ok()).toBe(true);
      members.push((await signed.json()).user.id);
      const accepted = await member.post("/api/auth/organization/accept-invitation", {
        data: { invitationId: invitation.id },
      });
      expect(accepted.ok()).toBe(true);
      sessions[name] = await member.storageState();
    } finally {
      await member.dispose();
    }
  }
  const endpoint = `/api/w/${workspace.id}`;
  const transact = (mutations: Mutation[]) => post(`${endpoint}/transactions`, { id: crypto.randomUUID(), mutations });
  const { labels, projects, cycles, modules, mutations: plan } = planning(5, "10,000 issue audit");
  await transact(plan);
  const ids: string[] = [];
  const started = performance.now();
  for (let batch = 0; batch < ISSUE_COUNT; batch += 100) {
    const mutations: Mutation[] = [];
    for (let i = batch; i < batch + 100; i++) {
      const made = issue(i, { labels, projects, cycles, modules, members, perProject: 2000, title: titleOf(i + 1) });
      ids.push(made.id);
      mutations.push(...made.mutations);
    }
    await transact(mutations);
  }
  const loaded = await post(`${endpoint}/load`, {
    queries: [{ model: "Issue" }, { model: "IssueLabel" }, { model: "IssueModule" }],
  });
  expect(loaded.rows.Issue).toHaveLength(ISSUE_COUNT);
  expect(loaded.rows.IssueLabel).toHaveLength(7500);
  expect(loaded.rows.IssueModule).toHaveLength(6666);
  for (const p of projects)
    expect(loaded.rows.Issue.filter((i: { projectId: string }) => i.projectId === p.id)).toHaveLength(2000);
  sessions.ada = await request.storageState();
  return {
    workspace,
    endpoint,
    projects,
    labels,
    cycles,
    modules,
    ids,
    members,
    sessions,
    today,
    seedMs: performance.now() - started,
  };
}
export type Dataset = Awaited<ReturnType<typeof seed>>;
