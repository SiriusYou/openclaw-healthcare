import { basename } from "node:path"

export const MAX_AUTO_RETRIES = 2

/** Adapters that the worker can actually run. gemini is a schema-only stub. */
export const SUPPORTED_ADAPTERS = ["fake", "codex", "claude"] as const
export type SupportedAdapter = (typeof SUPPORTED_ADAPTERS)[number]

/** Returns the validated adapter kind from AGENT_ADAPTER env var, or null if unsupported. */
export function getValidatedAdapterKind(): SupportedAdapter | null {
  const kind = process.env.AGENT_ADAPTER ?? "fake"
  return SUPPORTED_ADAPTERS.includes(kind as SupportedAdapter)
    ? (kind as SupportedAdapter)
    : null
}

/** Derive heartbeat file path from DATABASE_URL for environment isolation */
export function getHeartbeatPath(dbUrl: string): string {
  const dbFile = basename(dbUrl.replace(/^file:/, ""))
  const prefix = dbFile.replace(/\.db$/, "")
  return `.data/${prefix}-worker-heartbeat.json`
}
