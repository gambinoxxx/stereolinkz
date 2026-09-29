import { describe, expect, it } from "vitest";

import { bankInput, resolveShortName } from "@/features/banks/schema";

function nameError(name: string) {
  const result = bankInput.safeParse({ name, shortName: "", active: true });
  return result.success
    ? null
    : result.error.issues.find((i) => i.path[0] === "name")?.message;
}

describe("bankInput", () => {
  it("accepts a valid bank and trims it", () => {
    const result = bankInput.parse({
      name: "  Wema Bank ",
      shortName: " Wema ",
      active: false,
    });
    expect(result).toEqual({
      name: "Wema Bank",
      shortName: "Wema",
      active: false,
    });
  });

  it("rejects an empty name", () => {
    expect(nameError("")).toBe("Enter the bank’s name.");
    expect(nameError("   ")).toBe("Enter the bank’s name.");
  });

  it("rejects a name over 60 characters", () => {
    expect(nameError("A".repeat(61))).toBe(
      "Keep the bank name to 60 characters or fewer.",
    );
    expect(nameError("A".repeat(60))).toBeNull();
  });

  it("rejects a name that is only 'Bank PLC'", () => {
    expect(nameError("Bank PLC")).toBe("Enter a bank name, not just “Bank”.");
  });

  it("rejects a short name over 14 characters", () => {
    const result = bankInput.safeParse({
      name: "Wema Bank",
      shortName: "A".repeat(15),
      active: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["shortName"]);
  });
});

describe("resolveShortName", () => {
  it("keeps a given short name", () => {
    expect(
      resolveShortName({ name: "Wema Bank", shortName: "WEMA", active: true }),
    ).toBe("WEMA");
  });

  it("defaults to the first word, cut to 14 characters", () => {
    expect(
      resolveShortName({ name: "Wema Bank", shortName: "", active: true }),
    ).toBe("Wema");
    expect(
      resolveShortName({
        name: "Supercalifragilistic Bank",
        shortName: "",
        active: true,
      }),
    ).toBe("Supercalifragi");
  });
});
