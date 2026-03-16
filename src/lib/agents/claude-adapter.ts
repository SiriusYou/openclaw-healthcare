import { spawn, execFileSync } from "node:child_process"
import type { AgentAdapter, AgentHandle, AgentResult, RunConfig } from "./types"

/**
 * Parse a stream-json line from `claude -p --output-format stream-json`.
 * Returns a typed event or null if the line is not valid JSON.
 */
interface ClaudeStreamEvent {
  type: string
  subtype?: string
  content_block?: {
    type: string
    text?: string
  }
  result?: {
    type: string
    subtype?: string
    cost_usd?: number
    duration_ms?: number
    duration_api_ms?: number
    is_error?: boolean
    num_turns?: number
    session_id?: string
  }
}

function parseClaudeEvent(line: string): ClaudeStreamEvent | null {
  try {
    return JSON.parse(line) as ClaudeStreamEvent
  } catch {
    return null
  }
}

/**
 * Stream stdout from Claude CLI in stream-json mode.
 * Yields human-readable output lines extracted from content blocks.
 */
async function* parseClaudeStream(
  readable: NodeJS.ReadableStream | null,
  state: { sawResult: boolean; isError: boolean },
): AsyncIterable<string> {
  if (!readable) return
  let buffer = ""
  for await (const chunk of readable) {
    buffer += String(chunk)
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      const event = parseClaudeEvent(line)
      if (!event) {
        yield line
        continue
      }
      if (event.type === "result") {
        state.sawResult = true
        state.isError = event.result?.is_error === true
        continue
      }
      if (event.type === "content_block_delta" || event.type === "content_block_start") {
        const text = event.content_block?.text
        if (text) yield text
      }
    }
  }
  if (buffer.trim()) {
    const event = parseClaudeEvent(buffer)
    if (event) {
      if (event.type === "result") {
        state.sawResult = true
        state.isError = event.result?.is_error === true
      } else if (event.content_block?.text) {
        yield event.content_block.text
      }
    } else {
      yield buffer
    }
  }
}

/**
 * Stream stderr lines as plain text.
 */
async function* streamLines(
  readable: NodeJS.ReadableStream | null,
): AsyncIterable<string> {
  if (!readable) return
  let buffer = ""
  for await (const chunk of readable) {
    buffer += String(chunk)
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      yield line
    }
  }
  if (buffer) yield buffer
}

/**
 * After a Claude run, ensure changes are committed.
 * Claude Code may auto-commit via its tools, but we check and commit
 * any remaining uncommitted changes to be safe.
 */
type CommitResult =
  | { status: "committed"; sha: string }
  | { status: "no_changes"; sha: string | undefined }
  | { status: "error"; message: string }

function ensureCommitted(worktreePath: string, taskId: string): CommitResult {
  try {
    const dirty = execFileSync("git", ["-C", worktreePath, "status", "--porcelain"], {
      encoding: "utf-8",
    }).trim()

    if (dirty) {
      execFileSync("git", ["-C", worktreePath, "add", "-A"], { stdio: "pipe" })
      execFileSync(
        "git",
        ["-C", worktreePath, "commit", "-m", `agent: ${taskId}`],
        { stdio: "pipe" },
      )
    }

    const sha = execFileSync("git", ["-C", worktreePath, "rev-parse", "HEAD"], {
      encoding: "utf-8",
    }).trim()

    // Check if HEAD differs from the base (any commits were made)
    return { status: dirty ? "committed" : "no_changes", sha }
  } catch (err) {
    return { status: "error", message: String(err) }
  }
}

export const claudeAdapter: AgentAdapter = {
  kind: "claude",
  usesTmux: false,

  start(config: RunConfig): AgentHandle {
    const child = spawn(
      "claude",
      [
        "-p",
        "--dangerously-skip-permissions",
        "--output-format", "stream-json",
        "--no-session-persistence",
        config.prompt,
      ],
      {
        cwd: config.worktreePath,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )

    child.unref()

    let cancelled = false
    const state = { sawResult: false, isError: false }

    return {
      pid: child.pid!,
      stdout: parseClaudeStream(child.stdout, state),
      stderr: streamLines(child.stderr),

      wait(): Promise<AgentResult> {
        return new Promise((resolve) => {
          child.on("close", (code) => {
            let finishReason: AgentResult["finishReason"]
            let exitCode: number
            let commitSha: string | undefined
            let errorMessage: string | undefined

            if (cancelled) {
              finishReason = "cancelled"
              exitCode = 1
            } else if (code === 0 && !state.isError) {
              const commitResult = ensureCommitted(config.worktreePath, config.taskId)
              if (commitResult.status === "error") {
                finishReason = "failed"
                exitCode = 1
                errorMessage = `post-run commit failed: ${commitResult.message}`
              } else {
                finishReason = "completed"
                exitCode = 0
                commitSha = commitResult.sha
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
              errorMessage,
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
