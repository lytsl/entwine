import type { Store } from "./store";

/** Web Locks: `acquired` runs once `name` is held, until the returned release is called. */
export interface Locks {
  hold(name: string, acquired: () => void): () => void;
  /** Whether nobody holds or waits for `name`. */
  free(name: string): Promise<boolean>;
}

export interface LocalStore {
  /** Names this member's copy of this workspace, for its locks. */
  name: string;
  store: Store;
  locks: Locks;
  close(): Promise<void>;
  destroy(): Promise<void>;
}
