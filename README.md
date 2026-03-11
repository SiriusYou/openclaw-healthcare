# OpenClaw Agent Swarm

Local console for orchestrating AI coding agents. Dispatch tasks to Codex, Claude, or Gemini agents running in git worktrees, review their output, and merge approved changes.

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

- `fake` (default): Test adapter, creates a file and exits
- `codex`: OpenAI Codex CLI
- `claude`: Claude Code CLI

## License

Private
