import type { AgentAdapter, RunResult } from "./types"

export const claudeAdapter: AgentAdapter = {
  kind: "claude",
  usesTmux: true,

  async run(): Promise<RunResult> {
    throw new Error("Claude adapter not implemented — run spike first (scripts/spike-claude-cli.sh)")
  },
}
