import { ForexBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const forexDaylight: BoardTemplate<"FOREX"> = {
  key: "forex/daylight",
  version: 1,
  type: "FOREX",
  name: "Daylight",
  description: "Light lavender background with purple type.",
  maxRows: 4,
  theme: "daylight",
  render: (snapshot) => (
    <ForexBoard
      snapshot={snapshot}
      theme={boardTheme("daylight", snapshot.content.brand)}
    />
  ),
};
