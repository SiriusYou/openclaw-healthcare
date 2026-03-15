import { describe, it, expect, beforeEach, vi } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "../../db/index"
import { runs, tasks, events } from "../../db/schema"
import { truncateAll, createTestTask, createTestRun } from "./test-helpers"

const { mockExecFileSync, mockExistsSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(() => ""),
  mockExistsSync: vi.fn(() => false),
}))

vi.mock("node:child_process", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actual = require("child_process")
  const entries = Object.fromEntries(Object.keys(actual).map((k) => [k, actual[k]]))
  entries.execFileSync = mockExecFileSync
  return {
    __esModule: true,
    ...entries,
    default: entries,
    execFileSync: mockExecFileSync,
  }
})

vi.mock("node:fs", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actual = require("fs")
  const entries = Object.fromEntries(Object.keys(actual).map((k) => [k, actual[k]]))
  entries.existsSync = mockExistsSync
  return {
    __esModule: true,
    ...entries,
    default: entries,
    existsSync: mockExistsSync,
  }
})

import { mergeLoop } from "../merge-loop"

describe("mergeLoop", () => {
  beforeEach(async () => {
    await truncateAll(db)
    mockExecFileSync.mockReset()
    mockExistsSync.mockReset()

    // Default: no stale worktree
    mockExistsSync.mockReturnValue(false)

    // Default: execFileSync returns sensible values based on args
    mockExecFileSync.mockImplementation(((_cmd: string, args: string[]) => {
      if (args.includes("rev-parse") && args.includes("HEAD")) {
        return "merge-sha-123\n"
      }
      if (args.includes("symbolic-ref") && args.includes("--short")) {
        return "master\n"
      }
      if (args.includes("status") && args.includes("--porcelain")) {
        return "\n"
      }
      return ""
    }) as typeof mockExecFileSync)
  })

  it("happy path: merges approved commit and marks task merged", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      mergeRequested: true,
      approvedCommitSha: "sha-123",
    })
    await createTestRun(db, task.id, {
      status: "succeeded",
      baseBranch: "master",
    })

    await mergeLoop(db)

    // Task should be merged with mergeRequested cleared
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("merged")
    expect(updatedTask!.mergeRequested).toBe(false)

    // Run should be cleanup_pending
    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns).toHaveLength(1)
    expect(allRuns[0].status).toBe("cleanup_pending")

    // merge_result success event should exist
    const allEvents = await db.select().from(events).where(eq(events.taskId, task.id))
    const mergeEvent = allEvents.find((e) => e.type === "merge_result")
    expect(mergeEvent).toBeDefined()
    const payload = JSON.parse(mergeEvent!.payload!)
    expect(payload.message).toContain("Successfully merged")
    expect(payload.mergeCommitSha).toBe("merge-sha-123")
  })

  it("merge conflict: writes error event and clears mergeRequested", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      mergeRequested: true,
      approvedCommitSha: "sha-conflict",
    })
    await createTestRun(db, task.id, {
      status: "succeeded",
      baseBranch: "master",
    })

    // Make merge call throw
    mockExecFileSync.mockImplementation(((_cmd: string, args: string[]) => {
      if (args.includes("merge")) {
        throw new Error("CONFLICT: merge conflict in file.ts")
      }
      if (args.includes("rev-parse") && args.includes("HEAD")) {
        return "merge-sha-123\n"
      }
      if (args.includes("symbolic-ref") && args.includes("--short")) {
        return "master\n"
      }
      return ""
    }) as typeof mockExecFileSync)

    await mergeLoop(db)

    // Task stays pr_ready with mergeRequested cleared
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("pr_ready")
    expect(updatedTask!.mergeRequested).toBe(false)

    // merge_result error event should exist
    const allEvents = await db.select().from(events).where(eq(events.taskId, task.id))
    const mergeEvent = allEvents.find((e) => e.type === "merge_result")
    expect(mergeEvent).toBeDefined()
    const payload = JSON.parse(mergeEvent!.payload!)
    expect(payload.message).toContain("Merge failed")
  })

  it("flag not set: skips tasks without mergeRequested", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      mergeRequested: false,
      approvedCommitSha: "sha-456",
    })
    await createTestRun(db, task.id, {
      status: "succeeded",
      baseBranch: "master",
    })

    await mergeLoop(db)

    // No changes to task
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("pr_ready")
    expect(updatedTask!.mergeRequested).toBe(false)

    // No git calls
    expect(mockExecFileSync).not.toHaveBeenCalled()

    // No events
    const allEvents = await db.select().from(events).where(eq(events.taskId, task.id))
    expect(allEvents).toHaveLength(0)
  })

  it("missing approvedCommitSha: clears mergeRequested silently", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      mergeRequested: true,
      approvedCommitSha: null,
    })
    await createTestRun(db, task.id, {
      status: "succeeded",
      baseBranch: "master",
    })

    await mergeLoop(db)

    // mergeRequested cleared, task stays pr_ready
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("pr_ready")
    expect(updatedTask!.mergeRequested).toBe(false)

    // No merge_result event (silent recovery)
    const allEvents = await db.select().from(events).where(eq(events.taskId, task.id))
    expect(allEvents).toHaveLength(0)
  })

  it("stale merge worktree: removes existing worktree before creating new one", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      mergeRequested: true,
      approvedCommitSha: "sha-789",
    })
    await createTestRun(db, task.id, {
      status: "succeeded",
      baseBranch: "master",
    })

    // Stale worktree exists
    mockExistsSync.mockReturnValue(true)

    await mergeLoop(db)

    // Should have called worktree remove before worktree add
    const calls = mockExecFileSync.mock.calls
    const worktreeRemoveIdx = calls.findIndex(
      (c: unknown[]) => Array.isArray(c[1]) && c[1].includes("worktree") && c[1].includes("remove"),
    )
    const worktreeAddIdx = calls.findIndex(
      (c: unknown[]) => Array.isArray(c[1]) && c[1].includes("worktree") && c[1].includes("add"),
    )

    expect(worktreeRemoveIdx).toBeGreaterThanOrEqual(0)
    expect(worktreeAddIdx).toBeGreaterThan(worktreeRemoveIdx)

    // Task should still complete merge successfully
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("merged")
  })

  it("post-merge sync: resets working tree when on same branch and clean", async () => {
    const task = await createTestTask(db, {
      status: "pr_ready",
      mergeRequested: true,
      approvedCommitSha: "sha-sync",
    })
    await createTestRun(db, task.id, {
      status: "succeeded",
      baseBranch: "master",
    })

    // symbolic-ref returns "master" (same as baseBranch), status is clean
    mockExecFileSync.mockImplementation(((_cmd: string, args: string[]) => {
      if (args.includes("rev-parse") && args.includes("HEAD")) {
        return "merge-sha-123\n"
      }
      if (args.includes("symbolic-ref") && args.includes("--short")) {
        return "master\n"
      }
      if (args.includes("status") && args.includes("--porcelain")) {
        return "\n"
      }
      return ""
    }) as typeof mockExecFileSync)

    await mergeLoop(db)

    // Verify git reset --hard HEAD was called
    const calls = mockExecFileSync.mock.calls
    const resetCall = calls.find(
      (c: unknown[]) => Array.isArray(c[1]) && c[1].includes("reset") && c[1].includes("--hard") && c[1].includes("HEAD"),
    )
    expect(resetCall).toBeDefined()

    // Task should be merged
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("merged")
  })
})
