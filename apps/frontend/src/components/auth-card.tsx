import { Card, CardDescription, CardHeader, CardTitle } from "@entwine/ui/components/ui/card";
import { PageShell } from "@entwine/ui/components/ui/page-shell";
import type { ReactNode } from "react";
import { useDocumentTitle } from "../hooks/use-document-title";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <PageShell>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              e
            </span>
            entwine
          </div>
          <CardTitle role="heading" aria-level={1}>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children}
      </Card>
    </PageShell>
  );
}
