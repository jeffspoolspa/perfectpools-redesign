// Vitest config. Two environments — jsdom for component tests, node for
// pure logic. The default is jsdom; tests that only need node can opt out
// with /* @vitest-environment node */ at the top of the file.

import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Colocated test convention: *.test.ts and *.test.tsx next to the
    // module under test. Adjust if you want to move tests under __tests__/.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
