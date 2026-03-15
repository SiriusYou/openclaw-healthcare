#!/bin/bash
# Verify Claude Code CLI non-interactive mode (ADR-4 fallback)
# Tests same 6 contract points as Codex spike
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
BRANCH="spike/claude-test-$(date +%s)"
WORKTREE=$(mktemp -d)

echo "=== Claude Code CLI Spike ==="
echo "Repo: $REPO_ROOT"
echo "Branch: $BRANCH"
echo "Worktree: $WORKTREE"

git worktree add "$WORKTREE" -b "$BRANCH"
cd "$WORKTREE"

echo ""
echo "--- Contract 1-6: Non-interactive, cwd, prompt, exit, output, completion ---"

claude --dangerously-skip-permissions -p "Create a file hello.txt with content 'hello world'" 2>&1 | tee /tmp/claude-spike.log
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
echo "Results logged to /tmp/claude-spike.log"
