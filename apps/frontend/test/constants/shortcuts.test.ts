import { describe, expect, test } from "bun:test";
import { validateHotkey } from "@tanstack/react-hotkeys";
import { type Binding, SHORTCUTS } from "../../src/constants/shortcuts";

// Matching, sequences, fields and popups are the library's and need a document: tests/e2e covers them.
const bindings = Object.values(SHORTCUTS) as Binding[];
const combinations = bindings.flatMap((b) => b.keys.filter((keys) => typeof keys === "string"));
const sequences = bindings.flatMap((b) => b.keys.filter((keys) => typeof keys !== "string"));

describe("SHORTCUTS", () => {
  test("every key is one the library accepts", () => {
    for (const key of [...combinations, ...sequences.flat()])
      expect({ key, ...validateHotkey(key) }).toEqual({ key, valid: true, warnings: [], errors: [] });
  });

  test("no key is bound twice", () => {
    const keys = [...combinations, ...sequences.map((sequence) => sequence.join(" "))];
    expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
  });

  test("a sequence's first key is not a binding of its own, which would run before the sequence", () => {
    expect(sequences.map((sequence) => sequence[0]).filter((key) => combinations.includes(key))).toEqual([]);
  });
});
