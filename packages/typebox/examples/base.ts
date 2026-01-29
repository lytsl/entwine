// https://github.com/sinclairzx81/typebox/issues/343#issuecomment-1674520555

/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: example use */
/** biome-ignore-all lint/correctness/noUnusedVariables: example use */

import { type StaticDecode, type TObject, Type } from "typebox";
import { Value } from "typebox/value";

// -------------------------------------------------------------------
// Database: Vendor Id (Mongo)
// -------------------------------------------------------------------

export class ObjectId {
	constructor(private readonly _id: string) {}
	toHexString() {
		return this._id;
	}
}

export class TObjectId extends Type.Base<ObjectId> {
	public override Check(value: unknown): value is ObjectId {
		return value instanceof ObjectId;
	}
	public override Errors(value: unknown): object[] {
		return !this.Check(value) ? [{ message: "not an ObjectId" }] : [];
	}
	public override Clone(): TObjectId {
		return new TObjectId();
	}
}

export function ObjectID(): TObjectId {
	return new TObjectId();
}

// -------------------------------------------------------------------
// Database: Types
// -------------------------------------------------------------------
const DatabaseId = Type.Codec(ObjectID())
	.Decode((value) => value.toHexString())
	.Encode((value) => new ObjectId(value));

const DatabaseDate = Type.Codec(Type.Number())
	.Decode((value) => new Date(value))
	.Encode((value) => value.getTime());

const DatabaseType = Type.Object({
	_id: DatabaseId,
	created: DatabaseDate,
	updated: DatabaseDate,
});
// -------------------------------------------------------------------
// Application: Type Factory
// -------------------------------------------------------------------
const CreateType = <T extends TObject>(schema: T) =>
	Type.Evaluate(Type.Intersect([DatabaseType, schema]));

// -------------------------------------------------------------------
// Application: Types
// -------------------------------------------------------------------
const Customer = CreateType(
	Type.Object({
		name: Type.String(),
		email: Type.String(),
	}),
);
// -------------------------------------------------------------------
// Database: Encode & Decode
// -------------------------------------------------------------------
const decoded = Value.Decode(Customer, {
	// const decoded = {
	_id: new ObjectId("000000000000000000000000"), //   id: '000000000000000000000000',
	created: 0, //   created: 1970-01-01T00:00:00.000Z,
	updated: 0, //   updated: 1970-01-01T00:00:00.000Z,
	name: "user", //   name: 'user',
	email: "user@domain.com", //   email: 'user@domain.com'
}); // }

// encoded - the encoded database record (write)
const encoded = Value.Encode(Customer, decoded); // const encoded = {
console.log(encoded); //  _id: ObjectId { _id: '000000000000000000000000' },
//  created: 0,
//  updated: 0,
//  name: 'user',
//  email: 'user@domain.com'
// }

// -------------------------------------------------------------------
// MongoCollection<Customer>
// -------------------------------------------------------------------
namespace customers {
	export async function find(
		query: unknown,
	): Promise<StaticDecode<typeof Customer>[]> {
		/* todo */ return [];
	}
	export async function insert(value: StaticDecode<typeof Customer>) {
		/* todo */
	}
	export async function update(
		id: StaticDecode<typeof DatabaseId>,
		value: Partial<StaticDecode<typeof Customer>>,
	) {
		/* todo */
	}
	export async function remove(value: StaticDecode<typeof DatabaseId>) {
		/* todo */
	}
}
customers.insert({
	_id: "000000000000000000000000",
	created: new Date(0),
	updated: new Date(0),
	name: "user",
	email: "user@domain.com",
});
customers.update("000000000000000000000000", {
	email: "dave@domain.com",
});
customers.remove("000000000000000000000000");

const results = customers.find(`where email like '@domain.com'`);
