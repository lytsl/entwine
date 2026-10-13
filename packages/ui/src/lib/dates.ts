/** An ISO calendar date ("2026-09-26") as a local `Date` at midnight. */
export const toDate = (iso: string): Date => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day);
};

export const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** "Sep 26", with the year when it is not this year, or always. */
export function formatDate(iso: string, { year = "auto" }: { year?: "auto" | "always" } = {}): string {
  const date = toDate(iso);
  const showYear = year === "always" || date.getFullYear() !== new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(showYear && { year: "numeric" }) });
}
