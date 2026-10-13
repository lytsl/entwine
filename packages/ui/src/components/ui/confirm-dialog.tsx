import { Button } from "@entwine/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@entwine/ui/components/ui/dialog";
import type { ReactNode } from "react";

/** Mounted while it asks; `onConfirm` does the deed and closes it. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  disabled,
  destructive = true,
  onConfirm,
  onClose,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  disabled?: boolean;
  /** False for a deed that loses nothing, which then is not shown as a danger. */
  destructive?: boolean;
  onConfirm(): void;
  onClose(): void;
  /** What the member chooses or types before confirming, between the description and the buttons. */
  children?: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
