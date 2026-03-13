import type { AgentAdapter, AgentHandle } from "./types"

export const claudeAdapter: AgentAdapter = {
  kind: "claude",
  usesTmux: false,

  start(): AgentHandle {
    throw new Error("Claude adapter not implemented — run spike first (scripts/spike-claude-cli.sh)")
  },
}
