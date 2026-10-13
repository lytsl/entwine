export type Priority = "urgent" | "high" | "medium" | "low" | "none";

/** The knockout mark reads against the page in both themes. */
function PriorityIcon({ priority, className = "" }: { priority: Priority; className?: string }) {
  const c = `h-4 w-4 shrink-0 ${className}`;
  if (priority === "urgent") {
    return (
      <svg viewBox="0 0 16 16" className={c} aria-label="Urgent">
        <rect x="1" y="1" width="14" height="14" rx="3" fill="#f2994a" />
        <path d="M8 3.6v5.2M8 11.2v1.4" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  const bars = { high: 3, medium: 2, low: 1, none: 0 }[priority];
  if (bars === 0) {
    return (
      <svg viewBox="0 0 16 16" className={c} aria-label="No priority">
        <rect x="1.5" y="7.25" width="3" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
        <rect x="6.5" y="7.25" width="3" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
        <rect x="11.5" y="7.25" width="3" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={c} aria-label={`${priority[0].toUpperCase()}${priority.slice(1)} priority`}>
      <rect x="1.5" y="8" width="3" height="6" rx="1" fill="currentColor" opacity={bars >= 1 ? 1 : 0.25} />
      <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" opacity={bars >= 2 ? 1 : 0.25} />
      <rect x="11.5" y="2" width="3" height="12" rx="1" fill="currentColor" opacity={bars >= 3 ? 1 : 0.25} />
    </svg>
  );
}

export { PriorityIcon };
