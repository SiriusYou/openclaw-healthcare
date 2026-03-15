import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { events, runs, tasks } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import {
  truncateAll,
  createTestTask,
  createTestRun,
} from "@/lib/agents/__tests__/test-helpers"
import { POST as createTask, GET as listTasks } from "@/app/api/tasks/route"
import { GET as getTask, PATCH as patchTask } from "@/app/api/tasks/[id]/route"
import { POST as approveTask } from "@/app/api/tasks/[id]/approve/route"
import { POST as rejectTask } from "@/app/api/tasks/[id]/reject/route"
import { POST as mergeTask } from "@/app/api/tasks/[id]/merge/route"
import { POST as createRun } from "@/app/api/runs/route"
import { GET as getDiff } from "@/app/api/runs/[id]/diff/route"

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function postJson(url: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function patchJson(url: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${url}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function getReq(url: string) {
  return new NextRequest(`http://localhost${url}`, { method: "GET" })
}

describe("Task lifecycle API", () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await truncateAll(db)
  })

  it("1. Create task (draft)", async () => {
    const res = await createTask(postJson("/api/tasks", { title: "Test" }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.status).toBe("draft")
    expect(data.title).toBe("Test")
    expect(data.id).toBeDefined()
  })

  it("2. Create task (autoRun) creates task=queued and run=pending", async () => {
    const res = await createTask(
      postJson("/api/tasks", { title: "Test", autoRun: true }),
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.status).toBe("queued")
    expect(data.runId).toBeDefined()

    const allRuns = await db.select().from(runs)
    expect(allRuns).toHaveLength(1)
    expect(allRuns[0].taskId).toBe(data.id)
    expect(allRuns[0].status).toBe("pending")
  })

  it("3. Create run transitions task to queued", async () => {
    const task = await createTestTask(db, { status: "draft" })

    const res = await createRun(
      postJson("/api/runs", { taskId: task.id }),
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.status).toBe("pending")

    const updated = await db.query.tasks.findFirst({
      where: eq(tasks.id, task.id),
    })
    expect(updated!.status).toBe("queued")
  })

  it("4. Duplicate active run returns 409", async () => {
    const task = await createTestTask(db, { status: "queued" })
    await createTestRun(db, task.id, { status: "pending" })

    const res = await createRun(
      postJson("/api/runs", { taskId: task.id }),
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("active run")
  })

  it("5. Approve sets task to pr_ready with approvedRunId and approvedCommitSha", async () => {
    const task = await createTestTask(db, { status: "awaiting_review" })
    const run = await createTestRun(db, task.id, {
      status: "succeeded",
      headCommitSha: "sha-123",
    })

    const res = await approveTask(
      postJson(`/api/tasks/${task.id}/approve`, {}),
      makeParams(task.id),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("pr_ready")
    expect(data.approvedRunId).toBe(run.id)
    expect(data.approvedCommitSha).toBe("sha-123")
  })

  it("6. Approve wrong status returns 409", async () => {
    const task = await createTestTask(db, { status: "draft" })

    const res = await approveTask(
      postJson(`/api/tasks/${task.id}/approve`, {}),
      makeParams(task.id),
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("Cannot approve")
  })

  it("7. Approve requires headCommitSha on succeeded run", async () => {
    const task = await createTestTask(db, { status: "awaiting_review" })
    await createTestRun(db, task.id, {
      status: "succeeded",
      headCommitSha: null,
    })

    const res = await approveTask(
      postJson(`/api/tasks/${task.id}/approve`, {}),
      makeParams(task.id),
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("commit SHA")
  })

  it("8. Reject creates new run and resets task to queued", async () => {
    const task = await createTestTask(db, {
      status: "awaiting_review",
      approvedRunId: "old-run",
      approvedCommitSha: "old-sha",
    })
    await createTestRun(db, task.id, {
      status: "succeeded",
      attempt: 1,
    })

    const res = await rejectTask(
      postJson(`/api/tasks/${task.id}/reject`, { reason: "needs work" }),
      makeParams(task.id),
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.newRunId).toBeDefined()
    expect(data.attempt).toBe(2)

    const updated = await db.query.tasks.findFirst({
      where: eq(tasks.id, task.id),
    })
    expect(updated!.status).toBe("queued")
    expect(updated!.approvedRunId).toBeNull()
    expect(updated!.approvedCommitSha).toBeNull()
  })

  it("9. Cancel marks active runs cancelled, terminal runs cleanup_pending, clears merge fields", async () => {
    const task = await createTestTask(db, {
      status: "in_progress",
      mergeRequested: true,
      approvedRunId: "some-run",
      approvedCommitSha: "some-sha",
    })
    const activeRun = await createTestRun(db, task.id, {
      status: "running",
      agentPid: 123,
    })
    const terminalRun = await createTestRun(db, task.id, {
      status: "succeeded",
      attempt: 2,
    })

    const res = await patchTask(
      patchJson(`/api/tasks/${task.id}`, { status: "cancelled" }),
      makeParams(task.id),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("cancelled")

    const updatedActive = await db.query.runs.findFirst({
      where: eq(runs.id, activeRun.id),
    })
    expect(updatedActive!.status).toBe("cancelled")

    const updatedTerminal = await db.query.runs.findFirst({
      where: eq(runs.id, terminalRun.id),
    })
    expect(updatedTerminal!.status).toBe("cleanup_pending")

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, task.id),
    })
    expect(updatedTask!.mergeRequested).toBe(false)
    expect(updatedTask!.approvedRunId).toBeNull()
    expect(updatedTask!.approvedCommitSha).toBeNull()
  })

  it("10. lastMergeError only returned for pr_ready tasks", async () => {
    const task = await createTestTask(db, { status: "pr_ready" })

    // Insert a merge_result event (INSERT is allowed by append-only triggers)
    await db.insert(events).values({
      eventId: nanoid(),
      taskId: task.id,
      type: "merge_result",
      payload: JSON.stringify({ message: "conflict in main" }),
    })

    // GET task detail — should include lastMergeError
    const res1 = await getTask(
      getReq(`/api/tasks/${task.id}`),
      makeParams(task.id),
    )
    const data1 = await res1.json()
    expect(res1.status).toBe(200)
    expect(data1.lastMergeError).toBe("conflict in main")

    // Change task status to failed
    await db
      .update(tasks)
      .set({ status: "failed" })
      .where(eq(tasks.id, task.id))

    // GET again — lastMergeError should be null
    const res2 = await getTask(
      getReq(`/api/tasks/${task.id}`),
      makeParams(task.id),
    )
    const data2 = await res2.json()
    expect(data2.lastMergeError).toBeNull()
  })

  it("11. Merge wrong status returns 409", async () => {
    const task = await createTestTask(db, { status: "awaiting_review" })

    const res = await mergeTask(
      postJson(`/api/tasks/${task.id}/merge`, {}),
      makeParams(task.id),
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("Cannot merge")
  })

  it("12. Merge requires approvedCommitSha", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      approvedCommitSha: null,
    })

    const res = await mergeTask(
      postJson(`/api/tasks/${task.id}/merge`, {}),
      makeParams(task.id),
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("approved")
  })

  it("13. Merge duplicate returns 409", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      approvedCommitSha: "sha",
      mergeRequested: true,
    })

    const res = await mergeTask(
      postJson(`/api/tasks/${task.id}/merge`, {}),
      makeParams(task.id),
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("already")
  })

  it("14. Diff endpoint returns 404 for unknown run", async () => {
    const res = await getDiff(
      getReq("/api/runs/nonexistent/diff"),
      makeParams("nonexistent"),
    )
    expect(res.status).toBe(404)
  })

  it("15. Diff endpoint returns 400 when run has no commit data", async () => {
    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "succeeded",
      baseCommitSha: null,
      headCommitSha: null,
    })

    const res = await getDiff(
      getReq(`/api/runs/${run.id}/diff`),
      makeParams(run.id),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("commit data")
  })

  it("16. Reject stores reason in event and lastRejectReason is projected", async () => {
    const task = await createTestTask(db, { status: "awaiting_review" })
    await createTestRun(db, task.id, { status: "succeeded", attempt: 1 })

    await rejectTask(
      postJson(`/api/tasks/${task.id}/reject`, { reason: "needs more tests" }),
      makeParams(task.id),
    )

    // GET task should include lastRejectReason (task is now queued)
    const res = await getTask(
      getReq(`/api/tasks/${task.id}`),
      makeParams(task.id),
    )
    const data = await res.json()
    expect(data.lastRejectReason).toBe("needs more tests")
  })

  it("17. lastRejectReason projected in task list", async () => {
    const task = await createTestTask(db, { status: "awaiting_review" })
    await createTestRun(db, task.id, { status: "succeeded", attempt: 1 })

    await rejectTask(
      postJson(`/api/tasks/${task.id}/reject`, { reason: "missing edge case" }),
      makeParams(task.id),
    )

    // List tasks should include lastRejectReason
    const res = await listTasks(getReq("/api/tasks"))
    const data = await res.json()
    const found = data.find((t: { id: string }) => t.id === task.id)
    expect(found).toBeDefined()
    expect(found.lastRejectReason).toBe("missing edge case")
  })

  it("18. Diff endpoint success path returns stat and diff", async () => {
    // Use two real commits from the repo for a valid diff
    const { execFileSync } = await import("node:child_process")
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).trim()
    const parent = execFileSync("git", ["rev-parse", "HEAD~1"], { encoding: "utf-8" }).trim()

    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "succeeded",
      baseCommitSha: parent,
      headCommitSha: head,
    })

    const res = await getDiff(
      getReq(`/api/runs/${run.id}/diff`),
      makeParams(run.id),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.baseCommitSha).toBe(parent)
    expect(data.headCommitSha).toBe(head)
    expect(typeof data.stat).toBe("string")
    expect(typeof data.diff).toBe("string")
  })
})
