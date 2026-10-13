import {
  DEFAULT_SEQUENCE_TIMEOUT,
  getSequenceManager,
  type UseHotkeyDefinition,
  type UseHotkeySequenceDefinition,
  useHotkeySequences,
  useHotkeys,
} from "@tanstack/react-hotkeys";
import { type Binding, SHORTCUTS, type ShortcutId } from "../constants/shortcuts";
import { keysOf } from "../lib/shortcuts";
import { useSingleKeys } from "./use-single-keys";

/** Returning `false` leaves the key to the browser, as when there is nothing to act on. */
export type ShortcutHandler = (event: KeyboardEvent) => boolean | undefined | void;
export type Handlers = Partial<Record<ShortcutId, ShortcutHandler>>;

const OPEN_POPUP =
  "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-slot=popover-content], [data-slot=dropdown-menu-content], [data-slot=context-menu-content]";

/** Whether a sequence is partway through, so that the next key is its own, matched or not. */
function sequencePending(): boolean {
  const now = Date.now();
  for (const sequence of getSequenceManager().registrations.state.values())
    if (
      sequence.matchedStepCount > 0 &&
      now - sequence.partialMatchLastKeyTime <= (sequence.options.timeout ?? DEFAULT_SEQUENCE_TIMEOUT)
    )
      return true;
  return false;
}

/**
 * Held keys do not repeat a binding; an open dialog, menu or popover keeps every key but the `anywhere` ones; and the
 * key after a sequence's first is never a binding of its own (`G` then `C` does not also start an issue).
 */
function run(handler: ShortcutHandler, event: KeyboardEvent, anywhere: boolean, single: boolean) {
  if (event.repeat || (single && sequencePending())) return;
  // Base UI keeps a closing popup mounted for its exit animation; its keys already belong to the view. So do a
  // toast's, which is a dialog that takes no focus.
  const open = (popup: Element) => !popup.closest("[data-closed], [data-slot=toast]");
  if (!anywhere && [...document.querySelectorAll(OPEN_POPUP)].some(open)) return;
  if (handler(event) !== false) event.preventDefault();
}

// The library would prevent the default of every key it matches; `run` does, once a handler took the key.
const PASSIVE = { preventDefault: false, stopPropagation: false };

/** The handlers may change on every render. */
export function useShortcuts(handlers: Handlers) {
  const singleKeys = useSingleKeys();
  const combinations: UseHotkeyDefinition[] = [];
  const sequences: UseHotkeySequenceDefinition[] = [];
  for (const id of Object.keys(handlers) as ShortcutId[]) {
    const handler = handlers[id];
    if (!handler) continue;
    const { anywhere = false }: Binding = SHORTCUTS[id];
    // Otherwise the library lets ⌘ and Ctrl combinations and Escape through in text fields, where they are the
    // field's (undo, select all, delete a word).
    const options = { ignoreInputs: !anywhere };
    for (const key of keysOf(id, singleKeys)) {
      if (typeof key === "string")
        combinations.push({ hotkey: key, callback: (event) => run(handler, event, anywhere, true), options });
      else sequences.push({ sequence: key, callback: (event) => run(handler, event, anywhere, false), options });
    }
  }
  // A key press reaches `document` before `window`: combinations see whether a sequence is partway through before
  // the sequences consume the key.
  useHotkeys(combinations, PASSIVE);
  useHotkeySequences(sequences, { ...PASSIVE, target: window });
}
