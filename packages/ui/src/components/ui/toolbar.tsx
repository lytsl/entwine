import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import { cn } from "@entwine/ui/lib/utils";

/** One stop for Tab: the arrow keys move between its buttons, which are all `ToolbarButton`s. */
function Toolbar({ className, ...props }: ToolbarPrimitive.Root.Props) {
  return (
    <ToolbarPrimitive.Root data-slot="toolbar" className={cn("flex items-center gap-0.5", className)} {...props} />
  );
}

/** Takes its looks from `render`: a `Button`, or the trigger of a menu or popover. */
function ToolbarButton(props: ToolbarPrimitive.Button.Props) {
  return <ToolbarPrimitive.Button data-slot="toolbar-button" {...props} />;
}

function ToolbarSeparator({ className, ...props }: ToolbarPrimitive.Separator.Props) {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      className={cn("mx-0.5 h-4 w-px shrink-0 bg-border", className)}
      {...props}
    />
  );
}

export { Toolbar, ToolbarButton, ToolbarSeparator };
