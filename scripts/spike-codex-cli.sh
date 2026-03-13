#!/bin/bash
# Codex CLI Contract Spike (ADR-6, Step 1)
# Tests 7 contract points against `codex exec` (v0.46+)
# Results feed directly into Step 3 (codex-adapter.ts)
set -uo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
BRANCH="spike/codex-test-$(date +%s)"
WORKTREE=$(mktemp -d)
LOG_DIR="/tmp/codex-spike-$(date +%s)"
mkdir -p "$LOG_DIR"

# Finding #3: trap-based cleanup so interrupt/failure doesn't leak worktree
cleanup() {
  echo ""
  echo "=== Cleanup ==="
  cd "$REPO_ROOT"
  git worktree remove "$WORKTREE" --force 2>/dev/null || true
  git branch -D "$BRANCH" 2>/dev/null || true
  echo "=== Done ==="
}
trap cleanup EXIT

echo "=== Codex CLI Contract Spike ==="
echo "Version: $(codex --version 2>&1)"
echo "Repo:    $REPO_ROOT"
echo "Branch:  $BRANCH"
echo "Worktree: $WORKTREE"
echo "Logs:    $LOG_DIR"
echo ""

git worktree add "$WORKTREE" -b "$BRANCH" 2>&1
# Set git identity in worktree (ADR-6)
git -C "$WORKTREE" config user.name "OpenClaw Agent"
git -C "$WORKTREE" config user.email "agent@openclaw.local"

########################################################################
# Contract 1-5: Non-interactive start, cwd, prompt, exit status, output
# Override model_reasoning_effort (user config may have invalid value)
########################################################################
CODEX_OVERRIDE=(-c 'model_reasoning_effort="high"')

# Finding #1: Per-invocation commit check — snapshot HEAD before each test
echo "--- Test A: Plain text mode ---"
HEAD_A_BEFORE=$(git -C "$WORKTREE" rev-parse HEAD)

codex exec --full-auto "${CODEX_OVERRIDE[@]}" -C "$WORKTREE" \
  "Create a file hello.txt containing exactly 'hello world'. Do not create any other files." \
  > "$LOG_DIR/plain-stdout.log" 2> "$LOG_DIR/plain-stderr.log"
PLAIN_EXIT=$?

HEAD_A_AFTER=$(git -C "$WORKTREE" rev-parse HEAD)
DIRTY_A=$(git -C "$WORKTREE" status --porcelain)

echo "Exit code: $PLAIN_EXIT"
echo "stdout lines: $(wc -l < "$LOG_DIR/plain-stdout.log")"
echo "stderr lines: $(wc -l < "$LOG_DIR/plain-stderr.log")"
if [ "$HEAD_A_BEFORE" = "$HEAD_A_AFTER" ]; then
  echo "Commit: NO (HEAD unchanged)"
  echo "Dirty files: $DIRTY_A"
  COMMIT_A="no"
else
  echo "Commit: YES (HEAD moved)"
  echo "New commits:"
  git -C "$WORKTREE" log --oneline "$HEAD_A_BEFORE..$HEAD_A_AFTER"
  COMMIT_A="yes"
fi
echo ""

echo "--- Test B: JSON mode ---"
HEAD_B_BEFORE=$(git -C "$WORKTREE" rev-parse HEAD)

codex exec --full-auto --json "${CODEX_OVERRIDE[@]}" -C "$WORKTREE" \
  "Create a file goodbye.txt containing exactly 'goodbye world'. Do not create any other files." \
  > "$LOG_DIR/json-stdout.log" 2> "$LOG_DIR/json-stderr.log"
JSON_EXIT=$?

HEAD_B_AFTER=$(git -C "$WORKTREE" rev-parse HEAD)
DIRTY_B=$(git -C "$WORKTREE" status --porcelain)

echo "Exit code: $JSON_EXIT"
echo "stdout lines: $(wc -l < "$LOG_DIR/json-stdout.log")"
echo "First 5 JSONL events:"
head -5 "$LOG_DIR/json-stdout.log"
if [ "$HEAD_B_BEFORE" = "$HEAD_B_AFTER" ]; then
  echo "Commit: NO (HEAD unchanged)"
  echo "Dirty files: $DIRTY_B"
  COMMIT_B="no"
