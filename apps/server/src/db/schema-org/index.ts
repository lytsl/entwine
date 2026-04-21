import issueSchema from "./issue";
import syncSchema from "./sync";
import { relations as authRelations } from "./issue";
import { config as issueConfig } from "./issue";

export const orgSchema = { ...syncSchema, ...issueSchema };

export const orgRelations = {
	...authRelations,
};

export const orgModelConfigs = { ...issueConfig };
export const orgSyncModels = [
	"Issue",
] satisfies (keyof typeof orgModelConfigs)[];
export type TOrgSyncModel = (typeof orgSyncModels)[number];
