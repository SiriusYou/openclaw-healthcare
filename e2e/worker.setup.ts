import { test as setup, expect } from "@playwright/test"

setup("wait for worker readiness", async ({ request }) => {
  const maxWait = 30_000
  const interval = 1_000
  const start = Date.now()

  let ready = false
  while (Date.now() - start < maxWait) {
    try {
      const res = await request.get("/api/worker/health")
      if (res.ok()) {
        const body = await res.json()
        if (body.ready) {
          ready = true
          break
        }
      }
    } catch {
      // server may not be up yet
    }
    await new Promise((r) => setTimeout(r, interval))
  }

  expect(ready, "Worker should be ready within 30s").toBe(true)
})
