import { E2E_DATABASE_URL } from "./constants"
import { ensureDataDir } from "./ensure-data-dir"
import { getHeartbeatPath } from "../agents/constants"
import { unlinkSync } from "node:fs"

ensureDataDir(E2E_DATABASE_URL)

const dbPath = E2E_DATABASE_URL.replace(/^file:/, "")
try { unlinkSync(dbPath) } catch { /* first run, no file */ }
try { unlinkSync(getHeartbeatPath(E2E_DATABASE_URL)) } catch { /* same */ }

console.log("E2E prepare: cleaned DB and heartbeat files")
