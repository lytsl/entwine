type StateType = "backlog" | "unstarted" | "started" | "completed" | "cancelled";

/** The knockout tick or cross reads against the page in both themes. */
function StateIcon({ type, color, className = "" }: { type: string; color: string; className?: string }) {
  const c = `h-4 w-4 shrink-0 ${className}`;
  switch (type as StateType) {
    case "backlog":
      return (
        <svg viewBox="0 0 16 16" className={c} aria-label="Backlog">
          <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="2.2 2.2" />
        </svg>
      );
    case "unstarted":
      return (
        <svg viewBox="0 0 16 16" className={c} aria-label="Unstarted">
          <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.6" />
        </svg>
      );
    case "started":
      return (
        <svg viewBox="0 0 16 16" className={c} aria-label="Started">
          <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.6" />
          <path d="M8 4a4 4 0 0 1 0 8z" fill={color} />
        </svg>
      );
    case "completed":
      return (
        <svg viewBox="0 0 16 16" className={c} aria-label="Completed">
          <circle cx="8" cy="8" r="7" fill={color} />
          <path
            d="M5 8.2l2 2 4-4.4"
            stroke="var(--background)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "cancelled":
      return (
        <svg viewBox="0 0 16 16" className={c} aria-label="Cancelled">
          <circle cx="8" cy="8" r="7" fill={color} />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}

export { StateIcon };
