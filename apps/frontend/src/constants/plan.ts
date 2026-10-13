import type { PlanKind } from "../types/rows";

/** `one` names a plan; `many` titles the page that lists them. */
export const PLAN_NOUNS: Record<PlanKind, { one: string; many: string }> = {
  cycle: { one: "cycle", many: "Cycles" },
  module: { one: "module", many: "Modules" },
};
