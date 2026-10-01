import { describe, expect, it } from "vitest";

import { contrastRatio, contrastWarning } from "@/features/settings/contrast";
import {
  normalizeHexColour,
  normalizeWhatsAppNumber,
  orgSettingsInput,
} from "@/features/settings/schema";

const valid = {
  name: " Stereolinkz ",
  contactLine: "+234 800 000 0000",
  email: "",
  backgroundColor: "#2a0f58",
  primaryColor: "#6A35D9",
  accentColor: "#e9b949",
  timezone: "Africa/Lagos",
  defaultFinePrint: " Rates can change without notice. ",
};

const errorOf = (patch: Partial<typeof valid>) => {
  const parsed = orgSettingsInput.safeParse({ ...valid, ...patch });
  return parsed.success ? null : parsed.error.issues[0]?.message;
};

describe("normalizeWhatsAppNumber", () => {
  it("accepts the usual Nigerian formats and stores them grouped", () => {
    for (const raw of [
      "+234 803 123 4567",
      "+2348031234567",
      "08031234567",
      "0803-123-4567",
      " 0803 123 4567 ",
      "002348031234567",
    ])
      expect(normalizeWhatsAppNumber(raw)).toBe("+234 803 123 4567");
  });

  it("keeps other countries as + and digits", () => {
    expect(normalizeWhatsAppNumber("+44 7700 900123")).toBe("+447700900123");
  });

  it("refuses what can't be a number", () => {
    for (const raw of [
      "",
      "803",
      "+12345",
      "+1234567890123456",
      "080-CALL-NOW",
      "234 803 123 4567",
    ])
      expect(normalizeWhatsAppNumber(raw)).toBeNull();
  });
});

describe("normalizeHexColour", () => {
  it("uppercases and expands #RGB", () => {
    expect(normalizeHexColour(" #6a35d9 ")).toBe("#6A35D9");
    expect(normalizeHexColour("#abc")).toBe("#AABBCC");
  });
  it("refuses anything else", () => {
    for (const raw of ["6A35D9", "#6A35D", "#GGGGGG", "purple", "#6A35D9FF"])
      expect(normalizeHexColour(raw)).toBeNull();
  });
});

describe("orgSettingsInput", () => {
  it("normalises a valid form", () => {
    expect(orgSettingsInput.parse(valid)).toEqual({
      name: "Stereolinkz",
      contactLine: "+234 800 000 0000",
      email: null,
      backgroundColor: "#2A0F58",
      primaryColor: "#6A35D9",
      accentColor: "#E9B949",
      timezone: "Africa/Lagos",
      defaultFinePrint: "Rates can change without notice.",
    });
  });

  it("checks the name length", () => {
    expect(errorOf({ name: " A " })).toBe(
      "Enter a company name of at least 2 characters.",
    );
    expect(errorOf({ name: "x".repeat(41) })).toBe(
      "Keep the company name to 40 characters or fewer.",
    );
  });

  it("checks the WhatsApp number", () => {
    expect(errorOf({ contactLine: "12345" })).toBe(
      "Enter a WhatsApp number like +234 803 123 4567.",
    );
    expect(
      orgSettingsInput.parse({ ...valid, contactLine: "08031234567" })
        .contactLine,
    ).toBe("+234 803 123 4567");
  });

  it("accepts an empty or valid email", () => {
    expect(
      orgSettingsInput.parse({ ...valid, email: " Rates@Stereolinkz.com " })
        .email,
    ).toBe("rates@stereolinkz.com");
    expect(errorOf({ email: "rates@" })).toBe(
      "Enter a valid email address, or leave it empty.",
    );
  });

  it("checks colours", () => {
    expect(errorOf({ accentColor: "gold" })).toBe(
      "Enter a colour like #6A35D9.",
    );
    expect(
      orgSettingsInput.parse({ ...valid, primaryColor: "#fff" }).primaryColor,
    ).toBe("#FFFFFF");
  });

  it("checks the time zone against the IANA list", () => {
    expect(
      orgSettingsInput.parse({ ...valid, timezone: "Europe/London" }).timezone,
    ).toBe("Europe/London");
    expect(errorOf({ timezone: "Lagos" })).toBe(
      "Pick a time zone from the list.",
    );
  });

  it("limits the small print; empty means each type's own default", () => {
    expect(
      orgSettingsInput.parse({ ...valid, defaultFinePrint: "  " })
        .defaultFinePrint,
    ).toBeNull();
    expect(errorOf({ defaultFinePrint: "x".repeat(121) })).toBe(
      "Keep the small print to 120 characters or fewer.",
    );
  });
});

describe("contrast", () => {
  it("matches WCAG for black and white, and is symmetric", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#6A35D9", "#6A35D9")).toBe(1);
  });

  it("warns below 4.5:1 only", () => {
    expect(contrastWarning("#6A35D9", "#FFFFFF")).toBeNull(); // the default buy colour
    expect(contrastWarning("#E9B949", "#1F0B3F")).toBeNull(); // the default sell colour
    expect(contrastWarning("#E9B949", "#FFFFFF")).toBe(
      "Hard to read: contrast is 1.8:1. Aim for 4.5:1 or more.",
    );
  });
});
