// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return { ...actual, readFileSync: vi.fn() }
})

import { readFileSync } from "node:fs"
import { GET } from "@/app/api/worker/health/route"

const mockReadFileSync = vi.mocked(readFileSync)

describe("Worker health API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns ready:true when heartbeat is fresh", async () => {
    const now = Math.floor(Date.now() / 1000)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ pid: "1234", timestamp: now - 5 }) as never,
    )

    const res = await GET()
    const data = await res.json()

    expect(data.ready).toBe(true)
    expect(data.pid).toBe("1234")
    expect(data.ageSeconds).toBeLessThanOrEqual(6)
  })

  it("returns ready:false when heartbeat is stale (>30s)", async () => {
    const now = Math.floor(Date.now() / 1000)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ pid: "1234", timestamp: now - 60 }) as never,
    )

    const res = await GET()
    const data = await res.json()

    expect(data.ready).toBe(false)
    expect(data.ageSeconds).toBeGreaterThan(30)
  })

  it("returns ready:false with error when no heartbeat file", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT")
    })

    const res = await GET()
    const data = await res.json()

    expect(data.ready).toBe(false)
    expect(data.error).toBe("No heartbeat file")
  })
})
