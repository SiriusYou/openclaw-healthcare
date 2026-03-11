import { defineConfig } from "@playwright/test"
import { config } from "dotenv"

config({ path: ".env.local" })

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "bun run build && bun run start",
    port: 3000,
    reuseExistingServer: false,
    timeout: 180000,
  },
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "unauthenticated",
      use: { storageState: { cookies: [], origins: [] } },
      testMatch: /auth-redirect|login/,
    },
    {
      name: "authenticated",
      dependencies: ["setup"],
      use: { storageState: "e2e/.auth/user.json" },
      testMatch: /dashboard/,
    },
  ],
})
