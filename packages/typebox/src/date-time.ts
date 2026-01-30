import Type from "typebox";

export class TDateTime extends Type.Base<globalThis.Date> {
	public override Convert(value: unknown): unknown {
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			value instanceof globalThis.Date
		) {
			const date = new globalThis.Date(value);
			if (Number.isNaN(date.getTime())) {
				return value;
			}
			return date;
		}
		return value;
	}

	public override Check(value: unknown): value is globalThis.Date {
		return value instanceof globalThis.Date;
	}

	public override Errors(value: unknown): object[] {
		return this.Check(value) ? [] : [{ message: "must be Date" }];
	}

	public override Clone(): TDateTime {
		return new TDateTime();
	}

	public override Create(): globalThis.Date {
		return new globalThis.Date(0);
	}
}

export function DateTime(): TDateTime {
	return new TDateTime();
}
