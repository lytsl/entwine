export type MergeType<A, B> = Omit<A, keyof B> & B;

export type RequiredUndefined<T> = {
	[P in keyof Required<T>]: Required<T>[P] | undefined;
};

export type Nullable<T> = { [K in keyof T]: T[K] | null };

export type AsNonEmptyArray<T extends any[]> = T extends (infer U)[]
	? [U, ...U[]]
	: never;

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type WithOptional<T, K extends keyof T> = Omit<T, K> &
	Partial<Pick<T, K>>;

export type NonNullableFields<T> = {
	[P in keyof T]-?: NonNullable<T[P]>;
};

// expands object types one level deep
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// expands object types recursively
export type ExpandRecursively<T> = T extends object
	? T extends infer O
		? { [K in keyof O]: ExpandRecursively<O[K]> }
		: never
	: T;
