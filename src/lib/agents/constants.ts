import { basename } from "node:path"

export const MAX_AUTO_RETRIES = 2

/** Derive heartbeat file path from DATABASE_URL for environment isolation */
export function getHeartbeatPath(dbUrl: string): string {
  const dbFile = basename(dbUrl.replace(/^file:/, ""))
  const prefix = dbFile.replace(/\.db$/, "")
  return `.data/${prefix}-worker-heartbeat.json`
}
