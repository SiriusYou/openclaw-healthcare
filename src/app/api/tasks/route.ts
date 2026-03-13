import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { tasks, runs, events } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { json, error } from "@/lib/api-utils"

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
    let lastMergeError: string | null = null
    if (task.status === "pr_ready") {
      const mergeEvent = await db.select().from(events)
        .where(and(eq(events.taskId, task.id), eq(events.type, "merge_result")))
        .orderBy(desc(events.id))
        .limit(1)
      if (mergeEvent.length > 0 && mergeEvent[0].payload) {
        try {
          const parsed = JSON.parse(mergeEvent[0].payload)
          lastMergeError = parsed.message ?? null
        } catch { /* ignore */ }
      }
    }
    return { ...task, lastMergeError }
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
