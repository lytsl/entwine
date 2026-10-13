import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import { propertyTriggerVariants } from "@entwine/ui/components/ui/property-select";
import { useSelector } from "@tanstack/react-form";
import { GitForkIcon } from "lucide-react";
import { withForm } from "../../../../hooks/use-app-form";
import { issueFormOptions } from "../../../../lib/issue-form";
import { toggledList } from "../../../../lib/toggle";
import type { Store } from "../../../../store";
import { AssigneePicker } from "../pickers/assignee-picker";
import { CyclePicker } from "../pickers/cycle-picker";
import { EstimatePicker } from "../pickers/estimate-picker";
import { IssuePicker } from "../pickers/issue-picker";
import { LabelPicker } from "../pickers/label-picker";
import { ModulePicker } from "../pickers/module-picker";
import { PriorityPicker } from "../pickers/priority-picker";
import { StatePicker } from "../pickers/state-picker";

export const NewIssueProperties = withForm({
  ...issueFormOptions,
  props: {} as { store: Store },
  render: function NewIssueProperties({ form, store }) {
    const projectId = useSelector(form.store, (state) => state.values.projectId);
    const startDate = useSelector(form.store, (state) => state.values.startDate);
    const dueDate = useSelector(form.store, (state) => state.values.dueDate);
    return (
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-4">
        <form.Field name="stateId">
          {(field) => (
            <StatePicker store={store} projectId={projectId} value={field.state.value} onChange={field.handleChange} />
          )}
        </form.Field>
        <form.Field name="priority">
          {(field) => <PriorityPicker value={field.state.value} onChange={field.handleChange} showName />}
        </form.Field>
        <form.Field name="assigneeId">
          {(field) => <AssigneePicker store={store} value={field.state.value} onChange={field.handleChange} showName />}
        </form.Field>
        <form.Field name="labelIds">
          {(field) => (
            <LabelPicker
              store={store}
              selected={field.state.value}
              onToggle={(id) => field.handleChange((ids) => toggledList(ids, id))}
            />
          )}
        </form.Field>
        <form.Field name="estimate">
          {(field) => <EstimatePicker value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <DatePicker label="Start date" value={field.state.value} onChange={field.handleChange} max={dueDate} />
          )}
        </form.Field>
        <form.Field name="dueDate">
          {(field) => (
            <DatePicker
              label="Due date"
              icon="due"
              value={field.state.value}
              onChange={field.handleChange}
              min={startDate}
            />
          )}
        </form.Field>
        <form.Field name="cycleId">
          {(field) => (
            <CyclePicker store={store} projectId={projectId} value={field.state.value} onChange={field.handleChange} />
          )}
        </form.Field>
        <form.Field name="moduleIds">
          {(field) => (
            <ModulePicker
              store={store}
              projectId={projectId}
              selected={field.state.value}
              onToggle={(id) => field.handleChange((ids) => toggledList(ids, id))}
            />
          )}
        </form.Field>
        <form.Field name="parentId">
          {(field) => {
            const parent = field.state.value ? store.issues.get(field.state.value) : undefined;
            return (
              <IssuePicker
                store={store}
                issues={() => (projectId ? store.issues.list(store.issues.scope({ projectId })) : [])}
                placeholder="Choose a parent…"
                onSelect={(issue) => field.handleChange(issue.id)}
                trigger={
                  <button type="button" className={propertyTriggerVariants({ face: "pill" })} aria-label="Parent">
                    <GitForkIcon className="text-muted-foreground" />
                    <span className="truncate">{parent ? store.issues.key(parent) : "Parent"}</span>
                  </button>
                }
              />
            );
          }}
        </form.Field>
      </div>
    );
  },
});
