import { PofBoard } from "@/features/templates/layout";
import { boardTheme } from "@/features/templates/theme";
import type { BoardTemplate } from "@/features/templates/types";

export const pofDaylight: BoardTemplate<"POF"> = {
  key: "pof/daylight",
  version: 2, // 2: the website in the small print (boards with one)
  type: "POF",
  name: "Daylight",
  description: "Light lavender background with purple type.",
  maxRows: 6,
  theme: "daylight",
  render: (snapshot) => (
    <PofBoard
      snapshot={snapshot}
      theme={boardTheme("daylight", snapshot.content.brand)}
    />
  ),
};
