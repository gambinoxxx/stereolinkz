import { describe, expect, it } from "vitest";

import { bankSlug } from "@/features/banks/slug";

describe("bankSlug", () => {
  it("gives spacing variants the same slug", () => {
    expect(bankSlug("Eco Bank")).toBe("eco");
    expect(bankSlug("Ecobank")).toBe("eco");
    expect(bankSlug("Acme Bank Plc")).toBe(bankSlug("Acme"));
    expect(bankSlug("First-City Ltd.")).toBe("firstcity");
  });

  it("gives an empty slug for a name made only of removed words", () => {
    expect(bankSlug("Bank PLC")).toBe("");
  });
});
