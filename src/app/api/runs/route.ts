import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { runs, tasks } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { json, error } from "@/lib/api-utils"

const createRunSchema = z.object({
  taskId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const taskId = searchParams.get("taskId")
  const limit = Number(searchParams.get("limit") ?? "50")

  const result = taskId
    ? await db.select().from(runs)
        .where(eq(runs.taskId, taskId))
        .orderBy(desc(runs.createdAt)).limit(limit)
    : await db.select().from(runs)
        .orderBy(desc(runs.createdAt)).limit(limit)

  return json(result)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createRunSchema.safeParse(body)

  if (!parsed.success) {
    return error(parsed.error.message, 400)
  }

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, parsed.data.taskId) })
  if (!task) return error("Task not found", 404)

  // Check no active run exists
  const activeRun = await db.query.runs.findFirst({
    where: eq(runs.taskId, parsed.data.taskId),
    orderBy: desc(runs.attempt),
  })

  if (activeRun && ["pending", "claimed", "running"].includes(activeRun.status ?? "")) {
    return error("Task already has an active run", 409)
  }

  const agentKind = task.agentKind as "codex" | "claude" | "gemini" | "fake"
  const nextAttempt = activeRun ? (activeRun.attempt ?? 0) + 1 : 1

  const runId = nanoid()
  try {
    await db.insert(runs).values({
      id: runId,
      taskId: parsed.data.taskId,
      agentKind,
      status: "pending",
      attempt: nextAttempt,
    })
  } catch (err) {
    if (String(err).includes("UNIQUE constraint failed")) {
      return error("Task already has an active run", 409)
    }
    throw err
  }

  await db.update(tasks).set({ status: "queued", updatedAt: new Date() }).where(eq(tasks.id, parsed.data.taskId))

  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) })
  return json(run, 201)
}
