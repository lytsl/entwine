import { Popover, PopoverContent, PopoverTrigger } from "@entwine/ui/components/ui/popover";
import { cn } from "@entwine/ui/lib/utils";

function ColorPicker({
  value,
  onChange,
  colors,
  label,
}: {
  value: string;
  onChange(color: string): void;
  colors: readonly string[];
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="flex size-7 shrink-0 items-center justify-center rounded-md border hover:bg-accent"
      >
        <span className="size-3.5 rounded-full" style={{ background: value }} />
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 p-2" align="start">
        <div className="grid grid-cols-4 gap-1.5">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              className={cn(
                "size-6 rounded-full ring-offset-2 ring-offset-popover",
                value === color && "ring-2 ring-foreground",
              )}
              style={{ background: color }}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ColorPicker };
