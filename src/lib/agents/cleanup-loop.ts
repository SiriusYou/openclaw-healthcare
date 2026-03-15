import { db } from "../db/index"
import { runs, tasks, events } from "../db/schema"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { removeWorktree } from "./worktree"

type Db = typeof db

export async function cleanupLoop(db: Db): Promise<void> {
  try {
    const pendingCleanup = await db.select().from(runs)
      .where(eq(runs.status, "cleanup_pending"))

    // Group by taskId
    const taskGroups = new Map<string, typeof pendingCleanup>()
    for (const run of pendingCleanup) {
      if (!run.taskId) continue
      const group = taskGroups.get(run.taskId) ?? []
      group.push(run)
      taskGroups.set(run.taskId, group)
    }

    for (const [taskId, cleanupRuns] of taskGroups) {
      // Check all runs for this task are in safe terminal states
      const allRuns = await db.select().from(runs).where(eq(runs.taskId, taskId))
      const safeStates = ["cleanup_pending", "cleaned", "succeeded", "failed", "orphaned"]
      const allSafe = allRuns.every((r) => safeStates.includes(r.status ?? ""))

      if (!allSafe) continue

      // Safety: don't remove worktree if any run still has a living agent process.
      // This prevents deleting a worktree from under a stale process that hasn't died yet.
      const hasLivingProcess = allRuns.some((r) => {
        if (!r.agentPid) return false
        try {
          process.kill(r.agentPid, 0)
          return true // process is alive
        } catch {
          return false // ESRCH = dead
        }
      })
      if (hasLivingProcess) continue

      try {
        removeWorktree(taskId)

        // Mark all cleanup_pending runs as cleaned
        for (const run of cleanupRuns) {
          await db.update(runs).set({ status: "cleaned", agentPid: null }).where(eq(runs.id, run.id))
        }

        // Check if task can be marked cleaned
        const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
        if (task && (task.status === "merged" || task.status === "cancelled")) {
          await db.update(tasks).set({ status: "cleaned", updatedAt: new Date() }).where(eq(tasks.id, taskId))
        }
      } catch (err) {
        await db.insert(events).values({
          eventId: nanoid(),
          taskId,
          type: "cleanup_error",
          payload: JSON.stringify({ message: `worktree remove failed: ${err}` }),
        })
      }
    }
  } catch (err) {
    console.error("[worker:cleanup]", err)
  }
}
