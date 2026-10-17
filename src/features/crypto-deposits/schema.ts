// The sell-crypto form (deal-crypto.html), shared by the form (client) and
// submitCryptoDeal (server). The client sends no rate or naira: the server
// quotes again from the latest Crypto board.
import { z } from "zod";

import {
  amountString,
  customerInput,
  NAME_MAX,
  payoutInput,
} from "@/features/deals/schema";

export const submitCryptoDealInput = z.object({
  ticker: z.string().regex(/^[A-Z0-9]{2,6}$/),
  network: z.enum(["TRC20", "BEP20"]),
  qty: amountString,
  payout: payoutInput.extend({
    accountName: z
      .string()
      .trim()
      .min(2, "Enter the name on the account.")
      .max(NAME_MAX),
  }),
  customer: customerInput,
  consent: z.literal(true, { error: "Please agree to continue." }),
  website: z.string().max(200),
  formToken: z.string().max(200),
});
export type SubmitCryptoDealInput = z.input<typeof submitCryptoDealInput>;
