import { randomBytes } from "node:crypto";
import { chmod } from "node:fs/promises";

/** The secret a server makes for itself on first start and keeps in `file`, since sessions are signed with it. */
export async function keptSecret(file: string): Promise<string> {
  const kept = await Bun.file(file)
    .text()
    .catch(() => "");
  if (kept) return kept;
  const secret = randomBytes(32).toString("base64");
  await Bun.write(file, secret);
  await chmod(file, 0o600);
  return secret;
}
