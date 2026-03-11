import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { events } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { json } from "@/lib/api-utils"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const result = await db.select().from(events)
    .where(eq(events.taskId, id))
    .orderBy(desc(events.timestamp))
    .limit(100)

  return json(result)
}
