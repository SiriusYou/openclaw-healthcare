import { writeFileSync } from "node:fs"
import { join } from "node:path"
import type { AgentAdapter, RunConfig, RunResult } from "./types"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const fakeAdapter: AgentAdapter = {
  kind: "fake",
  usesTmux: false,

  async run(config: RunConfig): Promise<RunResult> {
    await delay(3000)
    writeFileSync(
      join(config.worktreePath, "hello.txt"),
      `hello from fake adapter\ntask: ${config.taskId}\nrun: ${config.runId}\nattempt: ${config.attempt}\n`
    )
    return { exitCode: 0, output: "fake adapter completed" }
  },
}
