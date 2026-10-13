import { Separator } from "@entwine/ui/components/ui/separator";
import { SidebarTrigger } from "@entwine/ui/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useDocumentTitle } from "../hooks/use-document-title";

export function PageHeader({
  title,
  icon,
  crumbs = [],
  count,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  crumbs?: ReactNode[];
  count?: number;
  children?: ReactNode;
}) {
  useDocumentTitle(typeof title === "string" ? title : undefined);
  return (
    <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 @min-[64rem]/main:h-11 @min-[64rem]/main:flex-nowrap @min-[64rem]/main:py-0">
      <SidebarTrigger className="-ml-1 size-7 text-muted-foreground" />
      <Separator orientation="vertical" className="mr-1 h-4! self-center" />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-1 text-body @min-[64rem]/main:flex-initial"
      >
        {crumbs.map((crumb, index) => (
          <Fragment key={index}>
            {crumb}
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
          </Fragment>
        ))}
        <span className="flex min-w-0 items-center gap-1.5 px-1">
          {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
          <h1 className="truncate font-medium">{title}</h1>
        </span>
      </nav>
      {count !== undefined && (
        <span
          className="rounded-full bg-muted px-2 py-0.5 text-micro font-medium text-muted-foreground tabular-nums"
          title={`${count} ${count === 1 ? "issue" : "issues"}`}
        >
          {count.toLocaleString()}
        </span>
      )}
      {children && (
        <div className="flex w-full flex-wrap items-center gap-1.5 @min-[64rem]/main:ml-auto @min-[64rem]/main:w-auto @min-[64rem]/main:flex-nowrap">
          {children}
        </div>
      )}
    </header>
  );
}
