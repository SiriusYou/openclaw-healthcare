import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { events } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

type EventType = typeof events.type.enumValues[number]

/** Fetch the latest event payload field for a given task and event type. */
export async function getLatestEventField(
  taskId: string,
  eventType: EventType,
  field: string,
): Promise<string | null> {
  const row = await db.select().from(events)
    .where(and(eq(events.taskId, taskId), eq(events.type, eventType)))
    .orderBy(desc(events.id))
    .limit(1)
  if (row.length === 0 || !row[0].payload) return null
  try {
    const parsed = JSON.parse(row[0].payload)
    return parsed[field] ?? null
  } catch {
    return null
  }
}
