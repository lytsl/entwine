import { Button } from "@entwine/ui/components/ui/button";
import { PopoverTrigger } from "@entwine/ui/components/ui/popover";
import type { ReactNode } from "react";

export function PanelButton({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <PopoverTrigger render={<Button variant="outline" size="sm" className="relative h-7 gap-1.5 px-2 text-body" />}>
      {icon}
      {label}
      {active && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />}
    </PopoverTrigger>
  );
}
