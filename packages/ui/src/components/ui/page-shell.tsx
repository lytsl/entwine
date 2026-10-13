import { cn } from "@entwine/ui/lib/utils";
import type { ReactNode } from "react";

/** For the screens shown before an app shell exists. */
function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground",
        className,
      )}
    >
      {children}
    </main>
  );
}

function LoadingPage({ label = "Loading…" }: { label?: string }) {
  return (
    <PageShell>
      <div className="text-sm text-muted-foreground">{label}</div>
    </PageShell>
  );
}

export { LoadingPage, PageShell };
