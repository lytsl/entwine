import { hcQuery } from "@entwine/hono-react-query";
import type { AppType } from "@entwine/server";
import { hc } from "hono/client";
import { env } from "../../env";

const honoClient = hc<AppType>(env.VITE_SERVER_URL, {
	init: {
		credentials: "include",
	},
	buildSearchParams: (query) => {
		return new URLSearchParams(JSON.stringify(query));
	},
});

export const wsClient = honoClient.ws.$ws(0);
export const apiQuery = hcQuery(honoClient);
