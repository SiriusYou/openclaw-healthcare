import { test, expect } from "@playwright/test"

const navRoutes = [
  { label: "Overview", route: "/dashboard", title: "Welcome back" },
  { label: "Patients", route: "/dashboard/patients", title: "Patient Management" },
  { label: "Heart Rate", route: "/dashboard/heart-rate", title: "Heart Rate" },
  { label: "Activity", route: "/dashboard/activity", title: "Activity" },
  { label: "Sleep", route: "/dashboard/sleep", title: "Sleep" },
  { label: "Weight", route: "/dashboard/weight", title: "Weight" },
  { label: "Settings", route: "/dashboard/settings", title: "Settings" },
]

for (const { label, route, title } of navRoutes) {
  test(`clicking "${label}" navigates to ${route}`, async ({ page }) => {
    await page.goto("/dashboard")
    await page.getByRole("link", { name: label }).first().click()
    await expect(page).toHaveURL(new RegExp(`.*${route.replace("/", "\\/")}`))
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
