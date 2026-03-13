#!/bin/bash
# Codex CLI Contract Reference (Step 1 spike results, 2026-03-13)
# codex-cli v0.46.0, model gpt-5.4
#
# This file documents the verified calling convention for codex-adapter.ts.
# Do NOT run this file — it's a reference document.

###############################################################################
# 1. INVOCATION
###############################################################################
# Non-interactive entry point:
#   codex exec --full-auto --json -C <worktree-path> "<prompt>"
#
# Flags:
#   --full-auto      = -a on-failure --sandbox workspace-write (no human prompts)
#   --json           = JSONL events on stdout (required for reliable completion detection)
#   -C <dir>         = working directory (files land here)
#   -c key="value"   = override config.toml values per-invocation
#
# Prompt: positional arg, or stdin (pass `-` as prompt arg to read stdin)

###############################################################################
# 2. EXIT CODES (UNRELIABLE — do not use for success detection)
###############################################################################
# Exit 0:  agent finished OR was cancelled via SIGTERM (ambiguous!)
# Exit 1:  may indicate real failure OR just MCP server startup errors
#          (e.g., `zen` MCP client timeout causes exit 1 even on task success)
#
# Decision: adapter must track cancelled state internally (did we call kill?)
#           and use `turn.completed` JSONL event as the true success signal.

###############################################################################
# 3. JSONL EVENT SCHEMA (--json mode, stdout)
###############################################################################
# {"type":"thread.started","thread_id":"<uuid>"}
# {"type":"error","message":"<non-fatal error, e.g. MCP timeout>"}
# {"type":"turn.started"}
# {"type":"item.completed","item":{"id":"<id>","type":"agent_message","text":"<msg>"}}
# {"type":"item.started","item":{"id":"<id>","type":"command_execution","command":"<cmd>","aggregated_output":"","status":"in_progress"}}
# {"type":"item.completed","item":{"id":"<id>","type":"command_execution","command":"<cmd>","aggregated_output":"<output>","exit_code":0,"status":"completed"}}
# {"type":"turn.completed","usage":{"input_tokens":N,"cached_input_tokens":N,"output_tokens":N}}
#
# JSONL → OpenClaw events mapping (locked for codex-adapter.ts):
#
#   JSONL type                        → events.type  → payload shape
#   ─────────────────────────────────────────────────────────────────
#   item.completed (agent_message)    → "output"     → { stream: "stdout", chunk: item.text }
#   item.completed (command_execution)→ "output"     → { stream: "stdout", chunk: "$ " + item.command + "\n" + item.aggregated_output }
#   item.completed (file_change)      → "output"     → { stream: "stdout", chunk: "file: " + changes[].kind + " " + changes[].path }
#   item.completed (reasoning)        → (skip)       → internal model reasoning, not user-facing
#   item.started   (command_execution)→ (skip)       → not written (wait for completed with full output)
#   error                             → "output"     → { stream: "stderr", chunk: message }
#   turn.completed                    → (internal)   → sets sawTurnCompleted=true (success signal, not stored as event)
#   thread.started                    → (skip)       → not written
#   turn.started                      → (skip)       → not written
#
# Rationale: all visible output goes to events.type="output" with stream
# discrimination (stdout/stderr). This matches the fake-adapter's existing
# event shape and the SSE consumer in runs/[id]/page.tsx.

###############################################################################
# 4. COMMIT BEHAVIOR
###############################################################################
# Codex does NOT auto-commit. It uses an internal `apply_patch` tool that
# modifies the working tree directly. After a successful run:
#
#   git -C <worktree> status --porcelain    → shows dirty files (?? or M)
#   git -C <worktree> rev-parse HEAD        → unchanged from before run
#
# Worker must run:
#   git -C <worktree> add -A
#   git -C <worktree> commit -m "agent: <task-title>"
#
# Git identity must be pre-configured in worktree (ADR-6):
#   git -C <worktree> config user.name "OpenClaw Agent"
#   git -C <worktree> config user.email "agent@openclaw.local"

###############################################################################
# 5. CANCEL SEMANTICS
###############################################################################
# spawn(cmd, args, { detached: true }) → child becomes process group leader
# Cancel: process.kill(-child.pid, 'SIGTERM') → kills entire group
#
# Observed behavior:
#   - SIGTERM to process group: clean exit, no orphaned children
#   - Exit code after SIGTERM: 0 (not distinguishable from success!)
#   - No `turn.completed` event emitted on cancel (use this to distinguish)
#
# Note: the bash spike uses `pgrep -P` which only finds direct children.
# The real adapter uses Node `spawn(detached: true)` + `process.kill(-pid, 'SIGTERM')`
# which operates on OS process groups — a stronger guarantee than the spike tested.
#
# Adapter strategy:
#   let cancelled = false
#   kill() { cancelled = true; process.kill(-pid, 'SIGTERM') }
#   wait() → if cancelled, finishReason = 'cancelled'
#          → else if saw turn.completed, finishReason = 'completed'
#          → else finishReason = 'failed'

###############################################################################
# 6. MCP SERVER POLICY (DECIDED: disable in worker)
###############################################################################
# Codex loads MCP servers from ~/.codex/config.toml [mcp_servers.*]
# If a server fails to start (e.g., missing executable), Codex:
#   - Logs ERROR to stderr
#   - Emits {"type":"error","message":"MCP client for `X` failed..."} to JSON stdout
#   - Continues execution (non-fatal)
#   - Exits with code 1 even if task succeeds
#
# DECISION: Worker disables all MCP servers via -c 'mcp_servers={}'.
# VERIFIED: 2026-03-13 — with MCP disabled, exit code is 0 on success (was 1 with MCP).
# Rationale:
#   - Worker tasks are self-contained file edits — MCP tools are not needed
#   - MCP failures pollute exit codes (exit 1 on success)
#   - MCP startup adds 5-10s latency per invocation (timeout waiting for servers)
#   - Eliminates a class of non-deterministic failures from user's MCP config
#   - If MCP is needed later, add specific servers to the adapter config, not inherit user's

###############################################################################
# 7. CONFIG OVERRIDES FOR WORKER (FINAL)
###############################################################################
# Full command line:
#   codex exec --full-auto --json \
#     -c 'model_reasoning_effort="high"' \
#     -c 'mcp_servers={}' \
#     -C <worktree-path> \
#     "<prompt>"
#
# Required overrides:
#   -c 'model_reasoning_effort="high"'    # user may have invalid value like "xhigh"
#   -c 'mcp_servers={}'                   # disable MCP (see §6 decision)
#
# Optional overrides:
#   -m <model>                            # override model if needed
