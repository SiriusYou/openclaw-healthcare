import { render, within } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { HeartRateChart } from "../heart-rate-chart"
import type { HeartRatePoint } from "@/lib/health-data"

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

const mockData: readonly HeartRatePoint[] = [
  { time: "00:00", bpm: 62 },
  { time: "06:00", bpm: 60 },
  { time: "12:00", bpm: 90 },
  { time: "18:00", bpm: 76 },
]

function renderChart(data: readonly HeartRatePoint[] = mockData) {
  const result = render(<HeartRateChart data={data} />)
  const view = within(result.container)
  return { ...result, view }
}

describe("HeartRateChart", () => {
  it("renders the card with title and description", () => {
    const { view } = renderChart()

    expect(view.getByText("Heart Rate Trend")).toBeInTheDocument()
    expect(
      view.getByText("24-hour heart rate monitoring (bpm)")
    ).toBeInTheDocument()
  })

  it("renders the chart inside a responsive container", () => {
    const { view } = renderChart()

    const container = view.getByTestId("responsive-container")
    expect(container).toBeInTheDocument()
    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument()
  })

  it("renders within a fixed-height container for consistent layout", () => {
    const { view } = renderChart()

    const chartWrapper = view.getByTestId("responsive-container").parentElement
    expect(chartWrapper).toHaveClass("h-[300px]")
  })
})
