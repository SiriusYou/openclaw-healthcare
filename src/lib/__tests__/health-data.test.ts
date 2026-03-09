import { describe, it, expect } from "vitest"
import { getHealthData, deriveChatSummary } from "../health-data"

describe("getHealthData", () => {
  it("returns health data with all required fields", async () => {
    const data = await getHealthData()

    expect(data.stats).toBeDefined()
    expect(data.stats.length).toBeGreaterThan(0)
    expect(data.heartRate).toBeDefined()
    expect(data.heartRate.length).toBeGreaterThan(0)
    expect(data.weight).toBeDefined()
    expect(data.weight.length).toBeGreaterThan(0)
    expect(data.bloodPressure).toBeDefined()
    expect(data.bloodPressure.length).toBeGreaterThan(0)
  })

  it("returns stats with correct shape", async () => {
    const data = await getHealthData()

    for (const stat of data.stats) {
      expect(stat).toHaveProperty("title")
      expect(stat).toHaveProperty("value")
      expect(stat).toHaveProperty("description")
      expect(stat).toHaveProperty("icon")
      expect(stat).toHaveProperty("trend")
    }
  })
})

describe("deriveChatSummary", () => {
  it("maps stats by icon key to chat summary", async () => {
    const data = await getHealthData()
    const summary = deriveChatSummary(data)

    expect(summary.steps).toBe("8,432")
    expect(summary.heartRate).toBe("72 bpm")
    expect(summary.sleep).toBe("7h 24m")
    expect(summary.weight).toBe("68.5 kg")
  })

  it("returns fallback value when icon key is missing", () => {
    const summary = deriveChatSummary({
      stats: [],
      heartRate: [],
      weight: [],
      bloodPressure: [],
    })

    expect(summary.steps).toBe("—")
    expect(summary.heartRate).toBe("—")
    expect(summary.sleep).toBe("—")
    expect(summary.weight).toBe("—")
  })
})
