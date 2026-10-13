import type { ReactNode } from "react";

export function SettingsPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* The room below lets the last form scroll clear of a toast, which lies over the bottom of a narrow page. */}
      <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 pt-10 pb-28 @min-[40rem]/main:px-6">{children}</div>
    </div>
  );
}
