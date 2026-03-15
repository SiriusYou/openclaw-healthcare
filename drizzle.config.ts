import { defineConfig } from "drizzle-kit"
import { DEFAULT_DATABASE_URL } from "./src/lib/db/constants"

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL },
})
