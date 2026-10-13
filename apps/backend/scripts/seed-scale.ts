/**
 * `bun run seed:scale`: workspace "scale" for the demo accounts, with 100,000 issues over ten projects (or the
 * count given as an argument). Dates are laid out around the day of seeding: start and due dates from sixty days
 * back to sixty days ahead, and in each project a past, a current and an upcoming cycle holding the issues due
 * within them. Every twenty issues of a project form a family with sub-issues two levels deep, relations of each
 * type, links, comments and an archived issue.
 * Project "Edge cases" holds one issue per limit and oddity, named after it; "Archived" and "Empty" are projects in
 * those states.
 * Running it again changes nothing.
 */

import {
  ARCHIVABLE_GROUPS,
  addDays,
  defaultStates,
  ESTIMATES,
  issueRelationId,
  localToday,
  MODULE_STATUSES,
  PRIORITIES,
  pairId,
  type RelationType,
  STATE_GROUPS,
  type StateGroup,
} from "@entwine/shared";
import { MAX_MUTATIONS, type Mutation } from "@entwine/sync-engine/protocol";
import { insert, seedWorkspace, update } from "./seed-workspace";

const ISSUES = Number(process.argv[2] ?? 100_000);
const PROJECTS = 10;
/** A project's issues, in order, form families of this many: what an issue gets depends on its place in one. */
const FAMILY = 20;
const VERBS = ["Fix", "Add", "Remove", "Refactor", "Document", "Test", "Speed up", "Redesign", "Investigate"];
const THINGS = ["sign-in", "search", "billing", "notifications", "onboarding", "exports", "webhooks", "permissions"];
const PLACES = [
  "on mobile",
  "in the API",
  "in settings",
  "for admins",
  "for guests",
  "in the editor",
  "on slow networks",
];

// The seed sends more requests in a minute than a member may.
const { server, ada, bob, cy, transact } = await seedWorkspace("Scale", "scale", { requestsPerMinute: 1_000_000 });
const today = localToday();
const assignees = [ada.id, bob.id, cy.id, null];

const relate = (issueId: string, relatedId: string, type: RelationType) =>
  insert("IssueRelation", { id: issueRelationId(issueId, relatedId), issueId, relatedId, type });
const label = (issueId: string, labelId: string) =>
  insert("IssueLabel", { id: pairId(issueId, labelId), issueId, labelId });
const inModule = (issueId: string, moduleId: string) =>
  insert("IssueModule", { id: pairId(issueId, moduleId), issueId, moduleId });
const link = (issueId: string, url: string, title = "") =>
  insert("IssueLink", { id: crypto.randomUUID(), issueId, url, title });
const comment = (issueId: string, body: string) => insert("Comment", { id: crypto.randomUUID(), issueId, body });
const archive = (model: "Issue" | "Project", id: string) => update(model, id, { archivedAt: Date.now() });

const labels = ["Bug", "Feature", "Docs", "Chore"].map((name, n) => ({
  id: crypto.randomUUID(),
  name,
  color: ["#eb5757", "#5e6ad2", "#4cb782", "#95a2b3"][n],
}));
const projects = Array.from({ length: PROJECTS }, (_, n) => ({
  id: crypto.randomUUID(),
  name: `Project ${n + 1}`,
  identifier: `P${n + 1}`,
  description: "",
}));
/** Two-week cycles, offset in days from today: the past, the current and the upcoming one. */
const CYCLE_STARTS = [-21, -7, 7];
const cycles = projects.map((project) =>
  CYCLE_STARTS.map((from, n) => ({
    id: crypto.randomUUID(),
    projectId: project.id,
    name: `Sprint ${n + 1}`,
    startDate: addDays(today, from),
    endDate: addDays(today, from + 13),
  })),
);
const modules = projects.map((project) =>
  (
    [
      ["Launch", "in_progress"],
      ["Polish", "planned"],
    ] as const
  ).map(([name, status]) => ({ id: crypto.randomUUID(), projectId: project.id, name, status })),
);
await transact([
  ...labels.map((label) => insert("Label", label)),
  ...projects.flatMap((project) => [
    insert("Project", project),
    ...defaultStates(project.id).map((state) => insert("State", state)),
  ]),
  ...cycles.flat().map((cycle) => insert("Cycle", cycle)),
  ...modules.flat().map((module) => insert("Module", module)),
]);

