import Type from "typebox";
import compile from "typebox/compile";
import Value from "typebox/value";

export function Numeric(property?: Type.TNumberOptions) {
	const schema = Type.Number(property);
	const compiler = compile(schema);

	return Type.Codec(
		Type.Union(
			[
				Type.String({
					pattern: /^-?\d+(\.\d+)?$/,
					default: 0,
				}),
				Type.Number(property),
			],
			property,
		),
	)
		.Decode((value) => {
			const number = +value;
			if (Number.isNaN(number)) return value;

			if (property && !compiler.Check(number)) throw compiler.Errors(number)[0];

			return number;
		})
		.Encode((value) => value) as unknown as Type.TNumber;
}

const Schema = Type.Object({
	age: Numeric({ minimum: 18 }),
});

console.log(Value.Check(Schema, { age: 25 })); // true
console.log(Value.Check(Schema, { age: "25" })); // { age: 25 } (Converted)

console.log(Value.Errors(Schema, { age: "12" })); // false

console.log(Value.Errors(Schema, { age: 12 })); // false
