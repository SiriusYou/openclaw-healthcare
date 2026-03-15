import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export function ensureDataDir(dbUrl: string) {
  const filePath = dbUrl.replace(/^file:/, "")
  mkdirSync(dirname(filePath), { recursive: true })
}
