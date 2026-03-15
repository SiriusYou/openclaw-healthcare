import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKTREE_BASE = join(homedir(), ".openclaw-worktrees")

export function getWorktreePath(taskId: string): string {
  return join(WORKTREE_BASE, taskId)
}

export function createWorktree(taskId: string, branch: string): string {
  const wtPath = getWorktreePath(taskId)
  if (existsSync(wtPath)) {
    return wtPath
  }
  execFileSync("git", ["worktree", "add", wtPath, "-b", branch], {
    stdio: "pipe",
  })
  // Set git identity for agent commits (ADR-6)
  execFileSync("git", ["-C", wtPath, "config", "user.name", "OpenClaw Agent"], {
    stdio: "pipe",
  })
  execFileSync("git", ["-C", wtPath, "config", "user.email", "agent@openclaw.local"], {
    stdio: "pipe",
  })
  return wtPath
}

export function removeWorktree(taskId: string): void {
  const wtPath = getWorktreePath(taskId)
  if (!existsSync(wtPath)) {
    return
  }
  execFileSync("git", ["worktree", "remove", wtPath, "--force"], {
    stdio: "pipe",
  })
}

/** Get the current branch name of the main repo */
export function getCurrentBranch(): string {
  return execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
    encoding: "utf-8",
    stdio: "pipe",
  }).trim()
}

/** Get the HEAD commit SHA of a branch */
export function getBranchHeadSha(branch: string): string {
  return execFileSync("git", ["rev-parse", branch], {
    encoding: "utf-8",
    stdio: "pipe",
  }).trim()
}

/** Get the HEAD commit SHA in a worktree */
export function getWorktreeHeadSha(worktreePath: string): string {
  return execFileSync("git", ["-C", worktreePath, "rev-parse", "HEAD"], {
    encoding: "utf-8",
    stdio: "pipe",
  }).trim()
}
