/**
 * Whether shortcuts pressed with character keys alone (`C`, `G` then `P`, `Shift+E`) are on. WCAG 2.1.4 asks for the
 * switch: speech input types what it hears, so a spoken word would run a shortcut per letter. Shortcuts with ⌘ or
 * Ctrl, and keys that type nothing (arrows, Enter, Escape), are never turned off.
 */
import { storage } from "../lib/local-storage";

const KEY = "entwine:single-keys";
const listeners = new Set<() => void>();

const stored = (): boolean => storage.get(KEY) !== "off";

let on = stored();

export const singleKeys = (): boolean => on;

export function setSingleKeys(value: boolean) {
  on = value;
  if (value) storage.remove(KEY);
  else storage.set(KEY, "off");
  for (const listener of listeners) listener();
}

/** Calls `onChange` when the choice changes, here or in another tab. */
export function followSingleKeys(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    on = stored();
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
