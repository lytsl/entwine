import { Button } from "@entwine/ui/components/ui/button";
import { Calendar } from "@entwine/ui/components/ui/calendar";
import { PopoverContent } from "@entwine/ui/components/ui/popover";
import {
  type PropertyFace,
  PropertyPlaceholder,
  PropertyPopover,
  propertyTriggerVariants,
} from "@entwine/ui/components/ui/property-select";
import { formatDate, toDate, toIso } from "@entwine/ui/lib/dates";
import { cn } from "@entwine/ui/lib/utils";
import { CalendarClockIcon, CalendarIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

export type DueTone = "overdue" | "soon" | null;

const DUE_TONE_CLASS: Record<Exclude<DueTone, null>, string> = {
  overdue: "text-destructive",
  soon: "text-warning-foreground",
};

/** Dates are ISO strings. What else it is given goes to its trigger. */
function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  face = "pill",
  tone = null,
  icon = "calendar",
  placeholder = label,
  clearable = true,
  ...triggerProps
}: Omit<ComponentProps<"button">, "value" | "onChange"> & {
  label: string;
  placeholder?: string;
  value: string | null;
  onChange(date: string | null): void;
  min?: string | null;
  max?: string | null;
  face?: PropertyFace;
  tone?: DueTone;
  icon?: "calendar" | "due";
  /** False for a required date: it can be changed, never removed. */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = icon === "due" ? CalendarClockIcon : CalendarIcon;
  const text = value ? formatDate(value, { year: face === "pill" ? "auto" : "always" }) : null;
  const disabled = [...(min ? [{ before: toDate(min) }] : []), ...(max ? [{ after: toDate(max) }] : [])];
  return (
    <PropertyPopover
      open={open}
      onOpenChange={setOpen}
      label={`${label}: ${value ? formatDate(value, { year: "always" }) : "none"}`}
      tooltip={face === "pill" ? `${label}${text ? `: ${text}` : ""}` : undefined}
      className={cn(propertyTriggerVariants({ face }), tone && DUE_TONE_CLASS[tone])}
      triggerProps={triggerProps}
      trigger={
        <>
          <Icon className={cn(!tone && "text-muted-foreground")} />
          {text ?? (face === "pill" ? placeholder : <PropertyPlaceholder>{placeholder}</PropertyPlaceholder>)}
        </>
      }
    >
      <PopoverContent className="w-auto gap-0 p-0" align="start" onClick={(event) => event.stopPropagation()}>
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={value ? toDate(value) : undefined}
          defaultMonth={value ? toDate(value) : undefined}
          disabled={disabled}
          onSelect={(date) => {
            // Picking the selected day again deselects it, which a required date ignores.
            if (date || clearable) onChange(date ? toIso(date) : null);
            setOpen(false);
          }}
        />
        {value && clearable && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </PropertyPopover>
  );
}

export { DatePicker };
