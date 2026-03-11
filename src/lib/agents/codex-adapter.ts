import type { AgentAdapter, RunResult } from "./types"

export const codexAdapter: AgentAdapter = {
  kind: "codex",
  usesTmux: true,

  async run(): Promise<RunResult> {
    throw new Error("Codex adapter not implemented — run spike first (scripts/spike-codex-cli.sh)")
  },
}
