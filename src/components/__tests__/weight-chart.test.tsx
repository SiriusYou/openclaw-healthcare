import { render, within } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { WeightChart } from "../weight-chart"
import type { WeightPoint } from "@/lib/health-data"

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

const mockData: readonly WeightPoint[] = [
  { date: "Mon", kg: 69.2 },
  { date: "Tue", kg: 69.0 },
  { date: "Wed", kg: 68.8 },
]

function renderChart(data: readonly WeightPoint[] = mockData) {
  const result = render(<WeightChart data={data} />)
  const view = within(result.container)
  return { ...result, view }
}

describe("WeightChart", () => {
  it("renders the card with title and description", () => {
    const { view } = renderChart()

    expect(view.getByText("Weight Trend")).toBeInTheDocument()
    expect(
      view.getByText("Weekly weight tracking (kg)")
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
