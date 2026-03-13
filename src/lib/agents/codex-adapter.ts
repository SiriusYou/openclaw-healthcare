import type { AgentAdapter, AgentHandle } from "./types"

export const codexAdapter: AgentAdapter = {
  kind: "codex",
  usesTmux: false,

  start(): AgentHandle {
    throw new Error("Codex adapter not implemented — run spike first (scripts/spike-codex-cli.sh)")
  },
}
