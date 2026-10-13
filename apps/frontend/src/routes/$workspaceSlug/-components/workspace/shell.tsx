import { useSyncStatus, useWorkspace } from "@entwine/db-collection/react";
import { SidebarInset, SidebarProvider } from "@entwine/ui/components/ui/sidebar";
import { useIsMobile } from "@entwine/ui/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { COMMAND_SHORTCUTS } from "../../../../constants/command";
import { issueInContext, ShellContext } from "../../../../contexts/shell";
import { StoreContext } from "../../../../contexts/store";
import { useRootStore } from "../../../../hooks/use-root-store";
import { useShortcuts } from "../../../../hooks/use-shortcuts";
import { useTheme } from "../../../../hooks/use-theme";
import { buildCommands } from "../../../../lib/commands/build-commands";
import { type WorkspaceInfo } from "../../../../services/auth-client";
import { sessionQuery, workspacesQuery } from "../../../../services/queries";
import { type CommandContext } from "../../../../types/command";
import {
  type CreateKind,
  type IssueScope,
  type NewIssueDefaults,
  type PalettePage,
  type Shell as ShellApi,
  type ViewControls,
} from "../../../../types/shell";
import { CommandPalette } from "../command-palette/command-palette";
import { ShortcutHelp } from "../command-palette/shortcut-help";
import { DeleteIssueDialog } from "../issue/delete-issue-dialog";
import { NewIssueDialog } from "../issue/new-issue-dialog";
import { PlanDialog } from "../planning/plan-dialog";
import { ProjectDialog } from "../project/project-dialog";
import { AppSidebar } from "../sidebar/app-sidebar";
import { SyncIndicator } from "../sidebar/sync-indicator";
import { NewViewDialog } from "../views/new-view-dialog";
import { VerifyEmailBanner } from "./verify-email-banner";

export function Shell({ workspace }: { workspace: WorkspaceInfo }) {
  const ws = useWorkspace();
  const status = useSyncStatus();
  const store = useRootStore();
  const theme = useTheme();
  const mobile = useIsMobile();
  const [newIssue, setNewIssue] = useState<NewIssueDefaults | null>(null);
  /** The last page is on top; null while the palette is closed. */
  const [palette, setPalette] = useState<PalettePage[] | null>(null);
  const [shortcutList, setShortcutList] = useState(false);
  const [create, setCreate] = useState<{ kind: CreateKind; projectId?: string } | null>(null);
  const [deleting, setDeleting] = useState<{ issueId: string; onDeleted?: () => void } | null>(null);
  const { projectId, issueId } = useParams({ strict: false });
  /** New issues start in the project on screen: the page's own, or the open issue's. */
  const currentProject = projectId ?? (issueId ? store.issues.get(issueId)?.projectId : undefined);
  const peek = useRef<((issueId: string) => void) | null>(null);
  const scope = useRef<IssueScope | null>(null);
  const view = useRef<ViewControls | null>(null);
  const shell = useMemo<ShellApi>(
    () => ({
      // A scoped view's plan is taken when the dialog opens, from whichever button or shortcut opened it.
      openNewIssue: (defaults = {}) => setNewIssue({ ...scope.current?.seed, ...defaults }),
      peek,
      scope,
      view,
      shown: new Map(),
      openPalette: (page = "root") => setPalette(page === "root" ? ["root"] : ["root", page]),
      openShortcuts: () => setShortcutList(true),
      openCreate: (kind, projectId) => setCreate({ kind, projectId }),
      confirmDelete: (issueId, onDeleted) => setDeleting({ issueId, onDeleted }),
    }),
    [],
  );
  const navigate = useNavigate();
  const ctx = (): CommandContext => {
    const id = issueInContext(shell);
    return {
      ws,
      store,
      shell,
      navigate,
      workspaceSlug: workspace.slug,
      projectId,
      issue: id ? store.issues.get(id) : undefined,
      view: view.current,
      theme,
    };
  };

  useShortcuts({
    palette: () => setPalette((open) => (open ? null : ["root"])),
    undo: () => void ws.undo(),
    redo: () => void ws.redo(),
    ...Object.fromEntries(
      COMMAND_SHORTCUTS.map((id) => [
        id,
        () => {
          const command = buildCommands(ctx()).find((c) => c.shortcut === id);
          if (!command) return false;
          command.run();
        },
      ]),
    ),
  });

  const queryClient = useQueryClient();
  useEffect(() => {
    if (status !== "unauthenticated") return;
    // The session ended elsewhere: the answer kept for this tab no longer holds.
    queryClient.removeQueries({ queryKey: sessionQuery.queryKey });
    void navigate({ to: "/login", search: { next: location.pathname } });
  }, [status, navigate, queryClient]);

  // Better Auth's list of workspaces is not on the stream: the synced name says when to ask for it again.
  const router = useRouter();
  const name = store.workspace.name;
  useEffect(() => {
    if (name === undefined || name === workspace.name) return;
    void queryClient.invalidateQueries({ queryKey: workspacesQuery.queryKey }).then(() => router.invalidate());
  }, [name, workspace.name, queryClient, router]);

  const deletingIssue = deleting ? store.issues.get(deleting.issueId) : undefined;
  return (
    <ShellContext.Provider value={shell}>
      <StoreContext.Provider value={store}>
        <SidebarProvider className="h-svh">
          {/* A button, since a link would put a hash in the address. */}
          <button
            type="button"
            className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-body font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            onClick={() => document.getElementById("main")?.focus()}
          >
            Skip to content
          </button>
          <AppSidebar workspace={workspace} store={store} />
          <SidebarInset id="main" tabIndex={-1} className="@container/main min-w-0 overflow-hidden outline-none">
            {mobile && status !== "live" && <SyncIndicator className="shrink-0 border-b px-3" />}
            <VerifyEmailBanner />
            <Outlet />
          </SidebarInset>
          {newIssue && (
            <NewIssueDialog
              store={store}
              defaults={{ projectId: currentProject, ...newIssue }}
              onClose={() => setNewIssue(null)}
            />
          )}
          {palette && (
            <CommandPalette stack={palette} onStack={setPalette} onClose={() => setPalette(null)} ctx={ctx()} />
          )}
          {shortcutList && <ShortcutHelp onClose={() => setShortcutList(false)} />}
          {create?.kind === "project" && <ProjectDialog onClose={() => setCreate(null)} />}
          {create?.kind === "view" && <NewViewDialog onClose={() => setCreate(null)} />}
          {(create?.kind === "cycle" || create?.kind === "module") && create.projectId && (
            <PlanDialog kind={create.kind} projectId={create.projectId} onClose={() => setCreate(null)} />
          )}
          {deletingIssue && (
            <DeleteIssueDialog
              issue={deletingIssue}
              store={store}
              onClose={() => setDeleting(null)}
              onDeleted={() => {
                deleting?.onDeleted?.();
                // Leave the page of the deleted issue for its project's issues.
                if (issueId === deletingIssue.id)
                  void navigate({
                    to: "/$workspaceSlug/projects/$projectId",
                    params: { workspaceSlug: workspace.slug, projectId: deletingIssue.projectId },
                  });
              }}
            />
          )}
        </SidebarProvider>
      </StoreContext.Provider>
    </ShellContext.Provider>
  );
}
