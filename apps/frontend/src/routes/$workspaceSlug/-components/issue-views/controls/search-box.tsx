import { Button } from "@entwine/ui/components/ui/button";
import { SearchField } from "@entwine/ui/components/ui/search-field";
import { useDebouncer } from "@tanstack/react-pacer";
import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShortcuts } from "../../../../../hooks/use-shortcuts";
import { useSingleKeys } from "../../../../../hooks/use-single-keys";
import { tooltip } from "../../../../../lib/shortcuts";

/**
 * What is typed shows at once; the view and the URL follow once typing pauses, since each change filters every issue
 * and replaces the history entry.
 */
export function SearchBox({ value, onChange }: { value: string; onChange(q: string): void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  /** The text sent last. `value` coming back as it is an echo; any other `value` was set elsewhere. */
  const sent = useRef(value);
  const send = (q: string) => {
    sent.current = q;
    onChange(q);
  };
  const { maybeExecute: sendOncePaused, cancel } = useDebouncer(send, { wait: 200 });
  // Clearing the filters, a saved view or Back changed the search: the box shows it. An echo is left alone, or it
  // would overwrite what was typed since it was sent.
  useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    cancel();
    setDraft(value);
  }, [value, cancel]);
  const clear = () => {
    cancel();
    setDraft("");
    send("");
    setOpen(false);
  };
  useShortcuts({
    search: () => {
      setOpen(true);
      input.current?.focus();
    },
  });
  const singleKeys = useSingleKeys();
  if (!open && !draft)
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Search"
        title={tooltip("Search", "search", singleKeys)}
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </Button>
    );
  return (
    <SearchField
      ref={input}
      autoFocus={!draft}
      aria-label="Search issues"
      placeholder="Search title or key…"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        sendOncePaused(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") clear();
      }}
      onBlur={() => !draft && setOpen(false)}
    >
      {draft && (
        <button
          type="button"
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground"
          onClick={clear}
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </SearchField>
  );
}
