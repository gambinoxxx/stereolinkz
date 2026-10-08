import { describe, expect, it } from "vitest";

import { whatsappLink } from "@/features/public/whatsapp";

describe("whatsappLink", () => {
  it("keeps only the digits of the saved number", () => {
    expect(whatsappLink("+234 903 591 4544", "Hi")).toBe(
      "https://wa.me/2349035914544?text=Hi",
    );
  });

  it("encodes the message", () => {
    expect(
      whatsappLink(
        "+2348000000000",
        "Hi Stereolinkz, I want to sell 500 X. Is ₦1,365 still today’s rate?",
      ),
    ).toBe(
      "https://wa.me/2348000000000?text=Hi%20Stereolinkz%2C%20I%20want%20to%20sell%20500%20X.%20Is%20%E2%82%A61%2C365%20still%20today%E2%80%99s%20rate%3F",
    );
  });

  it("still opens WhatsApp when no number is saved", () => {
    expect(whatsappLink(null, "Hi")).toBe("https://wa.me/?text=Hi");
  });
});
