import { relations as authRelations } from "./auth";
import { relations as syncRelations } from "./sync";

export default {
  ...authRelations,
  ...syncRelations,
};
