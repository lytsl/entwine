import { type ShortcutId } from "../../../../constants/shortcuts";
import { useSingleKeys } from "../../../../hooks/use-single-keys";
import { keysOf } from "../../../../lib/shortcuts";
import { KeyCombination } from "./key-combination";

/** Renders nothing while the binding cannot be pressed. */
export function ShortcutKeys({ id }: { id: ShortcutId }) {
  const keys = keysOf(id, useSingleKeys())[0];
  return keys ? <KeyCombination keys={keys} /> : null;
}
