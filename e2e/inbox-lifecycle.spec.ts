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
  await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText("queued")).toBeVisible({ timeout: 5_000 })

  // 4. Wait for worker to claim and complete (fake adapter ~3s + claim poll ~5s)
  await expect(page.getByText("awaiting_review")).toBeVisible({ timeout: 30_000 })

  // 5. Navigate to reviews page
  await page.getByRole("link", { name: "Reviews" }).first().click()
  await expect(page.getByTestId("reviews-root")).toBeVisible()

  // 6. Verify task appears in awaiting_review section
  await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5_000 })

  // 7. Approve the task
  await page.getByRole("button", { name: "Approve" }).click()
  await expect(page.getByText("pr_ready")).toBeVisible({ timeout: 5_000 })

  // 8. Merge the task
  await page.getByRole("button", { name: "Merge" }).click()
  await expect(page.getByText("Merging...")).toBeVisible({ timeout: 5_000 })

  // 9. Wait for merge-loop to complete (polls every 5s)
  await expect(page.getByText("merged")).toBeVisible({ timeout: 30_000 })
})
