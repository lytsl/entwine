import { addDays } from "@entwine/shared";

/** `YYYY-MM`, `delta` months after `month`. */
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** The days a month's grid shows: whole weeks, Monday first, covering the month. */
export function monthDays(month: string): string[] {
  const first = `${month}-01`;
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const count = Math.ceil((offset + Number(last.slice(8))) / 7) * 7;
  return Array.from({ length: count }, (_, i) => addDays(first, i - offset));
}

/** A day as it is read out: "Saturday, October 10". */
export const spoken = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
