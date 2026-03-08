import { render, within } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { BloodPressureChart } from "../blood-pressure-chart"

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

function renderChart() {
  const result = render(<BloodPressureChart />)
  const view = within(result.container)
  return { ...result, view }
}

describe("BloodPressureChart", () => {
  it("renders the card with title and description", () => {
    const { view } = renderChart()

    expect(view.getByText("Blood Pressure Trend")).toBeInTheDocument()
    expect(
      view.getByText("Weekly blood pressure tracking (mmHg)")
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
