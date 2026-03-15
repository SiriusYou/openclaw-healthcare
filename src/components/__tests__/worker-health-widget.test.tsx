import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { WorkerHealthWidget } from "../worker-health-widget"

describe("WorkerHealthWidget", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("shows loading state initially", () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}), // never resolves
    )
    render(<WorkerHealthWidget />)
    expect(screen.getByText("...")).toBeDefined()
  })

  it("shows Online when worker is ready", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ready: true, pid: "1234", ageSeconds: 5 })),
    )
    render(<WorkerHealthWidget />)
    await waitFor(() => {
      expect(screen.getByText("Online")).toBeDefined()
    })
    expect(screen.getByText(/PID 1234/)).toBeDefined()
  })

  it("shows Offline when worker is not ready", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ready: false, error: "No heartbeat file" })),
    )
    render(<WorkerHealthWidget />)
    await waitFor(() => {
      expect(screen.getByText("Offline")).toBeDefined()
    })
    expect(screen.getByText("No heartbeat file")).toBeDefined()
  })

  it("shows Offline when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"))
    render(<WorkerHealthWidget />)
    await waitFor(() => {
      expect(screen.getByText("Offline")).toBeDefined()
    })
  })
})
