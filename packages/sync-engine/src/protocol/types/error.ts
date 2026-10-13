export type ErrorCode = "invalid" | "forbidden" | "not_found" | "conflict" | "unauthenticated" | "failed";

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
}
