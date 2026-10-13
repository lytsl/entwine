/**
 * Local storage may be off (a private window, blocked site data): then a read finds nothing and a write is dropped,
 * so a choice still holds until the page is left.
 */
export const storage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
