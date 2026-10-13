/** Render `SyncDevtools` inside `SyncProvider`. */
import { useWorkspace, type Workspace } from "@entwine/db-collection/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { useSyncExternalStore } from "react";

/** A string that changes whenever anything the panel shows does. */
const snapshot = (workspace: Workspace) =>
  JSON.stringify({
    status: workspace.status,
    epoch: workspace.epoch,
    cursor: workspace.cursor,
    role: workspace.role,
    queued: workspace.queued(),
    counts: workspace.counts(),
  });

function SyncPanel({ workspace }: { workspace: Workspace }) {
  const { counts, ...state } = JSON.parse(
    useSyncExternalStore(
      (listener) => workspace.subscribe(listener),
      () => snapshot(workspace),
    ),
  ) as Record<string, string | number> & { counts: Record<string, number> };
  const labels: Record<string, string> = {
    status: "status",
    epoch: "change log",
    cursor: "cursor",
    role: "tab role",
    queued: "unanswered writes",
  };
  const cell = { padding: "4px 12px 4px 0" };
  return (
    <div style={{ padding: 16, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
      <table>
        <tbody>
          {Object.entries(state).map(([key, value]) => (
            <tr key={key}>
              <td style={cell}>{labels[key]}</td>
              <td>{value}</td>
            </tr>
          ))}
          {Object.entries(counts).map(([model, count]) => (
            <tr key={model}>
              <td style={cell}>{model}</td>
              <td>{count} rows</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SyncDevtools() {
  const workspace = useWorkspace();
  return (
    <TanStackDevtools
      plugins={[{ id: "entwine-sync", name: "Sync", render: <SyncPanel workspace={workspace} /> }]}
      config={{ position: "bottom-right" }}
    />
  );
}
