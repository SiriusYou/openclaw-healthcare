import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"
import { DEFAULT_DATABASE_URL } from "./constants"
import { ensureDataDir } from "./ensure-data-dir"

const dbUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
ensureDataDir(dbUrl)

const client = createClient({ url: dbUrl })
export const db = drizzle(client, { schema })
