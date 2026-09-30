import type { RecordStatus } from "@/generated/prisma/enums";

// A bank's POF rate shows on new boards only when the bank is ACTIVE and
// its pofActive switch is on. The POF filter's Active means exactly that;
// Inactive is everything else.
export function isPofShown(bank: {
  status: RecordStatus;
  pofActive: boolean;
}): boolean {
  return bank.status === "ACTIVE" && bank.pofActive;
}
