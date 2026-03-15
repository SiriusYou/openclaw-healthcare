import { describe, it, expect, beforeEach, vi } from "vitest"
import { eq, sql } from "drizzle-orm"
import { db } from "../../db/index"
import { runs, tasks, events } from "../../db/schema"
import { createTestTask, createTestRun } from "./test-helpers"

vi.mock("../worktree", () => ({
  removeWorktree: vi.fn(),
}))

import { removeWorktree } from "../worktree"
import { cleanupLoop } from "../cleanup-loop"

const mockedRemoveWorktree = removeWorktree as ReturnType<typeof vi.fn>

/** Truncate all tables, temporarily dropping the events_no_delete trigger */
async function truncateAllWithEvents(database: typeof db): Promise<void> {
  await database.run(sql`DROP TRIGGER IF EXISTS events_no_delete`)
  await database.delete(events)
  await database.run(sql`
    CREATE TRIGGER IF NOT EXISTS events_no_delete
    BEFORE DELETE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events table is append-only');
    END
  `)
  await database.delete(runs)
  await database.delete(tasks)
}

describe("cleanupLoop", () => {
  beforeEach(async () => {
    await truncateAllWithEvents(db)
    vi.restoreAllMocks()
    mockedRemoveWorktree.mockReset()

    // Default: process.kill throws ESRCH (process is dead)
    vi.spyOn(process, "kill").mockImplementation(() => {
      const err = new Error("No such process") as NodeJS.ErrnoException
      err.code = "ESRCH"
      throw err
    })
  })

  it("happy path: cleans up worktree and marks run + task as cleaned", async () => {
    const task = await createTestTask(db, { status: "cancelled" })
    await createTestRun(db, task.id, {
      status: "cleanup_pending",
      agentPid: 12345,
    })

    await cleanupLoop(db)

    expect(mockedRemoveWorktree).toHaveBeenCalledWith(task.id)

    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns).toHaveLength(1)
    expect(allRuns[0].status).toBe("cleaned")
    expect(allRuns[0].agentPid).toBeNull()

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("cleaned")
  })

  it("returns early when no cleanup_pending runs exist", async () => {
    const task = await createTestTask(db, { status: "in_progress" })
    await createTestRun(db, task.id, { status: "running" })

    await cleanupLoop(db)

    expect(mockedRemoveWorktree).not.toHaveBeenCalled()

    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns[0].status).toBe("running")
  })

  it("skips cleanup when a living agent process is detected", async () => {
    const task = await createTestTask(db, { status: "cancelled" })
    await createTestRun(db, task.id, {
      status: "cleanup_pending",
      agentPid: 55555,
    })

    // process.kill does NOT throw → process is alive
    vi.spyOn(process, "kill").mockImplementation(() => true)

    await cleanupLoop(db)

    expect(mockedRemoveWorktree).not.toHaveBeenCalled()

    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns[0].status).toBe("cleanup_pending")
  })

  it("skips cleanup when a non-terminal run exists for the same task", async () => {
    const task = await createTestTask(db, { status: "in_progress" })
    await createTestRun(db, task.id, { status: "cleanup_pending" })
    await createTestRun(db, task.id, { status: "running" })

    await cleanupLoop(db)

    expect(mockedRemoveWorktree).not.toHaveBeenCalled()

    const pendingRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    const cleanupRun = pendingRuns.find((r) => r.status === "cleanup_pending")
    expect(cleanupRun).toBeDefined()
    expect(cleanupRun!.status).toBe("cleanup_pending")
  })

  it("logs cleanup_error event and does not crash when worktree removal fails", async () => {
    const task = await createTestTask(db, { status: "cancelled" })
    await createTestRun(db, task.id, { status: "cleanup_pending" })

    mockedRemoveWorktree.mockImplementation(() => {
      throw new Error("rmdir failed")
    })

    await cleanupLoop(db)

    expect(mockedRemoveWorktree).toHaveBeenCalledWith(task.id)

    // Run should NOT be marked cleaned
    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns[0].status).toBe("cleanup_pending")

    // cleanup_error event should be logged
    const errorEvents = await db.select().from(events).where(eq(events.taskId, task.id))
    expect(errorEvents).toHaveLength(1)
    expect(errorEvents[0].type).toBe("cleanup_error")
    expect(errorEvents[0].payload).toContain("rmdir failed")
  })

  it("cleans runs but leaves task status unchanged when task is not terminal", async () => {
    const task = await createTestTask(db, { status: "in_progress" })
    await createTestRun(db, task.id, { status: "cleanup_pending" })

    await cleanupLoop(db)

    expect(mockedRemoveWorktree).toHaveBeenCalledWith(task.id)

    const allRuns = await db.select().from(runs).where(eq(runs.taskId, task.id))
    expect(allRuns[0].status).toBe("cleaned")

    // Task should remain in_progress (not merged/cancelled, so not marked cleaned)
    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask!.status).toBe("in_progress")
  })
})
