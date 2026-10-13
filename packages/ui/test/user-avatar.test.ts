import { expect, test } from "bun:test";
import { AVATAR_FILLS } from "../src/components/ui/user-avatar";

/** WCAG's relative luminance of an `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// axe skips a single letter as too short to judge, so a browser test would pass or fail by the members' names.
test("white initials have a contrast of 4.5:1 on every avatar fill", () => {
  for (const fill of AVATAR_FILLS) {
    const contrast = 1.05 / (luminance(fill) + 0.05);
    expect([fill, contrast >= 4.5]).toEqual([fill, true]);
  }
});
