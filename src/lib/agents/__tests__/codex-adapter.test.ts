// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventEmitter } from "node:events"

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>()
  return {
    ...actual,
    spawn: vi.fn(),
    execFileSync: vi.fn(() => ""),
  }
})

import { spawn, execFileSync } from "node:child_process"
import { codexAdapter } from "../codex-adapter"
import type { RunConfig } from "../types"

const mockSpawn = vi.mocked(spawn)
const mockExecFileSync = vi.mocked(execFileSync)

/**
 * Custom mock stream that supports BOTH `.on("data", ...)` AND `for await`.
 * Real Node.js streams have a flowing/paused mode conflict when both are used.
 * This mock feeds data to both consumers independently.
 */
class MockStream extends EventEmitter {
  private chunks: string[] = []
  private ended = false
  private waiting: (() => void) | null = null

  write(data: string) {
    this.chunks.push(data)
    this.emit("data", Buffer.from(data))
    if (this.waiting) {
      this.waiting()
      this.waiting = null
    }
  }

  end() {
    this.ended = true
    this.emit("end")
    if (this.waiting) {
      this.waiting()
      this.waiting = null
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<string> {
    while (true) {
      if (this.chunks.length > 0) {
        yield this.chunks.shift()!
      } else if (this.ended) {
        return
      } else {
        await new Promise<void>((r) => { this.waiting = r })
      }
    }
  }
}

function createFakeChild() {
  const stdout = new MockStream()
  const stderr = new MockStream()
  const child = Object.assign(new EventEmitter(), {
    pid: 12345,
    stdout,
    stderr,
    unref: vi.fn(),
  })
  return { child, stdout, stderr }
}

function makeConfig(overrides?: Partial<RunConfig>): RunConfig {
  return {
    runId: "run-1",
    taskId: "task-1",
    worktreePath: "/tmp/worktree",
    branch: "feature/test",
    prompt: "fix the bug",
    attempt: 1,
    ...overrides,
  }
}

async function collectAsync(iter: AsyncIterable<string>): Promise<string[]> {
  const results: string[] = []
  for await (const item of iter) {
    results.push(item)
  }
  return results
}

describe("codexAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("resolves with completed when turn.completed is seen", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)
    mockExecFileSync.mockReturnValue("" as never)

    const handle = codexAdapter.start(makeConfig())

    // Start wait() FIRST to register close listener before event fires
    const waitP = handle.wait()
    const stdoutP = collectAsync(handle.stdout)
    const stderrP = collectAsync(handle.stderr)

    stdout.write('{"type":"turn.completed"}\n')
    stdout.end()
    stderr.end()

    // Emit close after a tick to let streams drain
    await new Promise((r) => setTimeout(r, 10))
    child.emit("close", 0)

    const [, , result] = await Promise.all([stdoutP, stderrP, waitP])

    expect(result.finishReason).toBe("completed")
    expect(result.exitCode).toBe(0)
  })

  it("resolves with failed when no turn.completed is seen", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)

    const handle = codexAdapter.start(makeConfig())

    const waitP = handle.wait()
    const stdoutP = collectAsync(handle.stdout)
    const stderrP = collectAsync(handle.stderr)

    stdout.write('{"type":"thread.started"}\n')
    stdout.end()
    stderr.end()

    await new Promise((r) => setTimeout(r, 10))
    child.emit("close", 0)

    const [, , result] = await Promise.all([stdoutP, stderrP, waitP])

