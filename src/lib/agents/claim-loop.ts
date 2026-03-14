import { db } from "../db/index"
import { runs, tasks, events } from "../db/schema"
import { eq, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { createWorktree, getCurrentBranch, getBranchHeadSha, getWorktreeHeadSha } from "./worktree"
import { MAX_AUTO_RETRIES } from "./constants"
import type { AgentAdapter } from "./types"

type Db = typeof db

async function handleStaleProcessCheck(
  db: Db,
  taskId: string,
  newRunId: string,
): Promise<boolean> {
  // Check ALL previous runs for this task that have an agentPid (regardless of status).
  // A run in cleanup_pending/orphaned/failed may still have a living process if the
  // OS hasn't reclaimed the PID yet. We must block to prevent two agents writing
  // to the same worktree simultaneously.
  const previousRuns = await db.select().from(runs)
    .where(eq(runs.taskId, taskId))

  for (const prevRun of previousRuns) {
    if (!prevRun.agentPid) continue
    // Skip the run we're about to start
    if (prevRun.id === newRunId) continue

    try {
      process.kill(prevRun.agentPid, 0)
      // Process is alive — stale process blocked
      await db.update(runs).set({
        status: "failed",
        finishReason: "stale_process_blocked",
        finishedAt: new Date(),
        agentPid: null,
      }).where(eq(runs.id, newRunId))

      await db.insert(events).values({
        eventId: nanoid(),
        runId: newRunId,
        type: "error",
        payload: JSON.stringify({
          message: `Stale process still running: pid=${prevRun.agentPid} from run ${prevRun.id}`,
          stalePid: prevRun.agentPid,
          staleRunId: prevRun.id,
        }),
      })

      await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, taskId))
      return true
    } catch {
      // ESRCH = no such process — process is dead, proceed normally
    }
  }

  return false
}

async function runAgent(
  db: Db,
  adapter: AgentAdapter,
  runId: string,
  taskId: string,
  attempt: number,
  worktreePath: string,
  branch: string,
  prompt: string,
  baseBranch: string,
  baseCommitSha: string,
): Promise<void> {
  let handle
  try {
    handle = adapter.start({ runId, taskId, worktreePath, branch, prompt, attempt })
  } catch (err) {
    await db.update(runs).set({
      status: "failed",
      finishReason: "failed",
      exitCode: 1,
      finishedAt: new Date(),
      agentPid: null,
    }).where(eq(runs.id, runId))
    await db.insert(events).values({
      eventId: nanoid(),
      runId,
      type: "error",
      payload: JSON.stringify({ message: `adapter.start() threw: ${err}` }),
    })
    if (attempt >= MAX_AUTO_RETRIES + 1) {
      await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, taskId))
    }
    return
  }

  // Write agentPid immediately after start
  await db.update(runs).set({ agentPid: handle.pid }).where(eq(runs.id, runId))

  // Consume stdout/stderr as output events (fire-and-forget streams)
  const streamOutput = async (stream: AsyncIterable<string>, streamName: string) => {
    try {
      for await (const chunk of stream) {
        await db.insert(events).values({
          eventId: nanoid(),
          runId,
          type: "output",
          payload: JSON.stringify({ stream: streamName, chunk }),
        })
      }
    } catch {
      // Stream errors are non-fatal
    }
  }

  void streamOutput(handle.stdout, "stdout")
  void streamOutput(handle.stderr, "stderr")

  let result
  try {
    result = await handle.wait()
  } catch (err) {
    await db.update(runs).set({
      status: "failed",
      finishReason: "failed",
      exitCode: 1,
      finishedAt: new Date(),
      agentPid: null,
    }).where(eq(runs.id, runId))
    await db.insert(events).values({
      eventId: nanoid(),
      runId,
      type: "error",
      payload: JSON.stringify({ message: String(err) }),
    })
    if (attempt >= MAX_AUTO_RETRIES + 1) {
      await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, taskId))
    }
    return
  }

  // Guard: if the run was cancelled/cleaned while we were waiting, don't overwrite.
  // cancel-loop sends SIGTERM directly (bypassing adapter.kill()), so the adapter
  // may not know about the cancellation. Re-read status from DB before writing.
  const currentRun = await db.query.runs.findFirst({ where: eq(runs.id, runId) })
  if (currentRun && currentRun.status !== "running") {
    // Run was moved by cancel-loop or cleanup-loop — don't overwrite
    return
  }

  // Capture head commit sha from worktree
  let headCommitSha: string | undefined
  try {
    headCommitSha = getWorktreeHeadSha(worktreePath)
  } catch {
    // Non-fatal — worktree may have been removed
  }

  const succeeded = result.exitCode === 0

  await db.update(runs).set({
    status: succeeded ? "succeeded" : "failed",
    exitCode: result.exitCode,
    finishReason: result.finishReason,
    finishedAt: result.finishedAt,
    headCommitSha: headCommitSha ?? result.commitSha ?? null,
    agentPid: null,
  }).where(eq(runs.id, runId))

  await db.insert(events).values({
    eventId: nanoid(),
    runId,
    type: "status_change",
    payload: JSON.stringify({
      from: "running",
      to: succeeded ? "succeeded" : "failed",
      finishReason: result.finishReason,
    }),
  })

  if (succeeded) {
    await db.update(tasks).set({ status: "awaiting_review", updatedAt: new Date() }).where(eq(tasks.id, taskId))
    return
  }

  if (attempt < MAX_AUTO_RETRIES + 1) {
    // Auto-retry: new run inherits branch, baseBranch, baseCommitSha, worktreePath
    const newRunId = nanoid()
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
    await db.insert(runs).values({
      id: newRunId,
      taskId,
      agentKind: task?.agentKind ?? "fake",
      status: "pending",
      attempt: attempt + 1,
      worktreePath,
      branch,
      baseBranch,
      baseCommitSha,
    })
    await db.update(tasks).set({ status: "queued", updatedAt: new Date() }).where(eq(tasks.id, taskId))
  } else {
    await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, taskId))
  }
}

