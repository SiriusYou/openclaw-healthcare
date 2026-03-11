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
}
