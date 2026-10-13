import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@entwine/ui/lib/utils";

function SegmentedControl<T>({ className, ...props }: RadioGroupPrimitive.Props<T>) {
  return (
    <RadioGroupPrimitive
      data-slot="segmented-control"
      className={cn("flex items-center gap-0.5 rounded-md bg-muted p-0.5", className)}
      {...props}
    />
  );
}

function SegmentedControlItem<T>({ className, ...props }: RadioPrimitive.Root.Props<T>) {
  return (
    <RadioPrimitive.Root
      data-slot="segmented-control-item"
      className={cn(
        "flex h-6 items-center justify-center rounded-[5px] px-2 text-caption text-muted-foreground outline-none transition-colors select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-background data-checked:text-foreground data-checked:shadow-xs [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
