import type { RowMap } from "@entwine/sync-engine/protocol";
import { createContext, useContext } from "react";
import type { Workspace } from "./types";

export const WorkspaceContext = createContext<Workspace<RowMap> | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace needs a SyncProvider");
  return workspace as unknown as Workspace;
}
