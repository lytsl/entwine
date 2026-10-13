import { type APIRequestContext, request, test } from "@playwright/test";
import { type Dataset, data, note } from "./helpers";

const ORIGIN = data.origin;
const api = (name: keyof Dataset["users"] | null, origin = ORIGIN) =>
  request.newContext({
    baseURL: ORIGIN,
    extraHTTPHeaders: { Origin: origin, ...(name ? { Cookie: data.users[name].cookie } : {}) },
  });

async function check(
  title: string,
  response: Promise<import("@playwright/test").APIResponse>,
  want: number | number[],
) {
  const r = await response;
  const body = (await r.text()).slice(0, 300);
  const ok = ([] as number[]).concat(want).includes(r.status());
  note(ok ? "ok" : "finding", "authz", title, { status: r.status(), want, body });
  return r;
}
const tx = (ctx: APIRequestContext, endpoint: string, mutations: unknown[]) =>
  ctx.post(`${endpoint}/transactions`, { data: { id: crypto.randomUUID(), mutations } });
const W = data.endpoint;
const issueId = data.ids[0];

test("workspace boundary: outsiders and other tenants", async () => {
  const anon = await api(null);
  const dee = await api("dee");
  const eve = await api("eve");
  for (const [who, ctx] of [
    ["anonymous", anon],
    ["non-member", dee],
    ["other workspace's owner", eve],
  ] as const) {
    const want = who === "anonymous" ? 401 : 403;
    await check(`${who} cannot load`, ctx.post(`${W}/load`, { data: { queries: [{ model: "Project" }] } }), want);
    await check(`${who} cannot write`, tx(ctx, W, [{ model: "Issue", type: "delete", key: issueId, value: {} }]), want);
    await check(`${who} cannot stream`, ctx.get(`${W}/stream?after=0`, { timeout: 5000 }), want);
  }
  // Rows of workspace A named from workspace B's endpoint.
  const E = `/api/w/${data.other.id}`;
  await check(
    "another tenant's issue id is unknown in mine",
    tx(eve, E, [{ model: "Issue", type: "update", key: issueId, value: { title: "pwned" } }]),
    404,
  );
  const leaked = await (
    await eve.post(`${E}/load`, {
      data: { queries: [{ model: "Issue", where: { id: issueId } }, { model: "Member" }] },
    })
  ).json();
  note(
    leaked.rows.Issue.length === 0 && leaked.rows.Member.length === 1 ? "ok" : "finding",
    "authz",
    "other tenant's load returns only its own rows",
    {
      issues: leaked.rows.Issue.length,
      members: leaked.rows.Member.length,
    },
  );
  await check(
    "path traversal in workspace id",
    eve.post(`/api/w/..%2F${data.workspace.id}/load`, { data: { queries: [{ model: "Project" }] } }),
    [403, 404],
  );
  await check(
    "outsider reads full organization",
    dee.get(`/api/auth/organization/get-full-organization?organizationId=${data.workspace.id}`),
    [400, 403, 404],
  );
  await check(
    "outsider lists members",
    dee.get(`/api/auth/organization/list-members?organizationId=${data.workspace.id}`),
    [400, 403, 404],
  );
  await check(
    "outsider lists invitations",
    dee.get(`/api/auth/organization/list-invitations?organizationId=${data.workspace.id}`),
    [400, 403, 404],
  );
  await check(
    "outsider checks slug (existence oracle)",
    dee.post(`/api/auth/organization/check-slug`, { data: { slug: data.workspace.slug } }),
    [400, 403, 404],
  );
});

