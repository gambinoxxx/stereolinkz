import { describe, expect, it } from "vitest";

import { dropOrder, isSameIdSet, moveItem } from "@/features/currencies/order";

describe("moveItem", () => {
  it("moves up and down", () => {
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("clamps at the ends and ignores a missing index", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 5)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 3, 0)).toEqual(["a", "b"]);
  });
});

describe("dropOrder", () => {
  const ids = ["a", "b", "c", "d"];

  it("drops before or after the target", () => {
    expect(dropOrder(ids, "d", "a", "before")).toEqual(["d", "a", "b", "c"]);
    expect(dropOrder(ids, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
    expect(dropOrder(ids, "b", "d", "after")).toEqual(["a", "c", "d", "b"]);
  });

  it("leaves the order alone for a drop on itself or an unknown id", () => {
    expect(dropOrder(ids, "b", "b", "before")).toEqual(ids);
    expect(dropOrder(ids, "x", "a", "before")).toEqual(ids);
  });
});

describe("isSameIdSet", () => {
  const existing = ["a", "b", "c"];

  it("accepts the same ids in any order", () => {
    expect(isSameIdSet(["c", "a", "b"], existing)).toBe(true);
  });

  it("rejects missing, extra, foreign and duplicate ids", () => {
    expect(isSameIdSet(["a", "b"], existing)).toBe(false);
    expect(isSameIdSet(["a", "b", "c", "d"], existing)).toBe(false);
    expect(isSameIdSet(["a", "b", "x"], existing)).toBe(false);
    expect(isSameIdSet(["a", "a", "b"], existing)).toBe(false);
  });
});
