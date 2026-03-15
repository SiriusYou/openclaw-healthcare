import { test as setup, expect } from "@playwright/test"
import fs from "node:fs"

const email = process.env.OPERATOR_EMAIL ?? "admin@example.com"
const password = process.env.OPERATOR_PASSWORD ?? "change-me"

setup("authenticate", async ({ page }) => {
  fs.mkdirSync("e2e/.auth", { recursive: true })
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL("**/dashboard")
  await expect(page).toHaveURL(/.*\/dashboard/)
  await expect(page.getByTestId("dashboard-root")).toBeVisible()
  await page.context().storageState({ path: "e2e/.auth/user.json" })
})
