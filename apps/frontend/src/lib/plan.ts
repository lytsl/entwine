import type { CyclePhase, Progress, Row } from "@entwine/shared";
import { formatDate } from "@entwine/ui/lib/dates";
import type { Store } from "../store";
import type { Cycle, Member, Module, PlanKind } from "../types/rows";
import { daysBetween, daysLeft } from "./dates";

/** Current from its start through its end; `today` is an ISO date. */
export function cyclePhase(cycle: Pick<Row<"Cycle">, "startDate" | "endDate">, today: string): CyclePhase {
  if (today < cycle.startDate) return "upcoming";
  return today > cycle.endDate ? "past" : "current";
}

/** Current and upcoming soonest first, past most recent first. */
export function cyclesByPhase(cycles: readonly Cycle[], today: string): Record<CyclePhase, Cycle[]> {
  const phases: Record<CyclePhase, Cycle[]> = { current: [], upcoming: [], past: [] };
  for (const cycle of cycles) phases[cyclePhase(cycle, today)].push(cycle);
  phases.past.reverse();
  return phases;
}

export const planUrl = (workspaceSlug: string, kind: PlanKind, plan: Cycle | Module) =>
  `${location.origin}/${workspaceSlug}/projects/${plan.projectId}/${kind}s/${plan.id}`;

/** `text` is in lower case; an empty search matches every plan. */
export const planMatches = (text: string, plan: Cycle | Module) => !text || plan.name.toLowerCase().includes(text);

/** "4 days left", "Starts in 3 days", "Ended Sep 30". */
export function cycleWhen(cycle: Cycle, phase: CyclePhase, today: string): string {
  if (phase === "current") return daysLeft(cycle.endDate, today);
  if (phase === "past") return `Ended ${formatDate(cycle.endDate)}`;
  const days = daysBetween(today, cycle.startDate);
  return days === 1 ? "Starts tomorrow" : `Starts in ${days} days`;
}

/** "5 of 8 points", or nothing where no counted issue has an estimate. */
export const pointsDone = (points: Progress): string | null =>
  points.planned ? `${points.done} of ${points.planned} ${points.planned === 1 ? "point" : "points"}` : null;

/**
 * A cycle's progress with what the rollover moved out of it still planned there: it belongs to no state group of
 * the cycle any more, and is the part of the plan that was not done.
 */
export function withRolled(progress: Progress, rolled: number): Progress {
  if (!rolled) return progress;
  const planned = progress.planned + rolled;
  return { ...progress, total: progress.total + rolled, planned, percent: (progress.done / planned) * 100 };
}

/** A whole percentage that says 100 only once everything is done, and 0 only while nothing is. */
export function wholePercent({ done, planned, percent }: Progress): number {
  if (!planned || done <= 0) return 0;
  return done >= planned ? 100 : Math.min(99, Math.max(1, Math.round(percent)));
}

/** A module's members by name, those who left the workspace included. */
export const moduleMembers = (store: Store, moduleId: string): Member[] =>
  store.moduleMembers
    .of(moduleId)
    .map((id) => store.members.get(id))
    .filter((member) => !!member)
    .sort((a, b) => a.name.localeCompare(b.name));

/** A module is found by its name, and by who leads it or works on it. `text` is in lower case. */
export const moduleMatches = (store: Store, text: string, module: Module): boolean =>
  planMatches(text, module) ||
  [module.leadId ? store.members.get(module.leadId) : undefined, ...moduleMembers(store, module.id)].some((member) =>
    member?.name.toLowerCase().includes(text),
  );
