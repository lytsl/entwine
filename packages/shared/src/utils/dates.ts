export function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

export function dateIn(timezone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** 0 is Sunday. */
export const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

export function localToday(now = new Date()): string {
  return addDays("1970-01-01", Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000));
}
