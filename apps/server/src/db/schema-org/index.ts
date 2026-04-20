import issue from "./issue";
import sync from "./sync";

const org = {
	...issue,
	...sync,
};

type TOrg = typeof org;
type TOrgSchema = {
	[K in keyof TOrg]: TOrg[K]["table"];
};
type TOrgModelConfig = {
	[K in keyof TOrg as TOrg[K] extends { config: any }
		? K
		: never]: TOrg[K] extends { config: infer C } ? C : never;
};

export const orgSchema = {} as TOrgSchema;
export const orgModelConfig = {} as TOrgModelConfig;

for (const [key, value] of Object.entries(org)) {
	const k = key as keyof TOrg;

	(orgSchema as any)[k] = value.table;
	if ("config" in value) {
		(orgModelConfig as any)[k] = value.config;
	}
}

export const orgSyncModels = ["Issue"] satisfies (keyof TOrgModelConfig)[];
export type TOrgSyncModel = (typeof orgSyncModels)[number];
