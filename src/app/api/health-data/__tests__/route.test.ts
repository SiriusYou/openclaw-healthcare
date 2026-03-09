import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "../route"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/health-data", () => ({
  getHealthData: vi.fn(),
}))

import { auth } from "@/lib/auth"
import { getHealthData } from "@/lib/health-data"

const mockAuth = vi.mocked(auth)
const mockGetHealthData = vi.mocked(getHealthData)

const fakeHealthData = {
  stats: [{ title: "Steps", value: "8,432", description: "Goal", icon: "activity" as const, trend: "+12%" }],
  heartRate: [{ time: "00:00", bpm: 62 }],
  weight: [{ date: "Mon", kg: 69.2 }],
  bloodPressure: [{ date: "Mon", systolic: 118, diastolic: 78 }],
}

describe("GET /api/health-data", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockGetHealthData.mockResolvedValue(fakeHealthData)
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
    expect(body.stats).toEqual(fakeHealthData.stats)
    expect(body.heartRate).toEqual(fakeHealthData.heartRate)
  })

  it("calls getHealthData when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { name: "Test User", email: "test@example.com" },
      expires: "2026-12-31",
    } as never)

    await GET()

    expect(mockGetHealthData).toHaveBeenCalled()
  })
})
