import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "../../db/index"
import { runs } from "../../db/schema"
import { eq } from "drizzle-orm"
import { heartbeatLoop } from "../heartbeat-loop"
import { truncateAll, createTestTask, createTestRun } from "./test-helpers"

type Db = typeof db

describe("heartbeatLoop", () => {
  const WORKER_PID = "12345"
  let writeHeartbeatFile: ReturnType<typeof vi.fn<() => void>>

  beforeEach(async () => {
    await truncateAll(db)
    writeHeartbeatFile = vi.fn<() => void>()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("updates heartbeat_at for runs claimed by this worker", async () => {
    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "running",
      claimedBy: WORKER_PID,
    })

    await heartbeatLoop(db, WORKER_PID, writeHeartbeatFile)

    const updated = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updated!.heartbeatAt).not.toBeNull()
    expect(writeHeartbeatFile).toHaveBeenCalledOnce()
  })

  it("does not update runs claimed by a different worker", async () => {
    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "running",
      claimedBy: "other-worker",
    })

    await heartbeatLoop(db, WORKER_PID, writeHeartbeatFile)

    const unchanged = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(unchanged!.heartbeatAt).toBeNull()
    expect(writeHeartbeatFile).toHaveBeenCalledOnce()
  })

  it("logs errors without throwing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const brokenDb = { run: vi.fn().mockRejectedValue(new Error("db gone")) } as unknown as Db

    await heartbeatLoop(brokenDb, WORKER_PID, writeHeartbeatFile)

    expect(consoleSpy).toHaveBeenCalledWith("[worker:heartbeat]", expect.any(Error))
    expect(writeHeartbeatFile).not.toHaveBeenCalled()
  })
})
