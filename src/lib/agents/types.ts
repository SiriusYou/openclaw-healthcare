export type AgentKind = "codex" | "claude" | "gemini" | "fake"

export interface RunConfig {
  readonly runId: string
  readonly taskId: string
  readonly worktreePath: string
  readonly branch: string
  readonly prompt: string
  readonly attempt: number
}

export interface AgentHandle {
  readonly pid: number
  readonly stdout: AsyncIterable<string>
  readonly stderr: AsyncIterable<string>
  wait(): Promise<AgentResult>
  kill(): void
}

export interface AgentResult {
  readonly exitCode: number
  readonly finishedAt: Date
  readonly finishReason: "completed" | "cancelled" | "failed" | "timeout"
  readonly commitSha?: string
  readonly errorMessage?: string
}

export interface AgentAdapter {
  readonly kind: AgentKind
  readonly usesTmux: boolean
  start(config: RunConfig): AgentHandle
}
