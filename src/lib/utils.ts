import { createCn } from "cn/config";

// Class merging that knows our named radius steps (globals.css → @theme),
// so cn("rounded-lg", "rounded-control") keeps only the last one.
// components/ui/* import cn from "cn" directly; they don't mix radius names.
export const cn = createCn({
  extend: { theme: { radius: ["control", "panel", "modal", "sheet"] } },
});
