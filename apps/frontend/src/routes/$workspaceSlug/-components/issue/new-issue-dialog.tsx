/** Creating stays on the page and says which issue it made; "Create more" keeps the dialog open for the next one. */
import { RichText } from "@entwine/ui/components/editor/rich-text";
import { Button } from "@entwine/ui/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { Kbd } from "@entwine/ui/components/ui/kbd";
import { Switch } from "@entwine/ui/components/ui/switch";
import { toast } from "@entwine/ui/components/ui/toast";
import { useSelector } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, XIcon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useAppForm } from "../../../../hooks/use-app-form";
import { useIssueScope } from "../../../../hooks/use-issue-scope";
import { useShell } from "../../../../hooks/use-shell";
import { fieldErrors } from "../../../../lib/form";
import { issueFormOptions } from "../../../../lib/issue-form";
import { submitHint } from "../../../../lib/shortcuts";
import type { Store } from "../../../../store";
import type { NewIssueDefaults } from "../../../../types/shell";
import { ProjectPicker } from "../pickers/project-picker";
import { NewIssueProperties } from "./new-issue-properties";

const TITLE_ERROR = "new-issue-title-error";

export function NewIssueDialog({
  onClose,
  store,
  defaults = {},
}: {
  onClose(): void;
  store: Store;
  defaults?: NewIssueDefaults;
}) {
  const shell = useShell();
  const navigate = useNavigate({ from: "/$workspaceSlug" });
  const active = store.projects.active;
  const first = active.find((p) => p.id === defaults.projectId) ?? active[0];
  // A state, parent and plans only hold when their project is the one the dialog starts in (it skips archived
  // projects).
  const inDefaultProject = first?.id === defaults.projectId;
  const [more, setMore] = useState(false);
  // Starts the description's editor afresh for the next issue.
  const [round, setRound] = useState(0);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const open = (id: string) => {
    if (shell.peek.current) shell.peek.current(id);
    else
      void navigate({
        to: "/$workspaceSlug/issues/$issueId",
        params: { issueId: id },
      });
  };

  const form = useAppForm({
    ...issueFormOptions,
    defaultValues: {
      projectId: first?.id ?? "",
      title: defaults.title ?? "",
      description: defaults.description ?? "",
      stateId: (inDefaultProject ? defaults.stateId : undefined) ?? first?.defaultStateId ?? "",
      priority: defaults.priority ?? "none",
      assigneeId: defaults.assigneeId ?? null,
      startDate: defaults.startDate ?? null,
      dueDate: defaults.dueDate ?? null,
      estimate: defaults.estimate ?? null,
      labelIds: defaults.labelIds ?? [],
      parentId: inDefaultProject ? (defaults.parentId ?? null) : null,
      cycleId: inDefaultProject ? (defaults.cycleId ?? null) : null,
      moduleIds: inDefaultProject ? (defaults.moduleIds ?? []) : [],
    },
    onSubmitInvalid: () => titleRef.current?.focus(),
    onSubmit: ({ value, formApi }) => {
      const project = store.projects.get(value.projectId);
      if (!project) return;
      const title = value.title.trim();
      const key = `${project.identifier}-${project.lastIssueNumber + 1}`;
      const id = store.issues.create({ ...value, title });
      toast.success(`${key} created`, {
        description: title,
        action: { label: "Open", onClick: () => open(id) },
      });
      if (more) {
        formApi.setFieldValue("title", "");
        formApi.setFieldValue("description", "");
        setRound((n) => n + 1);
        titleRef.current?.focus();
      } else onClose();
    },
  });
  const projectId = useSelector(form.store, (state) => state.values.projectId);
  const datesError = useSelector(form.store, (state) => fieldErrors(state.fieldMeta.dueDate?.errors ?? [])[0]?.message);
  const scope = useIssueScope({ projectId });
  const project = store.projects.get(projectId);

  // The issues a parent is chosen from are still loading: the form waits for them.
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (scope.ready) void form.handleSubmit();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="top-[12%] max-h-[calc(88dvh-1rem)] translate-y-0 gap-0 p-0 sm:max-w-2xl"
        showCloseButton={false}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      >
        <form.AppForm>
          <form className="contents" onSubmit={submit}>
            <div className="flex items-center gap-1.5 px-4 pt-4">
              {project ? (
                <form.Field
                  name="projectId"
                  listeners={{
                    // A state, parent, cycle and modules belong to one project.
                    onChange: ({ value }) => {
                      form.setFieldValue("stateId", store.projects.get(value)?.defaultStateId ?? "");
                      form.setFieldValue("parentId", null);
                      form.setFieldValue("cycleId", null);
                      form.setFieldValue("moduleIds", []);
                    },
                  }}
                >
                  {(field) => <ProjectPicker store={store} value={field.state.value} onChange={field.handleChange} />}
                </form.Field>
              ) : null}
              <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              <DialogTitle className="text-body font-normal text-muted-foreground">New issue</DialogTitle>
              {!scope.ready && <p role="status">{scope.error?.message ?? "Loading issues…"}</p>}
              <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close" onClick={onClose}>
                <XIcon />
              </Button>
            </div>

            {!project ? (
              <p className="px-5 py-8 text-body text-muted-foreground">Create a project first.</p>
            ) : (
              <>
                <div className="flex flex-col gap-1 px-5 pt-3">
                  <form.Field name="title">
                    {(field) => {
                      const error = fieldErrors(field.state.meta.errors)[0]?.message;
                      return (
                        <>
                          <textarea
                            ref={titleRef}
                            autoFocus
                            rows={1}
                            aria-label="Title"
                            aria-invalid={error !== undefined}
                            aria-describedby={error ? TITLE_ERROR : undefined}
                            placeholder="Issue title"
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.value.replace(/\n/g, ""))}
                            onKeyDown={(event) =>
                              event.key === "Enter" && !event.metaKey && !event.ctrlKey && event.preventDefault()
                            }
                            className="field-sizing-content resize-none bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground/70"
                          />
                          {error && (
                            <p id={TITLE_ERROR} role="alert" className="text-caption text-destructive">
                              {error}
                            </p>
                          )}
                        </>
                      );
                    }}
                  </form.Field>
                  <form.Field name="description">
                    {(field) => (
                      <RichText
                        key={round}
                        aria-label="Description"
                        placeholder="Add a description…"
                        value={field.state.value}
                        people={store.members.people}
                        onChange={field.handleChange}
                        className="[&_.tiptap]:min-h-20"
                      />
                    )}
                  </form.Field>
                </div>
                <NewIssueProperties form={form} store={store} />
              </>
            )}

            {/* The footer wraps: as one line it is wider than a phone, and the dialog's grid would grow to hold it. */}
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t px-4 py-3">
              {datesError && (
                <p role="alert" className="text-caption text-destructive">
                  {datesError}
                </p>
              )}
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-caption text-muted-foreground">
                <Switch size="sm" checked={more} onCheckedChange={setMore} aria-label="Create more" />
                Create more
              </label>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!project || !!datesError}>
                Create issue
                <Kbd className="bg-black/25 text-primary-foreground">{submitHint()}</Kbd>
              </Button>
            </div>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
