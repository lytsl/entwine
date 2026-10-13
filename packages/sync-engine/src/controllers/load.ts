import { errorResponse, refusal } from "../errors/error-response";
import type { Query } from "../protocol";
import type { Tenant } from "../storage/tenants";

/** `POST /load`, for the member `reader`: of a model whose rows have an owner, only their own are read. */
export async function load(tenant: Tenant, body: unknown, reader: string): Promise<Response> {
  const queries = (body as { queries?: unknown } | null)?.queries;
  if (!Array.isArray(queries)) return errorResponse(400, "invalid", "Send { queries: [...] }");
  try {
    return Response.json(await tenant.load(queries as Query[], reader));
  } catch (error) {
    return refusal(error);
  }
}
