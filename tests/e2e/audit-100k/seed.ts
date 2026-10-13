/**
 * Seeds through the HTTP API of a running backend, so the write rules and the change log see every row. Writes what
 * the specs need to `AUDIT_OUT` (dataset.json).
 */
import { writeFileSync } from "node:fs";
import { defaultStates, issueRelationId } from "@entwine/shared";
import type { Mutation } from "@entwine/sync-engine/protocol";
import { auditTitle, insert, issue, planning, today } from "../helpers/seed";

const ORIGIN = process.env.AUDIT_ORIGIN ?? "http://localhost:4100";
const BACKEND = process.env.AUDIT_BACKEND ?? "http://localhost:4101";
const OUT = process.env.AUDIT_OUT ?? "dataset.json";
const ISSUE_COUNT = Number(process.env.AUDIT_ISSUES ?? 100_000);
const PROJECTS = 10;
const PER_PROJECT = ISSUE_COUNT / PROJECTS;
const BATCH = 150;

/** Titles that a tracker must show as text, clip, or lay out without breaking. */
const EDGE_TITLES = [
  '<img src=x onerror="window.__xss=1">',
  "<script>window.__xss=2</script>",
  '"><svg onload=window.__xss=3>',
  "javascript:window.__xss=4",
  "L".repeat(500),
  "مرحبا بالعالم — right to left title",
  "日本語のタイトル 🚀👩‍👩‍👧‍👦 emoji and CJK",
  "Zero​width​space and ‮reversed",
  "   padded with spaces   ",
  "Robert'); DROP TABLE Issue;--",
  "%00 null %0a newline \\n \\t {{7*7}} ${7*7}",
];

async function call(path: string, body: unknown, cookie = "", attempt = 0): Promise<{ body: any; cookie: string }> {
  const response = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  if (response.status === 429 && attempt < 10) {
    await Bun.sleep(4000);
    return call(path, body, cookie, attempt + 1);
  }
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  const cookies = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { body: await response.json(), cookie: cookies || cookie };
}

async function account(name: string) {
  const email = `${name.toLowerCase()}@example.com`;
  const signed = await call("/api/auth/sign-up/email", { name, email, password: "password123" }).catch(() =>
    call("/api/auth/sign-in/email", { email, password: "password123" }),
  );
  return { name, email, id: signed.body.user.id as string, cookie: signed.cookie };
}

const ada = await account("Ada");
const bob = await account("Bob");
const cy = await account("Cy");
/** Dee has an account and no membership; Eve owns another workspace. */
const dee = await account("Dee");
const eve = await account("Eve");

const workspace = (
  await call(
    "/api/auth/organization/create",
    { name: "Scale 100k", slug: `scale-${Date.now().toString(36)}` },
    ada.cookie,
  )
).body;
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
const other = (
  await call(
    "/api/auth/organization/create",
    { name: "Eve's place", slug: `eve-${Date.now().toString(36)}` },
    eve.cookie,
  )
).body;

const endpoint = `/api/w/${workspace.id}`;
const transact = (mutations: Mutation[], cookie = ada.cookie) =>
  call(`${endpoint}/transactions`, { id: crypto.randomUUID(), mutations }, cookie);

const members = [ada.id, bob.id, cy.id];
const { labels, projects, cycles, modules, mutations: plan } = planning(PROJECTS, "100,000 issue audit");
await transact(plan);

const ids: string[] = [];
const timings: { issues: number; ms: number }[] = [];
const started = performance.now();
let mark = started;
for (let batch = 0; batch < ISSUE_COUNT; batch += BATCH) {
  const mutations: Mutation[] = [];
  for (let i = batch; i < Math.min(batch + BATCH, ISSUE_COUNT); i++) {
    const title = auditTitle(i + 1, 6);
    const made = issue(i, { labels, projects, cycles, modules, members, perProject: PER_PROJECT, title });
    ids.push(made.id);
    mutations.push(...made.mutations);
  }
  await transact(mutations);
  const done = Math.min(batch + BATCH, ISSUE_COUNT);
  if (done % 10_000 < BATCH && done >= 10_000 && Math.floor(done / 10_000) > timings.length) {
    timings.push({ issues: done, ms: Math.round(performance.now() - mark) });
    console.log(`[seed] ${done} issues, last 10k in ${Math.round(performance.now() - mark)} ms`);
    mark = performance.now();
  }
}
const seedMs = Math.round(performance.now() - started);

// Edge content lives in an eleventh project, so the counts of the ten uniform ones stay exact.
const edge = { id: crypto.randomUUID(), name: "Edge cases", identifier: "EDGE", description: "" };
const edgeIds = EDGE_TITLES.map(() => crypto.randomUUID());
const hub = crypto.randomUUID();
await transact([
  insert("Project", edge),
  ...defaultStates(edge.id).map((s) => insert("State", s)),
  ...EDGE_TITLES.map((title, n) =>
    insert("Issue", {
      id: edgeIds[n],
      projectId: edge.id,
      title,
      stateId: `${edge.id}:backlog`,
      description: n === 0 ? '<img src=x onerror="window.__xss=5"><script>window.__xss=6</script>' : "",
    }),
  ),
  insert("Issue", {
    id: hub,
    projectId: edge.id,
    title: "Hub issue with many comments",
    stateId: `${edge.id}:started`,
  }),
  ...edgeIds
    .slice(1, 6)
    .map((id) => ({ model: "Issue", type: "update" as const, key: id, value: { parentId: edgeIds[0] } })),
  insert("IssueRelation", { id: issueRelationId(hub, ids[0]), issueId: hub, relatedId: ids[0], type: "blocks" }),
  insert("IssueLink", { id: crypto.randomUUID(), issueId: hub, url: "https://example.com/spec", title: "Spec" }),
]);
for (let n = 0; n < 2000; n += 400)
  await transact(
    Array.from({ length: 400 }, (_, i) =>
      insert("Comment", { id: crypto.randomUUID(), issueId: hub, body: `Comment ${n + i + 1} on the hub` }),
    ),
  );

writeFileSync(
  OUT,
  JSON.stringify({
    origin: ORIGIN,
    workspace,
    other,
    endpoint,
    today,
    users: { ada, bob, cy, dee, eve },
    members,
    labels,
    projects,
    cycles,
    modules,
    edge: { project: edge, ids: edgeIds, titles: EDGE_TITLES, hub },
    issueCount: ISSUE_COUNT,
    perProject: PER_PROJECT,
    seedMs,
    timings,
    ids,
  }),
);
console.log(`[seed] done in ${seedMs} ms`);
