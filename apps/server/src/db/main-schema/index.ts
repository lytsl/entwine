// import * as authSchema from "./auth";
// const { relations, ...auth } = authSchema;
// export { auth };

import auth from "./auth";
import issue from "./issue";
import sync from "./sync";
import tasks from "./tasks";
import todo from "./todo";

export default {
  ...auth,
  ...issue,
  ...sync,
  ...tasks,
  ...todo,
};