test("roles: what a plain member may not do", async () => {
  const cy = await api("cy");
  const ada = await api("ada");
  const org = { organizationId: data.workspace.id };
  await check(
    "member deletes a project",
    tx(cy, W, [{ model: "Project", type: "delete", key: data.projects[9].id, value: {} }]),
    403,
  );
  await check(
    "member deletes another's issue",
    tx(cy, W, [{ model: "Issue", type: "delete", key: issueId, value: {} }]),
    403,
  );
  await check(
    "member deletes another's cycle",
    tx(cy, W, [{ model: "Cycle", type: "delete", key: data.cycles[9].id, value: {} }]),
    403,
  );
  await check(
    "member writes the member directory",
    tx(cy, W, [{ model: "Member", type: "update", key: data.users.cy.id, value: { role: "owner" } }]),
    403,
  );
  await check(
    "member forges activity",
    tx(cy, W, [
      {
        model: "Activity",
        type: "insert",
        key: "a1",
        value: { id: "a1", issueId, actorId: data.users.ada.id, field: "title" },
      },
    ]),
    403,
  );
  await check(
    "member writes the change log model",
    tx(cy, W, [{ model: "Change", type: "delete", key: "1", value: {} }]),
    400,
  );
  await check(
    "member promotes themself",
    cy.post("/api/auth/organization/update-member-role", { data: { ...org, role: "owner", memberId: "self" } }),
    [400, 401, 403, 404],
  );
  await check(
    "member invites",
    cy.post("/api/auth/organization/invite-member", { data: { ...org, email: "x@example.com", role: "member" } }),
    [401, 403],
  );
  await check(
    "member removes the owner",
    cy.post("/api/auth/organization/remove-member", { data: { ...org, memberIdOrEmail: "ada@example.com" } }),
    [400, 401, 403],
  );
  await check(
    "member renames the workspace",
    cy.post("/api/auth/organization/update", { data: { ...org, data: { name: "pwned" } } }),
    [400, 401, 403],
  );
  await check(
    "member deletes the workspace",
    cy.post("/api/auth/organization/delete", { data: org }),
    [400, 401, 403, 404],
  );
  await check(
    "owner deletes the workspace (disabled)",
    ada.post("/api/auth/organization/delete", { data: org }),
    [400, 401, 403, 404],
  );
  await check(
    "invite with a made-up role",
    ada.post("/api/auth/organization/invite-member", { data: { ...org, email: "y@example.com", role: "superuser" } }),
    400,
  );

  const id = crypto.randomUUID();
  const p = data.projects[9].id;
  const forged = await tx(cy, W, [
    {
      model: "Issue",
      type: "insert",
      key: id,
      value: {
        id,
        projectId: p,
        title: "Forged fields",
        stateId: `${p}:backlog`,
        creatorId: data.users.ada.id,
        number: 1,
        createdAt: 1,
        updatedAt: 1,
        archivedAt: 5,
      },
    },
  ]);
  const row = (await (await cy.post(`${W}/load`, { data: { queries: [{ model: "Issue", where: { id } }] } })).json())
    .rows.Issue[0];
  const honest =
    row && row.creatorId === data.users.cy.id && row.number > 1 && row.createdAt > 1 && row.archivedAt === null;
  note(honest ? "ok" : "finding", "authz", "server-owned issue fields ignore the client", {
    status: forged.status(),
    row,
  });
  await check(
    "undo of another member's transaction",
    cy.post(`${W}/transactions`, { data: { id: crypto.randomUUID(), revert: "not-mine" } }),
    [403, 409],
  );
  await check(
    "cross-project state",
    tx(cy, W, [{ model: "Issue", type: "update", key: id, value: { stateId: `${data.projects[0].id}:backlog` } }]),
    400,
  );
  await check(
    "assign to a non-member",
    tx(cy, W, [{ model: "Issue", type: "update", key: id, value: { assigneeId: data.users.dee.id } }]),
    400,
  );
  await check("own parent", tx(cy, W, [{ model: "Issue", type: "update", key: id, value: { parentId: id } }]), 400);
  await check(
    "start after due",
    tx(cy, W, [{ model: "Issue", type: "update", key: id, value: { startDate: "2026-02-02", dueDate: "2026-01-01" } }]),
    400,
  );
  await check(
    "impossible date",
    tx(cy, W, [{ model: "Issue", type: "update", key: id, value: { dueDate: "2026-02-31" } }]),
    400,
  );
  await check(
    "javascript: link",
    tx(cy, W, [
      { model: "IssueLink", type: "insert", key: "l1", value: { id: "l1", issueId: id, url: "javascript:alert(1)" } },
    ]),
    400,
  );
  await check("empty title", tx(cy, W, [{ model: "Issue", type: "update", key: id, value: { title: "   " } }]), 400);
  await check(
    "501-character title",
    tx(cy, W, [{ model: "Issue", type: "update", key: id, value: { title: "x".repeat(501) } }]),
    400,
  );
  await check("own issue can be deleted", tx(cy, W, [{ model: "Issue", type: "delete", key: id, value: {} }]), 200);
});

test("request bounds and injection", async () => {
  const cy = await api("cy");
  const load = (queries: unknown) => cy.post(`${W}/load`, { data: { queries } });
  await check("SQL in a field name", load([{ model: "Issue", where: { 'id" OR 1=1 --': "x" } }]), 400);
  await check("SQL in a model name", load([{ model: 'Issue"; DROP TABLE Issue; --' }]), 400);
  await check("internal table: change", load([{ model: "change" }]), 400);
  await check("internal table: sqlite_master", load([{ model: "sqlite_master" }]), 400);
  await check(
    "SQL in select",
    load([{ model: "Issue", where: { id: { model: "Issue", select: "id FROM Issue; --" } } }]),
    400,
  );
  await check("SQL in a value stays a value", load([{ model: "Issue", where: { id: "x' OR '1'='1" } }]), 200);
  await check("101 queries", load(Array.from({ length: 101 }, () => ({ model: "Label" }))), 400);
  await check(
    "1001 values",
    load([{ model: "Issue", where: { id: Array.from({ length: 1001 }, (_, i) => `${i}`) } }]),
    400,
  );
  await check("queries not an array", load({ model: "Issue" }), 400);
  await check("object as a value", load([{ model: "Issue", where: { id: { $ne: null } } }]), 400);
  await check("form-encoded body", cy.post(`${W}/transactions`, { form: { id: "x" } }), 415);
  await check(
    "text/plain body",
    cy.post(`${W}/transactions`, { headers: { "Content-Type": "text/plain" }, data: "{}" }),
    415,
  );
  await check(
    "2 MB body",
    cy.post(`${W}/transactions`, {
      data: {
        id: "x",
        mutations: [{ model: "Issue", type: "update", key: "x", value: { title: "x".repeat(2_000_000) } }],
      },
    }),
    413,
  );
  await check(
    "501 mutations",
    tx(
      cy,
      W,
      Array.from({ length: 501 }, () => ({ model: "Issue", type: "update", key: "x", value: {} })),
    ),
    400,
  );
  await check("empty transaction", tx(cy, W, []), 400);
  await check(
    "stream with another epoch resets, not errors",
    cy.get(`${W}/stream?epoch=nope&after=999999999`, { timeout: 5000 }),
    200,
  );
  await check(
    "cross-origin write is refused",
    (await api("cy", "http://evil.example")).post(`${W}/transactions`, {
      data: {
        id: crypto.randomUUID(),
        mutations: [
          { model: "Label", type: "insert", key: "csrf", value: { id: "csrf", name: "csrf", color: "#000000" } },
        ],
      },
    }),
    [401, 403],
  );
});
