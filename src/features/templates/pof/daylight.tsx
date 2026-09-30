import { PofBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const pofDaylight: BoardTemplate<"POF"> = {
  key: "pof/daylight",
  version: 1,
  type: "POF",
  name: "Daylight",
  description: "Light lavender background with purple type.",
  maxRows: 6,
  render: (snapshot) => (
    <PofBoard
      snapshot={snapshot}
      theme={boardTheme("daylight", snapshot.content.brand)}
    />
  ),
};
