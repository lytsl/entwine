import type { Row, Rows } from "@entwine/shared";

declare module "@entwine/db-collection/react" {
  interface Register {
    rows: Rows;
  }
}

export type Issue = Row<"Issue">;
export type State = Row<"State">;
export type Project = Row<"Project">;
export type Label = Row<"Label">;
export type Member = Row<"Member">;
export type IssueRelation = Row<"IssueRelation">;
export type IssueLink = Row<"IssueLink">;
export type Reaction = Row<"Reaction">;
export type Attachment = Row<"Attachment">;
export type View = Row<"View">;
export type Cycle = Row<"Cycle">;
export type Module = Row<"Module">;
export type ModuleMember = Row<"ModuleMember">;
export type Notification = Row<"Notification">;

export type PlanKind = "cycle" | "module";
