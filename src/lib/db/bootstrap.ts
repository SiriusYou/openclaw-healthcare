import { db } from "./index"
import { sql } from "drizzle-orm"

export async function bootstrapTriggers() {
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS events_check_fk
    BEFORE INSERT ON events
    WHEN NEW.run_id IS NULL AND NEW.task_id IS NULL
    BEGIN
      SELECT RAISE(ABORT, 'events must have at least one of run_id or task_id');
    END
  `)

  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS events_no_update
    BEFORE UPDATE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events table is append-only');
    END
  `)

  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS events_no_delete
    BEFORE DELETE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events table is append-only');
    END
  `)

  // Single active run per task — DB-level constraint (ADR-5)
  // Clean up any pre-existing dirty data that would block index creation
  // (e.g. from runs before this constraint existed)
  try {
    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_run
      ON runs(task_id)
      WHERE status IN ('pending', 'claimed', 'running')
    `)
  } catch {
    // Dirty data exists — deduplicate: keep only the latest active run per task
    await db.run(sql`
      UPDATE runs SET status = 'failed'
      WHERE id IN (
        SELECT r.id FROM runs r
        INNER JOIN (
          SELECT task_id, MAX(rowid) AS max_rowid
          FROM runs
          WHERE status IN ('pending', 'claimed', 'running')
          GROUP BY task_id
          HAVING COUNT(*) > 1
        ) dupes ON r.task_id = dupes.task_id
        WHERE r.status IN ('pending', 'claimed', 'running')
          AND r.rowid < dupes.max_rowid
      )
    `)
    // Retry index creation after cleanup
    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_run
      ON runs(task_id)
      WHERE status IN ('pending', 'claimed', 'running')
    `)
  }
}
