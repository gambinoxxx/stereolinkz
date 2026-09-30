import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Pure logic and the render smoke test (code-standards.md → Testing). Test files sit next
// to the code they test: src/lib/format.test.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server modules (the renderer) are tested directly.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
