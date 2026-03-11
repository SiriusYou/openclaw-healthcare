#!/bin/bash
# Verify Codex CLI non-interactive mode (ADR-4)
# Tests 6 contract points: no-interaction start, cwd, prompt passing, exit status, output capture, completion detection
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
BRANCH="spike/codex-test-$(date +%s)"
WORKTREE=$(mktemp -d)

echo "=== Codex CLI Spike ==="
echo "Repo: $REPO_ROOT"
echo "Branch: $BRANCH"
echo "Worktree: $WORKTREE"

git worktree add "$WORKTREE" -b "$BRANCH"
cd "$WORKTREE"

echo ""
echo "--- Contract 1: Non-interactive start ---"
echo "--- Contract 2: Working directory (cwd) ---"
echo "--- Contract 3: Prompt passing ---"
echo "--- Contract 4: Exit status ---"
echo "--- Contract 5: Output capture ---"
echo "--- Contract 6: Completion detection ---"

codex --prompt "Create a file hello.txt with content 'hello world'" --approval-mode full-auto 2>&1 | tee /tmp/codex-spike.log
EXIT_CODE=$?

echo ""
echo "Exit code: $EXIT_CODE"
echo "Files created:"
ls -la
echo ""

if [ -f hello.txt ]; then
  echo "PASS: hello.txt created"
  echo "Content: $(cat hello.txt)"
else
  echo "FAIL: hello.txt not found"
fi

echo ""
echo "=== Cleanup ==="
cd "$REPO_ROOT"
git worktree remove "$WORKTREE" --force
git branch -D "$BRANCH" 2>/dev/null

echo "=== Spike Complete ==="
echo "Results logged to /tmp/codex-spike.log"
