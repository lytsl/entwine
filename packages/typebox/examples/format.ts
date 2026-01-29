import { Type } from "typebox";
import Format from "typebox/format";

Format.Set("numeric", (value: string) => /^-?\d+(\.\d+)?$/.test(value));

const _NumberToString = Type.Codec(Type.String({ format: "numeric" }))
	.Decode((value) => Number.parseFloat(value))
	.Encode((value) => value.toString());
