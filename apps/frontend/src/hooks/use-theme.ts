import { useSyncExternalStore } from "react";
import type { Theme } from "../constants/theme";
import { onThemeChange, storedTheme } from "../preferences/theme";

export const useTheme = (): Theme => useSyncExternalStore(onThemeChange, storedTheme, () => "dark" as const);
