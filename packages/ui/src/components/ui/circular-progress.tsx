import { cn } from "@entwine/ui/lib/utils";

/** A full ring turns green. */
function CircularProgress({
  value,
  size = 16,
  className,
  label,
}: {
  /** 0 to 100. */
  value: number;
  size?: number;
  className?: string;
  label?: string;
}) {
  const stroke = Math.max(2, size / 7);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0 -rotate-90", className)}
      role="img"
      aria-label={label ?? `${Math.round(clamped)}%`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={clamped >= 100 ? "var(--success)" : "var(--primary)"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        className="transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  );
}

export { CircularProgress };
