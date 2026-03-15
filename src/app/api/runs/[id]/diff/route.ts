import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { execFileSync } from "node:child_process"
import { json, error } from "@/lib/api-utils"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const run = await db.query.runs.findFirst({ where: eq(runs.id, id) })
  if (!run) return error("Run not found", 404)

  if (!run.baseCommitSha || !run.headCommitSha) {
    return error("Run has no commit data", 400)
  }

  try {
    const range = `${run.baseCommitSha}...${run.headCommitSha}`
    const opts = { encoding: "utf-8" as const, stdio: "pipe" as const }

    const stat = execFileSync("git", ["diff", range, "--stat"], opts).trim()
    const diff = execFileSync("git", ["diff", range], opts).trim()

    return json({
      stat,
      diff,
      baseCommitSha: run.baseCommitSha,
      headCommitSha: run.headCommitSha,
    })
  } catch (err) {
    return error(`Git diff failed: ${err}`, 500)
  }
}
