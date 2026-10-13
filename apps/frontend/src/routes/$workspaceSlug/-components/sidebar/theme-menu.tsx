import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { THEME_LABELS, THEMES, type Theme } from "../../../../constants/theme";
import { useTheme } from "../../../../hooks/use-theme";
import { setTheme } from "../../../../preferences/theme";

export function ThemeMenu() {
  const theme = useTheme();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <MonitorIcon />}
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t} value={t}>
              {THEME_LABELS[t]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
