import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: process.env.CI ? "bun run start" : "bun run build && bun run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
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
