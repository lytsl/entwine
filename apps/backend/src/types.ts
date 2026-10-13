import type { Role, Rows } from "@entwine/shared";
import type { Tenant } from "@entwine/sync-engine";

export type AppEnv = {
  /** What the server knows of the connection, given as the second argument of `fetch`. */
  Bindings: { ip?: string } | undefined;
  /** The caller and their workspace, set by `workspaceAccess` for the routes under a workspace. */
  Variables: { tenant: Tenant<Rows>; userId: string; role: Role };
};
