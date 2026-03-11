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

  if (task.status !== "awaiting_review") {
    return error(`Cannot approve task in status '${task.status}'`, 409)
  }

  await db.update(tasks).set({ status: "pr_ready", updatedAt: new Date() }).where(eq(tasks.id, id))

  const updated = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  return json(updated)
}
