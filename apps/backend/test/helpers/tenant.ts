import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultStates,
  type IssueScope,
  issueQueries,
  MODELS,
  type ModelName,
  type Role,
  type Row,
  type Rows,
  syncSchema,
} from "@entwine/shared";
import { createTenants, type Tenant, type Tenants, type TenantsOptions, transact } from "@entwine/sync-engine";
import type { Mutation } from "@entwine/sync-engine/protocol";
import { prepareTenant } from "../../src/database/prepare";
import { type FileStore, workspaceFiles } from "../../src/services/files";
import { applyTransaction } from "../../src/writes/transaction";
import { removeTemp } from "./temp";

export interface Fixture {
  tenants: Tenants<Rows>;
  tenant: Tenant<Rows>;
  /** The tenant's attachment bytes, as the rules see them. */
  files: FileStore;
  send(
    mutations: Mutation[],
    userId?: string,
    role?: Role,
    id?: string,
  ): Promise<{ status: number; body: Record<string, unknown> }>;
  revert(txid: string, id?: string, userId?: string): Promise<{ status: number; body: Record<string, unknown> }>;
  cleanup(): Promise<void>;
}

export const member = (id: string, role: Role = "member"): Row<"Member"> => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  email: `${id}@example.com`,
  image: null,
  role,
  removed: 0,
});

/** A fresh tenant of entwine's schema with members ada (owner), bob and cy. */
export async function fixture(options: Partial<TenantsOptions<Rows>> = {}): Promise<Fixture> {
  const dir = mkdtempSync(join(tmpdir(), "entwine-rules-"));
  const tenants = createTenants({ dir, schema: syncSchema, prepare: prepareTenant, ...options });
  const tenant = await tenants.tenant("t1");
  const files = workspaceFiles(dir, "t1");
  await tenant.write(async (writer) => {
    await writer.insert("Member", member("ada", "owner"));
    await writer.insert("Member", member("bob"));
    await writer.insert("Member", member("cy"));
  });
  const post = async (body: unknown, userId: string, role?: Role) => {
    const response = await transact(tenant, body, userId, (writer, request) =>
      applyTransaction(
        { writer, userId, role: role ?? (userId === "ada" ? "owner" : "member"), now: Date.now(), files },
        request,
      ),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  return {
    tenants,
    tenant,
    files,
    send: (mutations, userId = "ada", role, id = crypto.randomUUID()) => post({ id, mutations }, userId, role),
    revert: (txid, id = crypto.randomUUID(), userId = "ada") => post({ id, revert: txid }, userId),
    async cleanup() {
      await tenants.close();
      removeTemp(dir);
    },
  };
}

type Loaded<M extends ModelName> = { epoch: string; cursor: number; rows: { [K in M]: Rows[K][] } };

export async function bootstrap(tenant: Tenant<Rows>) {
  const instant = MODELS.filter((model) => syncSchema.models[model].load === "instant");
  const loaded = await tenant.load(instant.map((model) => ({ model })));
  return { ...loaded, rows: Object.fromEntries(instant.map((m) => [m, loaded.rows[m] ?? []])) } as Loaded<
    (typeof instant)[number]
  >;
}

export async function issues(tenant: Tenant<Rows>, scope: IssueScope = "all") {
  const models = ["Issue", "IssueLabel", "IssueModule", "IssueRelation", "IssueLink"] as const;
  const loaded = await tenant.load(issueQueries(scope));
  const rows = Object.fromEntries(
    models.map((m) => [m, [...(loaded.rows[m] ?? [])].sort((a, b) => a.id.localeCompare(b.id))]),
  );
  return { ...loaded, rows } as Loaded<(typeof models)[number]>;
}

/** An issue's history, or every issue's. */
export async function subset<M extends "Comment" | "Activity">(tenant: Tenant<Rows>, model: M, issueId: string | null) {
  const loaded = await tenant.load([issueId === null ? { model } : { model, where: { issueId } }]);
  return { ...loaded, rows: (loaded.rows[model] ?? []) as Rows[M][] };
}

export const insert = (model: ModelName, value: Record<string, unknown>): Mutation => ({
  model,
  type: "insert",
  key: String(value.id),
  value,
});
export const update = (model: ModelName, key: string, value: Record<string, unknown>): Mutation => ({
  model,
  type: "update",
  key,
  value,
});
export const remove = (model: ModelName, key: string): Mutation => ({ model, type: "delete", key, value: {} });

export const createProject = (id: string, identifier: string): Mutation[] => [
  insert("Project", { id, name: identifier, identifier, description: "" }),
  ...defaultStates(id).map((state) => insert("State", state)),
];

export const createIssue = (id: string, projectId: string, extra: Record<string, unknown> = {}): Mutation =>
  insert("Issue", { id, projectId, title: `Issue ${id}`, stateId: `${projectId}:backlog`, ...extra });

export const allRows = async (tenant: Tenant<Rows>) => ({
  ...(await bootstrap(tenant)).rows,
  ...(await issues(tenant)).rows,
  Comment: (await subset(tenant, "Comment", null)).rows,
  Activity: (await subset(tenant, "Activity", null)).rows,
});
