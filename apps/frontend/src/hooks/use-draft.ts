import { useEffect, useState } from "react";

/** Text saved when it loses focus, which follows edits made elsewhere meanwhile. */
export function useDraft(value: string): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return [draft, setDraft];
}
