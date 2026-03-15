import { describe, it, expect } from "vitest"
import { claudeAdapter } from "../claude-adapter"

describe("claude adapter", () => {
  it("has kind 'claude'", () => {
    expect(claudeAdapter.kind).toBe("claude")
  })

  it("does not use tmux", () => {
    expect(claudeAdapter.usesTmux).toBe(false)
  })

  it("start() throws not-implemented error", () => {
    expect(() => claudeAdapter.start({
      taskId: "t1",
      runId: "r1",
      worktreePath: "/tmp/wt",
      branch: "agent/t1",
      prompt: "test",
      attempt: 1,
    })).toThrow("not implemented")
  })
})
