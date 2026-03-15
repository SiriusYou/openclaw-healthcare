import { describe, it, expect, beforeEach, vi } from "vitest"
import { db } from "../../db/index"
import { runs } from "../../db/schema"
import { eq } from "drizzle-orm"
import { truncateAll, createTestTask, createTestRun } from "./test-helpers"
import { cancelLoop } from "../cancel-loop"

describe("cancelLoop", () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await truncateAll(db)
  })

  it("sends SIGTERM to process group and transitions to cleanup_pending", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true)

    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "cancelled",
      agentPid: 12345,
    })

    await cancelLoop(db)

    expect(killSpy).toHaveBeenCalledWith(-12345, "SIGTERM")

    const updated = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updated?.status).toBe("cleanup_pending")
    expect(updated?.agentPid).toBe(12345)
  })

  it("transitions to cleanup_pending even without agentPid", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true)

    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "cancelled",
      agentPid: null,
    })

    await cancelLoop(db)

    expect(killSpy).not.toHaveBeenCalled()

    const updated = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updated?.status).toBe("cleanup_pending")
  })

  it("transitions to cleanup_pending when process is already dead (ESRCH)", async () => {
    const esrchError = Object.assign(new Error("kill ESRCH"), { code: "ESRCH" })
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw esrchError
    })

    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "cancelled",
      agentPid: 99999,
    })

    await cancelLoop(db)

    expect(killSpy).toHaveBeenCalledWith(-99999, "SIGTERM")

    const updated = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updated?.status).toBe("cleanup_pending")
  })

  it("is a no-op when no cancelled runs exist", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true)

    const task = await createTestTask(db, { status: "in_progress" })
    await createTestRun(db, task.id, { status: "running", agentPid: 11111 })

    await cancelLoop(db)

    expect(killSpy).not.toHaveBeenCalled()

    const allRuns = await db.select().from(runs)
    expect(allRuns).toHaveLength(1)
    expect(allRuns[0].status).toBe("running")
  })
})
