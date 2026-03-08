import { render, within, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { DashboardStats } from "../dashboard-stats"
import { mockHealthData } from "@/lib/health-data"

function mockFetchSuccess() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(mockHealthData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  )
}

function mockFetchError(status: number) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  )
}

function renderStats() {
  const result = render(<DashboardStats />)
  const view = within(result.container)
  return { ...result, view }
}

describe("DashboardStats", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("shows loading skeletons initially", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}))

    const { container } = renderStats()

    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders all stat cards after fetch", async () => {
    mockFetchSuccess()

    const { view } = renderStats()

    await waitFor(() => {
      expect(view.getByText("Steps Today")).toBeInTheDocument()
    })

    expect(view.getByText("Heart Rate")).toBeInTheDocument()
    expect(view.getByText("Sleep")).toBeInTheDocument()
    expect(view.getByText("Weight")).toBeInTheDocument()
  })

  it("displays stat values and trends", async () => {
    mockFetchSuccess()

    const { view } = renderStats()

    await waitFor(() => {
      expect(view.getByText("8,432")).toBeInTheDocument()
    })

    expect(view.getByText("72 bpm")).toBeInTheDocument()
    expect(view.getByText("7h 24m")).toBeInTheDocument()
    expect(view.getByText("68.5 kg")).toBeInTheDocument()
    expect(view.getByText("+12% from yesterday")).toBeInTheDocument()
  })

  it("shows error state on fetch failure", async () => {
    mockFetchError(401)

    const { view } = renderStats()

    await waitFor(() => {
      expect(
        view.getByText(/Failed to load health stats/)
      ).toBeInTheDocument()
    })
  })

  it("shows error state on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"))

    const { view } = renderStats()

    await waitFor(() => {
      expect(view.getByText(/Network error/)).toBeInTheDocument()
    })
  })

  it("fetches from /api/health-data", async () => {
    mockFetchSuccess()

    const { view } = renderStats()

    await waitFor(() => {
      expect(view.getByText("Steps Today")).toBeInTheDocument()
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/health-data")
  })
})
