import { test, expect } from "@playwright/test"

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
  const taskRow = page.locator("div.border", { hasText: taskTitle })
  await expect(taskRow).toBeVisible({ timeout: 5_000 })
  await expect(taskRow.getByText("queued")).toBeVisible({ timeout: 5_000 })

  // 4. Wait for worker to claim and complete (fake adapter ~3s + claim poll ~5s)
  await expect(taskRow.getByText("awaiting_review")).toBeVisible({ timeout: 30_000 })

  // 5. Navigate to reviews page — find the run link for this task
  await page.getByRole("link", { name: "Reviews" }).first().click()
  await expect(page.getByTestId("reviews-root")).toBeVisible()

  // 6. Scope to the row containing our task title
  const reviewRow = page.locator("div.border", { hasText: taskTitle })
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
  const approveRow = page.locator("div.border", { hasText: taskTitle })
  await approveRow.getByRole("button", { name: "Approve" }).click()

  // 11. Verify task moves to pr_ready section — find the merge row
  const mergeRow = page.locator("div.border", { hasText: taskTitle })
  await expect(mergeRow.getByText("pr_ready")).toBeVisible({ timeout: 5_000 })

  // 12. Merge — scoped to our task's row
  await mergeRow.getByRole("button", { name: "Merge" }).click()
  await expect(mergeRow.getByText("Merging...")).toBeVisible({ timeout: 5_000 })

  // 13. Wait for merge-loop to complete (polls every 5s)
  await expect(page.getByText("merged")).toBeVisible({ timeout: 30_000 })
})
