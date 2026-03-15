import { db } from "../../db/index"
import { tasks, runs, events } from "../../db/schema"
import { eq, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import type { AgentAdapter, AgentResult } from "../types"

type Db = typeof db

/** Truncate all tables in FK-safe order: events → runs → tasks.
 *  Temporarily drops append-only triggers on events table. */
export async function truncateAll(database: Db): Promise<void> {
  await database.run(sql`DROP TRIGGER IF EXISTS events_no_delete`)
  await database.run(sql`DROP TRIGGER IF EXISTS events_no_update`)
  await database.delete(events)
  await database.delete(runs)
  await database.delete(tasks)
  await database.run(sql`
    CREATE TRIGGER IF NOT EXISTS events_no_update
    BEFORE UPDATE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events table is append-only');
    END
  `)
  await database.run(sql`
    CREATE TRIGGER IF NOT EXISTS events_no_delete
    BEFORE DELETE ON events
    BEGIN
      SELECT RAISE(ABORT, 'events table is append-only');
    END
  `)
}

interface TaskOverrides {
  readonly id?: string
  readonly title?: string
  readonly description?: string | null
  readonly priority?: "low" | "medium" | "high" | "urgent"
  readonly status?: "draft" | "queued" | "assigned" | "in_progress" | "awaiting_review" | "pr_ready" | "merged" | "failed" | "cancelled" | "cleaned"
  readonly agentKind?: "codex" | "claude" | "gemini" | "fake"
  readonly mergeRequested?: boolean
  readonly approvedRunId?: string | null
  readonly approvedCommitSha?: string | null
}

export async function createTestTask(database: Db, overrides: TaskOverrides = {}) {
  const id = overrides.id ?? nanoid()
  await database.insert(tasks).values({
    id,
    title: overrides.title ?? `Test task ${id.slice(0, 6)}`,
    description: overrides.description ?? null,
    priority: overrides.priority ?? "medium",
    status: overrides.status ?? "draft",
    agentKind: overrides.agentKind ?? "fake",
    mergeRequested: overrides.mergeRequested ?? false,
    approvedRunId: overrides.approvedRunId ?? null,
    approvedCommitSha: overrides.approvedCommitSha ?? null,
  })
  const result = await database.query.tasks.findFirst({ where: eq(tasks.id, id) })
  return result!
}

interface RunOverrides {
  readonly id?: string
  readonly agentKind?: "codex" | "claude" | "gemini" | "fake"
  readonly status?: "pending" | "claimed" | "running" | "succeeded" | "failed" | "orphaned" | "cancelled" | "cleanup_pending" | "cleaned"
  readonly attempt?: number
  readonly worktreePath?: string | null
  readonly branch?: string | null
  readonly baseBranch?: string | null
  readonly baseCommitSha?: string | null
  readonly headCommitSha?: string | null
  readonly agentPid?: number | null
  readonly finishReason?: "completed" | "cancelled" | "failed" | "timeout" | "stale_process_blocked" | null
  readonly exitCode?: number | null
  readonly heartbeatAt?: Date | null
  readonly claimedAt?: Date | null
  readonly startedAt?: Date | null
  readonly finishedAt?: Date | null
}

export async function createTestRun(database: Db, taskId: string, overrides: RunOverrides = {}) {
  const id = overrides.id ?? nanoid()
  await database.insert(runs).values({
    id,
    taskId,
    agentKind: overrides.agentKind ?? "fake",
    status: overrides.status ?? "pending",
    attempt: overrides.attempt ?? 1,
    worktreePath: overrides.worktreePath ?? null,
    branch: overrides.branch ?? null,
    baseBranch: overrides.baseBranch ?? null,
    baseCommitSha: overrides.baseCommitSha ?? null,
    headCommitSha: overrides.headCommitSha ?? null,
    agentPid: overrides.agentPid ?? null,
    finishReason: overrides.finishReason ?? null,
    exitCode: overrides.exitCode ?? null,
    heartbeatAt: overrides.heartbeatAt ?? null,
    claimedAt: overrides.claimedAt ?? null,
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  })
  const result = await database.query.runs.findFirst({ where: eq(runs.id, id) })
  return result!
}

interface MockAdapterBehavior {
  readonly startThrows?: boolean
  readonly waitThrows?: boolean
  readonly waitResult?: AgentResult
  readonly pid?: number
}

export function createMockAdapter(behavior: MockAdapterBehavior = {}): AgentAdapter {
  return {
    kind: "fake",
    usesTmux: false,
    start() {
      if (behavior.startThrows) {
        throw new Error("adapter.start() failed")
      }

      const result: AgentResult = behavior.waitResult ?? {
        exitCode: 0,
        finishedAt: new Date(),
        finishReason: "completed",
      }

      return {
        pid: behavior.pid ?? 99999,
        stdout: (async function* () { yield "mock output" })(),
        stderr: (async function* () { /* empty */ })(),
        wait: behavior.waitThrows
          ? () => Promise.reject(new Error("handle.wait() failed"))
          : () => Promise.resolve(result),
        kill: () => { /* no-op */ },
      }
    },
  }
}

/**
 * Poll DB until a run reaches a terminal status.
 * Useful because claimLoop fires runAgent as fire-and-forget.
 */
export async function waitForRunStatus(
  database: Db,
  runId: string,
  targetStatuses: readonly string[],
  timeout = 3000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const run = await database.query.runs.findFirst({ where: eq(runs.id, runId) })
    if (run && targetStatuses.includes(run.status ?? "")) {
      return
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  const run = await database.query.runs.findFirst({ where: eq(runs.id, runId) })
  throw new Error(`Run ${runId} did not reach ${targetStatuses.join("/")} within ${timeout}ms (current: ${run?.status})`)
}
