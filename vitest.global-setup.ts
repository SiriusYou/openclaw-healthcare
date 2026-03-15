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
  // Must drop append-only triggers before deleting events (bootstrap recreates them)
  const { createClient } = await import("@libsql/client")
  const client = createClient({ url: TEST_DATABASE_URL })
  await client.execute("DROP TRIGGER IF EXISTS events_no_delete")
  await client.execute("DROP TRIGGER IF EXISTS events_no_update")
  await client.execute("DELETE FROM events")
  await client.execute("DELETE FROM runs")
  await client.execute("DELETE FROM tasks")
  // Recreate triggers
  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS events_no_update
    BEFORE UPDATE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events table is append-only');
    END
  `)
  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS events_no_delete
    BEFORE DELETE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events table is append-only');
    END
  `)
  client.close()
}
