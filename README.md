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
| `claude` | Stub | Forward-compatibility enum value; not a valid operator target |
| `gemini` | Stub | Forward-compatibility enum value; not a valid operator target |

The worker validates the adapter at startup and will refuse to start if an unsupported adapter is selected or if the required CLI binary is missing.

## Known Issues

- **Next.js 16 middleware deprecation**: Next 16 logs a warning about migrating `middleware.ts` to the new `proxy` convention. This is non-blocking and does not affect functionality.

## License

Private