const started = performance.now();
const ids: string[] = [];
let mutations: Mutation[] = [];
for (let i = 0; i < ISSUES; i++) {
  const n = i % PROJECTS;
  const project = projects[n];
  const id = crypto.randomUUID();
  ids.push(id);
  const k = Math.floor(i / PROJECTS);
  const slot = k % FAMILY;
  /** The issue `by` places before this one in its project. */
  const back = (by: number) => ids[i - by * PROJECTS];
  // Shifted by one per family, so that a place in a family is not always in the same state.
  const group = STATE_GROUPS[(k + Math.floor(k / FAMILY)) % STATE_GROUPS.length];
  const due = i % 7 === 0 ? null : (i % 121) - 60;
  const cycle = due === null ? undefined : cycles[n][CYCLE_STARTS.findIndex((from) => due >= from && due < from + 14)];
  // Place 0 is the parent of places 1 to 3, and place 3 of place 4.
  const parentId = slot >= 1 && slot <= 3 ? back(slot) : slot === 4 ? back(1) : null;
  const rows = [
    insert("Issue", {
      id,
      projectId: project.id,
      title: `${VERBS[i % VERBS.length]} ${THINGS[i % THINGS.length]} ${PLACES[i % PLACES.length]}`,
      stateId: pairId(project.id, group),
      priority: PRIORITIES[Math.floor(i / 50) % PRIORITIES.length],
      assigneeId: assignees[Math.floor(i / 250) % assignees.length],
      parentId,
      startDate: due === null ? null : addDays(today, due - (i % 10) - 1),
      dueDate: due === null ? null : addDays(today, due),
      estimate: ESTIMATES[i % (ESTIMATES.length + 1)] ?? null,
      cycleId: cycle?.id ?? null,
    }),
  ];
  if (i % 4 !== 0) {
    const first = Math.floor(i / 4) % labels.length;
    rows.push(label(id, labels[first].id));
    if (i % 5 === 0) rows.push(label(id, labels[(first + 1) % labels.length].id));
  }
  if (i % 3 === 0) rows.push(inModule(id, modules[n][0].id));
  if (k % 4 === 0) rows.push(inModule(id, modules[n][1].id));
  // A sub-issue blocked by its sibling, a pair, a chain of three, and one relation of each other type.
  if (slot === 2 || slot === 14 || slot === 15) rows.push(relate(back(1), id, "blocks"));
  if (slot === 7) rows.push(relate(id, back(1), "blocks"));
  if (slot === 9) rows.push(relate(id, ids[i - PROJECTS - 1], "relates_to")); // an issue of another project
  if (slot === 11) rows.push(relate(id, back(1), "duplicate"));
  if (slot === 12 || slot === 16) rows.push(link(id, `https://example.com/specs/${i}`, `Spec ${i}`));
  if (slot === 16) rows.push(link(id, `https://github.com/example/repo/pull/${i}`));
  if (slot === 0 || slot === 5) rows.push(comment(id, `Picked this up while looking at ${THINGS[i % THINGS.length]}.`));
  if (slot === 18 && ARCHIVABLE_GROUPS.includes(group)) rows.push(archive("Issue", id));

  if (mutations.length + rows.length > MAX_MUTATIONS) {
    await transact(mutations);
    mutations = [];
  }
  mutations.push(...rows);
  if ((i + 1) % 10_000 === 0) console.log(`[seed] ${i + 1} issues`);
}
if (mutations.length) await transact(mutations);

