// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventEmitter } from "node:events"
import { Readable } from "node:stream"

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>()
  return { ...actual, spawn: vi.fn() }
})

import { spawn } from "node:child_process"
import { fakeAdapter } from "../fake-adapter"

const mockSpawn = vi.mocked(spawn)

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
  prompt: "test",
  attempt: 1,
}

describe("fake adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("has kind 'fake' and usesTmux false", () => {
    expect(fakeAdapter.kind).toBe("fake")
    expect(fakeAdapter.usesTmux).toBe(false)
  })

  it("start() spawns a detached node process", () => {
    const child = createMockChild(1234)
    mockSpawn.mockReturnValue(child as never)

    const handle = fakeAdapter.start(baseConfig)

    expect(mockSpawn).toHaveBeenCalledWith(
      "node",
      ["-e", expect.stringContaining("[fake]")],
      { detached: true, stdio: ["ignore", "pipe", "pipe"] },
    )
    expect(handle.pid).toBe(1234)
    expect(child.unref).toHaveBeenCalled()
  })

  it("handle.wait() resolves with completed on exit code 0", async () => {
    const child = createMockChild(1234)
    mockSpawn.mockReturnValue(child as never)

    const handle = fakeAdapter.start(baseConfig)
    const waitPromise = handle.wait()
    child.emit("close", 0)
    const result = await waitPromise

    expect(result.exitCode).toBe(0)
    expect(result.finishReason).toBe("completed")
    expect(result.finishedAt).toBeInstanceOf(Date)
  })

  it("handle.wait() resolves with failed on non-zero exit code", async () => {
    const child = createMockChild(1234)
    mockSpawn.mockReturnValue(child as never)

    const handle = fakeAdapter.start(baseConfig)
    const waitPromise = handle.wait()
    child.emit("close", 1)
    const result = await waitPromise

    expect(result.exitCode).toBe(1)
    expect(result.finishReason).toBe("failed")
  })

  it("handle.wait() treats null exit code as 1", async () => {
    const child = createMockChild(1234)
    mockSpawn.mockReturnValue(child as never)

    const handle = fakeAdapter.start(baseConfig)
    const waitPromise = handle.wait()
    child.emit("close", null)
    const result = await waitPromise

    expect(result.exitCode).toBe(1)
    expect(result.finishReason).toBe("failed")
  })

  it("handle.kill() sends SIGTERM to process group", () => {
    const child = createMockChild(1234)
    mockSpawn.mockReturnValue(child as never)

    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true)
    const handle = fakeAdapter.start(baseConfig)
    handle.kill()

    expect(killSpy).toHaveBeenCalledWith(-1234, "SIGTERM")
    killSpy.mockRestore()
  })

  it("handle.kill() swallows errors for dead processes", () => {
    const child = createMockChild(1234)
    mockSpawn.mockReturnValue(child as never)

    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("ESRCH")
    })
    const handle = fakeAdapter.start(baseConfig)

    expect(() => handle.kill()).not.toThrow()
    killSpy.mockRestore()
  })

  it("start() injects config values into the script", () => {
    const child = createMockChild(1234)
    mockSpawn.mockReturnValue(child as never)

    fakeAdapter.start({
      taskId: "my-task",
      runId: "my-run",
      worktreePath: "/my/path",
      prompt: "test",
      attempt: 3,
    })

    const script = mockSpawn.mock.calls[0][1]![1] as string
    expect(script).toContain('"my-task"')
    expect(script).toContain('"my-run"')
    expect(script).toContain('"/my/path"')
    expect(script).toContain("3")
  })
})
