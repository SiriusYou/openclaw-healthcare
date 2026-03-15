import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react"
import { DiffPreview } from "../diff-preview"

describe("DiffPreview", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows loading state initially", () => {
    vi.spyOn(global, "fetch").mockImplementation(() => new Promise(() => {}))
    render(<DiffPreview runId="r1" />)
    expect(screen.getByText("Loading diff...")).toBeDefined()
  })

  it("shows diff stat when loaded", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        stat: " src/foo.ts | 5 ++---\n 1 file changed",
        diff: "diff --git a/src/foo.ts b/src/foo.ts",
        baseCommitSha: "abc",
        headCommitSha: "def",
      })),
    )
    render(<DiffPreview runId="r1" />)
    await waitFor(() => {
      expect(screen.getByText(/src\/foo.ts/)).toBeDefined()
    })
  })

  it("shows error message on API failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "No commit data" }), { status: 400 }),
    )
    render(<DiffPreview runId="r1" />)
    await waitFor(() => {
      expect(screen.getByText("No commit data")).toBeDefined()
    })
  })

  it("shows error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network"))
    render(<DiffPreview runId="r1" />)
    await waitFor(() => {
      expect(screen.getByText("Failed to load diff")).toBeDefined()
    })
  })

  it("toggles full diff on click", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        stat: "1 file changed",
        diff: "+const x = 1",
        baseCommitSha: "abc",
        headCommitSha: "def",
      })),
    )
    render(<DiffPreview runId="r1" />)
    await waitFor(() => {
      expect(screen.getByText("Show full diff")).toBeDefined()
    })
    fireEvent.click(screen.getByText("Show full diff"))
    expect(screen.getByText("+const x = 1")).toBeDefined()
    expect(screen.getByText("Hide full diff")).toBeDefined()
  })
})
