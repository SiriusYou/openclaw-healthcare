import { test, expect } from "@playwright/test"

test("login page renders with form", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
})

test("login page shows agent swarm branding", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByText("OpenClaw Agent Swarm")).toBeVisible()
})
