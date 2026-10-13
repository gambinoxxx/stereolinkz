import { describe, expect, it } from "vitest";

import {
  amountString,
  dealDetailsV1,
  normalizeCustomerWhatsapp,
  submitDealInput,
} from "@/features/deals/schema";

const fees = {
  service: "SCHOOL_FEES",
  country: "United Kingdom",
  schoolName: "A school",
  studentName: "A student",
  studentId: "",
  purpose: "TUITION",
  invoiceRequired: true,
};
const base = {
  details: fees,
  currency: "AAA",
  amount: "4,500",
  customer: { name: "Ada Obi", whatsapp: "0803 123 4567", email: "" },
  consent: true,
  website: "",
  formToken: "t",
};

describe("dealDetailsV1", () => {
  it("accepts each Phase 12 service", () => {
    for (const details of [
      fees,
      {
        service: "INTL_PAYMENT",
        purpose: "SUPPLIER",
        country: "China",
        receiveMethod: "WIRE",
        note: "Invoice 2291",
      },
      {
        service: "POF",
        bankId: "b1",
        months: 3,
        neededBy: "2026-10-30",
        purpose: "STUDY_VISA",
        destinationCountry: "Canada",
      },
      { service: "FOREX_SELL", method: "TRANSFER" },
      { service: "FOREX_BUY", method: "TRANSFER" },
    ])
      expect(dealDetailsV1.safeParse(details).success, details.service).toBe(
        true,
      );
  });

  it("drops empty optional text", () => {
    const parsed = dealDetailsV1.parse(fees);
    expect(parsed).not.toHaveProperty("studentId", "");
    expect(
      parsed.service === "SCHOOL_FEES" && parsed.studentId,
    ).toBeUndefined();
  });

  it("enforces lengths and ranges", () => {
    expect(
      dealDetailsV1.safeParse({ ...fees, schoolName: "x".repeat(121) }).success,
    ).toBe(false);
    expect(dealDetailsV1.safeParse({ ...fees, studentName: " " }).success).toBe(
      false,
    );
    expect(
      dealDetailsV1.safeParse({ ...fees, purpose: "HOLIDAY" }).success,
    ).toBe(false);
    const pof = {
      service: "POF",
      bankId: "b1",
      months: 3,
      neededBy: "2026-10-30",
      purpose: "STUDY_VISA",
      destinationCountry: "Canada",
    };
    expect(dealDetailsV1.safeParse({ ...pof, months: 0 }).success).toBe(false);
    expect(dealDetailsV1.safeParse({ ...pof, months: 13 }).success).toBe(false);
    expect(dealDetailsV1.safeParse({ ...pof, months: 2.5 }).success).toBe(
      false,
    );
    expect(
      dealDetailsV1.safeParse({ ...pof, neededBy: "30/10/2026" }).success,
    ).toBe(false);
    expect(
      dealDetailsV1.safeParse({
        service: "INTL_PAYMENT",
        purpose: "OTHER",
        country: "China",
        receiveMethod: "WIRE",
        note: "x".repeat(501),
      }).success,
    ).toBe(false);
    expect(
      dealDetailsV1.safeParse({ service: "FOREX_SELL", method: "CASH" })
        .success,
    ).toBe(false);
  });

  it("has no crypto variant in Phase 12", () => {
    expect(dealDetailsV1.safeParse({ service: "CRYPTO_SELL" }).success).toBe(
      false,
    );
  });
});

describe("amountString", () => {
  it("accepts what people type and returns a plain decimal", () => {
    expect(amountString.parse("4,500")).toBe("4500");
    expect(amountString.parse(" 1 200.50 ")).toBe("1200.50");
  });
  it("rejects zero, negatives, too many decimals and nonsense", () => {
    for (const v of ["0", "-5", "1.234", "abc", "", "1e5", "1000000001"])
      expect(amountString.safeParse(v).success, v).toBe(false);
  });
});

describe("normalizeCustomerWhatsapp", () => {
  it("accepts local, + and bare 234 forms", () => {
    for (const v of [
      "0803 123 4567",
      "+2348031234567",
      "2348031234567",
      "+234 803 123 4567",
    ])
      expect(normalizeCustomerWhatsapp(v), v).toBe("+234 803 123 4567");
    expect(normalizeCustomerWhatsapp("12")).toBeNull();
  });
});

describe("submitDealInput", () => {
  it("parses a school fees request", () => {
    const parsed = submitDealInput.parse(base);
    expect(parsed.amount).toBe("4500");
    expect(parsed.customer).toEqual({
      name: "Ada Obi",
      whatsapp: "+234 803 123 4567",
      email: undefined,
    });
  });

  it("requires consent", () => {
    expect(submitDealInput.safeParse({ ...base, consent: false }).success).toBe(
      false,
    );
  });

  it("checks the email when one is given", () => {
    expect(
      submitDealInput.safeParse({
        ...base,
        customer: { ...base.customer, email: "not-an-email" },
      }).success,
    ).toBe(false);
    expect(
      submitDealInput.parse({
        ...base,
        customer: { ...base.customer, email: "Ada@Example.com" },
      }).customer.email,
    ).toBe("ada@example.com");
  });

  it("requires a payout account to sell forex", () => {
    const sell = {
      ...base,
      details: { service: "FOREX_SELL", method: "TRANSFER" },
    };
    expect(submitDealInput.safeParse(sell).success).toBe(false);
    expect(
      submitDealInput.safeParse({
        ...sell,
        payout: { bank: "A bank", accountNumber: "0123 456 789" },
      }).success,
    ).toBe(true);
    expect(
      submitDealInput.safeParse({
        ...sell,
        payout: { bank: "A bank", accountNumber: "12345" },
      }).success,
    ).toBe(false);
  });

  it("keeps POF in naira", () => {
    const pof = {
      ...base,
      details: {
        service: "POF",
        bankId: "b1",
        months: 3,
        neededBy: "2026-10-30",
        purpose: "STUDY_VISA",
        destinationCountry: "Canada",
      },
    };
    expect(submitDealInput.safeParse({ ...pof, currency: "NGN" }).success).toBe(
      true,
    );
    expect(submitDealInput.safeParse(pof).success).toBe(false);
  });
});
