import { ForexBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const forexPurpleSignal: BoardTemplate<"FOREX"> = {
  key: "forex/purple-signal",
  version: 1,
  type: "FOREX",
  name: "Purple Signal",
  description: "Deep purple, gold sell prices. Built for WhatsApp Status.",
  maxRows: 4,
  theme: "purple-signal",
  render: (snapshot) => (
    <ForexBoard
      snapshot={snapshot}
      theme={boardTheme("purple-signal", snapshot.content.brand)}
    />
  ),
};