const edge = { id: crypto.randomUUID(), name: "Edge cases", identifier: "EDGE", description: "One issue per limit." };
const archived = { id: crypto.randomUUID(), name: "Archived", identifier: "ARCH", description: "" };
const empty = { id: crypto.randomUUID(), name: "Empty", identifier: "EMPTY", description: "" };
const review = { id: crypto.randomUUID(), projectId: edge.id, name: "In Review", color: "#f2994a", position: 5 };
const wontFix = { id: crypto.randomUUID(), projectId: edge.id, name: "Won't fix", color: "#6b6f76", position: 6 };
const longLabel = {
  id: crypto.randomUUID(),
  name: "A label name at the limit of fifty characters long",
  color: "#bb87fc",
};
const edgeModules = MODULE_STATUSES.map((status) => ({
  id: crypto.randomUUID(),
  projectId: edge.id,
  name: `Module ${status.replace("_", " ")}`,
  status,
}));
const dated = (name: string, from: number, days: number, projectId = edge.id) =>
  insert("Cycle", {
    id: crypto.randomUUID(),
    projectId,
    name,
    startDate: addDays(today, from),
    endDate: addDays(today, from + days - 1),
  });

const edges: Mutation[] = [
  ...[edge, archived, empty].flatMap((project) => [
    insert("Project", project),
    ...defaultStates(project.id).map((state) => insert("State", state)),
  ]),
  // Two states in one group.
  insert("State", { ...review, group: "started" }),
  insert("State", { ...wontFix, group: "cancelled" }),
  insert("Label", longLabel),
  insert("Label", { id: crypto.randomUUID(), name: "Unused", color: "#95a2b3" }),
  ...edgeModules.map((module) => insert("Module", module)),
  dated("Cycle without issues", -7, 14),
  dated("Cycle of one day", 0, 1),
  dated("Cycle of two years, over the others", -365, 730),
  dated("Sprint 1", -14, 14, archived.id),
];

function add(title: string, group: StateGroup = "backlog", fields: Record<string, unknown> = {}): string {
  const id = crypto.randomUUID();
  const projectId = (fields.projectId as string | undefined) ?? edge.id;
  edges.push(insert("Issue", { id, projectId, title, stateId: pairId(projectId, group), ...fields }));
  return id;
}
const day = (offset: number) => addDays(today, offset);

add(`${"The 500 character limit of a title ".repeat(15).slice(0, 499)}.`);
add("Unbroken".padEnd(500, "W"));
add("T");
add('<script>alert("title")</script> & <b>markup</b> **not bold** [not a link](https://example.com)');
add("Emoji 🚀 👩‍👩‍👧‍👦 🏳️‍🌈, accents Ærøskøbing, CJK 課題を修正する, right-to-left إصلاح تسجيل الدخول and שלום");
add("Description at the limit of 100,000 characters", "backlog", {
  description: "A line of a description at the limit of its length.\n".repeat(2000).slice(0, 100_000),
});
add("Description with markup", "backlog", {
  description:
    '# Heading\n\n- a list\n- of two\n\n`code`, **bold** and <img src=x onerror="alert(1)">\n\n\n\nBlank lines above.',
});

add("Starts and is due today", "started", { startDate: today, dueDate: today });
add("Due a year ago and still in progress", "started", { startDate: day(-400), dueDate: day(-365) });
add("Due in five years", "backlog", { startDate: today, dueDate: day(5 * 365) });
add("Start date without a due date", "unstarted", { startDate: day(3) });
add("Due date without a start date", "unstarted", { dueDate: day(3) });
add("Completed after its due date", "completed", { dueDate: day(-30) });
add("Cancelled with a due date ahead", "cancelled", { dueDate: day(30) });
add("In the backlog and overdue", "backlog", { dueDate: day(-1) });

add("Nothing set");
const full = add("Everything set", "started", {
  description: "Every property, every label, every module.",
  priority: "urgent",
  assigneeId: cy.id,
  startDate: day(-2),
  dueDate: day(2),
  estimate: ESTIMATES.at(-1),
});
for (const { id } of [...labels, longLabel]) edges.push(label(full, id));
for (const { id } of edgeModules) edges.push(inModule(full, id));
add("In a second state of its group", "started", { stateId: review.id });
add("In a second cancelled state", "cancelled", { stateId: wontFix.id });

const wide = add("Parent of 250 sub-issues", "started");
for (let n = 0; n < 250; n++)
  add(`Sub-issue ${n + 1} of 250`, STATE_GROUPS[n % STATE_GROUPS.length], { parentId: wide });
