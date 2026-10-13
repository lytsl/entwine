import type { ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <div className="flex flex-col gap-1 border-b pb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