    expect(result.finishReason).toBe("failed")
    expect(result.exitCode).toBe(0)
  })

  it("resolves with cancelled when kill() is called", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)

    const originalKill = process.kill
    process.kill = vi.fn() as never

    try {
      const handle = codexAdapter.start(makeConfig())

      const waitP = handle.wait()
      const stdoutP = collectAsync(handle.stdout)
      const stderrP = collectAsync(handle.stderr)

      handle.kill()

      stdout.end()
      stderr.end()

      await new Promise((r) => setTimeout(r, 10))
      child.emit("close", 1)

      const [, , result] = await Promise.all([stdoutP, stderrP, waitP])

      expect(result.finishReason).toBe("cancelled")
      expect(result.exitCode).toBe(1)
    } finally {
      process.kill = originalKill
    }
  })

  it("routes JSONL error events to stderr iterable", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)

    const handle = codexAdapter.start(makeConfig())

    const waitP = handle.wait()
    const stdoutP = collectAsync(handle.stdout)
    const stderrP = collectAsync(handle.stderr)

    stdout.write('{"type":"error","message":"something broke"}\n')
    stdout.end()
    stderr.end()

    await new Promise((r) => setTimeout(r, 10))
    child.emit("close", 1)

    const [, stderrLines] = await Promise.all([stdoutP, stderrP, waitP])

    expect(stderrLines).toContain("something broke")
  })

  it("formats agent_message events as plain text", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)

    const handle = codexAdapter.start(makeConfig())

    const waitP = handle.wait()
    const stdoutP = collectAsync(handle.stdout)
    const stderrP = collectAsync(handle.stderr)

    stdout.write('{"type":"item.completed","item":{"id":"1","type":"agent_message","text":"hello world"}}\n')
    stdout.end()
    stderr.end()

    await new Promise((r) => setTimeout(r, 10))
    child.emit("close", 0)

    const [stdoutLines] = await Promise.all([stdoutP, stderrP, waitP])

    expect(stdoutLines).toContain("hello world")
  })

  it("formats command_execution events with $ prefix", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)

    const handle = codexAdapter.start(makeConfig())

    const waitP = handle.wait()
    const stdoutP = collectAsync(handle.stdout)
    const stderrP = collectAsync(handle.stderr)

    stdout.write('{"type":"item.completed","item":{"id":"2","type":"command_execution","command":"ls","aggregated_output":"file.txt"}}\n')
    stdout.end()
    stderr.end()

    await new Promise((r) => setTimeout(r, 10))
    child.emit("close", 0)

    const [stdoutLines] = await Promise.all([stdoutP, stderrP, waitP])

    expect(stdoutLines).toContain("$ ls\nfile.txt")
  })

  it("formats file_change events with file: prefix", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)

    const handle = codexAdapter.start(makeConfig())

    const waitP = handle.wait()
    const stdoutP = collectAsync(handle.stdout)
    const stderrP = collectAsync(handle.stderr)

    stdout.write('{"type":"item.completed","item":{"id":"3","type":"file_change","changes":[{"kind":"modified","path":"src/foo.ts"}]}}\n')
    stdout.end()
    stderr.end()

    await new Promise((r) => setTimeout(r, 10))
    child.emit("close", 0)

    const [stdoutLines] = await Promise.all([stdoutP, stderrP, waitP])

    expect(stdoutLines).toContain("file: modified src/foo.ts")
  })

  it("resolves with failed when post-run commit throws", async () => {
    const { child, stdout, stderr } = createFakeChild()
    mockSpawn.mockReturnValue(child as never)

    // Mock git operations for commitWorktreeChanges
    mockExecFileSync.mockImplementation((_cmd, args) => {
      const argList = args as string[]
      if (argList.includes("status")) return " M src/foo.ts\n" as never
      if (argList.includes("add")) return "" as never
      if (argList.includes("commit")) throw new Error("commit failed: lock")
      return "" as never
    })

    const handle = codexAdapter.start(makeConfig())

    const waitP = handle.wait()
    const stdoutP = collectAsync(handle.stdout)
    const stderrP = collectAsync(handle.stderr)

    stdout.write('{"type":"turn.completed"}\n')
    stdout.end()
    stderr.end()

    await new Promise((r) => setTimeout(r, 10))
    child.emit("close", 0)

    const [, , result] = await Promise.all([stdoutP, stderrP, waitP])

    expect(result.finishReason).toBe("failed")
    expect(result.errorMessage).toContain("post-run commit failed")
  })
})
