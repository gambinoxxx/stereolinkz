import { PofBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const pofPurpleSignal: BoardTemplate<"POF"> = {
  key: "pof/purple-signal",
  version: 1,
  type: "POF",
  name: "Purple Signal",
  description: "Deep purple, gold notes. Built for WhatsApp Status.",
  maxRows: 6,
  theme: "purple-signal",
  render: (snapshot) => (
    <PofBoard
      snapshot={snapshot}
      theme={boardTheme("purple-signal", snapshot.content.brand)}
    />
  ),
};
