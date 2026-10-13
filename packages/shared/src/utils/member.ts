/** Owners and admins manage the workspace: its members, and rows other members created. */
export const isAdmin = (role: string | null | undefined): boolean => role === "owner" || role === "admin";
