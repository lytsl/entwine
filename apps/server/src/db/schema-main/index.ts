// import * as authSchema from "./auth";
// const { relations, ...auth } = authSchema;
// export { auth };

import auth from "./auth";

const mainSchema = {
	...auth,
};
export default mainSchema;
