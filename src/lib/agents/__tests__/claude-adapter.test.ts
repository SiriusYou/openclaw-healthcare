// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventEmitter } from "node:events"
import { Readable } from "node:stream"

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>()
  return { ...actual, spawn: vi.fn(), execFileSync: vi.fn() }
})

import { spawn, execFileSync } from "node:child_process"
import { claudeAdapter } from "../claude-adapter"

const mockSpawn = vi.mocked(spawn)
const mockExecFileSync = vi.mocked(execFileSync)

function createMockChild(pid: number) {
  const child = new EventEmitter() as EventEmitter & {
    pid: number
    stdout: Readable
    stderr: Readable
    unref: ReturnType<typeof vi.fn>
  }
  child.pid = pid
  child.stdout = new Readable({ read() {} })
  child.stderr = new Readable({ read() {} })
  child.unref = vi.fn()
  return child
}

const baseConfig = {
  taskId: "t1",
  runId: "r1",
  worktreePath: "/tmp/wt",
  branch: "agent/t1",
  prompt: "fix the bug",
  attempt: 1,
}

describe("claude adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("has kind 'claude' and usesTmux false", () => {
    expect(claudeAdapter.kind).toBe("claude")
    expect(claudeAdapter.usesTmux).toBe(false)
  })

  it("start() spawns claude CLI with correct flags", () => {
    const child = createMockChild(5678)
    mockSpawn.mockReturnValue(child as never)

    const handle = claudeAdapter.start(baseConfig)

    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      [
        "-p",
        "--dangerously-skip-permissions",
        "--output-format", "stream-json",
        "--no-session-persistence",
        "fix the bug",
      ],
      {
        cwd: "/tmp/wt",
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    expect(handle.pid).toBe(5678)
    expect(child.unref).toHaveBeenCalled()
  })

  it("handle.wait() resolves completed on exit 0 with no dirty files", async () => {
    const child = createMockChild(5678)
    mockSpawn.mockReturnValue(child as never)
    // git status --porcelain returns empty (no dirty files)
    mockExecFileSync.mockImplementation((cmd, args) => {
      if (Array.isArray(args) && args.includes("--porcelain")) return "" as never
      if (Array.isArray(args) && args.includes("rev-parse")) return "sha-abc\n" as never
      return "" as never
    })

    const handle = claudeAdapter.start(baseConfig)
    const waitPromise = handle.wait()
    child.emit("close", 0)
    const result = await waitPromise

    expect(result.exitCode).toBe(0)
    expect(result.finishReason).toBe("completed")
    expect(result.commitSha).toBe("sha-abc")
  })

  it("handle.wait() commits dirty files and resolves completed", async () => {
    const child = createMockChild(5678)
    mockSpawn.mockReturnValue(child as never)
    mockExecFileSync.mockImplementation((cmd, args) => {
      if (Array.isArray(args) && args.includes("--porcelain")) return " M file.ts\n" as never
      if (Array.isArray(args) && args.includes("rev-parse")) return "sha-def\n" as never
      return "" as never
    })

    const handle = claudeAdapter.start(baseConfig)
    const waitPromise = handle.wait()
    child.emit("close", 0)
    const result = await waitPromise

    expect(result.exitCode).toBe(0)
    expect(result.finishReason).toBe("completed")
    expect(result.commitSha).toBe("sha-def")
  })

  it("handle.wait() resolves failed on non-zero exit", async () => {
    const child = createMockChild(5678)
    mockSpawn.mockReturnValue(child as never)

    const handle = claudeAdapter.start(baseConfig)
    const waitPromise = handle.wait()
    child.emit("close", 1)
    const result = await waitPromise

    expect(result.exitCode).toBe(1)
    expect(result.finishReason).toBe("failed")
  })

  it("handle.kill() sends SIGTERM and marks cancelled", async () => {
    const child = createMockChild(5678)
    mockSpawn.mockReturnValue(child as never)

    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true)
    const handle = claudeAdapter.start(baseConfig)
    handle.kill()

    expect(killSpy).toHaveBeenCalledWith(-5678, "SIGTERM")

    const waitPromise = handle.wait()
    child.emit("close", 0)
    const result = await waitPromise

    expect(result.finishReason).toBe("cancelled")
    killSpy.mockRestore()
  })
})
