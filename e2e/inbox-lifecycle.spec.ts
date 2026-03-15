import { test, expect } from "@playwright/test"

/**
 * Selects a task row (rounded-md border p-3) by title text.
 * Uses the p-3 class to distinguish task rows from Card containers.
 */
function taskRow(page: import("@playwright/test").Page, title: string) {
  return page.locator("div.rounded-md.border.p-3", { hasText: title })
}

test("task lifecycle: create → complete → approve → merge", async ({ page }) => {
  const taskTitle = `E2E lifecycle ${Date.now()}`

  // 1. Navigate to inbox
  await page.goto("/dashboard/inbox")
  await expect(page.getByTestId("inbox-root")).toBeVisible()

  // 2. Create task with Queue & Run
  await page.getByTestId("create-task-btn").click()
  await page.getByLabel("Title").fill(taskTitle)
  await page.getByLabel("Description").fill("E2E lifecycle test task")
  await page.getByTestId("queue-and-run-btn").click()

  // 3. Wait for task to appear with 'queued' status
  const inboxRow = taskRow(page, taskTitle)
  await expect(inboxRow).toBeVisible({ timeout: 5_000 })
  await expect(inboxRow.getByText("queued")).toBeVisible({ timeout: 5_000 })

  // 4. Wait for worker to claim and complete (fake adapter ~3s + claim poll ~5s)
  await expect(inboxRow.getByText("awaiting_review")).toBeVisible({ timeout: 30_000 })

  // 5. Navigate to reviews page
  await page.getByRole("link", { name: "Reviews" }).first().click()
  await expect(page.getByTestId("reviews-root")).toBeVisible()

  // 6. Scope to the row containing our task title
  const reviewRow = taskRow(page, taskTitle)
  await expect(reviewRow).toBeVisible({ timeout: 5_000 })

  // 7. Navigate to run detail page via the run link
  const runLink = reviewRow.locator("a").first()
  await runLink.click()
  await expect(page.getByTestId("run-detail-root")).toBeVisible({ timeout: 5_000 })

  // 8. Verify run detail page shows Commits card and View Diff button
  await expect(page.getByText("Commits")).toBeVisible()
  await expect(page.getByRole("button", { name: "View Diff" })).toBeVisible()

  // 9. Go back to reviews page for approve/merge flow
  await page.goBack()
  await expect(page.getByTestId("reviews-root")).toBeVisible()

  // 10. Approve the task — scoped to the row with our task title
  const approveRow = taskRow(page, taskTitle)
  await approveRow.getByRole("button", { name: "Approve" }).click()

  // 11. Verify task moves to pr_ready section
  const mergeRow = taskRow(page, taskTitle)
  await expect(mergeRow.getByText("pr_ready")).toBeVisible({ timeout: 5_000 })

  // 12. Merge — scoped to our task's row
  await mergeRow.getByRole("button", { name: "Merge" }).click()
  await expect(mergeRow.getByText("Merging...")).toBeVisible({ timeout: 5_000 })

  // 13. After merge completes, task disappears from reviews page.
  // Navigate to inbox where completed/merged tasks are shown.
  await page.getByRole("link", { name: "Inbox" }).first().click()
  await expect(page.getByTestId("inbox-root")).toBeVisible()

  // 14. Verify task appears in Completed section with 'merged' or 'cleaned' badge.
  // cleanup-loop can promote merged→cleaned within ~30s, so accept either.
  const mergedRow = taskRow(page, taskTitle)
  await expect(
    mergedRow.getByText(/^(merged|cleaned)$/)
  ).toBeVisible({ timeout: 30_000 })
})
