import { describe, it, expect } from "vitest"
import { MAX_AUTO_RETRIES, getHeartbeatPath } from "../constants"

describe("MAX_AUTO_RETRIES", () => {
  it("should be 2", () => {
    expect(MAX_AUTO_RETRIES).toBe(2)
  })
})

describe("getHeartbeatPath", () => {
  it("derives path from default DB URL", () => {
    expect(getHeartbeatPath("file:.data/openclaw.db")).toBe(
      ".data/openclaw-worker-heartbeat.json"
    )
  })

  it("derives path from E2E DB URL", () => {
    expect(getHeartbeatPath("file:.data/e2e.db")).toBe(
      ".data/e2e-worker-heartbeat.json"
    )
  })

  it("derives path from CI DB URL", () => {
    expect(getHeartbeatPath("file:.data/ci-test.db")).toBe(
      ".data/ci-test-worker-heartbeat.json"
    )
  })

  it("handles DB URL without file: prefix", () => {
    expect(getHeartbeatPath(".data/test.db")).toBe(
      ".data/test-worker-heartbeat.json"
    )
  })
})
