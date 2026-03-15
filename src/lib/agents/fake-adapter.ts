import { spawn } from "node:child_process"
import type { AgentAdapter, AgentHandle, AgentResult, RunConfig } from "./types"

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

export const fakeAdapter: AgentAdapter = {
  kind: "fake",
  usesTmux: false,

  start(config: RunConfig): AgentHandle {
    const script = `
      const fs = require("fs");
      const path = require("path");
      const { execFileSync } = require("child_process");
      const wt = ${JSON.stringify(config.worktreePath)};
      const taskId = ${JSON.stringify(config.taskId)};
      const runId = ${JSON.stringify(config.runId)};
      const attempt = ${JSON.stringify(config.attempt)};

      console.log("[fake] starting work in " + wt);

      // Simulate work delay
      setTimeout(() => {
        try {
          fs.writeFileSync(
            path.join(wt, "hello.txt"),
            "hello from fake adapter\\ntask: " + taskId + "\\nrun: " + runId + "\\nattempt: " + attempt + "\\n"
          );
          console.log("[fake] wrote hello.txt");

          // Stage and commit
          execFileSync("git", ["-C", wt, "add", "-A"], { stdio: "pipe" });
          execFileSync("git", ["-C", wt, "commit", "-m", "agent: " + taskId], { stdio: "pipe" });
          console.log("[fake] committed changes");
          process.exit(0);
        } catch (err) {
          console.error("[fake] error: " + err.message);
          process.exit(1);
        }
      }, 3000);
    `

    const child = spawn("node", ["-e", script], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    // Prevent worker from waiting on child if it exits
    child.unref()

    const handle: AgentHandle = {
      pid: child.pid!,
      stdout: streamLines(child.stdout),
      stderr: streamLines(child.stderr),

      wait(): Promise<AgentResult> {
        return new Promise((resolve) => {
          child.on("close", (code) => {
            const exitCode = code ?? 1
            resolve({
              exitCode,
              finishedAt: new Date(),
              finishReason: exitCode === 0 ? "completed" : "failed",
            })
          })
        })
      },

      kill(): void {
        try {
          process.kill(-child.pid!, "SIGTERM")
        } catch {
          // Process may already be dead
        }
      },
    }

    return handle
  },
}
