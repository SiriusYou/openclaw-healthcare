import { render, within, fireEvent, act, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { HealthChat } from "../health-chat"
import type { HealthChatSummary } from "@/lib/health-data"

const mockHealthData: HealthChatSummary = {
  steps: "8,432",
  heartRate: "72 bpm",
  sleep: "7h 24m",
  weight: "68.5 kg",
}

function renderChat(healthData: HealthChatSummary = mockHealthData) {
  const result = render(<HealthChat healthData={healthData} />)
  const view = within(result.container)
  return { ...result, view }
}

describe("HealthChat", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollTo = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("renders the chat card with title", () => {
    const { view } = renderChat()
    expect(view.getByText("Health Assistant")).toBeInTheDocument()
  })

  it("shows initial assistant greeting", () => {
    const { view } = renderChat()
    expect(view.getByText(/I'm your health assistant/)).toBeInTheDocument()
  })

  it("renders input field and send button", () => {
    const { view } = renderChat()
    expect(view.getByPlaceholderText("Ask about your health...")).toBeInTheDocument()
    expect(view.getByRole("button")).toBeInTheDocument()
  })

  it("adds user message on send", () => {
    const { view } = renderChat()
    const input = view.getByPlaceholderText("Ask about your health...")
    fireEvent.change(input, { target: { value: "How are my steps?" } })
    fireEvent.click(view.getByRole("button"))
    expect(view.getByText("How are my steps?")).toBeInTheDocument()
  })

  it("clears input after send", () => {
    const { view } = renderChat()
    const input = view.getByPlaceholderText("Ask about your health...") as HTMLInputElement
    fireEvent.change(input, { target: { value: "test" } })
    fireEvent.click(view.getByRole("button"))
    expect(input.value).toBe("")
  })

  it("sends message on Enter key", () => {
    const { view } = renderChat()
    const input = view.getByPlaceholderText("Ask about your health...")
    fireEvent.change(input, { target: { value: "Hello" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(view.getByText("Hello")).toBeInTheDocument()
  })

  it("does not send on Shift+Enter", () => {
    const { view } = renderChat()
    const input = view.getByPlaceholderText("Ask about your health...")
    fireEvent.change(input, { target: { value: "Hello" } })
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
    expect(view.queryByText("Hello")).not.toBeInTheDocument()
  })

  it("does not send empty message", () => {
    const { view } = renderChat()
    const button = view.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("streams assistant response after user sends message", () => {
    const { view } = renderChat()
    const input = view.getByPlaceholderText("Ask about your health...")
    fireEvent.change(input, { target: { value: "steps" } })
    fireEvent.click(view.getByRole("button"))

    act(() => { vi.advanceTimersByTime(300) })
    act(() => { vi.advanceTimersByTime(5000) })

    const messages = view.getAllByText(/.+/)
    expect(messages.length).toBeGreaterThan(2)
  })

  it("disables input while streaming", () => {
    const { view } = renderChat()
    const input = view.getByPlaceholderText("Ask about your health...") as HTMLInputElement
    fireEvent.change(input, { target: { value: "steps" } })
    fireEvent.click(view.getByRole("button"))

    act(() => { vi.advanceTimersByTime(300) })
    act(() => { vi.advanceTimersByTime(15) })

    expect(input).toBeDisabled()
  })
})
