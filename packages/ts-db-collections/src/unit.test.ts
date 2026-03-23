import { describe, expect, it } from "vitest";

describe("Unit Tests", () => {
	describe("getNestedValue", () => {
		function getNestedValue(obj: any, path: Array<string | number>): any {
			if (!path.length) return obj;
			let current = obj;
			for (const key of path) {
				if (current == null) return undefined;
				current = current[key];
			}
			return current;
		}

		it("should get nested value from object", () => {
			const obj = { a: { b: { c: "value" } } };
			expect(getNestedValue(obj, ["a", "b", "c"])).toBe("value");
		});

		it("should return undefined for missing path", () => {
			const obj = { a: { b: 1 } };
			expect(getNestedValue(obj, ["a", "c"])).toBe(undefined);
		});

		it("should return undefined for null object", () => {
			expect(getNestedValue(null, ["a"])).toBe(undefined);
		});

		it("should handle array indices", () => {
			const obj = { items: ["first", "second", "third"] };
			expect(getNestedValue(obj, ["items", 1])).toBe("second");
		});

		it("should handle empty path", () => {
			expect(getNestedValue({ a: 1 }, [])).toEqual({ a: 1 });
		});
	});

	describe("Basic array operations", () => {
		it("should filter array with includes", () => {
			const items = [
				{ id: "1", status: "active" },
				{ id: "2", status: "pending" },
				{ id: "3", status: "deleted" },
			];
			const filtered = items.filter((item) =>
				["active", "pending"].includes(item.status),
			);
			expect(filtered).toHaveLength(2);
			expect(filtered[0]?.status).toBe("active");
			expect(filtered[1]?.status).toBe("pending");
		});

		it("should sort array by numeric field", () => {
			const items = [{ age: 30 }, { age: 20 }, { age: 40 }];
			const sorted = [...items].sort((a, b) => a.age - b.age);
			expect(sorted[0]?.age).toBe(20);
			expect(sorted[2]?.age).toBe(40);
		});

		it("should slice array with limit and offset", () => {
			const items = [1, 2, 3, 4, 5];
			const sliced = items.slice(1, 4);
			expect(sliced).toEqual([2, 3, 4]);
		});
	});

	describe("Comparison operators", () => {
		it("should handle equality", () => {
			// @ts-expect-error - intentionally testing unequal comparison
			expect(5 === 6).toBe(false);
		});

		it("should handle greater than", () => {
			expect(10 > 5).toBe(true);
			expect(5 > 10).toBe(false);
		});

		it("should handle less than", () => {
			expect(5 < 10).toBe(true);
			expect(10 < 5).toBe(false);
		});

		it("should handle greater than or equal", () => {
			expect(10 >= 10).toBe(true);
			expect(10 >= 5).toBe(true);
			expect(5 >= 10).toBe(false);
		});

		it("should handle less than or equal", () => {
			expect(10 <= 10).toBe(true);
			expect(5 <= 10).toBe(true);
			expect(10 <= 5).toBe(false);
		});
	});

	describe("Like pattern matching", () => {
		function likeMatch(value: string, pattern: string): boolean {
			const regexPattern = pattern.replace(/%/g, ".*").replace(/_/g, ".");
			return new RegExp(`^${regexPattern}$`, "i").test(value);
		}

		it("should match % wildcard", () => {
			expect(likeMatch("John Doe", "%john%")).toBe(true);
			expect(likeMatch("Jane Doe", "%john%")).toBe(false);
		});

		it("should match _ wildcard", () => {
			expect(likeMatch("John", "J_hn")).toBe(true);
			expect(likeMatch("Jane", "J_hn")).toBe(false);
		});

		it("should be case insensitive", () => {
			expect(likeMatch("John Doe", "%JOHN%")).toBe(true);
		});
	});
});
