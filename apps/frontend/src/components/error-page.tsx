import { Button } from "@entwine/ui/components/ui/button";
import { PageShell } from "@entwine/ui/components/ui/page-shell";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { useDocumentTitle } from "../hooks/use-document-title";

/**
 * Shown when a route's loader or render throws, in place of the router's unstyled default, and while a workspace
 * cannot be opened.
 */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useDocumentTitle("Something went wrong");
  return (
    <PageShell>
      <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center text-sm">
        <h1 className="text-base font-medium">Something went wrong</h1>
        <p className="text-muted-foreground">
          {(error instanceof Error && error.message) || "The page could not be shown."}
        </p>
        <Button
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </Button>
      </div>
    </PageShell>
  );
}
