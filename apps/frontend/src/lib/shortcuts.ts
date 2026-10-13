import { formatForDisplay, type Hotkey } from "@tanstack/react-hotkeys";
import { type Binding, type Keys, SHORTCUTS, type ShortcutId } from "../constants/shortcuts";

const stepsOf = (keys: Keys): readonly Hotkey[] => (typeof keys === "string" ? [keys] : keys);

/** WCAG 2.1.4's character key shortcut: every step types a character, Shift or not. */
const typesCharacters = (keys: Keys): boolean => stepsOf(keys).every((step) => /^(Shift\+)?.$/.test(step));

/** The ways to press a binding that are on, in the order they are shown. */
export const keysOf = (id: ShortcutId, singleKeys: boolean): readonly Keys[] => {
  const { keys }: Binding = SHORTCUTS[id];
  return singleKeys ? keys : keys.filter((way) => !typesCharacters(way));
};

/** Where single keys are text: fields and editors. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])");
}

type Platform = "mac" | "windows" | "linux";

/** The keys of each step, as the member's keyboard labels them. */
export const keyLabels = (keys: Keys, platform?: Platform): string[][] =>
  stepsOf(keys).map((step) => formatForDisplay(step, { platform, parts: true }));

/** ⌘↵ on macOS, Ctrl+Enter elsewhere. */
export const submitHint = (platform?: Platform): string => formatForDisplay("Mod+Enter", { platform });

/** A binding's first keys that are on, as text: "C", "G then P", "Ctrl+K"; nothing when none is. */
export const keyHint = (id: ShortcutId, platform?: Platform, singleKeys = true): string =>
  stepsOf(keysOf(id, singleKeys)[0] ?? [])
    .map((step) => formatForDisplay(step, { platform }))
    .join(" then ");

/** "New issue (C)": the keys show only while the binding can be pressed. */
export const tooltip = (label: string, id: ShortcutId, singleKeys: boolean): string => {
  const hint = keyHint(id, undefined, singleKeys);
  return hint ? `${label} (${hint})` : label;
};
