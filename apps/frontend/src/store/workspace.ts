import type { Row } from "@entwine/shared";
import { RowStore } from "./row-store";

/** The workspace's one row about itself, which the server keeps from Better Auth's. */
export class WorkspaceDetails extends RowStore<Row<"Workspace">> {
  /** Undefined until the row has loaded. */
  get name(): string | undefined {
    return this.get(this.ws.workspaceId)?.name;
  }
}
