import { execFileSync } from "node:child_process"

export function tmuxSessionExists(sessionName: string): boolean {
  try {
    execFileSync("tmux", ["has-session", "-t", sessionName], { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export function tmuxKillSession(sessionName: string): void {
  try {
    execFileSync("tmux", ["kill-session", "-t", sessionName], { stdio: "pipe" })
  } catch {
    /* session may not exist */
  }
}