else
  echo "Commit: YES (HEAD moved)"
  echo "New commits:"
  git -C "$WORKTREE" log --oneline "$HEAD_B_BEFORE..$HEAD_B_AFTER"
  COMMIT_B="yes"
fi
echo ""

########################################################################
# File creation verification
########################################################################

echo "--- File verification ---"
for f in hello.txt goodbye.txt; do
  if [ -f "$WORKTREE/$f" ]; then
    echo "PASS: $f exists — content: $(cat "$WORKTREE/$f")"
  else
    echo "FAIL: $f not found"
  fi
done
echo ""

########################################################################
# Contract 6: Commit semantics summary (per-invocation)
########################################################################

echo "--- Contract 6: Commit semantics (per-invocation) ---"
echo "Test A (plain): commit=$COMMIT_A"
echo "Test B (json):  commit=$COMMIT_B"
if [ "$COMMIT_A" = "yes" ] && [ "$COMMIT_B" = "yes" ]; then
  COMMIT_VERDICT="Auto-commits consistently (worker can skip commit)"
elif [ "$COMMIT_A" = "no" ] && [ "$COMMIT_B" = "no" ]; then
  COMMIT_VERDICT="Does NOT auto-commit (worker must commit)"
else
  COMMIT_VERDICT="INCONSISTENT — A=$COMMIT_A, B=$COMMIT_B (investigate)"
fi
echo "Verdict: $COMMIT_VERDICT"
echo ""

########################################################################
# Contract 7: Cancel semantics (process group SIGTERM)
# Finding #2: kill process group, not just parent PID
########################################################################

echo "--- Contract 7: Cancel (process group SIGTERM) ---"
# macOS has no setsid — use perl to create a new process group leader,
# matching the worker's spawn(detached: true) which calls setpgrp().
perl -e 'use POSIX "setpgid"; setpgid(0,0); exec @ARGV' -- \
  codex exec --full-auto --json "${CODEX_OVERRIDE[@]}" -C "$WORKTREE" \
  "Write a detailed 2000-word essay about the history of computing to essay.txt. Take your time and be thorough." \
  > "$LOG_DIR/cancel-stdout.log" 2> "$LOG_DIR/cancel-stderr.log" &
CODEX_PID=$!
echo "Started long task: PID=$CODEX_PID (process group leader via perl setpgid)"

sleep 8
if kill -0 "$CODEX_PID" 2>/dev/null; then
  echo "Process alive after 8s, sending SIGTERM to process group (-$CODEX_PID)..."
  kill -TERM -- -"$CODEX_PID" 2>/dev/null || kill -TERM "$CODEX_PID" 2>/dev/null
  wait "$CODEX_PID" 2>/dev/null
  CANCEL_EXIT=$?
  echo "Exit code after group SIGTERM: $CANCEL_EXIT"

  # Check for orphaned child processes
  sleep 2
  ORPHANS=$(pgrep -P "$CODEX_PID" 2>/dev/null || true)
  if [ -n "$ORPHANS" ]; then
    echo "WARNING: Orphaned child processes after group kill: $ORPHANS"
    echo "Cleaning up orphans..."
    kill -KILL -- -"$CODEX_PID" 2>/dev/null || true
  else
    echo "Clean kill: no orphaned child processes"
  fi
else
  echo "Process already exited before SIGTERM (was too fast)"
  wait "$CODEX_PID" 2>/dev/null
  CANCEL_EXIT=$?
  echo "Exit code: $CANCEL_EXIT"
fi
echo ""

########################################################################
# Summary
########################################################################

echo "================================================================="
echo "=== CONTRACT SPIKE SUMMARY ==="
echo "================================================================="
echo ""
echo "1. Non-interactive start:  codex exec --full-auto -C <dir> '<prompt>'"
echo "2. Working directory:      -C <dir> (files created inside worktree)"
echo "3. Prompt passing:         positional arg (or stdin with '-')"
echo "4. Exit codes:             plain=$PLAIN_EXIT, json=$JSON_EXIT, cancel=$CANCEL_EXIT"
echo "5. Output format:          --json emits JSONL to stdout"
echo "6. Commit behavior:        $COMMIT_VERDICT"
echo "7. Cancel (group SIGTERM): exit=$CANCEL_EXIT, orphans=$([ -n "${ORPHANS:-}" ] && echo 'YES' || echo 'none')"
echo ""
echo "All logs in: $LOG_DIR"
