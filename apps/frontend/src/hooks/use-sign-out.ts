import { clearLocalData } from "@entwine/db-collection/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "../services/auth-client";
import { browserSubscription } from "../services/push";

/**
 * Ends the session by `end`, signing out unless it says otherwise (deleting the account), and leaves nothing of the
 * person in this browser.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (end: () => Promise<unknown> = () => authClient.signOut()) => {
    await end();
    // The server forgot the browser's subscription with the session; the browser forgets it too.
    await (await browserSubscription())?.unsubscribe();
    queryClient.clear();
    await navigate({ to: "/login", search: { next: "/" } });
    await clearLocalData();
  };
}
