export * from "typebox";
export * from "./typebox";

// import { type Union } from "typebox";
import { Type as TypeboxType } from "typebox";
import * as Typebox from "./typebox";

export const Type = {
	...TypeboxType,
	...Typebox,
};

// export default Type;
