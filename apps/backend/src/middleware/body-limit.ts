import { errorResponse } from "@entwine/sync-engine";
import { bodyLimit } from "hono/body-limit";

/** Refuses a request body over `maxSize` bytes, in the shape of the API's other errors. */
export const maxBody = (maxSize: number) =>
  bodyLimit({ maxSize, onError: () => errorResponse(413, "invalid", "The request is too large") });
