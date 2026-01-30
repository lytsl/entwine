import { type TSchema, Type } from "typebox";
import {
	Clean,
	Clone,
	Convert,
	DecodeUnsafe,
	Default,
	Pipeline,
	Value,
} from "typebox/value";

const DecoderUnsafe = Pipeline([
	// (_context, _type, value) => Clone(value),
	(context, type, value) => Default(context, type, value),
	(context, type, value) => Convert(context, type, value),
	(context, type, value) => Clean(context, type, value),
	// (context, type, value) => {
	// 	Assert(context, type, value);
	// 	return value;
	// },
	(context, type, value) => DecodeUnsafe(context, type, value), // <--- Decode Last
]);

export type PipeFunction = (value: unknown) => unknown;
export type TypeSchema<T> = TSchema & { type: T };
export class TPipe<T> extends Type.Base<T> {
	constructor(private rules: [...(TSchema | PipeFunction)[], TypeSchema<T>]) {
		super();
	}

	public override Check(value: unknown): value is T {
		let currentValue = Clone(value);
		for (const [index, rule] of this.rules.entries()) {
			if (typeof rule === "function") {
				currentValue = rule(currentValue);
			} else {
				if (!Value.Check(rule, currentValue)) return false;
				if (index < this.rules.length - 1)
					currentValue = DecoderUnsafe(rule, currentValue);
			}
		}
		return true;
	}

	public override Errors(value: unknown): object[] {
		let currentValue = Clone(value);
		for (const [index, rule] of this.rules.entries()) {
			if (typeof rule === "function") {
				currentValue = rule(currentValue);
			} else {
				if (!Value.Check(rule, currentValue))
					return Value.Errors(rule, currentValue);
				if (index < this.rules.length - 1)
					currentValue = DecoderUnsafe(rule, currentValue);
			}
		}
		return [];
	}

	public override Clone(): TPipe<T> {
		return new TPipe<T>(this.rules);
	}
}

export function Pipe<T>(
	options: [...(TSchema | PipeFunction)[], TypeSchema<T>],
) {
	return new TPipe(options);
}

// Example use
// const Schema = Pipe([
// 	Type.Decode(Type.Any(), (v) =>
// 		v instanceof Date ? new Date(v).toISOString() : v,
// 	),
// 	Type.String({ format: "date-time" }),
// ]);

// const Schema = Pipe([
// 	Type.Codec(Type.Any()).Decode((v)=>v instanceof Date ? new Date(v).toISOString() : v).Encode((v)=>new Date(v)),
// 	Type.String({ format: "date-time" }),
// ]);

// const Schema = Pipe([
// 	(v: unknown) => (v instanceof Date ? new Date(v).toISOString() : v),
// 	Type.String({ format: "date-time" }),
// ]);