let deep = add("Top of a chain twelve sub-issues deep");
for (let n = 1; n <= 12; n++) deep = add(`Sub-issue at depth ${n}`, "backlog", { parentId: deep });
const doneParent = add("Completed parent of an open sub-issue", "completed");
add("Open sub-issue of a completed parent", "started", { parentId: doneParent });
const openParent = add("Open parent whose sub-issues are all completed", "started");
for (let n = 0; n < 3; n++) add(`Completed sub-issue ${n + 1}`, "completed", { parentId: openParent });
const archivedParent = add("Archived parent of an open sub-issue", "completed");
add("Open sub-issue of an archived parent", "started", { parentId: archivedParent });
edges.push(archive("Issue", archivedParent));
const keptParent = add("Open parent of an archived sub-issue", "started");
edges.push(archive("Issue", add("Archived sub-issue of an open parent", "cancelled", { parentId: keptParent })));

const blocked = add("Blocked by 30 issues", "unstarted");
for (let n = 0; n < 30; n++) edges.push(relate(add(`Blocker ${n + 1} of 30`, "started"), blocked, "blocks"));
const blocker = add("Blocks 30 issues", "started");
for (let n = 0; n < 30; n++) edges.push(relate(blocker, add(`Blocked ${n + 1} of 30`), "blocks"));
const loop = ["first", "second", "third"].map((name) => add(`Blocking loop, ${name} of three`, "unstarted"));
loop.forEach((id, n) => edges.push(relate(id, loop[(n + 1) % loop.length], "blocks")));
const resolved = add("Blocked only by finished issues", "unstarted");
edges.push(relate(add("Completed blocker", "completed"), resolved, "blocks"));
edges.push(relate(add("Cancelled blocker", "cancelled"), resolved, "blocks"));
const archivedBlocker = add("Archived blocker", "completed");
edges.push(relate(archivedBlocker, resolved, "blocks"), archive("Issue", archivedBlocker));
const family = add("Parent that blocks its sub-issue", "started");
edges.push(relate(family, add("Sub-issue blocked by its parent", "backlog", { parentId: family }), "blocks"));
const every = add("Blocks, is blocked by, relates to and duplicates", "started");
edges.push(
  relate(every, add("Blocked by the issue with every relation"), "blocks"),
  relate(add("Blocker of the issue with every relation", "started"), every, "blocks"),
  relate(every, add("Related to the issue with every relation"), "relates_to"),
  relate(every, add("Original the issue with every relation duplicates", "cancelled"), "duplicate"),
);
const far = add("Blocked by issues of other projects", "unstarted");
if (ids.length) edges.push(relate(ids[0], far, "blocks"));
const frozen = Array.from({ length: 5 }, (_, n) =>
  add(`Issue ${n + 1} of an archived project`, STATE_GROUPS[n], { projectId: archived.id }),
);
edges.push(relate(frozen[2], far, "blocks"), archive("Project", archived.id));
const related = add("Relates to 10 issues");
for (let n = 0; n < 10; n++) edges.push(relate(related, add(`Related ${n + 1} of 10`), "relates_to"));

const linked = add("25 links");
for (let n = 0; n < 22; n++) edges.push(link(linked, `https://example.com/links/${n + 1}`, `Link ${n + 1}`));
edges.push(
  link(linked, "https://example.com/untitled"),
  link(linked, `https://example.com/${"long/".repeat(396)}`, "An address at the limit of 2,000 characters"),
  link(
    linked,
    "https://example.com/links/1",
    "The first address again, under a title at the limit of its length".padEnd(200, "!"),
  ),
);
const discussed = add("200 comments by three members", "started");
edges.push(comment(add("A comment at the limit of 20,000 characters"), "A long comment. ".repeat(1250)));

for (let from = 0; from < edges.length; from += MAX_MUTATIONS) await transact(edges.slice(from, from + MAX_MUTATIONS));
// A comment is its sender's, so each member sends their own, in turn.
const members = [ada, bob, cy];
for (let n = 0; n < 200; n++) await transact([comment(discussed, `Comment ${n + 1} of 200.`)], members[n % 3].cookie);

console.log(
  `[seed] workspace scale: ${ISSUES} issues in ${Math.round((performance.now() - started) / 1000)} s; ` +
    "sign in as ada@example.com, bob@example.com or cy@example.com with password123",
);
await server.close();
