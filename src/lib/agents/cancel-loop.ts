import { db } from "../db/index"
import { runs } from "../db/schema"
import { eq } from "drizzle-orm"

type Db = typeof db

export async function cancelLoop(db: Db): Promise<void> {
  try {
    const cancelledRuns = await db.select().from(runs)
      .where(eq(runs.status, "cancelled"))

    for (const run of cancelledRuns) {
      if (run.agentPid) {
        try {
          // Kill entire process group (negative pid = process group)
          process.kill(-run.agentPid, "SIGTERM")
        } catch {
          // Process may already be dead — that's fine
        }
      }
      // Keep agentPid populated — process may still be dying after SIGTERM.
      // cleanup-loop checks liveness before removing worktree.
      await db.update(runs).set({ status: "cleanup_pending" }).where(eq(runs.id, run.id))
    }
  } catch (err) {
    console.error("[worker:cancel]", err)
  }
}
