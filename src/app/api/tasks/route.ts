import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { tasks, runs } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { json, error, getLatestEventField } from "@/lib/api-utils"

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  autoRun: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const status = searchParams.get("status")
  const limit = Number(searchParams.get("limit") ?? "20")

  const result = status
    ? await db.select().from(tasks)
        .where(eq(tasks.status, status as typeof tasks.status.enumValues[number]))
        .orderBy(desc(tasks.createdAt)).limit(limit)
    : await db.select().from(tasks)
        .orderBy(desc(tasks.createdAt)).limit(limit)

  const enriched = await Promise.all(result.map(async (task) => {
    const [lastMergeError, lastRejectReason] = await Promise.all([
      task.status === "pr_ready"
        ? getLatestEventField(task.id, "merge_result", "message")
        : null,
      ["queued", "assigned", "in_progress", "awaiting_review"].includes(task.status ?? "")
        ? getLatestEventField(task.id, "review_rejected", "reason")
        : null,
    ])
    return { ...task, lastMergeError, lastRejectReason }
  }))

  return json(enriched)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createTaskSchema.safeParse(body)

  if (!parsed.success) {
    return error(parsed.error.message, 400)
  }

  const { title, description, priority, autoRun } = parsed.data
  const agentKind = (process.env.AGENT_ADAPTER ?? "fake") as "codex" | "claude" | "gemini" | "fake"

  const taskId = nanoid()
  const task = {
    id: taskId,
    title,
    description: description ?? null,
    priority,
    status: autoRun ? "queued" as const : "draft" as const,
    agentKind,
  }

  if (autoRun) {
    const runId = nanoid()
    await db.batch([
      db.insert(tasks).values(task),
      db.insert(runs).values({
        id: runId,
        taskId,
        agentKind,
        status: "pending",
        attempt: 1,
      }),
    ])
    return json({ ...task, runId }, 201)
  }

  await db.insert(tasks).values(task)
  return json(task, 201)
}
