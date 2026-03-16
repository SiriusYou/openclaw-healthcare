# OpenClaw Agent Swarm

Local console for orchestrating AI coding agents. Dispatch tasks to agents running in git worktrees, review their output, and merge approved changes.

## Quick Start

```bash
cp .env.example .env.local
# Edit .env.local with your credentials

bun install
bun run dev:all    # starts web console + runner worker
```

## Architecture

- **Web Console** (`bun run dev`): Next.js dashboard for managing tasks and reviewing agent output
- **Runner Worker** (`bun run worker`): Independent process that claims pending tasks, creates git worktrees, launches agents, and monitors execution
- **SQLite** (`.data/openclaw.db`): Local database for tasks, runs, and events

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Next.js dev server |
| `bun run dev:all` | Start web + worker (development) |
| `bun run start:all` | Start web + worker (production) |
| `bun run worker` | Start worker only (standalone) |
| `bun run db:push` | Push schema to SQLite |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run test` | Run unit tests |
| `bun run build` | Build for production |

## Agent Adapters

Set `AGENT_ADAPTER` in `.env.local`:

| Adapter | Status | Description |
|---------|--------|-------------|
| `fake` | **Supported** (default) | Test adapter — creates a file and exits |
| `codex` | **Supported** | OpenAI Codex CLI (`codex` binary must be on PATH) |
| `claude` | **Supported** | Claude Code CLI (`claude` binary must be on PATH) |
| `gemini` | Stub | Forward-compatibility enum value; not a valid operator target |

The worker validates the adapter at startup and will refuse to start if an unsupported adapter is selected or if the required CLI binary is missing.

## Operator Runbook

### Prerequisites

- **Node.js 20+** and **bun** installed
- For Codex adapter: `codex` CLI on PATH (install via `npm i -g @openai/codex`)
- Git repo with a clean working tree (the worker creates worktrees under `~/.openclaw-worktrees/`)

### Startup Modes

| Mode | Command | Use Case |
|------|---------|----------|
| Development | `bun run dev:all` | Web (Turbopack HMR) + worker with concurrently |
| Production | `bun run build && bun run start:all` | Optimized build + worker |
| Worker only | `AGENT_ADAPTER=codex bun run worker` | Attach worker to an existing web console |
| Web only | `bun run dev` | UI without agent execution |

### Smoke Checklist

After starting, verify the system is operational:

1. Open `http://localhost:3000/dashboard` — should show the dashboard
2. Create a task via Inbox → "New Task"
3. Check worker output for `[worker] starting claim loop` (confirms worker is running)
4. Wait for task to reach `awaiting_review` status
5. Review the diff, approve or reject
6. If approved, click Merge and verify the commit lands on the base branch

### Recovery: Failed/Cancelled Tasks

| Symptom | Cause | Fix |
|---------|-------|-----|
| Task stuck in `in_progress` | Worker crashed mid-execution | Orphan loop auto-detects after 60s stale heartbeat → marks run `orphaned` → can retry via UI |
| Task stuck in `queued` | No worker running | Start the worker: `bun run worker` |
| Run in `stale_process_blocked` | Cleanup found a still-running agent process | Kill the stale process manually, then retry the run via the UI |
| Run in `cleanup_pending` | Normal — cleanup loop will remove the worktree | Wait for cleanup loop (30s interval) or restart worker |
| Merge fails repeatedly | Git conflict on base branch | Pull latest on base branch, resolve conflict manually, then re-approve |
| Worker refuses to start | Unsupported `AGENT_ADAPTER` or missing binary | Check `.env.local` — supported values: `fake`, `codex`, `claude`. For codex/claude, ensure the CLI binary is on PATH |

### Database

SQLite database lives at `.data/openclaw.db`. To reset:

```bash
rm .data/openclaw.db
bun run db:push        # recreate schema
bun run db:bootstrap   # seed operator account
```

## Known Issues

- **Next.js 16 middleware deprecation**: Next 16 logs a warning about migrating `middleware.ts` to the new `proxy` convention. This is non-blocking and does not affect functionality.

## License

Private
