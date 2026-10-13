/**
 * What a project's cycle schedule asks of the server, done for a whole tenant inside one write: the upcoming cycles
 * it keeps created, and the open issues of ended cycles it moves on. It keeps no state of its own, so a pass that
 * comes a month late does what the passes it missed would have. Nobody made these changes: the cycles have no
 * creator and the activity no actor.
 */
import { ARCHIVABLE_GROUPS, addDays, dateIn, type Row, type Rows, weekday } from "@entwine/shared";
import type { Writer } from "@entwine/sync-engine";

type Project = Row<"Project"> & { cycleWeeks: number };

export async function planCycles(writer: Writer<Rows>, now: number): Promise<void> {
  for (const project of await writer.list("Project")) {
    if (project.cycleWeeks === null || project.archivedAt !== null) continue;
    // The viewer's date decides a cycle's phase; the server has no viewer, so the schedule names a zone.
    const today = dateIn(project.cycleTimezone, new Date(now));
    const cycles = await writer.list("Cycle", { projectId: project.id });
    await createUpcoming(writer, project as Project, cycles, today, now);
    if (project.cycleRollover) await rollOver(writer, project.id, cycles, today, now);
  }
}

/**
 * The schedule keeps its own run of cycles: a new one follows the latest it made, so a deleted one is not made again
 * in its gap, and takes the first slot on its weekday that no cycle of the project is in. A hand-made cycle is
 * stepped over, however far ahead it is, and does not stand in for one of the schedule's. Adds what it creates to
 * `cycles`.
 */
async function createUpcoming(
  writer: Writer<Rows>,
  project: Project,
  cycles: Row<"Cycle">[],
  today: string,
  now: number,
): Promise<void> {
  const scheduled = cycles.filter((cycle) => cycle.creatorId === null);
  let upcoming = scheduled.filter((cycle) => cycle.startDate > today).length;
  let number = Math.max(0, ...cycles.map((cycle) => Number(/^Cycle (\d{1,6})$/.exec(cycle.name)?.[1] ?? 0)));
  const latestEnd = scheduled.reduce((latest, cycle) => (cycle.endDate > latest ? cycle.endDate : latest), "");
  let earliest = latestEnd >= today ? addDays(latestEnd, 1) : today;
  while (upcoming < project.cycleUpcoming) {
    let startDate: string;
    let endDate: string;
    for (;;) {
      startDate = addDays(earliest, (project.cycleStartDay - weekday(earliest) + 7) % 7);
      endDate = addDays(startDate, project.cycleWeeks * 7 - 1);
      const inTheWay = cycles.filter((cycle) => cycle.startDate <= endDate && cycle.endDate >= startDate);
      if (!inTheWay.length) break;
      earliest = addDays(
        inTheWay
          .map((cycle) => cycle.endDate)
          .sort()
          .at(-1)!,
        1,
      );
    }
    const cycle: Row<"Cycle"> = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name: `Cycle ${++number}`,
      description: "",
      startDate,
      endDate,
      creatorId: null,
      rolledIssues: 0,
      rolledPoints: 0,
      createdAt: now,
      updatedAt: now,
    };
    await writer.insert("Cycle", cycle);
    cycles.push(cycle);
    earliest = addDays(endDate, 1);
    // One that starts today is current, and does not count.
    if (startDate > today) upcoming++;
  }
}

/**
 * Finished and archived issues stay where they were done. The cycle keeps count of what leaves it, or it would read
 * as wholly done from then on.
 */
async function rollOver(
  writer: Writer<Rows>,
  projectId: string,
  cycles: readonly Row<"Cycle">[],
  today: string,
  now: number,
): Promise<void> {
  // The current cycle, or else the next to start.
  const [next] = cycles
    .filter((cycle) => cycle.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  if (!next) return;
  const open = new Set(
    (await writer.list("State", { projectId })).filter((s) => !ARCHIVABLE_GROUPS.includes(s.group)).map((s) => s.id),
  );
  for (const cycle of cycles) {
    if (cycle.endDate >= today) continue;
    let issues = 0;
    let points = 0;
    for (const issue of await writer.list("Issue", { cycleId: cycle.id })) {
      if (issue.archivedAt !== null || !open.has(issue.stateId)) continue;
      await writer.update("Issue", issue.id, { cycleId: next.id, updatedAt: now });
      await writer.insert("Activity", {
        id: crypto.randomUUID(),
        issueId: issue.id,
        actorId: null,
        field: "cycleId",
        oldValue: cycle.id,
        newValue: next.id,
        createdAt: now,
      });
      issues++;
      points += issue.estimate ?? 0;
    }
    if (issues)
      await writer.update("Cycle", cycle.id, {
        rolledIssues: cycle.rolledIssues + issues,
        rolledPoints: cycle.rolledPoints + points,
      });
  }
}
