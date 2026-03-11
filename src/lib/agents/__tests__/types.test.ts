import { describe, it, expect } from "vitest"
import { fakeAdapter } from "../fake-adapter"

describe("fakeAdapter", () => {
  it("has kind 'fake'", () => {
    expect(fakeAdapter.kind).toBe("fake")
  })

  it("does not use tmux", () => {
    expect(fakeAdapter.usesTmux).toBe(false)
  })
})
