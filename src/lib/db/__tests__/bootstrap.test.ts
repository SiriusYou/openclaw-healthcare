import { describe, it, expect, beforeEach } from "vitest"
import { db } from "../index"
import { sql } from "drizzle-orm"
import { events, runs, tasks } from "../schema"
import { nanoid } from "nanoid"
import { truncateAll } from "@/lib/agents/__tests__/test-helpers"
import { bootstrapTriggers } from "../bootstrap"

describe("bootstrapTriggers", () => {
  beforeEach(async () => {
    await truncateAll(db)
  })

  it("creates triggers that enforce append-only events", async () => {
    await bootstrapTriggers()

    const taskId = nanoid()
    await db.insert(tasks).values({ id: taskId, title: "test", status: "draft" })
    await db.insert(events).values({
      eventId: nanoid(),
      taskId,
      type: "log",
      payload: "{}",
    })

    // UPDATE should be blocked — drizzle wraps the trigger message
    await expect(
      db.run(sql`UPDATE events SET payload = '{"x":1}' WHERE task_id = ${taskId}`),
    ).rejects.toThrow()

    // DELETE should be blocked
    await expect(
      db.run(sql`DELETE FROM events WHERE task_id = ${taskId}`),
    ).rejects.toThrow()
  })

  it("creates triggers that require at least one FK on events", async () => {
    await bootstrapTriggers()

    await expect(
      db.run(sql`INSERT INTO events (event_id, type, payload) VALUES ('e1', 'test', '{}')`)
    ).rejects.toThrow()
  })

  it("creates single-active-run unique index", async () => {
    await bootstrapTriggers()

    const taskId = nanoid()
    await db.insert(tasks).values({ id: taskId, title: "test", status: "queued" })

    await db.insert(runs).values({
      id: nanoid(),
      taskId,
      agentKind: "fake",
      status: "pending",
      attempt: 1,
    })

    // Second active run for same task should fail
    await expect(
      db.insert(runs).values({
        id: nanoid(),
        taskId,
        agentKind: "fake",
        status: "pending",
        attempt: 2,
      }),
    ).rejects.toThrow()
  })

  it("is idempotent — calling twice does not throw", async () => {
    await bootstrapTriggers()
    await expect(bootstrapTriggers()).resolves.not.toThrow()
  })
})
