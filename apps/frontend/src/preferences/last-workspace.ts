import { storage } from "../lib/local-storage";

const KEY = "entwine:last-workspace";

export const lastWorkspace = {
  get: (): string | null => storage.get(KEY),
  set: (slug: string) => storage.set(KEY, slug),
  /** A workspace the member lost: its slug may come to name another. */
  forget: (slug: string) => {
    if (storage.get(KEY) === slug) storage.remove(KEY);
  },
};
