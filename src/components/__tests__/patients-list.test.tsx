import { render, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { PatientsList, mockPatients, type Patient } from "../patients-list"

function renderPatientsList(patients?: readonly Patient[]) {
  const props = patients !== undefined ? { patients } : {}
  const result = render(<PatientsList {...props} />)
  const view = within(result.container)
  return { ...result, view }
}

describe("PatientsList", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the card with title and description", () => {
    const { view } = renderPatientsList()

    expect(view.getByText("Patient Records")).toBeInTheDocument()
    expect(
      view.getByText("Manage and view patient information. Click a row to view details.")
    ).toBeInTheDocument()
  })

  it("renders table headers for all columns", () => {
    const { view } = renderPatientsList()

    const headers = ["ID", "Name", "Age", "Gender", "Diagnosis", "Admission Date"]
    for (const header of headers) {
      expect(view.getByText(header)).toBeInTheDocument()
    }
  })

  it("renders all 5 mock patients by default", () => {
    const { view } = renderPatientsList()

    for (const patient of mockPatients) {
      expect(view.getByText(patient.name)).toBeInTheDocument()
      expect(view.getByText(patient.id)).toBeInTheDocument()
      expect(view.getByText(patient.diagnosis)).toBeInTheDocument()
    }
  })

  it("renders correct patient data in each row", () => {
    const { view } = renderPatientsList()

    expect(view.getByText("Zhang Wei")).toBeInTheDocument()
    expect(view.getByText("45")).toBeInTheDocument()
    expect(view.getByText("Type 2 Diabetes")).toBeInTheDocument()
    expect(view.getByText("2026-02-15")).toBeInTheDocument()
  })

  it("shows empty state when no patients provided", () => {
    const { view } = renderPatientsList([])

    expect(view.getByText("No patients found.")).toBeInTheDocument()
    expect(view.queryByText("Zhang Wei")).not.toBeInTheDocument()
  })

  it("logs patient info to console on row click", async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    const { view } = renderPatientsList()

    const row = view.getByText("Zhang Wei").closest("tr")!
    await user.click(row)

    expect(consoleSpy).toHaveBeenCalledWith(
      "Navigate to patient detail: P001 - Zhang Wei"
    )
  })

  it("supports keyboard navigation with Enter key", async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    const { view } = renderPatientsList()

    const row = view.getByText("Li Na").closest("tr")!
    row.focus()
    await user.keyboard("{Enter}")

    expect(consoleSpy).toHaveBeenCalledWith(
      "Navigate to patient detail: P002 - Li Na"
    )
  })

  it("renders rows with button role for accessibility", () => {
    const { view } = renderPatientsList()

    const buttons = view.getAllByRole("button")
    expect(buttons.length).toBe(mockPatients.length)
  })

  it("accepts custom patient data via props", () => {
    const custom: Patient[] = [
      {
        id: "C001",
        name: "Test Patient",
        age: 30,
        gender: "Female",
        diagnosis: "Flu",
        admissionDate: "2026-03-07",
      },
    ]
    const { view } = renderPatientsList(custom)

    expect(view.getByText("Test Patient")).toBeInTheDocument()
    expect(view.getByText("Flu")).toBeInTheDocument()
    expect(view.queryByText("Zhang Wei")).not.toBeInTheDocument()
  })
})
