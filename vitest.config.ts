import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // run tests from all packages
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
    globals: false,
  },
})
