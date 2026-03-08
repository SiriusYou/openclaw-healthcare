import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "../route"
import { mockHealthData } from "@/lib/health-data"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { auth } from "@/lib/auth"

const mockAuth = vi.mocked(auth)

describe("GET /api/health-data", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 401 when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null, expires: "" } as never)

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it("returns health data when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { name: "Test User", email: "test@example.com" },
      expires: "2026-12-31",
    } as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toEqual(mockHealthData.stats)
    expect(body.heartRate).toEqual(mockHealthData.heartRate)
    expect(body.weight).toEqual(mockHealthData.weight)
    expect(body.bloodPressure).toEqual(mockHealthData.bloodPressure)
  })

  it("returns all 4 stat cards", async () => {
    mockAuth.mockResolvedValue({
      user: { name: "Test User" },
      expires: "2026-12-31",
    } as never)

    const response = await GET()
    const body = await response.json()

    expect(body.stats).toHaveLength(4)
    const titles = body.stats.map((s: { title: string }) => s.title)
    expect(titles).toContain("Steps Today")
    expect(titles).toContain("Heart Rate")
    expect(titles).toContain("Sleep")
    expect(titles).toContain("Weight")
  })
})
