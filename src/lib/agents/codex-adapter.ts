import { spawn } from "node:child_process"
import { execFileSync } from "node:child_process"
import type { AgentAdapter, AgentHandle, AgentResult, RunConfig } from "./types"

/**
 * Parse a JSONL line from `codex exec --json` stdout.
 * Returns a typed event or null if the line is not valid JSON.
 */
interface CodexEvent {
  type: string
  message?: string
  item?: {
    id: string
    type: string
    text?: string
    command?: string
    aggregated_output?: string
    exit_code?: number
    status?: string
    changes?: Array<{ path: string; kind: string }>
  }
  usage?: {
    input_tokens: number
    cached_input_tokens: number
    output_tokens: number
  }
}

function parseCodexEvent(line: string): CodexEvent | null {
  try {
    return JSON.parse(line) as CodexEvent
  } catch {
    return null
  }
}

/**
 * Format a CodexEvent into a human-readable output line for the events table.
 * Returns null for events that should be skipped (thread.started, turn.started, reasoning).
 */
function formatEventLine(event: CodexEvent): string | null {
  if (event.type === "item.completed" && event.item) {
    switch (event.item.type) {
      case "agent_message":
        return event.item.text ?? null
      case "command_execution":
        return `$ ${event.item.command ?? ""}\n${event.item.aggregated_output ?? ""}`.trim()
      case "file_change": {
        const changes = event.item.changes ?? []
        const summary = changes.map((c) => `${c.kind} ${c.path}`).join("\n")
        return `file: ${summary}`
      }
    }
  }

  // Skip: thread.started, turn.started, turn.completed, item.started, reasoning
  return null
}

/**
 * Stream JSONL lines from codex stdout, yielding formatted output lines.
 * Tracks whether turn.completed was seen (signals success).
 * Error events are pushed to errorQueue for the stderr iterable to drain.
 */
async function* parseCodexStream(
  readable: NodeJS.ReadableStream | null,
  state: { sawTurnCompleted: boolean },
  errorQueue: string[],
): AsyncIterable<string> {
  if (!readable) return
  let buffer = ""
  for await (const chunk of readable) {
    buffer += String(chunk)
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      const event = parseCodexEvent(line)
      if (!event) {
        yield line // raw non-JSON output
        continue
      }
      if (event.type === "turn.completed") {
        state.sawTurnCompleted = true
        continue
      }
      if (event.type === "error") {
        errorQueue.push(event.message ?? "unknown error")
        continue
      }
      const formatted = formatEventLine(event)
      if (formatted) {
        yield formatted
      }
    }
  }
  if (buffer.trim()) {
    const event = parseCodexEvent(buffer)
    if (event) {
      if (event.type === "turn.completed") {
        state.sawTurnCompleted = true
      } else if (event.type === "error") {
        errorQueue.push(event.message ?? "unknown error")
      } else {
        const formatted = formatEventLine(event)
        if (formatted) yield formatted
      }
    } else {
      yield buffer
    }
  }
}

/**
 * Stream stderr lines from child.stderr + JSONL error events from errorQueue.
 * Error events from the JSONL stdout parser are routed here to preserve
 * the correct stream classification per the Step 1 contract.
 */
async function* streamStderr(
  readable: NodeJS.ReadableStream | null,
  errorQueue: string[],
): AsyncIterable<string> {
  // Drain any errors that arrived before we started consuming
  while (errorQueue.length > 0) {
    yield errorQueue.shift()!
  }

  if (readable) {
    let buffer = ""
    for await (const chunk of readable) {
      // Drain error queue on each iteration (errors arrive concurrently)
      while (errorQueue.length > 0) {
        yield errorQueue.shift()!
      }
      buffer += String(chunk)
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        yield line
      }
    }
    if (buffer) yield buffer
  }

  // Final drain after stderr closes
  while (errorQueue.length > 0) {
    yield errorQueue.shift()!
  }
}

/**
 * After a successful Codex run, commit any uncommitted changes in the worktree.
 * Codex uses internal `apply_patch` and does NOT auto-commit.
 */
type CommitResult =
  | { status: "committed"; sha: string }
  | { status: "no_changes" }
  | { status: "error"; message: string }

function commitWorktreeChanges(worktreePath: string, taskId: string): CommitResult {
  try {
    const dirty = execFileSync("git", ["-C", worktreePath, "status", "--porcelain"], {
      encoding: "utf-8",
    }).trim()
    if (!dirty) return { status: "no_changes" }

    execFileSync("git", ["-C", worktreePath, "add", "-A"], { stdio: "pipe" })
    execFileSync(
      "git",
      ["-C", worktreePath, "commit", "-m", `agent: ${taskId}`],
      { stdio: "pipe" },
    )

    const sha = execFileSync("git", ["-C", worktreePath, "rev-parse", "HEAD"], {
      encoding: "utf-8",
    }).trim()
    return { status: "committed", sha }
  } catch (err) {
    return { status: "error", message: String(err) }
  }
}

export const codexAdapter: AgentAdapter = {
  kind: "codex",
  usesTmux: false,

  start(config: RunConfig): AgentHandle {
    const child = spawn(
      "codex",
      [
        "exec",
        "--full-auto",
        "--json",
        "-c", 'model_reasoning_effort="high"',
        "-c", "mcp_servers={}",
        "-C", config.worktreePath,
        config.prompt,
      ],
      {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )

    child.unref()

    let cancelled = false
    const state = { sawTurnCompleted: false }
    const errorQueue: string[] = []

    // Eagerly scan for turn.completed via raw data listener.
    // This fires synchronously on data arrival, independent of the async
    // generator's consumer pace. By the time `close` fires, all `data`
    // events have already fired, so `sawTurnCompleted` is reliable.
    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes('"type":"turn.completed"')) {
        state.sawTurnCompleted = true
      }
    })

    return {
      pid: child.pid!,
      stdout: parseCodexStream(child.stdout, state, errorQueue),
      stderr: streamStderr(child.stderr, errorQueue),

      wait(): Promise<AgentResult> {
        return new Promise((resolve) => {
          child.on("close", (code) => {
            let finishReason: AgentResult["finishReason"]
            let exitCode: number
            let commitSha: string | undefined

            if (cancelled) {
              finishReason = "cancelled"
              exitCode = 1
            } else if (state.sawTurnCompleted) {
              // Codex doesn't auto-commit — commit worktree changes now
              const commitResult = commitWorktreeChanges(config.worktreePath, config.taskId)
              if (commitResult.status === "committed") {
                finishReason = "completed"
                exitCode = 0
                commitSha = commitResult.sha
              } else if (commitResult.status === "no_changes") {
                // Agent completed but made no file changes — still a success
                finishReason = "completed"
                exitCode = 0
              } else {
                // Commit failed — treat as failure to prevent stale SHA approval
                finishReason = "failed"
                exitCode = 1
              }
            } else {
              finishReason = "failed"
              exitCode = code ?? 1
            }

            resolve({
              exitCode,
              finishedAt: new Date(),
              finishReason,
              commitSha,
            })
          })
        })
      },

      kill(): void {
        cancelled = true
        try {
          process.kill(-child.pid!, "SIGTERM")
        } catch {
          // Process may already be dead
        }
      },
    }
  },
}
