import issue from "./issue";
import sync from "./sync";

const orgSchema = {
	...issue,
	...sync,
};
export default orgSchema;
