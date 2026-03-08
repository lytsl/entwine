// import type { AuthType } from "@entwine/server";
import {
	adminClient,
	multiSessionClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "../../env";

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL,
	plugins: [
		// inferAdditionalFields<AuthType>(),
		adminClient(),
		organizationClient({ teams: { enabled: true } }),
		multiSessionClient(),
	],
});
