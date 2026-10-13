/** "812 B", "3.4 KB", "10 MB": a file's size as a member reads it. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)} ${units[unit]}`;
}
