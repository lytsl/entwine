export interface Operation {
  model: string;
  key: string;
  type: "insert" | "update" | "delete";
  original: Record<string, unknown>;
  modified: Record<string, unknown>;
  changes: Record<string, unknown>;
}

/** The operations of one transaction, in the order they were made. */
export interface Step {
  id: string;
  operations: readonly Operation[];
}

export interface SessionStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
