import { db } from "../db/index"
import { runs, tasks, events } from "../db/schema"
import { eq, and, sql, inArray, lt } from "drizzle-orm"
import { nanoid } from "nanoid"

type Db = typeof db

const HEARTBEAT_TIMEOUT = 60

export async function orphanLoop(db: Db): Promise<void> {
  try {
    const staleRuns = await db.select().from(runs)
      .where(
        and(
          inArray(runs.status, ["claimed", "running"] as const),
          lt(runs.heartbeatAt, sql`unixepoch() - ${HEARTBEAT_TIMEOUT}`)
        )
      )

    for (const run of staleRuns) {
      // ADR-8: no crash reattach. Stale heartbeat → always mark orphaned.
      // The operator can manually retry after verifying the old process is dead.
      // Keep agentPid populated so stale process check can probe it on retry.
      // The process may still be alive — clearing PID would defeat the safety check.
      await db.update(runs).set({
        status: "orphaned",
        finishReason: "timeout",
        finishedAt: new Date(),
      }).where(eq(runs.id, run.id))
      await db.insert(events).values({
        eventId: nanoid(),
        runId: run.id,
        type: "status_change",
        payload: JSON.stringify({ from: run.status, to: "orphaned", reason: "heartbeat timeout" }),
      })

      if (run.taskId) {
        await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, run.taskId))
      }
    }
  } catch (err) {
    console.error("[worker:orphan]", err)
  }
}
