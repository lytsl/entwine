/**
 * Each kind of row has a class, in a module of its own, and the workspace one object of each (`root.ts`), which
 * follows its rows and holds their edits. Every edit is a transaction on the collections. Edits to an issue are
 * `undoable`; deletes of other rows are not, since the server deletes their dependents with them.
 */
export type { CycleInput } from "./cycle";
export type { IssuePatch, NewIssue } from "./issue/issue";
export { NEWEST, questionKey, type Scope } from "./issue/issue-lists";
export { unarchived } from "./issue/scope";
export type { ModuleInput } from "./module";
export type { CycleSchedule } from "./project";
export { RootStore, type Store, sameButIssues } from "./root";
