import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { tasks } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { json, error } from "@/lib/api-utils"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (!task) return error("Task not found", 404)

  if (task.status !== "pr_ready") {
    return error(`Cannot merge task in status '${task.status}'`, 409)
  }

  if (!task.approvedCommitSha) {
    return error("Task must be approved before merging", 400)
  }

  if (task.mergeRequested) {
    return error("Merge already in progress", 409)
  }

  await db.update(tasks).set({
    mergeRequested: true,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id))

  const updated = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  return json(updated)
}
