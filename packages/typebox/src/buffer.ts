import Type from "typebox";

export class TBuffer extends Type.Base<globalThis.Buffer> {
	public override Convert(value: unknown): unknown {
		if (typeof value === "string") {
			const buffer = globalThis.Buffer.from(value);
			return buffer;
		}
		return value;
	}

	public override Check(value: unknown): value is globalThis.Buffer {
		return (
			value instanceof globalThis.Buffer && globalThis.Buffer.isBuffer(value)
		);
	}

	public override Errors(value: unknown): object[] {
		return this.Check(value) ? [] : [{ message: "must be Buffer" }];
	}

	public override Clone(): TBuffer {
		return new TBuffer();
	}

	public override Create(): globalThis.Buffer {
		return globalThis.Buffer.from([0]);
	}
}

export function Buffer(): TBuffer {
	return new TBuffer();
}
