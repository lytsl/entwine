/** The initials, or the first letters of one word. */
export function suggestIdentifier(name: string): string {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const initials = words.map((word) => word[0]).join("");
  return (words.length > 1 ? initials : (words[0] ?? "")).slice(0, 5);
}

/** Lower case, with dashes for everything but letters and digits. */
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
