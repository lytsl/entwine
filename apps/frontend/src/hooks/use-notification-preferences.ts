import { type NotificationPreferences, notificationPreferences } from "@entwine/shared";
import { toast } from "@entwine/ui/components/ui/toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authClient, errorMessage } from "../services/auth-client";
import { sessionQuery } from "../services/queries";

/** The account's, as the session last read them. */
const DEFAULTS: NotificationPreferences = { emailNotifications: true, mutedNotifications: [] };

/** Each change is saved as it is made, and shown at once; a refused one goes back. */
export function useNotificationPreferences() {
  const queryClient = useQueryClient();
  const user = useQuery(sessionQuery).data?.user;
  const saved = notificationPreferences.catch(DEFAULTS).parse(user);
  const [pending, setPending] = useState<Partial<NotificationPreferences>>({});
  const set = async (patch: Partial<NotificationPreferences>) => {
    setPending((current) => ({ ...current, ...patch }));
    try {
      await authClient.updateUser(patch);
      await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 });
      toast.success("Notification settings saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in patch))));
    }
  };
  return { preferences: { ...saved, ...pending }, set };
}
