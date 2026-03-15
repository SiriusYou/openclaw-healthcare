import { db } from "../db/index"
import { tasks, runs, events } from "../db/schema"
import { eq, and } from "drizzle-orm"
import { nanoid } from "nanoid"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

type Db = typeof db

const MERGE_WORKTREE_BASE = join(homedir(), ".openclaw-worktrees")

function getMergeWorktreePath(taskId: string): string {
  return join(MERGE_WORKTREE_BASE, `_merge-${taskId}`)
}

function execGit(args: string[], cwd?: string): string {
  const opts: { encoding: "utf-8"; stdio: "pipe"; cwd?: string } = {
    encoding: "utf-8",
    stdio: "pipe",
  }
  if (cwd) opts.cwd = cwd
  return execFileSync("git", cwd ? ["-C", cwd, ...args] : args, opts).trim()
}

async function executeMerge(
  db: Db,
  taskId: string,
  approvedCommitSha: string,
  baseBranch: string,
): Promise<void> {
  const mergePath = getMergeWorktreePath(taskId)

  // Force-remove stale merge worktree if it exists (from a previous failed merge)
  if (existsSync(mergePath)) {
    try {
      execFileSync("git", ["worktree", "remove", mergePath, "--force"], { stdio: "pipe" })
    } catch {
      // If removal fails, try to continue anyway
    }
  }

  // Delete stale temp branch if it exists
  const tempBranch = `_merge-${taskId}`
  try {
    execFileSync("git", ["branch", "-D", tempBranch], { stdio: "pipe" })
  } catch {
    // Branch may not exist
  }

  // Step 1: Create temporary worktree + branch based on baseBranch
  try {
    execFileSync("git", ["worktree", "add", mergePath, "-b", tempBranch, baseBranch], {
      stdio: "pipe",
    })
  } catch (err) {
    await writeMergeError(db, taskId, `Failed to create merge worktree: ${err}`)
    await clearMergeRequested(db, taskId)
    return
  }

  // Step 2: Merge the approved commit SHA
  try {
    execGit(["merge", approvedCommitSha, "-m", `merge: task ${taskId}`], mergePath)
  } catch (err) {
    // Merge conflict or other failure — preserve worktree for inspection
    await writeMergeError(db, taskId, `Merge failed (conflicts?): ${err}`)
    await clearMergeRequested(db, taskId)
    return
  }

  // Step 3: Get the merge commit SHA and update-ref the base branch
  const mergeCommitSha = execGit(["rev-parse", "HEAD"], mergePath)

  try {
    execFileSync("git", ["update-ref", `refs/heads/${baseBranch}`, mergeCommitSha], {
      stdio: "pipe",
    })
  } catch (err) {
    await writeMergeError(db, taskId, `Failed to update ref for ${baseBranch}: ${err}`)
    await clearMergeRequested(db, taskId)
    return
  }

  // Step 4: Cleanup — remove temp worktree and branch
  try {
    execFileSync("git", ["worktree", "remove", mergePath, "--force"], { stdio: "pipe" })
  } catch {
    // Non-fatal
  }
  try {
    execFileSync("git", ["branch", "-D", tempBranch], { stdio: "pipe" })
  } catch {
    // Non-fatal
  }

  // Mark all runs for this task as cleanup_pending
  await db.update(runs).set({ status: "cleanup_pending" })
    .where(eq(runs.taskId, taskId))

  // Mark task as merged (keep approvedRunId/approvedCommitSha for audit)
  await db.update(tasks).set({
    status: "merged",
    mergeRequested: false,
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId))

  // Write success event
  await db.insert(events).values({
    eventId: nanoid(),
    taskId,
    type: "merge_result",
    payload: JSON.stringify({
      message: `Successfully merged to ${baseBranch}`,
      mergeCommitSha,
    }),
  })

  // Post-merge sync: try to sync main worktree if on the same branch and clean
  try {
    const currentBranch = execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim()

    if (currentBranch !== baseBranch) {
      // Different branch — skip sync silently (debug-only output event)
      await db.insert(events).values({
        eventId: nanoid(),
        taskId,
        type: "output",
        payload: JSON.stringify({
          message: `Main worktree on branch '${currentBranch}', not '${baseBranch}' — ref updated but working tree not synced`,
        }),
      })
      return
    }

    // Check if working tree is clean
    const status = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim()

    if (status) {
      await db.insert(events).values({
        eventId: nanoid(),
        taskId,
        type: "output",
        payload: JSON.stringify({
          message: "Main worktree has uncommitted changes, run 'git reset --hard HEAD' to sync after committing/stashing",
        }),
      })
      return
    }

    // Safe to sync
    execFileSync("git", ["reset", "--hard", "HEAD"], { stdio: "pipe" })
  } catch {
    // Post-merge sync failure is non-fatal
  }
}

async function writeMergeError(db: Db, taskId: string, message: string): Promise<void> {
  await db.insert(events).values({
    eventId: nanoid(),
    taskId,
    type: "merge_result",
    payload: JSON.stringify({ message }),
  })
}

async function clearMergeRequested(db: Db, taskId: string): Promise<void> {
  await db.update(tasks).set({
    mergeRequested: false,
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId))
}

export async function mergeLoop(db: Db): Promise<void> {
  try {
    // Find tasks that are pr_ready with mergeRequested and have an approved commit
    const pendingMerges = await db.select().from(tasks)
      .where(
        and(
          eq(tasks.status, "pr_ready"),
          eq(tasks.mergeRequested, true),
        )
      )

    for (const task of pendingMerges) {
      if (!task.approvedCommitSha) {
        // Should not happen (API validates), but clear flag defensively
        await clearMergeRequested(db, task.id)
        continue
      }

      // Find the baseBranch from the latest run
      const latestRun = await db.query.runs.findFirst({
        where: eq(runs.taskId, task.id),
        orderBy: (runs, { desc }) => [desc(runs.attempt)],
      })

      const baseBranch = latestRun?.baseBranch ?? "master"

      await executeMerge(db, task.id, task.approvedCommitSha, baseBranch)
    }
  } catch (err) {
    console.error("[worker:merge]", err)
  }
}
