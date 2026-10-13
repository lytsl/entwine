import { ROLES, type Role } from "@entwine/shared";

/** Only an owner makes another owner, as the server has it. */
export const rolesFor = (owner: boolean): Role[] => ROLES.filter((role) => owner || role !== "owner");

/** "Ada, Bob and 3 more": the first `most` names, and how many are left out. */
export function listNames(names: readonly string[], most = 5): string {
  const more = names.length - most;
  return more > 0 ? `${names.slice(0, most).join(", ")} and ${more} more` : names.join(", ");
}
