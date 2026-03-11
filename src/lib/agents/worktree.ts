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
