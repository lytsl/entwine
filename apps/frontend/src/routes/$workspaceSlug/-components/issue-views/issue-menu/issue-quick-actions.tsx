import { Button } from "@entwine/ui/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@entwine/ui/components/ui/dropdown-menu";
import { cn } from "@entwine/ui/lib/utils";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { IssueMenuItems } from "./issue-menu-items";

/** Every row and card has one, so the menu is mounted by the button's first click. */
export function IssueQuickActions({
  issue,
  store,
  className,
  onDeleted,
}: {
  issue: Issue;
  store: Store;
  className?: string;
  onDeleted?(): void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const button = {
    variant: "ghost",
    size: "icon-xs",
    "aria-label": `${store.issues.key(issue)} actions`,
    className: cn("text-muted-foreground data-popup-open:bg-accent", className),
  } as const;
  // Rows and cards are links or drag handles: a click on the button is not a click on them.
  const keep = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  if (!mounted)
    return (
      <Button
        {...button}
        aria-haspopup="menu"
        onClick={(event) => {
          keep(event);
          setMounted(true);
          setOpen(true);
        }}
      >
        <MoreHorizontalIcon />
      </Button>
    );
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button {...button} onClick={keep} />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(event) => event.stopPropagation()}>
        <IssueMenuItems issue={issue} store={store} onDeleted={onDeleted} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
