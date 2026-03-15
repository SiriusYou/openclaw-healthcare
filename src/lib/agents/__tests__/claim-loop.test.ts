import { describe, it, expect, beforeEach, vi } from "vitest"
import { db } from "../../db/index"
import { runs, tasks } from "../../db/schema"
import { eq } from "drizzle-orm"
import {
  truncateAll,
  createTestTask,
  createTestRun,
  createMockAdapter,
  waitForRunStatus,
} from "./test-helpers"
import { claimLoop } from "../claim-loop"
import type { AgentAdapter, AgentResult } from "../types"

vi.mock("../worktree", () => ({
  createWorktree: vi.fn(() => "/mock/worktree"),
  getCurrentBranch: vi.fn(() => "master"),
  getBranchHeadSha: vi.fn(() => "abc123"),
  getWorktreeHeadSha: vi.fn(() => "def456"),
  removeWorktree: vi.fn(),
}))

describe("claimLoop", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await truncateAll(db)
  })

  it("happy path: pending run → succeeded → task awaiting_review", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 1 })

    const adapter = createMockAdapter({
      waitResult: { exitCode: 0, finishedAt: new Date(), finishReason: "completed" },
    })

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, run.id, ["succeeded"], 3000)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("succeeded")
    expect(updatedRun?.finishReason).toBe("completed")
    expect(updatedRun?.exitCode).toBe(0)

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("awaiting_review")

    killSpy.mockRestore()
  })

  it("no pending runs: returns early with no changes", async () => {
    const task = await createTestTask(db, { status: "in_progress" })
    await createTestRun(db, task.id, { status: "running" })

    await claimLoop(db, () => createMockAdapter(), "test-worker")

    const allRuns = await db.select().from(runs)
    expect(allRuns).toHaveLength(1)
    expect(allRuns[0].status).toBe("running")
  })

  it("stale process blocks: living PID fails run with stale_process_blocked", async () => {
    // process.kill(pid, 0) NOT throwing means process is alive
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true)

    const task = await createTestTask(db, { status: "queued" })
    await createTestRun(db, task.id, {
      status: "failed",
      agentPid: 12345,
      attempt: 1,
    })
    const newRun = await createTestRun(db, task.id, {
      status: "pending",
      attempt: 2,
    })

    await claimLoop(db, () => createMockAdapter(), "test-worker")

    // Wait a tick for the stale check to complete
    await new Promise((r) => setTimeout(r, 200))

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, newRun.id) })
    expect(updatedRun?.status).toBe("failed")
    expect(updatedRun?.finishReason).toBe("stale_process_blocked")

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("failed")

    killSpy.mockRestore()
  })

  it("stale process dead (ESRCH): proceeds normally", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    await createTestRun(db, task.id, {
      status: "failed",
      agentPid: 12345,
      attempt: 1,
    })
    const newRun = await createTestRun(db, task.id, {
      status: "pending",
      attempt: 2,
    })

    const adapter = createMockAdapter({
      waitResult: { exitCode: 0, finishedAt: new Date(), finishReason: "completed" },
    })

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, newRun.id, ["succeeded"], 3000)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, newRun.id) })
    expect(updatedRun?.status).toBe("succeeded")

    killSpy.mockRestore()
  })

  it("adapter.start() throws (retries exhausted, attempt=3): run failed, task failed", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 3 })

    const adapter = createMockAdapter({ startThrows: true })

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, run.id, ["failed"], 3000)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("failed")
    expect(updatedRun?.finishReason).toBe("failed")

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("failed")

    killSpy.mockRestore()
  })

  it("adapter.start() throws (retries remaining, attempt=1): run failed, task stays in_progress", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 1 })

    const adapter = createMockAdapter({ startThrows: true })

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, run.id, ["failed"], 3000)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("failed")

    // Task transitions to in_progress during claim but start() failure doesn't
    // escalate to task failure when retries remain (attempt < MAX_AUTO_RETRIES + 1)
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("in_progress")

    killSpy.mockRestore()
  })

  it("handle.wait() throws (retries exhausted, attempt=3): run failed, task failed", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 3 })

    const adapter = createMockAdapter({ waitThrows: true })

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, run.id, ["failed"], 3000)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("failed")

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("failed")

    killSpy.mockRestore()
  })

  it("handle.wait() throws (retries remaining, attempt=1): run failed, task stays in_progress", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 1 })

    const adapter = createMockAdapter({ waitThrows: true })

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, run.id, ["failed"], 3000)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("failed")

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("in_progress")

    killSpy.mockRestore()
  })

  it("auto-retry on failure: attempt=1 with exitCode=1 creates new pending run", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 1 })

    const adapter = createMockAdapter({
      waitResult: { exitCode: 1, finishedAt: new Date(), finishReason: "failed" },
    })

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, run.id, ["failed"], 3000)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("failed")
    expect(updatedRun?.finishReason).toBe("failed")

    // Task should be re-queued for retry
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("queued")

    // A new pending run should exist with attempt=2
    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns).toHaveLength(2)
    const retryRun = allRuns.find((r) => r.id !== run.id)
    expect(retryRun?.status).toBe("pending")
    expect(retryRun?.attempt).toBe(2)

    killSpy.mockRestore()
  })

  it("auto-retry guard: cancelled task blocks retry insertion", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 1 })

    // Custom adapter that cancels the task during wait(), simulating a concurrent cancel
    const adapter: AgentAdapter = {
      kind: "fake",
      usesTmux: false,
      start() {
        return {
          pid: 99999,
          stdout: (async function* () {})(),
          stderr: (async function* () {})(),
          async wait(): Promise<AgentResult> {
            // Cancel the task while the agent is "running" — before runAgent
            // reaches the auto-retry guard
            await db
              .update(tasks)
              .set({ status: "cancelled", updatedAt: new Date() })
              .where(eq(tasks.id, task.id))
            return { exitCode: 1, finishedAt: new Date(), finishReason: "failed" }
          },
          kill() {},
        }
      },
    }

    await claimLoop(db, () => adapter, "test-worker")
    await waitForRunStatus(db, run.id, ["failed"], 3000)

    // Task should remain cancelled (retry guard prevented transition to queued)
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("cancelled")

    // No new pending run should exist — only the original
    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns).toHaveLength(1)

    killSpy.mockRestore()
  })

  it("atomic cancel guard: run cancelled during execution prevents result write", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    })

    const task = await createTestTask(db, { status: "queued" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 1 })

    // Custom adapter that cancels the RUN during wait(), simulating cancel-loop
    const adapter: AgentAdapter = {
      kind: "fake",
      usesTmux: false,
      start() {
        return {
          pid: 99999,
          stdout: (async function* () {})(),
          stderr: (async function* () {})(),
          async wait(): Promise<AgentResult> {
            // Simulate cancel-loop moving run to cancelled while agent is executing
            await db
              .update(runs)
              .set({ status: "cancelled", finishedAt: new Date() })
              .where(eq(runs.id, run.id))
            return { exitCode: 0, finishedAt: new Date(), finishReason: "completed" }
          },
          kill() {},
        }
      },
    }

    await claimLoop(db, () => adapter, "test-worker")

    // Wait for runAgent to attempt the result write
    await new Promise((r) => setTimeout(r, 500))

    // Run should stay cancelled — the atomic guard WHERE status='running' rejected the update
    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("cancelled")

    killSpy.mockRestore()
  })

  it("claim allowlist: pending run on cancelled task is not claimed", async () => {
    const task = await createTestTask(db, { status: "cancelled" })
    const run = await createTestRun(db, task.id, { status: "pending", attempt: 1 })

    await claimLoop(db, () => createMockAdapter(), "test-worker")

    // Run should remain pending — the JOIN WHERE t.status='queued' prevented claiming
    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("pending")

    // Task should remain cancelled
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("cancelled")
  })
})
