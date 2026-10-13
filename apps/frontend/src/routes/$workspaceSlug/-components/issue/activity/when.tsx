import { fullTime, timeAgo } from "../../../../../lib/dates";

export function When({ at }: { at: number }) {
  return (
    <time
      dateTime={new Date(at).toISOString()}
      title={fullTime(at)}
      className="whitespace-nowrap text-muted-foreground"
    >
      {timeAgo(at)}
    </time>
  );
}
