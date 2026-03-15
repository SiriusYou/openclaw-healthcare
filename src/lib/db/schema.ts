import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { index } from "drizzle-orm/sqlite-core"
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
  mergeRequested: integer("merge_requested", { mode: "boolean" }).default(false),
  approvedRunId: text("approved_run_id"),
  approvedCommitSha: text("approved_commit_sha"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (t) => [
  index("tasks_status_idx").on(t.status),
])

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
  branch: text("branch"),
  baseBranch: text("base_branch"),
  baseCommitSha: text("base_commit_sha"),
  headCommitSha: text("head_commit_sha"),
  agentPid: integer("agent_pid"),
  finishReason: text("finish_reason", {
    enum: ["completed", "cancelled", "failed", "timeout", "stale_process_blocked"],
  }),
  exitCode: integer("exit_code"),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
  claimedBy: text("claimed_by"),
  heartbeatAt: integer("heartbeat_at", { mode: "timestamp" }),
  startedAt: integer("started_at", { mode: "timestamp" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (t) => [
  index("runs_status_created_idx").on(t.status, t.createdAt),
  index("runs_task_id_idx").on(t.taskId),
])

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id"),
  runId: text("run_id").references(() => runs.id),
  taskId: text("task_id").references(() => tasks.id),
  type: text("type", {
    enum: [
      "log", "status_change", "error", "output",
      "review_rejected", "cleanup_error", "merge_result",
    ],
  }),
  payload: text("payload"),
  timestamp: integer("timestamp", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (t) => [
  index("events_run_id_idx").on(t.runId, t.id),
  index("events_task_type_idx").on(t.taskId, t.type, t.id),
])
