import { hcQuery } from "@entwine/hono-react-query";
import type { AppType } from "@entwine/server";
import { hc } from "hono/client";
import { env } from "../../env";

const client = hc<AppType>(env.VITE_SERVER_URL, {
	init: {
		credentials: "include",
	},
});
export const api = hcQuery(client);
