import { describe, expect, it } from "vitest";

import {
  getTemplate,
  listTemplates,
  resolveTemplateKey,
  UnknownTemplateError,
} from "@/features/templates/registry";

describe("template registry", () => {
  it("finds templates by key and throws a typed error for unknown keys", () => {
    expect(getTemplate("forex/daylight").name).toBe("Daylight");
    expect(() => getTemplate("forex/nope")).toThrow(UnknownTemplateError);
  });

  it("lists templates per type with their limits", () => {
    expect(
      listTemplates("FOREX").map((t) => [t.key, t.maxRows, t.version]),
    ).toEqual([
      ["forex/purple-signal", 4, 1],
      ["forex/daylight", 4, 1],
    ]);
    expect(listTemplates("POF").map((t) => [t.key, t.maxRows])).toEqual([
      ["pof/purple-signal", 6],
      ["pof/daylight", 6],
    ]);
    expect(listTemplates("CRYPTO").map((t) => [t.key, t.maxRows])).toEqual([
      ["crypto/purple-signal", 6],
      ["crypto/daylight", 6],
    ]);
  });

  it("resolves the org default, falling back to the first of the type", () => {
    const org = {
      defaultForexTemplateKey: "forex/daylight",
      defaultPofTemplateKey: null,
      defaultCryptoTemplateKey: "crypto/daylight",
    };
    expect(resolveTemplateKey("FOREX", org)).toBe("forex/daylight");
    expect(resolveTemplateKey("POF", org)).toBe("pof/purple-signal");
    expect(resolveTemplateKey("CRYPTO", org)).toBe("crypto/daylight");
    // Unregistered, or the wrong type: fall back.
    expect(
      resolveTemplateKey("FOREX", {
        defaultForexTemplateKey: "forex/gone",
        defaultPofTemplateKey: null,
        defaultCryptoTemplateKey: null,
      }),
    ).toBe("forex/purple-signal");
    expect(
      resolveTemplateKey("POF", {
        defaultForexTemplateKey: null,
        defaultPofTemplateKey: "forex/daylight",
        defaultCryptoTemplateKey: null,
      }),
    ).toBe("pof/purple-signal");
  });
});
