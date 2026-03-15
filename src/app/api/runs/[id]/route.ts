import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { json, error } from "@/lib/api-utils"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const run = await db.query.runs.findFirst({ where: eq(runs.id, id) })
  if (!run) return error("Run not found", 404)
  return json(run)
}
