import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { runs, tasks } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { nanoid } from "nanoid"
import { MAX_AUTO_RETRIES } from "@/lib/agents/constants"
import { json, error } from "@/lib/api-utils"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const run = await db.query.runs.findFirst({ where: eq(runs.id, id) })
  if (!run) return error("Run not found", 404)
  if (!run.taskId) return error("Run has no task", 400)

  // Must be the latest run for this task
  const latestRun = await db.query.runs.findFirst({
    where: eq(runs.taskId, run.taskId),
    orderBy: desc(runs.attempt),
  })

  if (!latestRun || latestRun.id !== id) {
    return error("Can only retry the latest run for a task", 409)
  }

  // Check retry eligibility
  const isOrphaned = run.status === "orphaned"
  const isExhaustedFailed = run.status === "failed" && (run.attempt ?? 0) >= MAX_AUTO_RETRIES + 1
  if (!isOrphaned && !isExhaustedFailed) {
    return error("Run is not eligible for manual retry", 409)
  }

  // Check no active run for this task
  const allTaskRuns = await db.select().from(runs).where(eq(runs.taskId, run.taskId))
  const hasActiveRun = allTaskRuns.some((r) =>
    ["pending", "claimed", "running"].includes(r.status ?? "")
  )
  if (hasActiveRun) {
    return error("Task already has an active run", 409)
  }

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, run.taskId) })
  if (!task) return error("Task not found", 404)

  // Create new run atomically
  const newRunId = nanoid()
  const nextAttempt = (run.attempt ?? 0) + 1

  const batchOps = [
    db.insert(runs).values({
      id: newRunId,
      taskId: run.taskId,
      agentKind: task.agentKind as "codex" | "claude" | "gemini" | "fake",
      status: "pending",
      attempt: nextAttempt,
      worktreePath: run.worktreePath,
    }),
    db.update(tasks).set({ status: "queued", updatedAt: new Date() }).where(eq(tasks.id, run.taskId)),
    ...(isOrphaned
      ? [db.update(runs).set({ status: "cleanup_pending" }).where(eq(runs.id, id))]
      : []),
  ] as const

  try {
    await db.batch(batchOps as unknown as [typeof batchOps[0], ...typeof batchOps[number][]])
  } catch (err) {
    if (String(err).includes("UNIQUE constraint failed")) {
      return error("Task already has an active run", 409)
    }
    throw err
  }

  const newRun = await db.query.runs.findFirst({ where: eq(runs.id, newRunId) })
  return json(newRun, 201)
}
