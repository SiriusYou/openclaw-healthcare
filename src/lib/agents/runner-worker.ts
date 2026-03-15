import { db } from "../db/index"
import { writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fakeAdapter } from "./fake-adapter"
import { codexAdapter } from "./codex-adapter"
import { getHeartbeatPath, SUPPORTED_ADAPTERS, type SupportedAdapter } from "./constants"
import { DEFAULT_DATABASE_URL } from "../db/constants"
import type { AgentAdapter } from "./types"
import { claimLoop } from "./claim-loop"
import { heartbeatLoop } from "./heartbeat-loop"
import { cancelLoop } from "./cancel-loop"
import { cleanupLoop } from "./cleanup-loop"
import { orphanLoop } from "./orphan-loop"
import { mergeLoop } from "./merge-loop"

const CLAIM_INTERVAL = 5_000
const HEARTBEAT_INTERVAL = 10_000
const CANCEL_INTERVAL = 5_000
const CLEANUP_INTERVAL = 30_000
const ORPHAN_INTERVAL = 30_000
const MERGE_INTERVAL = 10_000

const dbUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
const heartbeatPath = getHeartbeatPath(dbUrl)
const workerPid = String(process.pid)

/* ── Preflight: validate adapter name + binary ── */
const adapterKind = (process.env.AGENT_ADAPTER ?? "fake") as string
if (!SUPPORTED_ADAPTERS.includes(adapterKind as SupportedAdapter)) {
  console.error(`[worker] FATAL: unsupported AGENT_ADAPTER="${adapterKind}". Supported: ${SUPPORTED_ADAPTERS.join(", ")}`)
  process.exit(1)
}
if (adapterKind === "codex") {
  try {
    execFileSync("which", ["codex"], { stdio: "pipe" })
  } catch {
    console.error("[worker] FATAL: codex CLI not found on PATH")
    process.exit(1)
  }
}

function getAdapter(): AgentAdapter {
  switch (adapterKind) {
    case "codex": return codexAdapter
    default: return fakeAdapter
  }
}

function writeHeartbeatFile() {
  try {
    writeFileSync(heartbeatPath, JSON.stringify({ pid: workerPid, timestamp: Math.floor(Date.now() / 1000) }))
  } catch {
    /* .data/ may not exist yet on first tick */
  }
}

function startLoop(fn: () => Promise<void>, interval: number, name: string) {
  const tick = async () => {
    await fn()
    setTimeout(tick, interval)
  }
  console.log(`[worker] starting ${name} loop (${interval}ms)`)
  setTimeout(tick, 0)
}

const adapter = getAdapter()
console.log(`[worker] pid=${workerPid} adapter=${adapter.kind} db=${dbUrl}`)

writeHeartbeatFile()

startLoop(() => claimLoop(db, getAdapter, workerPid), CLAIM_INTERVAL, "claim")
startLoop(() => heartbeatLoop(db, workerPid, writeHeartbeatFile), HEARTBEAT_INTERVAL, "heartbeat")
startLoop(() => cancelLoop(db), CANCEL_INTERVAL, "cancel")
startLoop(() => cleanupLoop(db), CLEANUP_INTERVAL, "cleanup")
startLoop(() => orphanLoop(db), ORPHAN_INTERVAL, "orphan")
startLoop(() => mergeLoop(db), MERGE_INTERVAL, "merge")
