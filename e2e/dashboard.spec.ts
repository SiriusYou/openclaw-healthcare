import { test, expect } from "@playwright/test"

test("dashboard loads with stats and charts", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page.getByTestId("dashboard-root")).toBeVisible()
  await expect(page.getByText("Steps Today")).toBeVisible()
  await expect(page.getByText("Heart Rate Trend")).toBeVisible()

  // Below-fold content: scroll into view before asserting
  await page.getByText("Weight Trend").scrollIntoViewIfNeeded()
  await expect(page.getByText("Weight Trend")).toBeVisible()
  await page.getByText("Blood Pressure Trend").scrollIntoViewIfNeeded()
  await expect(page.getByText("Blood Pressure Trend")).toBeVisible()
  await page.getByText("Health Assistant", { exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByText("Health Assistant", { exact: true })).toBeVisible()
})

test("dashboard shows welcome message", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page.getByText(/Welcome back/)).toBeVisible()
})

test("can navigate to patients from sidebar", async ({ page }) => {
  await page.goto("/dashboard")

  await page.getByRole("link", { name: "Patients" }).first().click()
  await expect(page).toHaveURL(/.*\/dashboard\/patients/)
  await expect(page.getByText("Patient Management")).toBeVisible()
})
