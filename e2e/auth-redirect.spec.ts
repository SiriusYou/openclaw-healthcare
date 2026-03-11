import { test, expect } from "@playwright/test"

test("unauthenticated visit to / redirects to /login", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/.*\/login/)
})

const protectedRoutes = [
  "/dashboard",
  "/dashboard/inbox",
  "/dashboard/runs",
  "/dashboard/reviews",
  "/dashboard/settings",
]

for (const route of protectedRoutes) {
  test(`unauthenticated visit to ${route} redirects to /login`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/.*\/login/)
  })
}
