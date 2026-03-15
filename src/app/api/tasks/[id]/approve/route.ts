import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { tasks, runs } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { json, error } from "@/lib/api-utils"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (!task) return error("Task not found", 404)

  if (task.status !== "awaiting_review") {
    return error(`Cannot approve task in status '${task.status}'`, 409)
  }

  // Find latest succeeded run with a valid headCommitSha
  const latestRun = await db.query.runs.findFirst({
    where: and(eq(runs.taskId, id), eq(runs.status, "succeeded")),
    orderBy: desc(runs.attempt),
  })

  if (!latestRun || !latestRun.headCommitSha) {
    return error("No succeeded run with a commit SHA found — cannot approve", 400)
  }

  await db.update(tasks).set({
    status: "pr_ready",
    approvedRunId: latestRun.id,
    approvedCommitSha: latestRun.headCommitSha,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id))

  const updated = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  return json(updated)
}
