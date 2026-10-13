import { DISPLAY_PROPERTIES, type DisplayProperty } from "@entwine/shared";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import {
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  metaHelper,
  tableFeatures,
} from "@tanstack/react-table";
import {
  BoxIcon,
  CalendarClockIcon,
  CalendarIcon,
  CircleDotDashedIcon,
  FolderIcon,
  IterationCcwIcon,
  LinkIcon,
  NetworkIcon,
  SignalHighIcon,
  TagIcon,
  TriangleIcon,
  UserIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { dueTone } from "../../../../../lib/dates";
import { progressOf } from "../../../../../lib/issue-tree";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { AssigneePicker } from "../../pickers/assignee-picker";
import { CyclePicker } from "../../pickers/cycle-picker";
import { EstimatePicker } from "../../pickers/estimate-picker";
import { LabelPicker } from "../../pickers/label-picker";
import { ModulePicker } from "../../pickers/module-picker";
import { PriorityPicker } from "../../pickers/priority-picker";
import { StatePicker } from "../../pickers/state-picker";
import { IssueLink } from "../issue-link";
import { IssueQuickActions } from "../issue-menu/issue-quick-actions";
import { SelectBox } from "../select-box";

/** Reaches the cells through the table, so the columns below never change. */
interface TableMeta {
  store: Store;
  showKey: boolean;
}

export const features = tableFeatures({
  columnVisibilityFeature,
  columnSizingFeature,
  tableMeta: metaHelper<TableMeta>(),
});
const helper = createColumnHelper<typeof features, Issue>();

const head = (icon: ReactNode, label: string) => () => (
  <span className="flex items-center gap-1.5 [&_svg]:size-3.5">
    {icon}
    {label}
  </span>
);
const muted = (text: ReactNode) => <span className="px-2.5 text-body text-muted-foreground">{text}</span>;

const column = (
  id: string,
  header: string | (() => ReactNode),
  size: number,
  cell: (issue: Issue, meta: TableMeta) => ReactNode,
) =>
  helper.display({
    id,
    header,
    size,
    // The spreadsheet always passes `meta`.
    cell: ({ row, table }) => cell(row.original, table.options.meta as TableMeta),
  });

export const ISSUE_COLUMN = "issue";
export const PROJECT_COLUMN = "project";

/** `key` has none, since the issue column shows it. */
export const PROPERTY_COLUMNS = {
  state: column("state", head(<CircleDotDashedIcon />, "State"), 160, (issue, { store }) => (
    <StatePicker
      store={store}
      projectId={issue.projectId}
      value={issue.stateId}
      onChange={(stateId) => store.issues.update(issue.id, { stateId })}
      face="cell"
    />
  )),
  priority: column("priority", head(<SignalHighIcon />, "Priority"), 144, (issue, { store }) => (
    <PriorityPicker
      value={issue.priority}
      onChange={(priority) => store.issues.update(issue.id, { priority })}
      face="cell"
    />
  )),
  assignee: column("assignee", head(<UserIcon />, "Assignee"), 160, (issue, { store }) => (
    <AssigneePicker
      store={store}
      value={issue.assigneeId}
      onChange={(assigneeId) => store.issues.update(issue.id, { assigneeId })}
      face="cell"
    />
  )),
  labels: column("labels", head(<TagIcon />, "Labels"), 176, (issue, { store }) => (
    <LabelPicker
      store={store}
      selected={store.issues.labelsOf(issue.id)}
      onToggle={(labelId) => store.labels.toggle(issue.id, labelId)}
      face="cell"
    />
  )),
  startDate: column("startDate", head(<CalendarIcon />, "Start date"), 144, (issue, { store }) => (
    <DatePicker
      label={`${store.issues.key(issue)} start date`}
      placeholder="Start date"
      value={issue.startDate}
      max={issue.dueDate}
      onChange={(startDate) => store.issues.update(issue.id, { startDate })}
      face="cell"
    />
  )),
  dueDate: column("dueDate", head(<CalendarClockIcon />, "Due date"), 144, (issue, { store }) => (
    <DatePicker
      label={`${store.issues.key(issue)} due date`}
      placeholder="Due date"
      icon="due"
      value={issue.dueDate}
      min={issue.startDate}
      tone={dueTone(issue.dueDate, store.states.get(issue.stateId)?.group)}
      onChange={(dueDate) => store.issues.update(issue.id, { dueDate })}
      face="cell"
    />
  )),
  estimate: column("estimate", head(<TriangleIcon />, "Estimate"), 128, (issue, { store }) => (
    <EstimatePicker
      value={issue.estimate}
      onChange={(estimate) => store.issues.update(issue.id, { estimate })}
      face="cell"
    />
  )),
  subIssues: column("subIssues", head(<NetworkIcon />, "Sub-issues"), 112, (issue, { store }) => {
    const children = store.issues.childrenOf(issue.id);
    return muted(children.length ? `${progressOf(children, store).done}/${children.length}` : "—");
  }),
  links: column("links", head(<LinkIcon />, "Links"), 96, (issue, { store }) =>
    muted(store.issues.linkCount(issue.id) || "—"),
  ),
  cycle: column("cycle", head(<IterationCcwIcon />, "Cycle"), 176, (issue, { store }) => (
    <CyclePicker
      store={store}
      projectId={issue.projectId}
      value={issue.cycleId}
      onChange={(cycleId) => store.issues.update(issue.id, { cycleId })}
      face="cell"
    />
  )),
  modules: column("modules", head(<BoxIcon />, "Modules"), 176, (issue, { store }) => (
    <ModulePicker
      store={store}
      projectId={issue.projectId}
      selected={store.issues.modulesOf(issue.id)}
      onToggle={(moduleId) => store.modules.toggle(issue.id, moduleId)}
      face="cell"
    />
  )),
} satisfies Partial<Record<DisplayProperty, unknown>>;

export const columns = helper.columns([
  {
    ...column(ISSUE_COLUMN, "Issues", 416, (issue, { store, showKey }) => {
      const key = store.issues.key(issue);
      return (
        <div className="flex items-center gap-2">
          <SelectBox
            issueId={issue.id}
            label={key}
            className="hover-reveal group-hover/row:opacity-100 focus-visible:opacity-100"
          />
          {showKey && (
            <span className="w-16 shrink-0 text-caption font-medium text-muted-foreground tabular-nums">{key}</span>
          )}
          <IssueLink issue={issue} className="min-w-0 flex-1 truncate font-medium" />
          <IssueQuickActions
            issue={issue}
            store={store}
            className="hover-reveal group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
          />
        </div>
      );
    }),
    enableHiding: false,
  },
  // In the order of the display properties, which is the order the Display panel lists them in.
  ...DISPLAY_PROPERTIES.flatMap((property) =>
    property in PROPERTY_COLUMNS ? PROPERTY_COLUMNS[property as keyof typeof PROPERTY_COLUMNS] : [],
  ),
  column(PROJECT_COLUMN, head(<FolderIcon />, "Project"), 160, (issue, { store }) => {
    const project = store.projects.get(issue.projectId);
    return (
      project && (
        <span className="flex items-center gap-2 px-2.5 text-muted-foreground">
          <ProjectIcon project={project} size={16} />
          <span className="truncate">{project.name}</span>
        </span>
      )
    );
  }),
]);
