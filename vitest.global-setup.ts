import { spawnSync } from "node:child_process"
import { TEST_DATABASE_URL } from "./src/lib/db/constants"

export default async function globalSetup() {
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL }

  function runOrDie(cmd: string, args: string[]) {
    const result = spawnSync(cmd, args, { env, stdio: "inherit" })
    if (result.status !== 0) {
      throw new Error(`Vitest globalSetup failed: ${cmd} ${args.join(" ")} exited with ${result.status}`)
    }
  }

  runOrDie("bun", ["run", "db:push"])
  runOrDie("bun", ["run", "db:bootstrap"])

  // Truncate all tables for clean test state (FK order: events → runs → tasks)
  const { createClient } = await import("@libsql/client")
  const client = createClient({ url: TEST_DATABASE_URL })
  await client.execute("DELETE FROM events")
  await client.execute("DELETE FROM runs")
  await client.execute("DELETE FROM tasks")
  client.close()
}
