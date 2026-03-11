import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { tasks, runs, events } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { json, error } from "@/lib/api-utils"

const rejectSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (!task) return error("Task not found", 404)

  if (task.status !== "awaiting_review") {
    return error(`Cannot reject task in status '${task.status}'`, 409)
  }

  const body = await request.json().catch(() => ({}))
  const parsed = rejectSchema.safeParse(body)
  const reason = parsed.success ? parsed.data.reason : undefined

  // Get latest run for worktree path
  const latestRun = await db.query.runs.findFirst({
    where: eq(runs.taskId, id),
    orderBy: desc(runs.attempt),
  })

  const nextAttempt = latestRun ? (latestRun.attempt ?? 0) + 1 : 1

  // Log rejection event
  if (latestRun) {
    await db.insert(events).values({
      id: nanoid(),
      runId: latestRun.id,
      type: "review_rejected",
      payload: JSON.stringify({ reason: reason ?? "No reason provided" }),
    })
  }

  // Create new run (reject is not limited by MAX_AUTO_RETRIES)
  const newRunId = nanoid()
  await db.insert(runs).values({
    id: newRunId,
    taskId: id,
    agentKind: task.agentKind as "codex" | "claude" | "gemini" | "fake",
    status: "pending",
    attempt: nextAttempt,
    worktreePath: latestRun?.worktreePath,
  })

  await db.update(tasks).set({ status: "queued", updatedAt: new Date() }).where(eq(tasks.id, id))

  return json({ taskId: id, newRunId, attempt: nextAttempt }, 201)
}
