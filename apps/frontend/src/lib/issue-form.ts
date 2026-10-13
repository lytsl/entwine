import { issueDraftInput, issueInput } from "@entwine/shared";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod";

export type IssueFormValues = z.input<typeof issueInput>;

const BLANK: IssueFormValues = {
  projectId: "",
  title: "",
  description: "",
  stateId: "",
  priority: "none",
  assigneeId: null,
  parentId: null,
  startDate: null,
  dueDate: null,
  estimate: null,
  cycleId: null,
  labelIds: [],
  moduleIds: [],
};

/**
 * Shared by the new-issue dialog and the parts of it that are components of their own (`withForm`). The dates are
 * checked at every change, the title when it is submitted.
 */
export const issueFormOptions = formOptions({
  defaultValues: BLANK,
  validators: { onChange: issueDraftInput, onSubmit: issueInput },
});
