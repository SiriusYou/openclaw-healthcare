import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { DashboardSidebar } from "../dashboard-sidebar"

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}))

import { usePathname } from "next/navigation"

const mockUsePathname = vi.mocked(usePathname)

function renderSidebar(pathname = "/dashboard") {
  mockUsePathname.mockReturnValue(pathname)
  return render(<DashboardSidebar />)
}

describe("DashboardSidebar", () => {
  it("renders all navigation items", () => {
    renderSidebar()

    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Patients")).toBeInTheDocument()
    expect(screen.getByText("Heart Rate")).toBeInTheDocument()
    expect(screen.getByText("Activity")).toBeInTheDocument()
    expect(screen.getByText("Sleep")).toBeInTheDocument()
    expect(screen.getByText("Weight")).toBeInTheDocument()
    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("highlights the active link based on pathname", () => {
    renderSidebar("/dashboard/patients")

    const patientsLinks = screen.getAllByText("Patients")
    const activeLink = patientsLinks.find((el) =>
      el.closest("a")?.className.includes("bg-primary")
    )
    expect(activeLink).toBeTruthy()
  })

  it("renders correct hrefs for all nav items", () => {
    renderSidebar()

    const expectedRoutes = [
      "/dashboard",
      "/dashboard/patients",
      "/dashboard/heart-rate",
      "/dashboard/activity",
      "/dashboard/sleep",
      "/dashboard/weight",
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
    expect(screen.getAllByText("Healthcare").length).toBeGreaterThan(0)
  })

  it("renders mobile menu trigger button", () => {
    renderSidebar()

    const buttons = screen.getAllByLabelText("Open menu")
    expect(buttons.length).toBeGreaterThan(0)
  })
})
