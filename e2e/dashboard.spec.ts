import { test, expect } from "@playwright/test"

test("dashboard loads with welcome message", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page.getByTestId("dashboard-root")).toBeVisible()
  await expect(page.getByText(/Welcome back/)).toBeVisible()
})

test("can navigate to inbox from sidebar", async ({ page }) => {
  await page.goto("/dashboard")

  await page.getByRole("link", { name: "Inbox" }).first().click()
  await expect(page).toHaveURL(/.*\/dashboard\/inbox/)
  await expect(page.getByText("Inbox")).toBeVisible()
})

test("can navigate to runs from sidebar", async ({ page }) => {
  await page.goto("/dashboard")

  await page.getByRole("link", { name: "Runs" }).first().click()
  await expect(page).toHaveURL(/.*\/dashboard\/runs/)
  await expect(page.getByText("Runs")).toBeVisible()
})
