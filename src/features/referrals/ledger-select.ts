// The only reward fields the ledger reads (Phase 13c): the reward's own
// snapshot. Never the referred customer's name, number, email or files;
// ledger-select.test.ts fails if one is added.
export const LEDGER_SELECT = {
  id: true,
  dealRef: true,
  service: true,
  code: true,
  referrerKey: true,
  pct: true,
  profitNaira: true,
  amountNaira: true,
  status: true,
  holdUntil: true,
  notBefore: true,
  flag: true,
  createdAt: true,
  approvedAt: true,
  paidAt: true,
  bankReference: true,
  voidReason: true,
} as const;
