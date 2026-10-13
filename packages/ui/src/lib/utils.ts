import { createCn } from "cn/config";

/**
 * A status or project colour is picked to be told apart, not to be read: mixed towards the theme's text colour it
 * keeps its hue and meets WCAG's 4.5:1 on the theme's surfaces.
 */
export const textColor = (color: string) => `color-mix(in oklch, ${color} 55%, var(--foreground))`;

/**
 * Told that the theme's type scale (`text-body`, `text-caption`, `text-micro`) is a font size: otherwise the merge
 * reads it as a text colour and drops it beside `text-muted-foreground`.
 */
export const cn = createCn({ extend: { classGroups: { "font-size": [{ text: ["body", "caption", "micro"] }] } } });
