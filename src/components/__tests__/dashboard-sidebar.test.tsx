import { render, screen, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { DashboardSidebar } from "../dashboard-sidebar"

const mockPathname = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}))

function renderSidebar(pathname = "/dashboard") {
  mockPathname.mockReturnValue(pathname)
  return render(<DashboardSidebar />)
}

describe("DashboardSidebar", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders all navigation items", () => {
    renderSidebar()

    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Inbox")).toBeInTheDocument()
    expect(screen.getByText("Runs")).toBeInTheDocument()
    expect(screen.getByText("Reviews")).toBeInTheDocument()
    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("highlights the active link based on pathname", () => {
    renderSidebar("/dashboard/inbox")

    const inboxLinks = screen.getAllByText("Inbox")
    const activeLink = inboxLinks.find((el) =>
      el.closest("a")?.className.includes("bg-primary")
    )
    expect(activeLink).toBeTruthy()
  })

  it("highlights parent nav on nested routes", () => {
    renderSidebar("/dashboard/runs/some-id")

    const runsLinks = screen.getAllByText("Runs")
    const runsActive = runsLinks.find((el) =>
      el.closest("a")?.className.includes("bg-primary")
    )
    expect(runsActive).toBeTruthy()

    const overviewLinks = screen.getAllByText("Overview")
    const overviewActive = overviewLinks.find((el) =>
      el.closest("a")?.className.includes("bg-primary")
    )
    expect(overviewActive).toBeFalsy()
  })

  it("renders correct hrefs for all nav items", () => {
    renderSidebar()

    const expectedRoutes = [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/runs",
      "/dashboard/reviews",
      "/dashboard/settings",
    ]

    for (const route of expectedRoutes) {
      const links = screen.getAllByRole("link").filter(
        (link) => link.getAttribute("href") === route
      )
      expect(links.length).toBeGreaterThan(0)
    }
  })

  it("renders branding text", () => {
    renderSidebar()

    expect(screen.getAllByText("OpenClaw").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Agent Swarm").length).toBeGreaterThan(0)
  })

  it("renders mobile menu trigger button", () => {
    renderSidebar()

    const buttons = screen.getAllByLabelText("Open menu")
    expect(buttons.length).toBeGreaterThan(0)
  })
})
