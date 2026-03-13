import { db } from "../db/index"
import { sql } from "drizzle-orm"

type Db = typeof db

export async function heartbeatLoop(db: Db, workerPid: string, writeHeartbeatFile: () => void): Promise<void> {
  try {
    await db.run(sql`
      UPDATE runs SET heartbeat_at=unixepoch()
      WHERE claimed_by=${workerPid} AND status IN ('claimed','running')
    `)
    writeHeartbeatFile()
  } catch (err) {
    console.error("[worker:heartbeat]", err)
  }
}
