import { labelNameKey, pairId } from "@entwine/shared";
import { type Label } from "../types/rows";
import { linkIssues, RowStore } from "./row-store";

export class Labels extends RowStore<Label> {
  /** By name. */
  get sorted(): Label[] {
    return this.derived("sorted", (labels) => labels.sort((a, b) => a.name.localeCompare(b.name)));
  }

  /** Ignoring case. */
  find = (name: string): Label | undefined => {
    const key = labelNameKey(name);
    return this.sorted.find((label) => label.nameKey === key);
  };

  create = (name: string, color: string): string => {
    const id = crypto.randomUUID();
    void this.ws.mutate(() =>
      this.ws.collections.Label.insert({
        id,
        name: name.trim(),
        nameKey: labelNameKey(name),
        color,
        createdAt: Date.now(),
      }),
    );
    return id;
  };

  update = (id: string, patch: Partial<Pick<Label, "name" | "color">>) =>
    this.ws.mutate(() =>
      this.ws.collections.Label.update(id, (label) => {
        Object.assign(label, patch);
        if (patch.name) label.nameKey = labelNameKey(patch.name);
      }),
    );

  delete = (id: string) => this.ws.mutate(() => this.ws.collections.Label.delete(id));

  /** Adds the label to each issue that lacks it or, when all have it, removes it from all. */
  toggle = (issues: string | readonly string[], labelId: string) =>
    linkIssues(
      this.ws,
      this.ws.collections.IssueLabel,
      issues,
      (issueId: string) => ({ id: pairId(issueId, labelId), issueId, labelId }),
      true,
    );
}
