import { LAYOUTS, type Layout } from "@entwine/shared";
import { SegmentedControl, SegmentedControlItem } from "@entwine/ui/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@entwine/ui/components/ui/tooltip";
import { LAYOUT_OPTIONS, LAYOUT_SHORTCUTS } from "../../../../../constants/issue-view";
import { ShortcutKeys } from "../../command-palette/shortcut-keys";

export function LayoutSwitch({ value, onChange }: { value: Layout; onChange(layout: Layout): void }) {
  return (
    <SegmentedControl aria-label="Layout" value={value} onValueChange={onChange}>
      {LAYOUTS.map((layout) => (
        <Tooltip key={layout}>
          <TooltipTrigger
            render={
              <SegmentedControlItem value={layout} aria-label={LAYOUT_OPTIONS[layout].label} className="w-7 px-0" />
            }
          >
            {LAYOUT_OPTIONS[layout].icon}
          </TooltipTrigger>
          <TooltipContent>
            {LAYOUT_OPTIONS[layout].label} <ShortcutKeys id={LAYOUT_SHORTCUTS[layout]} />
          </TooltipContent>
        </Tooltip>
      ))}
    </SegmentedControl>
  );
}
