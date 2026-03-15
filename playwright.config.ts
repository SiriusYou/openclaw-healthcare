import { defineConfig } from "@playwright/test"
import { config } from "dotenv"
import { E2E_DATABASE_URL } from "./src/lib/db/constants"

config({ path: ".env.local" })

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "bun run e2e:prepare && bun run start:all",
    port: 3000,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  },
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "worker-setup",
      testMatch: /worker\.setup\.ts/,
    },
    {
      name: "auth-setup",
      dependencies: ["worker-setup"],
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "unauthenticated",
      dependencies: ["worker-setup"],
      use: { storageState: { cookies: [], origins: [] } },
      testMatch: /auth-redirect|login/,
    },
    {
      name: "authenticated",
      dependencies: ["auth-setup"],
      use: { storageState: "e2e/.auth/user.json" },
      testMatch: /dashboard|runs|inbox|reviews/,
    },
  ],
})
