// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>()
  return { ...actual, execFileSync: vi.fn() }
})

import { execFileSync } from "node:child_process"
import { tmuxSessionExists, tmuxKillSession } from "../tmux"

const mockExecFileSync = vi.mocked(execFileSync)

describe("tmux utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("tmuxSessionExists returns true when session exists", () => {
    mockExecFileSync.mockReturnValue("" as never)
    expect(tmuxSessionExists("my-session")).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "tmux",
      ["has-session", "-t", "my-session"],
      { stdio: "pipe" },
    )
  })

  it("tmuxSessionExists returns false when session does not exist", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("session not found")
    })
    expect(tmuxSessionExists("my-session")).toBe(false)
  })

  it("tmuxKillSession calls tmux kill-session", () => {
    mockExecFileSync.mockReturnValue("" as never)
    tmuxKillSession("my-session")
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "tmux",
      ["kill-session", "-t", "my-session"],
      { stdio: "pipe" },
    )
  })

  it("tmuxKillSession swallows errors for missing sessions", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("session not found")
    })
    expect(() => tmuxKillSession("missing")).not.toThrow()
  })
})
