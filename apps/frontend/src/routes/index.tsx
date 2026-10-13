import { createFileRoute, redirect } from "@tanstack/react-router";
import { lastWorkspace } from "../preferences/last-workspace";
import { knownWorkspaces, requireSession } from "../services/guards";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    await requireSession(context.queryClient, "/");
    const workspaces = await knownWorkspaces(context.queryClient);
    const last = lastWorkspace.get();
    const target = workspaces.find((w) => w.slug === last) ?? workspaces[0];
    throw target
      ? redirect({ to: "/$workspaceSlug", params: { workspaceSlug: target.slug } })
      : redirect({ to: "/new" });
  },
});
