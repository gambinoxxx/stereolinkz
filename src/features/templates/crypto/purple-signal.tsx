import { CryptoBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const cryptoPurpleSignal: BoardTemplate<"CRYPTO"> = {
  key: "crypto/purple-signal",
  version: 2, // 2: the website in the small print (boards with one)
  type: "CRYPTO",
  name: "Purple Signal",
  description: "Deep purple with coin badges and network tags.",
  maxRows: 6,
  theme: "purple-signal",
  render: (snapshot) => (
    <CryptoBoard
      snapshot={snapshot}
      theme={boardTheme("purple-signal", snapshot.content.brand)}
    />
  ),
};
