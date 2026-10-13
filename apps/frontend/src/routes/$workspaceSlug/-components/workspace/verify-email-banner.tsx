import { Button } from "@entwine/ui/components/ui/button";
import { toast } from "@entwine/ui/components/ui/toast";
import { useQuery } from "@tanstack/react-query";
import { MailIcon } from "lucide-react";
import { useState } from "react";
import { authClient, errorMessage } from "../../../../services/auth-client";
import { configQuery, sessionQuery } from "../../../../services/queries";

/** Notification mail goes to verified addresses only, so an unverified one is asked to verify, while mail is sent. */
export function VerifyEmailBanner() {
  const mail = useQuery(configQuery).data?.mail;
  // The link opens in another tab: coming back to this one reads the session again.
  const user = useQuery({ ...sessionQuery, staleTime: 0, refetchOnWindowFocus: true }).data?.user;
  const [sent, setSent] = useState(false);
  if (!mail || !user || user.emailVerified) return null;
  const send = () =>
    authClient.sendVerificationEmail({ email: user.email, callbackURL: "/" }).then(
      () => {
        setSent(true);
        toast.success(`A new link is on its way to ${user.email}`);
      },
      (error) => toast.error(errorMessage(error)),
    );
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/50 px-4 py-2 text-body">
      <MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1">
        Verify <strong className="font-medium wrap-anywhere">{user.email}</strong> to get notifications by mail: open
        the link we sent there.
      </p>
      <Button variant="outline" size="sm" className="h-7" disabled={sent} onClick={send}>
        {sent ? "Link sent" : "Send it again"}
      </Button>
    </div>
  );
}
