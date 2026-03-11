import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"
import { TEST_DATABASE_URL } from "./src/lib/db/constants"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.*",
        "src/**/*.spec.*",
        "src/lib/agents/runner-worker.ts",
        "src/lib/db/bootstrap-cli.ts",
        "src/lib/db/e2e-prepare.ts",
      ],
      thresholds: {
        lines: 15,
        branches: 15,
        functions: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
