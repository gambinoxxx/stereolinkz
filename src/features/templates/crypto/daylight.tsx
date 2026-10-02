import { CryptoBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const cryptoDaylight: BoardTemplate<"CRYPTO"> = {
  key: "crypto/daylight",
  version: 1,
  type: "CRYPTO",
  name: "Daylight",
  description: "Light lavender background with purple type.",
  maxRows: 6,
  theme: "daylight",
  render: (snapshot) => (
    <CryptoBoard
      snapshot={snapshot}
      theme={boardTheme("daylight", snapshot.content.brand)}
    />
  ),
};
