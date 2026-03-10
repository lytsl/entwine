import { hcQuery } from "@entwine/hono-react-query";
import type { AppType } from "@entwine/server";
import { hc, type InferRequestType, type InferResponseType } from "hono/client";
import { WebSocketClient } from "@/lib/sync/ws-client";
import { env } from "../../env";

export const honoClient = hc<AppType>(env.VITE_SERVER_URL, {
	init: {
		credentials: "include",
	},
	buildSearchParams: (query) => {
		return new URLSearchParams(JSON.stringify(query));
	},
});

export const apiQuery = hcQuery(honoClient);

const wsClient = honoClient.ws.$ws(0);
export const wsSyncClient = new WebSocketClient({ ws: wsClient });

export type SyncableModels = keyof typeof honoClient.sync;
export type SyncableModelType<modelName extends SyncableModels> =
	InferResponseType<(typeof honoClient.sync)[modelName]["$get"]>[number];
export type SyncableModelCreate<modelName extends SyncableModels> =
	InferRequestType<(typeof honoClient.sync)[modelName]["$post"]>["json"];
export type SyncableModelUpdate<modelName extends SyncableModels> =
	InferRequestType<(typeof honoClient.sync)[modelName]["$patch"]>["json"];

// let s: z.ZodType<SyncableModelCreate<"issue">> = z
//   .object({
//     id: z.string().optional(),
//     title: z.string(),
//     description: z.string(),
//     rank: z.string(),
//   })
//   .array();
