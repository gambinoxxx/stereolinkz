import { CryptoBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const cryptoPurpleSignal: BoardTemplate<"CRYPTO"> = {
  key: "crypto/purple-signal",
  version: 1,
  type: "CRYPTO",
  name: "Purple Signal",
  description: "Deep purple, gold sell prices. Built for WhatsApp Status.",
  maxRows: 6,
  theme: "purple-signal",
  render: (snapshot) => (
    <CryptoBoard
      snapshot={snapshot}
      theme={boardTheme("purple-signal", snapshot.content.brand)}
    />
  ),
};
