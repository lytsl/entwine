import { env } from "@entwine/env/web";
import { hcQuery } from "@entwine/hono-react-query";
import type { AppType } from "@entwine/server";
import { hc } from "hono/client";

const client = hc<AppType>(env.VITE_SERVER_URL, {
	init: {
		credentials: "include",
	},
});
export const api = hcQuery(client);
