import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { events } from "@/lib/db/schema"
import { eq, and, lt, desc } from "drizzle-orm"
import { json } from "@/lib/api-utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const beforeParam = url.searchParams.get("before")
  const beforeId = beforeParam !== null ? parseInt(beforeParam, 10) : undefined

  const whereClause = beforeId !== undefined
    ? and(eq(events.taskId, id), lt(events.id, beforeId))
    : eq(events.taskId, id)

  const result = await db.select().from(events)
    .where(whereClause)
    .orderBy(desc(events.id))
    .limit(100)

  return json(result.reverse())
}
