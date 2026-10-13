/**
 * `bun run seed:demo`: demo accounts (ada, bob and cy @example.com, password "password123") in workspace "acme",
 * through the real API, so the write rules apply. Running it again changes nothing.
 */

import { addDays, defaultStates, issueRelationId, localToday, pairId } from "@entwine/shared";
import { insert, seedWorkspace, update } from "./seed-workspace";

const { server, bob, cy, transact } = await seedWorkspace("Acme", "acme");

const projects = [
  { id: crypto.randomUUID(), name: "Website", identifier: "WEB", description: "The marketing site." },
  { id: crypto.randomUUID(), name: "API", identifier: "API", description: "The public API." },
];
for (const project of projects) {
  await transact([insert("Project", project), ...defaultStates(project.id).map((state) => insert("State", state))]);
}
const labels = [
  { id: crypto.randomUUID(), name: "Bug", color: "#eb5757" },
  { id: crypto.randomUUID(), name: "Feature", color: "#5e6ad2" },
  { id: crypto.randomUUID(), name: "Docs", color: "#4cb782" },
];
await transact(labels.map((label) => insert("Label", label)));

const issues: [number, string, string, string, string | null, number][] = [
  [0, "Redesign the landing page", "started", "high", bob.id, 1],
  [0, "Fix broken footer links", "unstarted", "urgent", null, 0],
  [0, "Add a pricing page", "backlog", "medium", cy.id, 1],
  [0, "Compress hero images", "completed", "low", bob.id, 0],
  [1, "Rate-limit the search endpoint", "started", "high", cy.id, 0],
  [1, "Document pagination", "unstarted", "none", null, 2],
  [1, "Return 404 for unknown projects", "backlog", "medium", null, 0],
];
/** Due dates relative to the day of seeding, so that the calendar and the due filters have something to show. */
const due: Record<string, number> = {
  "Fix broken footer links": 2,
  "Rate-limit the search endpoint": 5,
  "Document pagination": -1,
  "Add a pricing page": 12,
};
const issueIds: Record<string, string> = {};
for (const [projectIndex, title, group, priority, assigneeId, labelIndex] of issues) {
  const project = projects[projectIndex];
  const id = crypto.randomUUID();
  issueIds[title] = id;
  const estimate = priority === "high" ? 5 : priority === "urgent" ? 2 : null;
  await transact([
    insert("Issue", {
      id,
      projectId: project.id,
      title,
      stateId: pairId(project.id, group),
      priority,
      assigneeId,
      estimate,
      dueDate: title in due ? addDays(localToday(), due[title]) : null,
    }),
    insert("IssueLabel", { id: pairId(id, labels[labelIndex].id), issueId: id, labelId: labels[labelIndex].id }),
  ]);
  if (title.startsWith("Redesign")) {
    await transact(
      [insert("Comment", { id: crypto.randomUUID(), issueId: id, body: "First sketches are in the shared folder." })],
      bob.cookie,
    );
  }
}

const landing = issueIds["Redesign the landing page"];
const [web] = projects;
await transact(
  (
    [
      ["Draft the hero copy", "completed"],
      ["Pick the illustrations", "started"],
      ["Build the new layout", "unstarted"],
    ] as const
  ).map(([title, group]) =>
    insert("Issue", {
      id: crypto.randomUUID(),
      projectId: web.id,
      title,
      stateId: pairId(web.id, group),
      parentId: landing,
      estimate: 1,
    }),
  ),
);
const footer = issueIds["Fix broken footer links"];
await transact([
  insert("IssueRelation", {
    id: issueRelationId(footer, landing),
    issueId: footer,
    relatedId: landing,
    type: "blocks",
  }),
  insert("IssueLink", {
    id: crypto.randomUUID(),
    issueId: landing,
    url: "https://www.figma.com/file/landing",
    title: "Landing page designs",
  }),
]);

// Cycles around the day of seeding, so that one is past, one current and one upcoming; two modules share an issue.
const sprint = (n: number, from: number, description = "") => ({
  id: crypto.randomUUID(),
  projectId: web.id,
  name: `Sprint ${n}`,
  description,
  startDate: addDays(localToday(), from),
  endDate: addDays(localToday(), from + 13),
});
const [past, current, upcoming] = [sprint(1, -21), sprint(2, -7, "Ship the new landing page."), sprint(3, 7)];
const launch = { id: crypto.randomUUID(), projectId: web.id, name: "Launch", status: "in_progress" };
const pricing = { id: crypto.randomUUID(), projectId: web.id, name: "Pricing", status: "planned" };
const cycleOf: Record<string, string> = {
  "Compress hero images": past.id,
  "Redesign the landing page": current.id,
  "Fix broken footer links": current.id,
  "Add a pricing page": upcoming.id,
};
const modulesOf: Record<string, string[]> = {
  "Redesign the landing page": [launch.id],
  "Fix broken footer links": [launch.id],
  "Add a pricing page": [launch.id, pricing.id],
};
await transact([
  ...[past, current, upcoming].map((cycle) => insert("Cycle", cycle)),
  ...[launch, pricing].map((module) => insert("Module", module)),
  ...Object.entries(cycleOf).map(([title, cycleId]) => update("Issue", issueIds[title], { cycleId })),
  ...Object.entries(modulesOf).flatMap(([title, moduleIds]) =>
    moduleIds.map((moduleId) =>
      insert("IssueModule", { id: pairId(issueIds[title], moduleId), issueId: issueIds[title], moduleId }),
    ),
  ),
]);

await transact([
  insert("View", {
    id: crypto.randomUUID(),
    name: "Urgent and high",
    projectId: null,
    query: JSON.stringify({ priorities: ["urgent", "high"], group: "project", layout: "board" }),
  }),
]);

console.log("[seed] workspace acme: sign in as ada@example.com, bob@example.com or cy@example.com with password123");
await server.close();
