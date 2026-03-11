import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { tasks, runs } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { z } from "zod"
import { json, error } from "@/lib/api-utils"

const patchSchema = z.object({
  status: z.enum(["cancelled"]).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return error(parsed.error.message, 400)
  }

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (!task) return error("Task not found", 404)

  if (parsed.data.status === "cancelled") {
    // Draft tasks with no runs skip straight to cleaned
    if (task.status === "draft") {
      await db.update(tasks).set({ status: "cleaned", updatedAt: new Date() }).where(eq(tasks.id, id))
      return json({ ...task, status: "cleaned" })
    }

    // Cancel all active runs
    await db.update(runs).set({ status: "cancelled" })
      .where(and(eq(runs.taskId, id), inArray(runs.status, ["pending", "claimed", "running"])))

    // Mark non-cleaned runs as cleanup_pending
    await db.update(runs).set({ status: "cleanup_pending" })
      .where(and(eq(runs.taskId, id), inArray(runs.status, ["succeeded", "failed", "orphaned"])))

    await db.update(tasks).set({ status: "cancelled", updatedAt: new Date() }).where(eq(tasks.id, id))
    return json({ ...task, status: "cancelled" })
  }

  // Regular field updates
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (parsed.data.title) updates.title = parsed.data.title
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.priority) updates.priority = parsed.data.priority

  await db.update(tasks).set(updates).where(eq(tasks.id, id))
  const updated = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  return json(updated)
}
