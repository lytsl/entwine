// https://github.com/sinclairzx81/typebox/issues/597#issuecomment-1720785280

/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: example use */
/** biome-ignore-all lint/correctness/noUnusedVariables: example use */

import { Type } from "typebox";
import { Value } from "typebox/value";

export class ObjectId {
	constructor(private readonly _id: string) {}
	toString() {
		return this._id;
	}
}

// ---------------------------------------------------------------------------------------
// MongoId
//
// The following is a transform type that wraps a string and implements decode and encode
// functions that allow a string to be converted into a objectId. The inner string contains
// a pattern which is used to assert the correct identifier format before decode.
// ---------------------------------------------------------------------------------------
export const MongoId = Type.Codec(Type.String({ pattern: "^[0-9a-fA-F]{24}$" }))
	.Decode((value) => new ObjectId(value))
	.Encode((value) => value.toString());

// ---------------------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------------------

// Creates a mongo objectid string
const id = new ObjectId("_id").toString();

// Transform types check against the string representation (not the ObjectId representation)
const A = Value.Check(MongoId, id);

// You can call Value.Decode to decode a string value into a ObjectId
const B = Value.Decode(MongoId, id);

// ... And call Value.Encode to encode the ObjectId back into a string
const C = Value.Encode(MongoId, B);

console.log(A, B, C);

// ---------------------------------------------------------------------------------------
// StaticDecode & StaticEncode
//
// When using transform types, without decoding or encoding (as above), you may wish to
// substitute Static<T> usage for StaticDecode<T> and StaticEncode<T> to obtain the
// encoded and decoded types (depending on usage)
// ---------------------------------------------------------------------------------------

import type { StaticDecode, StaticEncode } from "typebox";

// Use StaticDecode instead of Static to infer decoded transform type
type T = StaticDecode<typeof MongoId>; // ObjectId

// Use StaticEncode instead of Static to infer encoded transform type
type U = StaticEncode<typeof MongoId>; // string
