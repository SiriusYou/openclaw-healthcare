import { describe, it, expect, beforeEach, vi } from "vitest"
import { db } from "../../db/index"
import { runs, tasks, events } from "../../db/schema"
import { eq } from "drizzle-orm"
import { truncateAll, createTestTask, createTestRun } from "./test-helpers"
import { orphanLoop } from "../orphan-loop"

describe("orphanLoop", () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await truncateAll(db)
  })

  it("marks stale running run as orphaned and fails the task", async () => {
    const staleHeartbeat = new Date(Date.now() - 120_000)

    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "running",
      agentPid: 12345,
      heartbeatAt: staleHeartbeat,
    })

    await orphanLoop(db)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("orphaned")
    expect(updatedRun?.finishReason).toBe("timeout")
    expect(updatedRun?.finishedAt).toBeTruthy()
    expect(updatedRun?.agentPid).toBe(12345)

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("failed")

    const allEvents = await db.select().from(events)
    expect(allEvents).toHaveLength(1)
    expect(JSON.parse(allEvents[0].payload ?? "{}")).toMatchObject({
      from: "running",
      to: "orphaned",
      reason: "heartbeat timeout",
    })
  })

  it("orphans multiple stale runs in one pass", async () => {
    const staleHeartbeat = new Date(Date.now() - 120_000)

    const task1 = await createTestTask(db, { status: "in_progress" })
    const run1 = await createTestRun(db, task1.id, {
      status: "running",
      agentPid: 11111,
      heartbeatAt: staleHeartbeat,
    })

    const task2 = await createTestTask(db, { status: "in_progress" })
    const run2 = await createTestRun(db, task2.id, {
      status: "claimed",
      agentPid: 22222,
      heartbeatAt: staleHeartbeat,
    })

    await orphanLoop(db)

    const updatedRun1 = await db.query.runs.findFirst({ where: eq(runs.id, run1.id) })
    expect(updatedRun1?.status).toBe("orphaned")
    expect(updatedRun1?.finishReason).toBe("timeout")

    const updatedRun2 = await db.query.runs.findFirst({ where: eq(runs.id, run2.id) })
    expect(updatedRun2?.status).toBe("orphaned")
    expect(updatedRun2?.finishReason).toBe("timeout")

    const updatedTask1 = await db.query.tasks.findFirst({ where: eq(tasks.id, task1.id) })
    expect(updatedTask1?.status).toBe("failed")

    const updatedTask2 = await db.query.tasks.findFirst({ where: eq(tasks.id, task2.id) })
    expect(updatedTask2?.status).toBe("failed")

    const allEvents = await db.select().from(events)
    expect(allEvents).toHaveLength(2)
  })

  it("skips runs with fresh heartbeat", async () => {
    const freshHeartbeat = new Date()

    const task = await createTestTask(db, { status: "in_progress" })
    const run = await createTestRun(db, task.id, {
      status: "running",
      agentPid: 33333,
      heartbeatAt: freshHeartbeat,
    })

    await orphanLoop(db)

    const updatedRun = await db.query.runs.findFirst({ where: eq(runs.id, run.id) })
    expect(updatedRun?.status).toBe("running")
    expect(updatedRun?.finishReason).toBeNull()

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("in_progress")

    const allEvents = await db.select().from(events)
    expect(allEvents).toHaveLength(0)
  })

  it("is a no-op when no running or claimed runs exist", async () => {
    const task = await createTestTask(db, { status: "merged" })
    await createTestRun(db, task.id, {
      status: "succeeded",
      finishReason: "completed",
    })

    await orphanLoop(db)

    const allEvents = await db.select().from(events)
    expect(allEvents).toHaveLength(0)

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe("merged")
  })
})
