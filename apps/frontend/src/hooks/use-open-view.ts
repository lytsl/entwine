import { useNavigate } from "@tanstack/react-router";

/** Views are created from pages of the workspace, whose slug the new view's address keeps. */
export const useOpenView = () => {
  const navigate = useNavigate({ from: "/$workspaceSlug" });
  return (viewId: string) => void navigate({ to: "/$workspaceSlug/views/$viewId", params: { viewId } });
};
