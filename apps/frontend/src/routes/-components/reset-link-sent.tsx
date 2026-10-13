import { Button, buttonVariants } from "@entwine/ui/components/ui/button";
import { CardContent, CardFooter } from "@entwine/ui/components/ui/card";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthCard } from "../../components/auth-card";
import { errorMessage } from "../../services/auth-client";

/** How long before the same address can be sent another link: the first may only be slow. */
const RESEND_MS = 30_000;

/** `onAgain` asks for another link to the same address. */
export function ResetLinkSent({ email, onAgain }: { email: string; onAgain(email: string): Promise<unknown> }) {
  const [sentAt, setSentAt] = useState(Date.now);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), RESEND_MS - (Date.now() - sentAt));
    return () => clearTimeout(timer);
  }, [sentAt]);
  const again = () =>
    onAgain(email).then(
      () => setSentAt(Date.now()),
      (failure) => setError(errorMessage(failure)),
    );
  return (
    <AuthCard
      title="Check your inbox"
      description={
        <span role="status">
          If an account uses {email}, a link to reset its password is on its way. It expires in 1 hour.
        </span>
      }
    >
      <CardContent className="flex flex-col gap-1 text-body">
        <p className="font-medium">Didn't get it?</p>
        <p className="text-muted-foreground">Check your spam folder, or send another link in a moment.</p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-6 flex-col gap-3">
        <Button variant="outline" className="w-full" disabled={!ready} onClick={again}>
          {ready ? "Send another link" : "Sent"}
        </Button>
        <Link to="/login" search={{ next: "/" }} className={buttonVariants({ variant: "ghost", className: "w-full" })}>
          Back to sign in
        </Link>
      </CardFooter>
    </AuthCard>
  );
}
