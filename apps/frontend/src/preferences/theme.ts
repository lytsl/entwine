/**
 * The theme is the `dark` class on `<html>`, which `globals.css` and the toaster key off; `index.html` applies the
 * stored choice before the first paint, with the same key and default as here.
 */
import { THEMES, type Theme } from "../constants/theme";
import { storage } from "../lib/local-storage";

const KEY = "entwine:theme";
const listeners = new Set<() => void>();

export function storedTheme(): Theme {
  const value = storage.get(KEY);
  return THEMES.includes(value as Theme) ? (value as Theme) : "dark";
}

const systemDark = () => matchMedia("(prefers-color-scheme: dark)");

function apply() {
  const theme = storedTheme();
  const dark = theme === "dark" || (theme === "system" && systemDark().matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  for (const listener of listeners) listener();
}

export function setTheme(theme: Theme) {
  storage.set(KEY, theme);
  apply();
}

/** Follows the system's setting while "System" is chosen, and choices made in other tabs. */
export function followTheme() {
  systemDark().addEventListener("change", apply);
  window.addEventListener("storage", (event) => event.key === KEY && apply());
  apply();
}

/** Calls `onChange` whenever the theme is applied: a choice here or in another tab, or the system's. */
export function onThemeChange(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
