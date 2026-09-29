import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Pure-logic tests only (code-standards.md → Testing). Test files sit next
// to the code they test: src/lib/format.test.ts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
