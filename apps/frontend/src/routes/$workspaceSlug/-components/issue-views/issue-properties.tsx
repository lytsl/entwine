import type { DisplayProperty } from "@entwine/shared";
import { CountPill } from "@entwine/ui/components/ui/count-pill";
import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import type { PropertyFace } from "@entwine/ui/components/ui/property-select";
import { LinkIcon, NetworkIcon } from "lucide-react";
import { dueTone } from "../../../../lib/dates";
import { progressOf } from "../../../../lib/issue-tree";
import type { IssuePatch, Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";
import { AssigneePicker } from "../pickers/assignee-picker";
import { CyclePicker } from "../pickers/cycle-picker";
import { EstimatePicker } from "../pickers/estimate-picker";
import { LabelPicker } from "../pickers/label-picker";
import { ModulePicker } from "../pickers/module-picker";
import { PriorityPicker } from "../pickers/priority-picker";
import { StatePicker } from "../pickers/state-picker";

/**
 * Empty dates, estimate, labels, cycle and modules are left out of rows and cards to keep them quiet; they are set
 * from the issue or the spreadsheet.
 */
export function IssueProperties({
  issue,
  store,
  properties,
  skip,
  face = "pill",
}: {
  issue: Issue;
  store: Store;
  properties: readonly DisplayProperty[];
  /** A property the layout already shows, such as the board column's. */
  skip?: DisplayProperty;
  face?: PropertyFace;
}) {
  const show = (property: DisplayProperty) => property !== skip && properties.includes(property);
  const set = (patch: IssuePatch) => store.issues.update(issue.id, patch);
  const group = store.states.get(issue.stateId)?.group;
  const children = show("subIssues") ? store.issues.childrenOf(issue.id) : [];
  const links = show("links") ? store.issues.linkCount(issue.id) : 0;
  const labels = show("labels") ? store.issues.labelsOf(issue.id) : [];
  const modules = show("modules") ? store.issues.modulesOf(issue.id) : [];
  const cycle = show("cycle") && issue.cycleId ? store.cycles.get(issue.cycleId) : undefined;
  return (
    <>
      {show("state") && (
        <StatePicker
          store={store}
          projectId={issue.projectId}
          value={issue.stateId}
          onChange={(stateId) => set({ stateId })}
          face={face}
        />
      )}
      {show("priority") && (
        <PriorityPicker value={issue.priority} onChange={(priority) => set({ priority })} face={face} />
      )}
      {show("startDate") && issue.startDate && (
        <DatePicker
          label="Start date"
          value={issue.startDate}
          max={issue.dueDate}
          onChange={(startDate) => set({ startDate })}
          face={face}
        />
      )}
      {show("dueDate") && issue.dueDate && (
        <DatePicker
          label="Due date"
          icon="due"
          value={issue.dueDate}
          min={issue.startDate}
          tone={dueTone(issue.dueDate, group)}
          onChange={(dueDate) => set({ dueDate })}
          face={face}
        />
      )}
      {show("estimate") && issue.estimate !== null && (
        <EstimatePicker value={issue.estimate} onChange={(estimate) => set({ estimate })} face={face} />
      )}
      {children.length > 0 && (
        <CountPill
          icon={<NetworkIcon />}
          count={`${progressOf(children, store).done}/${children.length}`}
          tooltip={`${progressOf(children, store).done} of ${children.length} sub-issues done`}
        />
      )}
      {links > 0 && (
        <CountPill icon={<LinkIcon />} count={links} tooltip={`${links} ${links === 1 ? "link" : "links"}`} />
      )}
      {labels.length > 0 && (
        <LabelPicker
          store={store}
          selected={labels}
          onToggle={(labelId) => store.labels.toggle(issue.id, labelId)}
          face={face}
        />
      )}
      {cycle && (
        <CyclePicker
          store={store}
          projectId={issue.projectId}
          value={cycle.id}
          onChange={(cycleId) => set({ cycleId })}
          face={face}
        />
      )}
      {modules.length > 0 && (
        <ModulePicker
          store={store}
          projectId={issue.projectId}
          selected={modules}
          onToggle={(moduleId) => store.modules.toggle(issue.id, moduleId)}
          face={face}
        />
      )}
      {show("assignee") && (
        <AssigneePicker
          store={store}
          value={issue.assigneeId}
          onChange={(assigneeId) => set({ assigneeId })}
          face={face}
        />
      )}
    </>
  );
}
