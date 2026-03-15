// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>()
  return { ...actual, execFileSync: vi.fn() }
})

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return { ...actual, existsSync: vi.fn() }
})

import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import {
  getWorktreePath,
  createWorktree,
  removeWorktree,
  getCurrentBranch,
  getBranchHeadSha,
  getWorktreeHeadSha,
} from "../worktree"

const mockExecFileSync = vi.mocked(execFileSync)
const mockExistsSync = vi.mocked(existsSync)

describe("worktree utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getWorktreePath returns ~/.openclaw-worktrees/<taskId>", () => {
    const result = getWorktreePath("task-abc")
    expect(result).toMatch(/\.openclaw-worktrees\/task-abc$/)
  })

  it("createWorktree returns existing path if worktree exists", () => {
    mockExistsSync.mockReturnValue(true)
    const result = createWorktree("task-abc", "branch-1")
    expect(result).toMatch(/\.openclaw-worktrees\/task-abc$/)
    expect(mockExecFileSync).not.toHaveBeenCalled()
  })

  it("createWorktree creates new worktree and sets git identity", () => {
    mockExistsSync.mockReturnValue(false)
    const result = createWorktree("task-abc", "branch-1")
    expect(result).toMatch(/\.openclaw-worktrees\/task-abc$/)
    expect(mockExecFileSync).toHaveBeenCalledTimes(3)
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", expect.stringContaining("task-abc"), "-b", "branch-1"],
      { stdio: "pipe" },
    )
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["-C", expect.stringContaining("task-abc"), "config", "user.name", "OpenClaw Agent"],
      { stdio: "pipe" },
    )
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["-C", expect.stringContaining("task-abc"), "config", "user.email", "agent@openclaw.local"],
      { stdio: "pipe" },
    )
  })

  it("removeWorktree does nothing if path does not exist", () => {
    mockExistsSync.mockReturnValue(false)
    removeWorktree("task-abc")
    expect(mockExecFileSync).not.toHaveBeenCalled()
  })

  it("removeWorktree calls git worktree remove --force", () => {
    mockExistsSync.mockReturnValue(true)
    removeWorktree("task-abc")
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["worktree", "remove", expect.stringContaining("task-abc"), "--force"],
      { stdio: "pipe" },
    )
  })

  it("getCurrentBranch returns trimmed branch name", () => {
    mockExecFileSync.mockReturnValue("main\n" as never)
    const result = getCurrentBranch()
    expect(result).toBe("main")
  })

  it("getBranchHeadSha returns trimmed SHA", () => {
    mockExecFileSync.mockReturnValue("abc123def\n" as never)
    const result = getBranchHeadSha("main")
    expect(result).toBe("abc123def")
  })

  it("getWorktreeHeadSha returns trimmed SHA for worktree", () => {
    mockExecFileSync.mockReturnValue("def456abc\n" as never)
    const result = getWorktreeHeadSha("/path/to/worktree")
    expect(result).toBe("def456abc")
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["-C", "/path/to/worktree", "rev-parse", "HEAD"],
      { encoding: "utf-8", stdio: "pipe" },
    )
  })
})
