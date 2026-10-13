import { SwitchField } from "@entwine/ui/components/ui/switch-field";
import { toast } from "@entwine/ui/components/ui/toast";
import { useEffect, useState } from "react";
import { errorMessage } from "../../../../services/auth-client";
import { browserSubscription, pushSupported, subscribePush, unsubscribePush } from "../../../../services/push";

/** Push is per browser: this switch is this one's, whatever the account's other browsers do. */
export function PushSwitch({ serverKey }: { serverKey: string | undefined }) {
  const supported = pushSupported();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void browserSubscription().then((subscription) => setOn(subscription !== null));
  }, []);
  const blocked = supported && Notification.permission === "denied";
  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) await subscribePush(serverKey!);
      else await unsubscribePush();
      setOn(next);
      toast.success(next ? "This browser shows your notifications" : "This browser no longer shows your notifications");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SwitchField
      label="Push to this browser"
      description={
        !supported
          ? "This browser cannot show notifications from this address: it needs HTTPS."
          : blocked
            ? "Notifications from this site are blocked in the browser's settings."
            : "Shown by your system, even with no tab of entwine open."
      }
      checked={on === true}
      disabled={!supported || blocked || !serverKey || on === null || busy}
      onChange={toggle}
    />
  );
}
