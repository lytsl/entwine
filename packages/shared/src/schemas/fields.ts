import { z } from "zod";

export const id = z.string().min(1).max(100);
/** An id derived from two others, joined with a colon. */
export const derivedId = z.string().min(1).max(201);
/** Epoch milliseconds. */
export const time = z.number().int();
export const date = z.iso.date();
export const description = z.string().max(100_000);
/** Text that must be given, trimmed; `required` is what a form says when it is not. */
export const name = (max: number, required = "Required") => z.string().trim().min(1, required).max(max);
export const color = z.string().regex(/^#[0-9a-f]{6}$/i, "A color is #rrggbb");
