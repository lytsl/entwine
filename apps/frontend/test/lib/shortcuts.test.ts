import { describe, expect, test } from "bun:test";
import { keyHint, keyLabels, keysOf, tooltip } from "../../src/lib/shortcuts";

describe("without single keys", () => {
  test("a binding keeps the ways that hold a modifier or a key that types nothing", () => {
    expect(keysOf("newIssue", false)).toEqual([]);
    expect(keysOf("goProjects", false)).toEqual([]);
    expect(keysOf("estimate", false)).toEqual([]);
    expect(keysOf("next", false)).toEqual(["ArrowDown"]);
    expect(keysOf("open", false)).toEqual(["Enter"]);
    expect(keysOf("palette", false)).toEqual(["Mod+K"]);
    expect(keysOf("copyLink", false)).toEqual(["Mod+Shift+,"]);
  });

  test("hints show the way that is left, or none", () => {
    expect(keyHint("next", "windows", false)).toBe("↓");
    expect(tooltip("New issue", "newIssue", true)).toBe("New issue (C)");
    expect(tooltip("New issue", "newIssue", false)).toBe("New issue");
  });
});

describe("key labels", () => {
  test("follow the platform", () => {
    expect(keyLabels("Mod+Shift+,", "mac")).toEqual([["⇧", "⌘", ","]]);
    expect(keyLabels("Mod+Shift+,", "windows")).toEqual([["Ctrl", "Shift", ","]]);
    expect(keyLabels(["G", "P"], "linux")).toEqual([["G"], ["P"]]);
    expect(keyHint("goProjects", "windows")).toBe("G then P");
    expect(keyHint("palette", "mac")).toBe("⌘ K");
    expect(keyHint("palette", "linux")).toBe("Ctrl+K");
    expect(keyHint("delete", "windows")).toBe("Ctrl+⌫");
    expect(keyHint("open", "mac")).toBe("↵");
    expect(keyHint("dismiss", "linux")).toBe("Esc");
  });
});
