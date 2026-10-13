/**
 * Several clients write at random while their network misbehaves at random; afterwards every client must hold
 * exactly the server's rows, as far as they are its member's to read. `SEED=<n> bun test test/convergence.test.ts` replays a run.
 */
import { afterEach, expect, test } from "bun:test";
import { MODELS, PRIORITIES, STATE_GROUPS } from "@entwine/shared";
import type { Client } from "./helpers/client";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject, now } from "./helpers/fixtures";
import { harness } from "./helpers/harness";
import { loadHistory, loadIssues } from "./helpers/loads";

let h: Awaited<ReturnType<typeof harness>>;
afterEach(() => h.cleanup());

/** mulberry32: small, seedable and good enough to pick operations. */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
  return { next, pick };
}

const seed = Number(process.env.SEED ?? Math.floor(Math.random() * 2 ** 31));

test(`clients converge with the server under random writes and faults (seed ${seed})`, async () => {
  const { next, pick } = random(seed);
  h = await harness({ heartbeatMs: 20 });
  const sessions = await Promise.all(["ada", "bob", "cy"].map((name) => h.signUp(name)));
  const workspaceId = await h.workspace(sessions[0], "acme", sessions.slice(1));
  const clients = await Promise.all(sessions.map((s) => h.connect(s, workspaceId, { stallMs: 100 })));
  await Promise.all(clients.map((c) => loadIssues(c, "all")));
  const starts = clients.map((c) => c.workspace.cursor);
  const [a] = clients;
  await createProject(a, "p1", "WEB");
  await a.mutate(() => {
    for (const id of ["l1", "l2"])
      a.collections.Label.insert({ id, name: id, nameKey: id, color: "#ff0000", createdAt: now });
  });
  for (const client of clients) await eventually(() => expect(client.collections.Label.size).toBe(2));

  const userOf = (client: Client) => sessions[clients.indexOf(client)].userId;
  const operations: ((client: Client) => Promise<unknown>)[] = [
    (c) => createIssue(c, crypto.randomUUID(), "p1", userOf(c)),
    (c) => {
      const issue = pick(c.collections.Issue.toArray);
      const field = pick(["title", "priority", "stateId", "assigneeId"] as const);
      return c.mutate(() =>
        c.collections.Issue.update(issue.id, (draft) => {
          if (field === "title") draft.title = `Title ${Math.floor(next() * 100)}`;
          if (field === "priority") draft.priority = pick(PRIORITIES);
          if (field === "stateId") draft.stateId = `p1:${pick(STATE_GROUPS)}`;
          if (field === "assigneeId") draft.assigneeId = pick(sessions).userId;
        }),
      );
    },
    (c) => {
      const issue = pick(c.collections.Issue.toArray);
      const labelId = pick(["l1", "l2"]);
      const id = `${issue.id}:${labelId}`;
      return c.mutate(() =>
        c.collections.IssueLabel.has(id)
          ? c.collections.IssueLabel.delete(id)
          : c.collections.IssueLabel.insert({ id, issueId: issue.id, labelId }),
      );
    },
    (c) =>
      c.mutate(() =>
        c.collections.Comment.insert({
          id: crypto.randomUUID(),
          issueId: pick(c.collections.Issue.toArray).id,
          authorId: userOf(c),
          body: "A comment",
          createdAt: now,
          updatedAt: now,
          editedAt: null,
        }),
      ),
    (c) =>
      c.mutate(() =>
        c.collections.Comment.update(pick(c.collections.Comment.toArray).id, (draft) => {
          draft.body = `Edited ${Math.floor(next() * 100)}`;
        }),
      ),
    (c) => c.mutate(() => c.collections.Issue.delete(pick(c.collections.Issue.toArray).id)),
  ];
  const faults: ((client: Client) => void)[] = [
    (c) => c.faults.dropStream(),
    (c) => c.faults.stallStream(),
    (c) => c.faults.loseNextResponse(),
    (c) => c.faults.failNextRequest(),
  ];

  // Writes run concurrently, and may be refused (a deleted issue, someone else's comment); both are fine.
  const writes: Promise<unknown>[] = [];
  for (let step = 0; step < 60; step++) {
    const client = pick(clients);
    if (next() < 0.15) pick(faults)(client);
    writes.push(
      Promise.resolve()
        .then(() => pick(operations)(client))
        .catch(() => {}),
    );
    if (next() < 0.3) await new Promise((resolve) => setTimeout(resolve, Math.floor(next() * 20)));
  }
  await Promise.all(writes);

  const tenant = await h.server.tenants.tenant(workspaceId);
  const sorted = (rows: { id: string }[]) => [...rows].sort((x, y) => x.id.localeCompare(y.id));
  /** A client row without TanStack DB's virtual `$` fields; every row must be confirmed by the server. */
  const plain = (row: object) => {
    expect(row).toMatchObject({ $synced: true });
    return Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("$"))) as { id: string };
  };
  for (const [i, client] of clients.entries()) {
    // Notifications are their member's alone, so each client is held against what its own member loads.
    const server = await h.snapshot(sessions[i], workspaceId);
    await eventually(() => expect(client.workspace.cursor).toBe(server.cursor), 5000);
    expect(client.workspace.queued()).toBe(0);
    // An issue's history is loaded when it is opened; open them all.
    await loadHistory(client);
    for (const model of MODELS) {
      expect({ model, rows: sorted(client.collections[model].toArray.map(plain)) }).toEqual({
        model,
        rows: sorted(server.rows[model]),
      });
    }
    // Every change after the client's bootstrap that is its member's to read reached it, and no other did; the
    // client applies each id once, in order.
    const received = new Set(client.received);
    const readable = (await tenant.changesFor(sessions[i].userId, starts[i], server.cursor))!.changes.map((c) => c.id);
    expect(readable.filter((id) => !received.has(id))).toEqual([]);
    expect([...received].filter((id) => id > starts[i] && !readable.includes(id))).toEqual([]);
  }
}, 30_000);
