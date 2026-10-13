import { z } from "zod";
import { errorResponse, refusal } from "../errors/error-response";
import { WriteError } from "../errors/write-error";
import {
  MAX_MUTATIONS,
  type Mutation,
  type RowMap,
  type Schema,
  type TransactionRequest,
  type TransactionResponse,
} from "../protocol";
import type { Tenant } from "../storage/tenants";
import type { Writer } from "../storage/writer";

const id = z.string().min(1).max(100);
const transactionSchema = z.union([
  z.object({
    id,
    mutations: z
      .array(
        z.object({
          model: z.string(),
          type: z.enum(["insert", "update", "delete"]),
          key: z.string().min(1),
          value: z.record(z.string(), z.unknown()),
        }),
      )
      .min(1)
      .max(MAX_MUTATIONS, `One change holds at most ${MAX_MUTATIONS} edits`),
  }),
  z.object({ id, revert: id }),
]);

/**
 * A row with an owner is the owner's alone to write: a client inserts one only as its own, and another member's is
 * answered as missing, which does not say that it exists. A row the request does not insert itself must exist
 * already, so a write cannot reach one the app's rules make for someone else later in the transaction.
 */
async function checkOwners(schema: Schema, writer: Writer, mutations: readonly Mutation[], actorId: string) {
  const inserted = new Set<string>();
  for (const { model, type, key, value } of mutations) {
    const owner = schema.models[model].owner;
    if (!owner) continue;
    const at = `${model}\0${key}`;
    if (type === "insert") {
      if (value[owner] !== actorId) throw new WriteError("forbidden", `A ${model} is written by the member it is for`);
      inserted.add(at);
      continue;
    }
    const row = (await writer.get(model, key)) as Record<string, unknown> | null;
    if (row ? row[owner] !== actorId : !inserted.has(at))
      throw new WriteError("not_found", `${model} ${key} was not found`);
  }
}

/** `POST /transactions`. An id the log already holds is answered from it, so a resent transaction is applied once. */
export async function transact<R extends RowMap>(
  tenant: Tenant<R>,
  body: unknown,
  actorId: string,
  apply: (writer: Writer<R>, request: TransactionRequest) => Promise<void>,
): Promise<Response> {
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "invalid", z.prettifyError(parsed.error));
  const request = parsed.data;
  if ("mutations" in request) {
    const unknown = request.mutations.find((m) => !Object.hasOwn(tenant.schema.models, m.model));
    if (unknown) return errorResponse(400, "invalid", `${unknown.model} is not a synced model`);
  }
  try {
    const { cursor } = await tenant.write(
      async (writer) => {
        if ("mutations" in request)
          await checkOwners(tenant.schema as Schema, writer as unknown as Writer, request.mutations, actorId);
        await apply(writer, request);
      },
      { txid: request.id, actorId },
    );
    return Response.json({ cursor } satisfies TransactionResponse);
  } catch (error) {
    return refusal(error);
  }
}
