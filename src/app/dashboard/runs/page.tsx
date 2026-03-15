"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Run {
  readonly id: string
  readonly taskId: string | null
  readonly agentKind: string | null
  readonly status: string | null
  readonly attempt: number | null
  readonly branch: string | null
  readonly exitCode: number | null
  readonly finishReason: string | null
  readonly createdAt: string | null
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

const MAX_AUTO_RETRIES = 2

function statusColor(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running": return "default"
    case "succeeded": return "secondary"
    case "failed": case "orphaned": return "destructive"
    case "pending": case "claimed": return "outline"
    default: return "outline"
  }
}

function canRetry(run: Run, allRuns: readonly Run[]): boolean {
  const taskRuns = allRuns.filter((r) => r.taskId === run.taskId)
  const latestRun = taskRuns.reduce((a, b) =>
    (a.attempt ?? 0) > (b.attempt ?? 0) ? a : b
  , taskRuns[0])
  if (!latestRun || latestRun.id !== run.id) return false

  const hasActiveRun = taskRuns.some((r) =>
    ["pending", "claimed", "running"].includes(r.status ?? "")
  )
  if (hasActiveRun) return false

  if (run.status === "orphaned") return true
  if (run.status === "failed" && run.finishReason === "stale_process_blocked") return true
  if (run.status === "failed" && (run.attempt ?? 0) >= MAX_AUTO_RETRIES + 1) return true
  return false
}

export default function RunsPage() {
  const [runs, setRuns] = useState<readonly Run[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/runs")
      if (res.ok) {
        const data = await res.json()
        setRuns(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, 3000)
    return () => clearInterval(interval)
  }, [fetchRuns])

  async function handleRetry(runId: string) {
    await fetch(`/api/runs/${runId}/retry`, { method: "POST" })
    await fetchRuns()
  }

  return (
    <div data-testid="runs-root" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Runs</h2>
        <p className="text-muted-foreground">Agent execution history and live logs.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading runs...</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Runs ({runs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <Link
                      href={`/dashboard/runs/${run.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      Run {run.id.slice(0, 8)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Task {run.taskId?.slice(0, 8)} &middot; Attempt {run.attempt} &middot; {run.agentKind}
                      {run.branch && <> &middot; {run.branch}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(run.status)}>{run.status}</Badge>
                    {canRetry(run, runs) && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleRetry(run.id)}>
                          Retry
                        </Button>
                        {run.finishReason === "stale_process_blocked" && (
                          <span className="text-xs text-muted-foreground">Kill stale process first</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
