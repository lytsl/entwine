import issueSchema, {
	relations as authRelations,
	config as issueConfig,
} from "./issue";
import metadataSchema from "./metadata";

const orgSchema = { ...metadataSchema, ...issueSchema };
export default orgSchema;

export const orgRelations = {
	...authRelations,
};

export const orgModelConfigs = { ...issueConfig };
export const orgSyncModels = [
	"Issue",
] satisfies (keyof typeof orgModelConfigs)[];
export type TOrgSyncModel = (typeof orgSyncModels)[number];
