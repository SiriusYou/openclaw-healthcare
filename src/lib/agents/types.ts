export type AgentKind = "codex" | "claude" | "gemini" | "fake"

export interface RunConfig {
  readonly runId: string
  readonly taskId: string
  readonly worktreePath: string
  readonly branch: string
  readonly prompt: string
  readonly attempt: number
}

export interface RunResult {
  readonly exitCode: number
  readonly output?: string
}

export interface AgentAdapter {
  readonly kind: AgentKind
  readonly usesTmux: boolean
  run(config: RunConfig): Promise<RunResult>
}
