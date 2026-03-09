import { render, within } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { DashboardStats } from "../dashboard-stats"
import type { HealthStat } from "@/lib/health-data"

const mockStats: readonly HealthStat[] = [
  {
    title: "Steps Today",
    value: "8,432",
    description: "Goal: 10,000",
    icon: "activity",
    trend: "+12% from yesterday",
  },
  {
    title: "Heart Rate",
    value: "72 bpm",
    description: "Resting average",
    icon: "heart",
    trend: "Normal range",
  },
  {
    title: "Sleep",
    value: "7h 24m",
    description: "Last night",
    icon: "moon",
    trend: "+30min from average",
  },
  {
    title: "Weight",
    value: "68.5 kg",
    description: "Updated today",
    icon: "weight",
    trend: "-0.3 kg this week",
  },
]

function renderStats(stats: readonly HealthStat[] = mockStats) {
  const result = render(<DashboardStats stats={stats} />)
  const view = within(result.container)
  return { ...result, view }
}

describe("DashboardStats", () => {
  it("renders all stat cards", () => {
    const { view } = renderStats()

    for (const stat of mockStats) {
      expect(view.getByText(stat.title)).toBeInTheDocument()
    }
  })

  it("displays stat values, descriptions, and trends", () => {
    const { view } = renderStats()

    for (const stat of mockStats) {
      expect(view.getByText(stat.value)).toBeInTheDocument()
      expect(view.getByText(stat.description)).toBeInTheDocument()
      expect(view.getByText(stat.trend)).toBeInTheDocument()
    }
  })

  it("renders empty grid when no stats provided", () => {
    const { container } = renderStats([])

    const cards = container.querySelectorAll("[class*='card']")
    expect(cards.length).toBe(0)
  })
})
