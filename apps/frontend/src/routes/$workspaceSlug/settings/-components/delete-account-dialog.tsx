import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { Input } from "@entwine/ui/components/ui/input";
import { toast } from "@entwine/ui/components/ui/toast";
import { useState } from "react";
import { useSignOut } from "../../../../hooks/use-sign-out";
import { authClient, errorCode, errorMessage } from "../../../../services/auth-client";

/** The address has to be typed, since the account cannot come back. */
export function DeleteAccountDialog({ email, onClose }: { email: string; onClose(): void }) {
  const signOut = useSignOut();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const ready = !deleting && typed.trim().toLowerCase() === email;
  const confirm = () => {
    setDeleting(true);
    signOut(() => authClient.deleteUser({})).then(
      () => toast.success("Your account was deleted"),
      (error) => {
        setDeleting(false);
        toast.error(
          // Better Auth asks for a session opened within the last day.
          errorCode(error) === "SESSION_EXPIRED"
            ? "To be sure it is you, sign out and sign in again before deleting your account."
            : errorMessage(error),
        );
      },
    );
  };
  return (
    <ConfirmDialog
      title="Delete your account?"
      description={
        <>
          You leave every workspace, and workspaces only you belong to are deleted. Elsewhere your issues and comments
          stay, under your name. This cannot be undone. Type{" "}
          <strong className="text-foreground wrap-anywhere">{email}</strong> to confirm.
        </>
      }
      confirmLabel={deleting ? "Deleting…" : "Delete account"}
      disabled={!ready}
      onClose={onClose}
      onConfirm={confirm}
    >
      <Input
        aria-label="Your email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && ready) confirm();
        }}
      />
    </ConfirmDialog>
  );
}
