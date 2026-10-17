import { describe, expect, it } from "vitest";

import { nameCheck } from "@/features/crypto-deposits/names";

describe("nameCheck", () => {
  it("matches the same names in any order and case", () => {
    expect(nameCheck("Chinedu Okeke", "OKEKE CHINEDU")).toBe("MATCH");
    expect(nameCheck("Chinedu Okeke", "Okeke Chinedu John")).toBe("MATCH");
    expect(nameCheck("Adé Obi", "ADE OBI")).toBe("MATCH");
    expect(nameCheck("Ngozi", "ngozi")).toBe("MATCH");
  });

  it("is close when only some names agree", () => {
    expect(nameCheck("Chinedu Okeke", "Okeke Emeka")).toBe("CLOSE");
    expect(nameCheck("Chinedu Okeke", "Chinedu")).toBe("CLOSE");
  });

  it("is different when no name agrees", () => {
    expect(nameCheck("Chinedu Okeke", "Bopstore Enterprises")).toBe(
      "DIFFERENT",
    );
    expect(nameCheck("Chinedu Okeke", "")).toBe("DIFFERENT");
  });
});
