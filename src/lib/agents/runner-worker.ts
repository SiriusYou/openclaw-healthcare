import { db } from "../db/index"
import { runs, tasks, events } from "../db/schema"
import { eq, and, sql, inArray, lt } from "drizzle-orm"
import { nanoid } from "nanoid"
import { writeFileSync } from "node:fs"
import { fakeAdapter } from "./fake-adapter"
import { codexAdapter } from "./codex-adapter"
import { claudeAdapter } from "./claude-adapter"
import { createWorktree, removeWorktree } from "./worktree"
import { tmuxSessionExists, tmuxKillSession } from "./tmux"
import { MAX_AUTO_RETRIES, getHeartbeatPath } from "./constants"
import { DEFAULT_DATABASE_URL } from "../db/constants"
import type { AgentAdapter } from "./types"

const CLAIM_INTERVAL = 5_000
const HEARTBEAT_INTERVAL = 10_000
const CANCEL_INTERVAL = 5_000
const CLEANUP_INTERVAL = 30_000
const ORPHAN_INTERVAL = 30_000
const HEARTBEAT_TIMEOUT = 60

const dbUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
const heartbeatPath = getHeartbeatPath(dbUrl)
const workerPid = String(process.pid)

function getAdapter(): AgentAdapter {
  const kind = process.env.AGENT_ADAPTER ?? "fake"
  switch (kind) {
    case "codex": return codexAdapter
    case "claude": return claudeAdapter
    default: return fakeAdapter
  }
}

const adapter = getAdapter()

function writeHeartbeatFile() {
  try {
    writeFileSync(heartbeatPath, JSON.stringify({ pid: workerPid, timestamp: Math.floor(Date.now() / 1000) }))
  } catch {
    /* .data/ may not exist yet on first tick */
  }
}

// ─── Loop 1: Claim pending runs ───────────────────────────────────────────────

async function claimLoop() {
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

    // Update task status
    await db.update(tasks).set({ status: "assigned", updatedAt: new Date() }).where(eq(tasks.id, taskId))

    // Get task details for prompt
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
    if (!task) return

    const branch = `agent/${taskId}/${attempt}`
    const worktreePath = createWorktree(taskId, branch)

    // Update run with worktree info
    await db.update(runs).set({
      status: "running",
      worktreePath,
      branch,
      tmuxSession: adapter.usesTmux ? `run-${runId}` : null,
      startedAt: new Date(),
    }).where(eq(runs.id, runId))

    await db.update(tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(tasks.id, taskId))

    // Log event
    await db.insert(events).values({
      id: nanoid(),
      runId,
      type: "status_change",
      payload: JSON.stringify({ from: "claimed", to: "running" }),
    })

    // Execute adapter
    if (adapter.usesTmux) {
      // TODO: tmux-based execution for codex/claude adapters
    } else {
      // Non-blocking: fire and forget, handle result in callback
      adapter.run({
        runId,
        taskId,
        worktreePath,
        branch,
        prompt: `${task.title}\n\n${task.description ?? ""}`,
        attempt,
      }).then(async (result) => {
        await db.update(runs).set({
          status: result.exitCode === 0 ? "succeeded" : "failed",
          exitCode: result.exitCode,
          finishedAt: new Date(),
        }).where(eq(runs.id, runId))

        await db.insert(events).values({
          id: nanoid(),
          runId,
          type: "status_change",
          payload: JSON.stringify({
            from: "running",
            to: result.exitCode === 0 ? "succeeded" : "failed",
            output: result.output,
          }),
        })

        if (result.exitCode === 0) {
          await db.update(tasks).set({ status: "awaiting_review", updatedAt: new Date() }).where(eq(tasks.id, taskId))
        } else if (attempt < MAX_AUTO_RETRIES + 1) {
          // Auto-retry: create new run in same transaction-like flow
          const newRunId = nanoid()
          await db.insert(runs).values({
            id: newRunId,
            taskId,
            agentKind: task.agentKind,
            status: "pending",
            attempt: attempt + 1,
            worktreePath,
            branch: `agent/${taskId}/${attempt + 1}`,
          })
          await db.update(tasks).set({ status: "queued", updatedAt: new Date() }).where(eq(tasks.id, taskId))
        } else {
          await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, taskId))
        }
      }).catch(async (err) => {
        await db.update(runs).set({
          status: "failed",
          exitCode: 1,
          finishedAt: new Date(),
        }).where(eq(runs.id, runId))
        await db.insert(events).values({
          id: nanoid(),
          runId,
          type: "error",
          payload: JSON.stringify({ message: String(err) }),
        })
        if (attempt >= MAX_AUTO_RETRIES + 1) {
          await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, taskId))
        }
      })
    }
  } catch (err) {
    console.error("[worker:claim]", err)
  }
}

