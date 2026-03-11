import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", {
    enum: ["low", "medium", "high", "urgent"],
  }).default("medium"),
  status: text("status", {
    enum: [
      "draft", "queued", "assigned", "in_progress",
      "awaiting_review", "pr_ready", "merged", "failed",
      "cancelled", "cleaned",
    ],
  }).default("draft"),
  agentKind: text("agent_kind", {
    enum: ["codex", "claude", "gemini", "fake"],
  }).default("fake"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
})

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  agentKind: text("agent_kind", {
    enum: ["codex", "claude", "gemini", "fake"],
  }),
  status: text("status", {
    enum: [
      "pending", "claimed", "running", "succeeded", "failed",
      "orphaned", "cancelled", "cleanup_pending", "cleaned",
    ],
  }).default("pending"),
  attempt: integer("attempt").default(1),
  worktreePath: text("worktree_path"),
  tmuxSession: text("tmux_session"),
  branch: text("branch"),
  exitCode: integer("exit_code"),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
  claimedBy: text("claimed_by"),
  heartbeatAt: integer("heartbeat_at", { mode: "timestamp" }),
  startedAt: integer("started_at", { mode: "timestamp" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
})

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  runId: text("run_id").references(() => runs.id),
  taskId: text("task_id").references(() => tasks.id),
  type: text("type", {
    enum: ["log", "status_change", "error", "output", "review_rejected", "cleanup_error"],
  }),
  payload: text("payload"),
  timestamp: integer("timestamp", { mode: "timestamp" }).default(sql`(unixepoch())`),
})
