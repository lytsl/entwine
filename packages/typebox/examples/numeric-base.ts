import { type TNumberOptions, Type } from "typebox";
import { Value } from "typebox/value";

export class TNumeric extends Type.Base<number | string> {
	constructor(private options: TNumberOptions = {}) {
		super();
	}

	public override Check(value: unknown): value is number | string {
		if (typeof value !== "number" && typeof value !== "string") return false;
		const resolved = typeof value === "string" ? Number(value) : value;
		if (Number.isNaN(resolved)) return false;
		return Value.Check(Type.Number(this.options), resolved);
	}

	public override Errors(value: unknown): {
		message: string;
	}[] {
		const resolved = typeof value === "string" ? Number(value) : value;
		if (Number.isNaN(resolved)) {
			return [{ message: "Expected numeric value" }];
		}
		return Value.Errors(Type.Number(this.options), resolved);
	}

	public override Clone(): TNumeric {
		return new TNumeric(this.options);
	}
}

export function Numeric(options: TNumberOptions = {}) {
	return Type.Codec(new TNumeric(options))
		.Decode((value) => (typeof value === "string" ? Number(value) : value))
		.Encode((value) => value);
}

const Schema = Type.Object({
	age: Numeric({ minimum: 18 }),
});

console.log(Value.Check(Schema, { age: 25 })); // true
console.log(Value.Check(Schema, { age: "25" })); // { age: 25 } (Converted)

console.log(Value.Errors(Schema, { age: "12" })); // false

console.log(Value.Check(Schema, { age: 12 })); // false