export async function claimLoop(db: Db, getAdapter: () => AgentAdapter, workerPid: string): Promise<void> {
  try {
    const claimed = await db.run(sql`
      UPDATE runs SET status='claimed', claimed_at=unixepoch(), claimed_by=${workerPid}, heartbeat_at=unixepoch()
      WHERE id = (SELECT id FROM runs WHERE status='pending' ORDER BY created_at ASC LIMIT 1)
      RETURNING *
    `)

    if (claimed.rowsAffected === 0) return

    const row = claimed.rows[0] as Record<string, unknown>
    const runId = row.id as string
    const taskId = row.task_id as string
    const attempt = row.attempt as number

    // Update task status to assigned
    await db.update(tasks).set({ status: "assigned", updatedAt: new Date() }).where(eq(tasks.id, taskId))

    // Stale process check (ADR-8): before starting, verify no living orphaned process
    const blocked = await handleStaleProcessCheck(db, taskId, runId)
    if (blocked) return

    // Get task details for prompt
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
    if (!task) return

    const branch = `agent/${taskId}`

    // Preserve inherited baseBranch/baseCommitSha from retry/reject.
    // Only compute fresh values for the first run of a task.
    const existingBaseBranch = row.base_branch as string | null
    const existingBaseCommitSha = row.base_commit_sha as string | null
    const baseBranch = existingBaseBranch ?? getCurrentBranch()
    const baseCommitSha = existingBaseCommitSha ?? getBranchHeadSha(baseBranch)

    const existingWorktreePath = row.worktree_path as string | null
    const worktreePath = existingWorktreePath ?? createWorktree(taskId, branch)

    // Update run with worktree info and base branch data
    await db.update(runs).set({
      status: "running",
      worktreePath,
      branch,
      baseBranch,
      baseCommitSha,
      startedAt: new Date(),
    }).where(eq(runs.id, runId))

    await db.update(tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(tasks.id, taskId))

    await db.insert(events).values({
      eventId: nanoid(),
      runId,
      type: "status_change",
      payload: JSON.stringify({ from: "claimed", to: "running" }),
    })

    const adapter = getAdapter()
    const prompt = `${task.title}\n\n${task.description ?? ""}`

    // Non-blocking: fire and forget
    void runAgent(db, adapter, runId, taskId, attempt, worktreePath, branch, prompt, baseBranch, baseCommitSha)
  } catch (err) {
    console.error("[worker:claim]", err)
  }
}
