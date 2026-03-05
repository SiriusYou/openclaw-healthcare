import { render, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { LoginForm } from "../login-form"

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockSignIn = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

function renderLoginForm() {
  const result = render(<LoginForm />)
  const view = within(result.container)
  const emailInput = () => view.getByPlaceholderText("admin@openclaw.com")
  const passwordInput = () => view.getByPlaceholderText("Enter your password")
  const submitButton = () => view.getByRole("button")
  return { ...result, view, emailInput, passwordInput, submitButton }
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the login form with title, inputs, and button", () => {
    const { view, emailInput, passwordInput, submitButton } = renderLoginForm()

    expect(view.getByText("OpenClaw Healthcare")).toBeInTheDocument()
    expect(view.getByText("Sign in to your account")).toBeInTheDocument()
    expect(emailInput()).toBeInTheDocument()
    expect(passwordInput()).toBeInTheDocument()
    expect(submitButton()).toHaveTextContent("Sign in")
    expect(view.getByText(/Demo:/)).toBeInTheDocument()
  })

  it("has correct input types and placeholders", () => {
    const { emailInput, passwordInput } = renderLoginForm()

    expect(emailInput()).toHaveAttribute("type", "email")
    expect(emailInput()).toHaveAttribute("name", "email")

    expect(passwordInput()).toHaveAttribute("type", "password")
    expect(passwordInput()).toHaveAttribute("name", "password")
  })

  it("has labels for email and password fields", () => {
    const { view } = renderLoginForm()

    const emailLabel = view.getByText("Email")
    expect(emailLabel.tagName).toBe("LABEL")
    expect(emailLabel).toHaveAttribute("for", "email")

    const passwordLabel = view.getByText("Password")
    expect(passwordLabel.tagName).toBe("LABEL")
    expect(passwordLabel).toHaveAttribute("for", "password")
  })

  it("submits the form and redirects on success", async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ error: null })

    const { emailInput, passwordInput, submitButton } = renderLoginForm()

    await user.type(emailInput(), "admin@openclaw.com")
    await user.type(passwordInput(), "admin123")
    await user.click(submitButton())

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "admin@openclaw.com",
        password: "admin123",
        redirect: false,
      })
    })
    expect(mockPush).toHaveBeenCalledWith("/dashboard")
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("shows error message when credentials are invalid", async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" })

    const { view, emailInput, passwordInput, submitButton } = renderLoginForm()

    await user.type(emailInput(), "wrong@email.com")
    await user.type(passwordInput(), "wrongpass")
    await user.click(submitButton())

    await waitFor(() => {
      expect(view.getByText("Invalid email or password")).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("shows generic error when signIn throws", async () => {
    const user = userEvent.setup()
    mockSignIn.mockRejectedValue(new Error("Network error"))

    const { view, emailInput, passwordInput, submitButton } = renderLoginForm()

    await user.type(emailInput(), "admin@openclaw.com")
    await user.type(passwordInput(), "admin123")
    await user.click(submitButton())

    await waitFor(() => {
      expect(
        view.getByText("Something went wrong. Please try again.")
      ).toBeInTheDocument()
    })
  })

  it("shows loading state while submitting", async () => {
    const user = userEvent.setup()
    let resolveSignIn: (value: unknown) => void
    mockSignIn.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve
      })
    )

    const { emailInput, passwordInput, submitButton } = renderLoginForm()

    await user.type(emailInput(), "admin@openclaw.com")
    await user.type(passwordInput(), "admin123")
    await user.click(submitButton())

    await waitFor(() => {
      const btn = submitButton()
      expect(btn).toBeDisabled()
      expect(btn).toHaveTextContent("Signing in...")
    })

    resolveSignIn!({ error: null })
  })

  it("clears previous error on new submission", async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValueOnce({ error: "CredentialsSignin" })
    mockSignIn.mockResolvedValueOnce({ error: null })

    const { view, emailInput, passwordInput, submitButton } = renderLoginForm()

    await user.type(emailInput(), "wrong@email.com")
    await user.type(passwordInput(), "wrongpass")
    await user.click(submitButton())

    await waitFor(() => {
      expect(view.getByText("Invalid email or password")).toBeInTheDocument()
    })

    await user.clear(emailInput())
    await user.type(emailInput(), "admin@openclaw.com")
    await user.clear(passwordInput())
    await user.type(passwordInput(), "admin123")
    await user.click(submitButton())

    await waitFor(() => {
      expect(view.queryByText("Invalid email or password")).not.toBeInTheDocument()
    })
  })
})
