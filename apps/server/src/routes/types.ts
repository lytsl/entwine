import type { Nullable } from "@entwine/utility/types";
import type { Server } from "bun";
import type { BunWebSocketData } from "hono/bun";
import type { BetterAuthSession } from "@/auth/better-auth";

export type THonoBaseEnv = {
	Variables: Nullable<BetterAuthSession>;
	Bindings: { server: Server<BunWebSocketData> };
};
export type THonoPrivateEnv = {
	Variables: BetterAuthSession;
	Bindings: { server: Server<BunWebSocketData> };
};
