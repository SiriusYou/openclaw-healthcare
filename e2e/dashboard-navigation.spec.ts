import { test, expect } from "@playwright/test"

const navRoutes = [
  { label: "Overview", route: "/dashboard", title: "Welcome back" },
  { label: "Inbox", route: "/dashboard/inbox", title: "Inbox" },
  { label: "Runs", route: "/dashboard/runs", title: "Runs" },
  { label: "Reviews", route: "/dashboard/reviews", title: "Reviews" },
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

test("all 5 sidebar nav links are present", async ({ page }) => {
  await page.goto("/dashboard")

  const navLabels = ["Overview", "Inbox", "Runs", "Reviews", "Settings"]
  for (const label of navLabels) {
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible()
  }
})