// ─── Loop 2: Heartbeat ───────────────────────────────────────────────────────

async function heartbeatLoop() {
  try {
    await db.run(sql`
      UPDATE runs SET heartbeat_at=unixepoch()
      WHERE claimed_by=${workerPid} AND status IN ('claimed','running')
    `)
    writeHeartbeatFile()
  } catch (err) {
    console.error("[worker:heartbeat]", err)
  }
}

// ─── Loop 3: Cancel observer ─────────────────────────────────────────────────

async function cancelLoop() {
  try {
    const cancelledRuns = await db.select().from(runs)
      .where(eq(runs.status, "cancelled"))

    for (const run of cancelledRuns) {
      if (run.tmuxSession) {
        tmuxKillSession(run.tmuxSession)
      }
      await db.update(runs).set({ status: "cleanup_pending" }).where(eq(runs.id, run.id))
    }
  } catch (err) {
    console.error("[worker:cancel]", err)
  }
}

// ─── Loop 4: Cleanup ─────────────────────────────────────────────────────────

async function cleanupLoop() {
  try {
    const pendingCleanup = await db.select().from(runs)
      .where(eq(runs.status, "cleanup_pending"))

    // Group by taskId
    const taskGroups = new Map<string, typeof pendingCleanup>()
    for (const run of pendingCleanup) {
      if (!run.taskId) continue
      const group = taskGroups.get(run.taskId) ?? []
      group.push(run)
      taskGroups.set(run.taskId, group)
    }

    for (const [taskId, cleanupRuns] of taskGroups) {
      // Check all runs for this task are in safe terminal states
      const allRuns = await db.select().from(runs).where(eq(runs.taskId, taskId))
      const safeStates = ["cleanup_pending", "cleaned", "succeeded", "failed", "orphaned"]
      const allSafe = allRuns.every((r) => safeStates.includes(r.status ?? ""))

      if (!allSafe) continue

      // Try to remove worktree
      try {
        removeWorktree(taskId)

        // Mark all cleanup_pending runs as cleaned
        for (const run of cleanupRuns) {
          await db.update(runs).set({ status: "cleaned" }).where(eq(runs.id, run.id))
        }

        // Check if task can be marked cleaned
        const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
        if (task && (task.status === "merged" || task.status === "cancelled")) {
          await db.update(tasks).set({ status: "cleaned", updatedAt: new Date() }).where(eq(tasks.id, taskId))
        }
      } catch (err) {
        await db.insert(events).values({
          id: nanoid(),
          taskId,
          type: "cleanup_error",
          payload: JSON.stringify({ message: `worktree remove failed: ${err}` }),
        })
      }
    }
  } catch (err) {
    console.error("[worker:cleanup]", err)
  }
}

// ─── Loop 5: Orphan detection ────────────────────────────────────────────────

async function orphanLoop() {
  try {
    const staleRuns = await db.select().from(runs)
      .where(
        and(
          inArray(runs.status, ["claimed", "running"]),
          lt(runs.heartbeatAt, sql`unixepoch() - ${HEARTBEAT_TIMEOUT}`)
        )
      )

    for (const run of staleRuns) {
      // Check if tmux session still exists (worker may have crashed and restarted)
      if (run.tmuxSession && tmuxSessionExists(run.tmuxSession)) {
        // Reclaim: agent is still running, just update heartbeat
        await db.update(runs).set({
          claimedBy: workerPid,
          heartbeatAt: new Date(),
        }).where(eq(runs.id, run.id))
        continue
      }

      // Mark as orphaned
      await db.update(runs).set({ status: "orphaned", finishedAt: new Date() }).where(eq(runs.id, run.id))
      await db.insert(events).values({
        id: nanoid(),
        runId: run.id,
        type: "status_change",
        payload: JSON.stringify({ from: run.status, to: "orphaned", reason: "heartbeat timeout" }),
      })

      if (run.taskId) {
        await db.update(tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(tasks.id, run.taskId))
      }
    }
  } catch (err) {
    console.error("[worker:orphan]", err)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function startLoop(fn: () => Promise<void>, interval: number, name: string) {
  const tick = async () => {
    await fn()
    setTimeout(tick, interval)
  }
  console.log(`[worker] starting ${name} loop (${interval}ms)`)
  setTimeout(tick, 0)
}

console.log(`[worker] pid=${workerPid} adapter=${adapter.kind} db=${dbUrl}`)

writeHeartbeatFile()

startLoop(claimLoop, CLAIM_INTERVAL, "claim")
startLoop(heartbeatLoop, HEARTBEAT_INTERVAL, "heartbeat")
startLoop(cancelLoop, CANCEL_INTERVAL, "cancel")
startLoop(cleanupLoop, CLEANUP_INTERVAL, "cleanup")
startLoop(orphanLoop, ORPHAN_INTERVAL, "orphan")
