import { test, expect } from "@playwright/test"

const navRoutes = [
  { route: "/dashboard", title: "Welcome back" },
  { route: "/dashboard/patients", title: "Patient Management" },
  { route: "/dashboard/heart-rate", title: "Heart Rate" },
  { route: "/dashboard/activity", title: "Activity" },
  { route: "/dashboard/sleep", title: "Sleep" },
  { route: "/dashboard/weight", title: "Weight" },
  { route: "/dashboard/settings", title: "Settings" },
]

for (const { route, title } of navRoutes) {
  test(`navigation to ${route} shows "${title}"`, async ({ page }) => {
    await page.goto(route)
    await expect(page.getByText(title).first()).toBeVisible()
  })
}

test("all 7 sidebar nav links are present", async ({ page }) => {
  await page.goto("/dashboard")

  const navLabels = ["Overview", "Patients", "Heart Rate", "Activity", "Sleep", "Weight", "Settings"]
  for (const label of navLabels) {
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible()
  }
})
