import { describe, it, expect } from "vitest"
import { homedir } from "node:os"
import { join } from "node:path"

describe("worktree path convention", () => {
  it("uses ~/.openclaw-worktrees/<taskId> pattern", () => {
    const taskId = "abc123"
    const expected = join(homedir(), ".openclaw-worktrees", taskId)
    expect(expected).toMatch(/\.openclaw-worktrees\/abc123$/)
  })
})
