import { readFileSync } from "node:fs"
import { getHeartbeatPath } from "@/lib/agents/constants"
import { DEFAULT_DATABASE_URL } from "@/lib/db/constants"
import { json } from "@/lib/api-utils"

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  const heartbeatPath = getHeartbeatPath(dbUrl)

  try {
    const content = readFileSync(heartbeatPath, "utf-8")
    const data = JSON.parse(content) as { pid: string; timestamp: number }
    const now = Math.floor(Date.now() / 1000)
    const age = now - data.timestamp

    return json({
      ready: age <= 30,
      pid: data.pid,
      lastHeartbeat: data.timestamp,
      ageSeconds: age,
    })
  } catch {
    return json({ ready: false, error: "No heartbeat file" })
  }
}
