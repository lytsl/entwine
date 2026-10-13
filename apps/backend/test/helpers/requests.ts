import type { LoadResponse, Mutation } from "@entwine/sync-engine/protocol";
import type { Account } from "./server";

export const insert = (model: Mutation["model"], value: Record<string, unknown>): Mutation => ({
  model,
  type: "insert",
  key: String(value.id),
  value,
});

export const send = (account: Account, workspaceId: string, mutations: Mutation[], init: RequestInit = {}) =>
  account.fetch(`/api/w/${workspaceId}/transactions`, {
    method: "POST",
    body: JSON.stringify({ id: crypto.randomUUID(), mutations }),
    ...init,
  });

export const loadAll = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ queries: [{ model: "Member" }] }),
};

export const members = async (account: { json: (p: string, body: unknown) => Promise<unknown> }, id: string) =>
  (
    ((await account.json(`/api/w/${id}/load`, { queries: [{ model: "Member" }] })) as LoadResponse).rows
      .Member as unknown as { name: string; role: string; removed: number }[]
  ).map((m) => [m.name, m.role, m.removed]);
