import type { RowMap, Schema } from "@entwine/sync-engine/protocol";
import { type ReactNode, useEffect, useState } from "react";
import { openLocalStore } from "../device/browser";
import type { SyncError } from "../errors";
import { Workspace as Open } from "../workspace/workspace";
import type { Workspace } from "./types";
import { WorkspaceContext } from "./use-workspace";

export interface SyncProviderProps<R extends RowMap> {
  schema: Schema<R>;
  workspaceId: string;
  userId: string;
  /** The sync endpoints' base for the workspace, such as `/api/w/<id>`. */
  url: string;
  /** Called with every refused or undeliverable write. */
  onError(error: SyncError): void;
  loading: ReactNode;
  /** Shown once the member has lost access to the workspace, in place of the children. */
  revoked: ReactNode;
  /**
   * Shown in place of the children while the workspace cannot be opened: the server refused, cannot be reached or
   * cannot answer. `retry` tries again now; the last two are also tried again without it.
   */
  failed(error: Error, retry: () => void): ReactNode;
  children: ReactNode;
}

export function SyncProvider<R extends RowMap>(props: SyncProviderProps<R>) {
  const { schema, workspaceId, userId, url, onError, loading, revoked, failed, children } = props;
  const [state, setState] = useState<{
    workspace?: Workspace<RowMap>;
    /** The server refused: nothing is tried again until asked. */
    error?: Error;
    /** The server cannot be reached or cannot answer, and is being tried again. */
    failing?: { error: Error; retry(): void };
    revoked?: boolean;
  }>({});
  const [opening, setOpening] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new workspace per workspace and member, not per handler.
  useEffect(() => {
    let left = false;
    let open: Open<R> | undefined;
    setState({});
    const report = (promise: Promise<void>) =>
      promise.then(
        () => true,
        (error) => {
          onError(error);
          return false;
        },
      );
    void (async () => {
      const local = await openLocalStore(userId, workspaceId);
      if (left) return void (await local?.close());
      const workspace = new Open({ schema, url, local: local ?? undefined, session: sessionStorage, onError });
      open = workspace;
      // A member who lost access keeps nothing: the pages leave first, then `release` deletes the device's copy.
      const unsubscribe = workspace.subscribe(() => {
        // Until the workspace has opened; after that the pages say that it is offline.
        if (!left && workspace.status !== "revoked")
          setState((state) =>
            state.workspace || state.revoked || state.error || state.failing?.error === workspace.failing
              ? state
              : { failing: workspace.failing && { error: workspace.failing, retry: () => workspace.retry() } },
          );
        if (workspace.status !== "revoked") return;
        unsubscribe();
        if (left) return;
        setState({ revoked: true });
        setTimeout(() => void workspace.release());
      });
      const extra: Record<PropertyKey, unknown> = {
        workspaceId,
        userId,
        mutate: (fn: () => void) => report(workspace.mutate(fn)),
        undo: () => report(workspace.history.undo()),
        redo: () => report(workspace.history.redo()),
      };
      // The workspace's own fields stay live through the wrapper, and its methods run on the workspace itself.
      const wrapped = new Proxy(workspace, {
        get(target, key) {
          if (Object.hasOwn(extra, key)) return extra[key];
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as unknown as Workspace<RowMap>;
      workspace.ready.then(
        () => !left && setState((state) => (state.revoked ? state : { workspace: wrapped })),
        (error) => !left && setState((state) => (state.revoked ? state : { error })),
      );
    })();
    return () => {
      left = true;
      // After the children's live queries have unsubscribed from the collections that `release` cleans up.
      setTimeout(() => void open?.release());
    };
  }, [workspaceId, userId, opening]);

  if (state.revoked) return revoked;
  if (state.error) return failed(state.error, () => setOpening((n) => n + 1));
  if (!state.workspace && state.failing) return failed(state.failing.error, state.failing.retry);
  if (!state.workspace) return loading;
  return <WorkspaceContext.Provider value={state.workspace}>{children}</WorkspaceContext.Provider>;
}
