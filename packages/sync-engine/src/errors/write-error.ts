export class WriteError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
  }
}
export const fail = (message: string): never => {
  throw new WriteError("invalid", message);
};
