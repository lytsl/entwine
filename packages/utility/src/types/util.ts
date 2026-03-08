export type MergeType<A, B> = Omit<A, keyof B> & B;

export type RequiredUndefined<T> = {
	[P in keyof Required<T>]: Required<T>[P] | undefined;
};

export type Nullable<T> = { [K in keyof T]: T[K] | null };

export type AsNonEmptyArray<T extends any[]> = T extends (infer U)[]
	? [U, ...U[]]
	: never;
